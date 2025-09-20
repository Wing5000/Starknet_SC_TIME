import { fmtFee, fmtNum, fmtTime } from '../lib/format'
export default function KpiCards({ total, callers, avgFee, lastTs }:{ total:number; callers:number; avgFee:number; lastTs:number }){
  const items=[{label:'Interakcje',value:fmtNum(total)},{label:'Unikalni callerzy',value:fmtNum(callers)},{label:'Średnie fee',value:fmtFee(avgFee)},{label:'Ostatnia aktywność',value:lastTs?fmtTime(lastTs):'—'}]
  return (<div className="grid grid-cols-2 md:grid-cols-4 gap-3">{items.map((it,i)=>(<div key={i} className="rounded-2xl p-4 bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800"><div className="text-xs text-slate-500">{it.label}</div><div className="text-2xl font-semibold mt-1">{it.value}</div></div>))}</div>)
}
