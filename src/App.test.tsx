// @vitest-environment jsdom

import { describe, expect, it, beforeEach, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import App from './App'
import { fetchInteractions } from './lib/starknetClient'

type FetchInteractionsParams = Parameters<typeof fetchInteractions>[0]

type FetchInteractionsReturn = Awaited<ReturnType<typeof fetchInteractions>>

const mockRow: FetchInteractionsReturn['rows'][number] = {
  timestamp: 1_700_000_000,
  txHash: '0xabc123def4567890',
  type: 'INVOKE',
  entrypoint: 'do_something',
  caller: '0x1111222233334444',
  to: '0x9999',
  fee: 42,
  status: 'ACCEPTED',
  network: 'mainnet'
}

vi.mock('./lib/starknetClient', () => ({
  fetchInteractions: vi.fn()
}))

const mockFetch = vi.mocked(fetchInteractions)

beforeEach(() => {
  mockFetch.mockReset()
  mockFetch.mockResolvedValue({ rows: [mockRow], totalEstimated: 1, hasMore: false })
})

describe('App date filters', () => {
  it('omits invalid date ranges and still loads data', async () => {
    const user = userEvent.setup()
    render(<App />)

    const addressInput = screen.getByPlaceholderText('0x… contract address')
    await user.type(addressInput, '0xCAFEBABE')

    const dateInputs = Array.from(document.querySelectorAll('input[type="date"]')) as HTMLInputElement[]
    expect(dateInputs).toHaveLength(2)

    await user.clear(dateInputs[0])
    await user.clear(dateInputs[1])

    await user.click(screen.getByRole('button', { name: /load data/i }))

    await screen.findByText(/Sukces: pobrano 1 rekordów\./)

    expect(mockFetch).toHaveBeenCalledTimes(1)
    const params = mockFetch.mock.calls[0][0]
    expect(params.from).toBeUndefined()
    expect(params.to).toBeUndefined()
  })
})
