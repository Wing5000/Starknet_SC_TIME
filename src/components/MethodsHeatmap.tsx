export default function MethodsHeatmap({ items }:{ items:{ name:string; count:number }[]}){
  const total = items.reduce((s,i)=>s+i.count,0)||1
  return (<div><h3 className="text-sm font-semibold mb-2">Contract methods</h3><div className="grid grid-cols-4 gap-2">{items.map(it=>(<div key={it.name} className="rounded-xl border border-slate-200 dark:border-slate-800 p-3"><div className="text-xs text-slate-500 truncate" title={it.name}>{it.name}</div><div className="mt-2 h-2 bg-slate-100 dark:bg-slate-800 rounded"><div className="h-2 bg-accent rounded" style={{width:`${(it.count/total)*100}%`}}/></div><div className="text-xs mt-1">{it.count}</div></div>))}</div></div>)
}
