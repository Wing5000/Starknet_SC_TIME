import { RpcProvider, shortString } from 'starknet'
import { TxRow, Network, TxStatus, TxType } from '../types'

const RPCS: Record<Network, string> = {
  mainnet: import.meta.env.VITE_STARKNET_RPC_MAINNET || 'https://starknet-mainnet.public.blastapi.io/rpc/v0_8',
  sepolia: import.meta.env.VITE_STARKNET_RPC_SEPOLIA || 'https://starknet-sepolia.public.blastapi.io/rpc/v0_8'
}

export interface FetchParams {
  address: string; network: Network; from: number; to: number; page: number; pageSize: number;
  filters: Partial<{ type: TxType | 'ALL'; method: string; status: TxStatus | 'ALL'; minFee: number; maxFee: number }>
}
export interface FetchResult { rows: TxRow[]; totalEstimated?: number }

export async function fetchInteractions(p: FetchParams): Promise<FetchResult> {
  const provider = new RpcProvider({ nodeUrl: RPCS[p.network] })
  const continuationTarget = p.page * p.pageSize
  const rows: TxRow[] = []
  const seenTx = new Set<string>()
  const blockTimestampCache = new Map<number, number>()
  const addressLower = p.address.toLowerCase()

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
    const block = await provider.getBlockWithTxHashes(blockNumber)
    const timestamp = Number((block as any).timestamp ?? Math.floor(Date.now() / 1000))
    blockTimestampCache.set(blockNumber, timestamp)
    return timestamp
  }

  let continuation: string | undefined
  const chunkSize = Math.max(100, p.pageSize)

  do {
    const { events, continuation_token } = await provider.getEvents({
      address: p.address,
      chunk_size: chunkSize,
      continuation_token: continuation
    })

    continuation = continuation_token

    for (const event of events) {
      const txHash = (event as any).transaction_hash as string | undefined
      if (!txHash || seenTx.has(txHash)) continue
      seenTx.add(txHash)

      try {
        const receipt = await provider.getTransactionReceipt(txHash) as any
        if (!receipt) continue

        const timestamp = await getBlockTimestamp(receipt.block_number ?? (event as any).block_number)
        if (p.from != null && timestamp < p.from) continue
        if (p.to != null && timestamp > p.to) continue

        const tx = await provider.getTransactionByHash(txHash) as any
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

        if (matchesFilters(row)) {
          rows.push(row)
        }
      } catch {
        continue
      }

      if (rows.length >= continuationTarget) break
    }
  } while (rows.length < continuationTarget && continuation)

  rows.sort((a, b) => b.timestamp - a.timestamp)

  const start = (p.page - 1) * p.pageSize
  const paged = rows.slice(start, start + p.pageSize)

  return {
    rows: paged,
    totalEstimated: rows.length
  }
}
