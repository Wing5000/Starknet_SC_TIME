import { RpcProvider } from 'starknet'
import { TxRow, Network, TxStatus, TxType } from '../types'

const RPCS: Record<Network, string> = {
  mainnet: import.meta.env.VITE_STARKNET_RPC_MAINNET || 'https://starknet-mainnet.public.blastapi.io/rpc/v0_7',
  sepolia: import.meta.env.VITE_STARKNET_RPC_SEPOLIA || 'https://starknet-sepolia.public.blastapi.io/rpc/v0_7'
}

export interface FetchParams {
  address: string; network: Network; from: number; to: number; page: number; pageSize: number;
  filters: Partial<{ type: TxType | 'ALL'; method: string; status: TxStatus | 'ALL'; minFee: number; maxFee: number }>
}
export interface FetchResult { rows: TxRow[]; totalEstimated?: number }

export async function fetchInteractions(p: FetchParams): Promise<FetchResult> {
  const provider = new RpcProvider({ nodeUrl: RPCS[p.network] })
  const rows: TxRow[] = []
  const latest = await provider.getBlockNumber()
  const lookback = 400

  for (let n = latest; n >= Math.max(0, latest - lookback); n--) {
    const b = await provider.getBlockWithTxs(n)
    for (const tx of (b as any).transactions as any[]) {
      const to = (tx as any).calldata?.[0] || (tx as any).contract_address
      if (!to) continue
      if (String(to).toLowerCase() !== p.address.toLowerCase()) continue
      const type: TxType = (tx.type || 'INVOKE').toUpperCase()
      const entrypoint = (tx.entry_point_selector_name || tx.entry_point_selector || undefined) as string | undefined
      const caller = (tx.sender_address || tx.sender || '0x0') as string
      const status: TxStatus = 'ACCEPTED'
      const fee = Number((tx.max_fee || 0))
      rows.push({ timestamp: Math.floor(((b as any).timestamp as number) || Date.now()/1000), txHash: (tx as any).transaction_hash || (tx as any).hash, type, entrypoint, caller, to: p.address, fee, status, network: p.network })
    }
  }

  const filtered = rows
    .filter(r => p.filters.type && p.filters.type !== 'ALL' ? r.type === p.filters.type : true)
    .filter(r => p.filters.method ? (r.entrypoint || '—') === p.filters.method : true)
    .filter(r => p.filters.status && p.filters.status !== 'ALL' ? r.status === p.filters.status : true)
    .filter(r => p.filters.minFee != null ? r.fee >= p.filters.minFee! : true)
    .filter(r => p.filters.maxFee != null ? r.fee <= p.filters.maxFee! : true)

  const start = (p.page - 1) * p.pageSize
  return { rows: filtered.slice(start, start + p.pageSize), totalEstimated: filtered.length }
}
