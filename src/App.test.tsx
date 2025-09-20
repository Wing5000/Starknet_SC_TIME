import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, afterEach } from 'vitest'
import App from './App'
import { fetchInteractions } from './lib/starknetClient'
import type { TxRow } from './types'

vi.mock('./lib/starknetClient', () => ({
  fetchInteractions: vi.fn(),
}))

afterEach(() => {
  vi.clearAllMocks()
})

describe('App date filter', () => {
  it('loads rows filtered by date range', async () => {
    const sampleRows: TxRow[] = [
      {
        timestamp: Math.floor(new Date('2024-01-06T00:00:00Z').getTime() / 1000),
        txHash: '0x1',
        type: 'INVOKE',
        entrypoint: 'transfer',
        caller: '0xabc',
        to: '0x123',
        fee: 100,
        status: 'ACCEPTED',
        network: 'mainnet',
      },
      {
        timestamp: Math.floor(new Date('2024-01-03T00:00:00Z').getTime() / 1000),
        txHash: '0x2',
        type: 'INVOKE',
        entrypoint: 'approve',
        caller: '0xdef',
        to: '0x123',
        fee: 200,
        status: 'ACCEPTED',
        network: 'mainnet',
      },
    ]

    const mockedFetch = vi.mocked(fetchInteractions)
    mockedFetch.mockResolvedValue({ rows: sampleRows, totalEstimated: sampleRows.length })

    render(<App />)

    fireEvent.change(screen.getByPlaceholderText('0x… contract address'), { target: { value: '0x123' } })
    const [fromInput, toInput] = screen.getAllByDisplayValue(/\d{4}-\d{2}-\d{2}/)
    fireEvent.change(fromInput, { target: { value: '2024-01-01' } })
    fireEvent.change(toInput, { target: { value: '2024-01-08' } })
    fireEvent.click(screen.getByRole('button', { name: /load data/i }))

    await waitFor(() => expect(mockedFetch).toHaveBeenCalledTimes(1))

    const expectedFrom = Math.floor(new Date('2024-01-01T00:00:00Z').getTime() / 1000)
    const expectedTo = Math.floor(new Date('2024-01-08T00:00:00Z').getTime() / 1000) + 86399

    expect(mockedFetch).toHaveBeenCalledWith(expect.objectContaining({
      address: '0x123',
      from: expectedFrom,
      to: expectedTo,
    }))

    await waitFor(() => {
      expect(screen.getAllByText('Open')).toHaveLength(sampleRows.length)
    })
  })
})
