import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'

const mockProviderConfig: { factory: () => any } = {
  factory: () => ({})
}

vi.mock('starknet', () => ({
  RpcProvider: class {
    constructor() {
      return mockProviderConfig.factory()
    }
  },
  shortString: {
    decodeShortString: (value: string) => value
  }
}))

const createProviderImplementation = (options: {
  latestBlock: number
  blockTimestamps: Map<number, number>
  blockTransactions: Map<number, any[]>
  events?: { events: any[]; continuation_token?: string | null }
  receipts?: Record<string, any>
  traces?: Record<string, any>
}) => {
  const {
    latestBlock,
    blockTimestamps,
    blockTransactions,
    events = { events: [], continuation_token: null },
    receipts = {},
    traces = {}
  } = options

  return {
    getBlockWithTxHashes: vi.fn(async (identifier: any) => {
      if (identifier === 'latest') {
        const timestamp = blockTimestamps.get(latestBlock) ?? Math.floor(Date.now() / 1000)
        return { block_number: latestBlock, timestamp }
      }

      const blockNumber = Number(identifier)
      const timestamp = blockTimestamps.get(blockNumber)
      if (timestamp == null) throw new Error('missing block timestamp')
      return { block_number: blockNumber, timestamp }
    }),
    getEvents: vi.fn(async () => events),
    getTransactionReceipt: vi.fn(async (txHash: string) => {
      return receipts[txHash]
    }),
    getTransactionByHash: vi.fn(async () => ({ type: 'INVOKE' })),
    getBlockWithTxs: vi.fn(async (blockNumber: number) => ({
      timestamp: blockTimestamps.get(blockNumber),
      transactions: blockTransactions.get(blockNumber) ?? []
    })),
    getTransactionTrace: vi.fn(async (txHash: string) => traces[txHash])
  }
}

const ADDRESS = '0xCAFE'

describe('fetchInteractions fallback trace handling', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    vi.resetModules()
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('returns transactions discovered via fallback when budget permits', async () => {
    vi.stubEnv('VITE_MAX_TRACE_LOOKUPS', '10')

    const blockTimestamps = new Map<number, number>([
      [0, 1000],
      [1, 2000],
      [2, 3000]
    ])

    const blockTransactions = new Map<number, any[]>([
      [2, [
        { transaction_hash: '0x1', type: 'INVOKE' }
      ]]
    ])

    mockProviderConfig.factory = () => createProviderImplementation({
      latestBlock: 2,
      blockTimestamps,
      blockTransactions,
      traces: {
        '0x1': {
          invoke_tx_trace: {
            execute_invocation: {
              contract_address: ADDRESS,
              entry_point_selector: '0x123',
              caller_address: '0xBEEF'
            }
          }
        }
      },
      receipts: {
        '0x1': {
          block_number: 2,
          execution_status: 'SUCCEEDED',
          actual_fee: { amount: '0x0' },
          sender_address: '0xFF',
          type: 'INVOKE'
        }
      }
    })

    const { fetchInteractions } = await import('./starknetClient')

    const result = await fetchInteractions({
      address: ADDRESS,
      network: 'mainnet',
      from: undefined,
      to: undefined,
      page: 1,
      pageSize: 10,
      filters: {}
    })

    expect(result.rows).toHaveLength(1)
    expect(result.rows[0]).toMatchObject({ txHash: '0x1', to: ADDRESS })
    expect(result.hasMore).toBe(false)
  })

  it('sets hasMore when fallback trace budget is exhausted', async () => {
    vi.stubEnv('VITE_MAX_TRACE_LOOKUPS', '1')
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

    const blockTimestamps = new Map<number, number>([
      [0, 1000],
      [1, 2000],
      [2, 3000]
    ])

    const blockTransactions = new Map<number, any[]>([
      [2, [
        { transaction_hash: '0x1', type: 'INVOKE' }
      ]]
    ])

    mockProviderConfig.factory = () => createProviderImplementation({
      latestBlock: 2,
      blockTimestamps,
      blockTransactions,
      traces: {
        '0x1': {
          invoke_tx_trace: {
            execute_invocation: {
              contract_address: ADDRESS,
              entry_point_selector: '0x123',
              caller_address: '0xBEEF'
            }
          }
        }
      },
      receipts: {
        '0x1': {
          block_number: 2,
          execution_status: 'SUCCEEDED',
          actual_fee: { amount: '0x0' },
          sender_address: '0xFF',
          type: 'INVOKE'
        }
      }
    })

    const { fetchInteractions } = await import('./starknetClient')

    const result = await fetchInteractions({
      address: ADDRESS,
      network: 'mainnet',
      from: undefined,
      to: undefined,
      page: 1,
      pageSize: 10,
      filters: {}
    })

    expect(result.rows).toHaveLength(0)
    expect(result.hasMore).toBe(true)
    expect(warnSpy).toHaveBeenCalled()
  })
})
