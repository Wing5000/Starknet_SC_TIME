import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fetchInteractions } from './starknetClient'
import { shortString } from 'starknet'

const providerFactory = vi.fn()

vi.mock('starknet', async () => {
  const actual = await vi.importActual<typeof import('starknet')>('starknet')
  return {
    ...actual,
    RpcProvider: class {
      constructor() {
        return providerFactory()
      }
    }
  }
})

describe('fetchInteractions', () => {
  beforeEach(() => {
    providerFactory.mockReset()
  })

  it('includes transactions without events', async () => {
    const targetAddress = '0xcontract'
    const txHash = '0xabc'

    const mockProvider = {
      getBlockWithTxHashes: vi.fn(async (id: any) => {
        if (id === 'latest') {
          return { block_number: 0, timestamp: 1000 }
        }
        if (id === 0) {
          return { block_number: 0, timestamp: 1000 }
        }
        throw new Error(`unexpected block request: ${String(id)}`)
      }),
      getEvents: vi.fn(async () => ({ events: [], continuation_token: null })),
      getBlockWithTxs: vi.fn(async (blockNumber: number) => {
        if (blockNumber !== 0) throw new Error('unexpected block number')
        return {
          block_number: 0,
          timestamp: 1000,
          transactions: [
            { transaction_hash: txHash, type: 'INVOKE' }
          ]
        }
      }),
      getTransactionTrace: vi.fn(async () => ({
        invoke_tx_trace: {
          type: 'INVOKE',
          execute_invocation: {
            contract_address: targetAddress,
            entry_point_selector: shortString.encodeShortString('ping'),
            caller_address: '0xcaller',
            calls: []
          }
        }
      })),
      getTransactionReceipt: vi.fn(async () => ({
        block_number: 0,
        sender_address: '0xaccount',
        actual_fee: { amount: '0x10' },
        execution_status: 'SUCCEEDED'
      })),
      getTransactionByHash: vi.fn()
    }

    providerFactory.mockReturnValue(mockProvider)

    const result = await fetchInteractions({
      address: targetAddress,
      network: 'sepolia',
      from: 0,
      to: 2000,
      page: 1,
      pageSize: 10,
      filters: {}
    })

    expect(mockProvider.getEvents).toHaveBeenCalled()
    expect(mockProvider.getBlockWithTxs).toHaveBeenCalledWith(0)
    expect(mockProvider.getTransactionTrace).toHaveBeenCalledWith(txHash)

    expect(result.rows).toHaveLength(1)
    const row = result.rows[0]
    expect(row.txHash).toBe(txHash)
    expect(row.entrypoint).toBe('ping')
    expect(row.caller.toLowerCase()).toBe('0xcaller')
    expect(row.to.toLowerCase()).toBe(targetAddress.toLowerCase())
    expect(row.fee).toBe(Number(BigInt('0x10')))
    expect(row.status).toBe('ACCEPTED')
    expect(result.totalEstimated).toBe(1)
    expect(result.hasMore).toBe(false)
  })
})
