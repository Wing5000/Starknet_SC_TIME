import { RpcProvider, shortString } from 'starknet'
import { TxRow, Network, TxStatus, TxType, ActivityLogLevel } from '../types'

const DEFAULT_MAX_TRACE_LOOKUPS = 200
const MAX_RPC_RETRIES = 4
const BASE_RETRY_DELAY_MS = 500
const MAX_RETRY_DELAY_MS = 10_000

type RetryLogEntry = { level: ActivityLogLevel; message: string }
type RetryLogger = (entry: RetryLogEntry) => void

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms))

const parseRetryAfterHeader = (value: unknown): number | undefined => {
  if (value == null) return undefined
  if (typeof value === 'number' && Number.isFinite(value)) {
    return Math.max(0, value) * 1000
  }

  const stringValue = Array.isArray(value) ? String(value[0]) : String(value)
  if (!stringValue) return undefined

  const seconds = Number(stringValue)
  if (Number.isFinite(seconds)) {
    return Math.max(0, seconds) * 1000
  }

  const asDate = Date.parse(stringValue)
  if (!Number.isNaN(asDate)) {
    const diff = asDate - Date.now()
    return diff > 0 ? diff : 0
  }

  return undefined
}

const getRetryDelayMs = (error: unknown, attempt: number): number => {
  const headers = (error as any)?.response?.headers ?? {}
  const retryAfterHeader = headers['retry-after'] ?? headers['Retry-After']
  const retryAfterMs = parseRetryAfterHeader(retryAfterHeader)
  if (retryAfterMs != null) return retryAfterMs
  const exponential = BASE_RETRY_DELAY_MS * 2 ** (attempt - 1)
  return Math.min(exponential, MAX_RETRY_DELAY_MS)
}

const isRateLimitError = (error: unknown): boolean => {
  if (!error || typeof error !== 'object') return false
  const status = (error as any)?.response?.status ?? (error as any)?.status
  if (status === 429) return true
  const code = (error as any)?.code
  if (code === 429 || Number(code) === 429) return true
  const message = String((error as any)?.message ?? '')
  return message.includes('429') || message.toLowerCase().includes('rate limit')
}

interface RetryOptions {
  method: string
  maxAttempts?: number
  log?: RetryLogger
}

async function callRpcWithRetry<T>(factory: () => Promise<T>, options: RetryOptions): Promise<T> {
  const { method, maxAttempts = MAX_RPC_RETRIES, log } = options

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await factory()
    } catch (error) {
      if (!isRateLimitError(error)) {
        throw error
      }

      if (attempt >= maxAttempts) {
        log?.({ level: 'error', message: `[${method}] Rate limit exceeded after ${attempt} attempts.` })
        throw error
      }

      const delayMs = getRetryDelayMs(error, attempt)
      const delaySeconds = delayMs >= 1000 ? `${(delayMs / 1000).toFixed(1)}s` : `${delayMs}ms`
      log?.({ level: 'warn', message: `[${method}] Rate limited (attempt ${attempt}). Retrying in ${delaySeconds}.` })
      await sleep(delayMs)
    }
  }

  throw new Error(`[${method}] RPC retry exhausted`)
}
const configuredLookupLimit = Number(
  (import.meta as any)?.env?.VITE_MAX_TRACE_LOOKUPS ?? DEFAULT_MAX_TRACE_LOOKUPS
)
export const MAX_TRACE_LOOKUPS = Number.isFinite(configuredLookupLimit) && configuredLookupLimit > 0
  ? configuredLookupLimit
  : DEFAULT_MAX_TRACE_LOOKUPS

const RPCS: Record<Network, string> = {
  mainnet: import.meta.env.VITE_STARKNET_RPC_MAINNET || 'https://starknet-mainnet.public.blastapi.io/rpc/v0_8',
  sepolia: import.meta.env.VITE_STARKNET_RPC_SEPOLIA || 'https://starknet-sepolia.public.blastapi.io/rpc/v0_8'
}

export interface FetchParams {
  address: string; network: Network; from?: number; to?: number; page: number; pageSize: number;
  filters: Partial<{ type: TxType | 'ALL'; method: string; status: TxStatus | 'ALL'; minFee: number; maxFee: number }>
  log?: RetryLogger
}
export interface FetchResult { rows: TxRow[]; totalEstimated?: number; hasMore?: boolean }

export async function fetchInteractions(p: FetchParams): Promise<FetchResult> {
  const provider = new RpcProvider({ nodeUrl: RPCS[p.network] })
  const allRows: TxRow[] = []
  const seenTx = new Set<string>()
  const blockTimestampCache = new Map<number, number>()
  const addressLower = p.address.toLowerCase()
  const noopLog: RetryLogger = () => {}
  const log = p.log ?? noopLog
  const callWithRetry = <T>(factory: () => Promise<T>, method: string) => callRpcWithRetry(factory, { method, log })

  const decodeSelector = (value?: string): string | undefined => {
    if (!value) return undefined
    if (!value.startsWith('0x')) return value
    try {
      return shortString.decodeShortString(value)
    } catch {
      return value
    }
  }

  const toTxType = (value?: string): TxType => {
    const normalized = (value || 'INVOKE').toUpperCase()
    if (normalized === 'DECLARE') return 'DECLARE'
    if (normalized === 'DEPLOY' || normalized === 'DEPLOY_ACCOUNT') return 'DEPLOY'
    if (normalized === 'L1_HANDLER') return 'L1_HANDLER'
    return 'INVOKE'
  }

  const toFee = (amount?: string): number => {
    if (!amount) return 0
    try {
      return Number(BigInt(amount))
    } catch {
      return 0
    }
  }

  const matchesFilters = (row: TxRow): boolean => {
    if (p.filters.type && p.filters.type !== 'ALL' && row.type !== p.filters.type) return false
    if (p.filters.method && (row.entrypoint || '—') !== p.filters.method) return false
    if (p.filters.status && p.filters.status !== 'ALL' && row.status !== p.filters.status) return false
    if (p.filters.minFee != null && row.fee < p.filters.minFee) return false
    if (p.filters.maxFee != null && row.fee > p.filters.maxFee) return false
    return true
  }

  const getBlockTimestamp = async (blockNumber?: number): Promise<number> => {
    if (blockNumber == null) return Math.floor(Date.now() / 1000)
    if (blockTimestampCache.has(blockNumber)) return blockTimestampCache.get(blockNumber)!
    const block = await callWithRetry(() => provider.getBlockWithTxHashes(blockNumber), 'getBlockWithTxHashes')
    const timestamp = Number((block as any).timestamp ?? Math.floor(Date.now() / 1000))
    blockTimestampCache.set(blockNumber, timestamp)
    return timestamp
  }

  const latestBlock = await callWithRetry(() => provider.getBlockWithTxHashes('latest' as any), 'getBlockWithTxHashes')
  const latestBlockNumber = Number((latestBlock as any).block_number ?? 0)
  const latestTimestamp = Number((latestBlock as any).timestamp ?? Math.floor(Date.now() / 1000))
  blockTimestampCache.set(latestBlockNumber, latestTimestamp)
  const earliestTimestamp = await getBlockTimestamp(0)

  const findBoundaryBlock = async (
    targetTimestamp: number | undefined,
    type: 'from' | 'to'
  ): Promise<number | undefined> => {
    if (targetTimestamp == null) {
      return type === 'from' ? 0 : latestBlockNumber
    }

    if (type === 'from') {
      if (targetTimestamp > latestTimestamp) return undefined
      if (targetTimestamp <= earliestTimestamp) return 0
    } else {
      if (targetTimestamp < earliestTimestamp) return undefined
      if (targetTimestamp >= latestTimestamp) return latestBlockNumber
    }

    let low = 0
    let high = latestBlockNumber
    let result = type === 'from' ? latestBlockNumber : 0

    while (low <= high) {
      const mid = Math.floor((low + high) / 2)
      const timestamp = await getBlockTimestamp(mid)

      if (type === 'from') {
        if (timestamp >= targetTimestamp) {
          result = mid
          high = mid - 1
        } else {
          low = mid + 1
        }
      } else {
        if (timestamp <= targetTimestamp) {
          result = mid
          low = mid + 1
        } else {
          high = mid - 1
        }
      }
    }

    return result
  }

  const fromBlock = await findBoundaryBlock(p.from, 'from')
  const toBlock = await findBoundaryBlock(p.to, 'to')

  if ((p.from != null && fromBlock == null) || (p.to != null && toBlock == null)) {
    return { rows: [], totalEstimated: 0 }
  }

  if (fromBlock != null && toBlock != null && fromBlock > toBlock) {
    return { rows: [], totalEstimated: 0 }
  }

  let continuation: string | undefined
  const chunkSize = Math.max(100, p.pageSize)

  let matchingRowCount = 0
  let reachedLimit = false
  const limit = p.page * p.pageSize
  let nextContinuationToken: string | undefined

  const addRow = (row: TxRow): boolean => {
    if (seenTx.has(row.txHash)) return false
    seenTx.add(row.txHash)
    allRows.push(row)

    const matches = matchesFilters(row)
      && (p.from == null || row.timestamp >= p.from)
      && (p.to == null || row.timestamp <= p.to)

    if (matches) {
      matchingRowCount += 1
      if (limit > 0 && matchingRowCount >= limit) {
        reachedLimit = true
      }
    }

    return true
  }

  const findInvocationForAddress = (invocation: any): any | undefined => {
    if (!invocation || typeof invocation !== 'object') return undefined

    const contractAddress = String(invocation.contract_address || '').toLowerCase()
    if (contractAddress === addressLower) return invocation

    if (Array.isArray(invocation.calls)) {
      for (const nested of invocation.calls) {
        const found = findInvocationForAddress(nested)
        if (found) return found
      }
    }

    return undefined
  }

  const extractInvocationFromTrace = (trace: any): any | undefined => {
    if (!trace || typeof trace !== 'object') return undefined

    const tryInvocation = (candidate: any): any | undefined => {
      return findInvocationForAddress(candidate)
    }

    const invokeTrace = trace.invoke_tx_trace
    if (invokeTrace && typeof invokeTrace === 'object') {
      const execution = invokeTrace.execute_invocation
      if (execution && typeof execution === 'object' && 'contract_address' in execution) {
        const found = tryInvocation(execution)
        if (found) return found
      }
    }

    const deployTrace = trace.deploy_account_tx_trace
    if (deployTrace && typeof deployTrace === 'object') {
      const found = tryInvocation(deployTrace.constructor_invocation)
      if (found) return found
    }

    const l1HandlerTrace = trace.l1_handler_tx_trace
    if (l1HandlerTrace && typeof l1HandlerTrace === 'object') {
      const found = tryInvocation(l1HandlerTrace.function_invocation)
      if (found) return found
    }

    const declareTrace = trace.declare_tx_trace
    if (declareTrace && typeof declareTrace === 'object') {
      const found = tryInvocation(declareTrace.validate_invocation)
      if (found) return found
    }

    return undefined
  }

  do {
    const { events, continuation_token } = await callWithRetry(() => provider.getEvents({
      address: p.address,
      chunk_size: chunkSize,
      continuation_token: continuation,
      ...(fromBlock != null ? { from_block: { block_number: fromBlock } } : {}),
      ...(toBlock != null ? { to_block: { block_number: toBlock } } : {})
    }), 'getEvents')

    continuation = continuation_token ?? undefined
    nextContinuationToken = continuation

    for (const event of events) {
      const txHash = (event as any).transaction_hash as string | undefined
      if (!txHash || seenTx.has(txHash)) continue

      try {
        const receipt = await callWithRetry(() => provider.getTransactionReceipt(txHash), 'getTransactionReceipt') as any
        if (!receipt) continue

        const timestamp = await getBlockTimestamp(receipt.block_number ?? (event as any).block_number)

        const tx = await callWithRetry(() => provider.getTransactionByHash(txHash), 'getTransactionByHash') as any
        const eventForContract = Array.isArray(receipt.events)
          ? receipt.events.find((e: any) => String(e.from_address || '').toLowerCase() === addressLower)
          : undefined

        const entrypoint = decodeSelector(
          (tx && (tx.entry_point_selector_name || tx.entry_point_selector))
            || (eventForContract && eventForContract.keys && eventForContract.keys[0])
        )

        const caller = (receipt.sender_address || tx?.sender_address || tx?.contract_address || '0x0') as string
        const type = toTxType(receipt.type || tx?.type)
        const status: TxStatus = (receipt.execution_status === 'REVERTED' || receipt.revert_reason) ? 'REJECTED' : 'ACCEPTED'
        const fee = toFee(receipt.actual_fee?.amount)

        const row: TxRow = {
          timestamp,
          txHash,
          type,
          entrypoint,
          caller,
          to: p.address,
          fee,
          status,
          network: p.network
        }

        const added = addRow(row)
        if (added && reachedLimit) {
          continuation = undefined
          break
        }
      } catch {
        continue
      }
    }
  } while (continuation)

  const blockRangeStart = fromBlock ?? 0
  const blockRangeEnd = toBlock ?? latestBlockNumber
  let txScanComplete = true
  let fallbackBudgetExhausted = false
  let remainingTraceLookups = MAX_TRACE_LOOKUPS

  for (let blockNumber = blockRangeEnd; blockNumber >= blockRangeStart; blockNumber -= 1) {
    if (reachedLimit) {
      txScanComplete = false
      break
    }

    if (remainingTraceLookups <= 0) {
      txScanComplete = false
      fallbackBudgetExhausted = true
      break
    }

    let block: any

    try {
      block = await callWithRetry(() => provider.getBlockWithTxs(blockNumber), 'getBlockWithTxs')
      remainingTraceLookups -= 1
    } catch {
      continue
    }

    const blockTimestamp = Number((block as any)?.timestamp ?? Math.floor(Date.now() / 1000))
    blockTimestampCache.set(blockNumber, blockTimestamp)

    const transactions: any[] = Array.isArray((block as any)?.transactions) ? (block as any).transactions : []
    const unseenTransactions = transactions.filter((tx: any) => {
      const hash = (tx as any)?.transaction_hash || (tx as any)?.hash
      return Boolean(hash) && !seenTx.has(hash)
    })

    if (unseenTransactions.length === 0) {
      continue
    }

    for (const tx of unseenTransactions) {
      if (reachedLimit) {
        txScanComplete = false
        break
      }

      if (remainingTraceLookups <= 0) {
        txScanComplete = false
        fallbackBudgetExhausted = true
        break
      }

      const txHash = (tx as any)?.transaction_hash || (tx as any)?.hash
      if (!txHash) continue

      try {
        const trace = await callWithRetry(() => provider.getTransactionTrace(txHash), 'getTransactionTrace')
        remainingTraceLookups -= 1
        const invocation = extractInvocationFromTrace(trace)
        if (!invocation) continue

        const contractAddress = String(invocation.contract_address || '').toLowerCase()
        if (contractAddress !== addressLower) continue

        const receipt = await callWithRetry(() => provider.getTransactionReceipt(txHash), 'getTransactionReceipt') as any
        if (!receipt) continue

        const timestamp = await getBlockTimestamp(receipt.block_number ?? blockNumber)
        const type = toTxType(receipt.type || (tx as any)?.type)
        const status: TxStatus = (receipt.execution_status === 'REVERTED' || receipt.revert_reason) ? 'REJECTED' : 'ACCEPTED'
        const fee = toFee(receipt.actual_fee?.amount)
        const entrypoint = decodeSelector(
          invocation.entry_point_selector_name
            || invocation.entry_point_selector
            || invocation.selector
        )
        const caller = (invocation.caller_address
          || receipt.sender_address
          || (tx as any)?.sender_address
          || (tx as any)?.contract_address
          || '0x0') as string

        const row: TxRow = {
          timestamp,
          txHash,
          type,
          entrypoint,
          caller,
          to: invocation.contract_address || p.address,
          fee,
          status,
          network: p.network
        }

        addRow(row)
      } catch {
        continue
      }
    }

    if (!txScanComplete || fallbackBudgetExhausted) break
  }

  if (fallbackBudgetExhausted) {
    console.warn('[starknetClient] Trace lookup budget exhausted during fallback scan')
  }

  const filteredRows = allRows.filter((row) => {
    if (!matchesFilters(row)) return false
    if (p.from != null && row.timestamp < p.from) return false
    if (p.to != null && row.timestamp > p.to) return false
    return true
  })

  filteredRows.sort((a, b) => b.timestamp - a.timestamp)

  const start = (p.page - 1) * p.pageSize
  const paged = filteredRows.slice(start, start + p.pageSize)

  return {
    rows: paged,
    totalEstimated: filteredRows.length,
    hasMore:
      (start + p.pageSize < filteredRows.length)
      || reachedLimit
      || Boolean(nextContinuationToken)
      || !txScanComplete
  }
}
