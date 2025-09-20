import { fmtAddr, fmtFee, fmtHash, fmtTime } from '../lib/format'
import { txLink } from '../lib/explorer'
import { TxRow } from '../types'
import Badge from './Badge'
export default function TxTable({ rows }:{ rows:TxRow[] }){
  if(!rows.length) return <div className="text-sm text-slate-500 py-6">Brak danych w wybranym zakresie.</div>
  return (<div className="overflow-x-auto"><table className="min-w-full text-sm"><thead className="text-left text-slate-500"><tr><th className="py-2 pr-4">time</th><th className="py-2 pr-4">tx hash</th><th className="py-2 pr-4">type</th><th className="py-2 pr-4">method</th><th className="py-2 pr-4">caller</th><th className="py-2 pr-4">fee</th><th className="py-2 pr-4">status</th><th className="py-2 pr-4">explorer</th></tr></thead><tbody>{rows.map(r=>(<tr key={r.txHash} className="border-t border-slate-100 dark:border-slate-800"><td className="py-2 pr-4 whitespace-nowrap">{fmtTime(r.timestamp)}</td><td className="py-2 pr-4"><span className="font-mono">{fmtHash(r.txHash)}</span></td><td className="py-2 pr-4"><Badge tone={{INVOKE:'blue',DECLARE:'slate',DEPLOY:'green',L1_HANDLER:'red'}[r.type] as any}>{r.type}</Badge></td><td className="py-2 pr-4">{r.entrypoint||'—'}</td><td className="py-2 pr-4"><span className="font-mono">{fmtAddr(r.caller)}</span></td><td className="py-2 pr-4">{fmtFee(r.fee)}</td><td className="py-2 pr-4">{r.status}</td><td className="py-2 pr-4"><a className="text-accent hover:underline" target="_blank" href={txLink(r.network, r.txHash)}>Open</a></td></tr>))}</tbody></table></div>)
}
