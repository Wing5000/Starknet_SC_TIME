import { useEffect, useMemo, useState } from 'react'
import { Filters, Network, TxRow, ActivityLogEntry } from './types'
import { fetchInteractions } from './lib/starknetClient'
import { kpis, methodCounts, topCallers } from './lib/aggregations'
import KpiCards from './components/KpiCards'
import TxTable from './components/TxTable'
import TopCallers from './components/TopCallers'
import MethodsHeatmap from './components/MethodsHeatmap'
import ActivityPanel from './components/ActivityPanel'

const last7=()=>{ const to=new Date(), from=new Date(Date.now()-7*24*3600*1000); return {fromDate:from.toISOString().slice(0,10), toDate:to.toISOString().slice(0,10)} }

export default function App(){
  const [filters,setFilters]=useState<Filters>({ address:'', network:'mainnet', ...last7(), type:'ALL', status:'ALL' })
  const [page,setPage]=useState(1); const pageSize=50
  const [rows,setRows]=useState<TxRow[]>([]); const [total,setTotal]=useState<number|undefined>(); const [loading,setLoading]=useState(false); const [error,setError]=useState<string|null>(null)
  const [logs,setLogs]=useState<ActivityLogEntry[]>([])
  const [panelOpen,setPanelOpen]=useState(false)
  const [lastError,setLastError]=useState<string|null>(null)

  const appendLog=(entry:Omit<ActivityLogEntry,'id'>)=>{
    setLogs(prev=>[...prev,{...entry,id:`${entry.timestamp}-${Math.random().toString(36).slice(2,8)}` }])
  }

  async function load(targetPage:number, reset=false){
    if(!filters.address) return
    setLoading(true); setError(null); setPanelOpen(true)
    const startMessage=reset?'Start: rozpoczynam odświeżone ładowanie danych.':`Start: pobieram stronę ${targetPage}.`
    appendLog({ level:'info', message:startMessage, timestamp:Date.now() })
    try{
      const fromSec=Math.floor(new Date(filters.fromDate).getTime()/1000)
      const toSec=Math.floor(new Date(filters.toDate).getTime()/1000)+86399
      const { rows:r, totalEstimated } = await fetchInteractions({ address:filters.address, network:filters.network, from:fromSec, to:toSec, page:targetPage, pageSize, filters:{ type:filters.type==='ALL'?undefined:filters.type, method:filters.method||undefined, status:filters.status==='ALL'?undefined:filters.status, minFee:filters.minFee, maxFee:filters.maxFee } })
      setRows(prev=> reset? r : [...prev, ...r]); setTotal(totalEstimated)
      appendLog({ level:'info', message:`Sukces: pobrano ${r.length} rekordów.`, timestamp:Date.now() })
      setLastError(null)
    }catch(e:any){
      const message=e?.message||'Load failed'
      setError(message)
      setLastError(message)
      appendLog({ level:'error', message:`Błąd: ${message}`, timestamp:Date.now() })
      setPanelOpen(true)
    } finally{ setLoading(false) }
  }

  useEffect(()=>{ setPage(1) },[filters.address,filters.network,filters.fromDate,filters.toDate])

  const metrics = useMemo(()=>kpis(rows),[rows])
  const top = useMemo(()=>topCallers(rows,100),[rows])
  const methods = useMemo(()=>methodCounts(rows,20),[rows])

  return (<div>
    <div className="sticky top-0 z-30 bg-white/80 dark:bg-slate-950/80 backdrop-blur border-b border-slate-200 dark:border-slate-800">
      <div className="container grid md:grid-cols-2 gap-3 py-3">
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
          <input className="col-span-2 md:col-span-3 w-full px-3 py-2 rounded-lg bg-slate-100 dark:bg-slate-900 font-mono" placeholder="0x… contract address" value={filters.address} onChange={e=>setFilters({...filters,address:e.target.value})}/>
          <select className="px-3 py-2 rounded-lg bg-slate-100 dark:bg-slate-900" value={filters.network} onChange={e=>setFilters({...filters,network:e.target.value as Network})}><option value="mainnet">Mainnet</option><option value="sepolia">Sepolia</option></select>
          <input type="date" className="px-3 py-2 rounded-lg bg-slate-100 dark:bg-slate-900" value={filters.fromDate} onChange={e=>setFilters({...filters,fromDate:e.target.value})}/>
          <input type="date" className="px-3 py-2 rounded-lg bg-slate-100 dark:bg-slate-900" value={filters.toDate} onChange={e=>setFilters({...filters,toDate:e.target.value})}/>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-6 gap-2 items-center">
          <select className="px-3 py-2 rounded-lg bg-slate-100 dark:bg-slate-900" value={filters.type} onChange={e=>setFilters({...filters,type:e.target.value as any})}>
            {['ALL','INVOKE','DECLARE','DEPLOY','L1_HANDLER'].map(t=> <option key={t} value={t}>{t}</option>)}
          </select>
          <input className="px-3 py-2 rounded-lg bg-slate-100 dark:bg-slate-900" placeholder="method (entrypoint)" value={filters.method||''} onChange={e=>setFilters({...filters,method:e.target.value})}/>
          <select className="px-3 py-2 rounded-lg bg-slate-100 dark:bg-slate-900" value={filters.status} onChange={e=>setFilters({...filters,status:e.target.value as any})}>
            {['ALL','ACCEPTED','REJECTED'].map(s=> <option key={s} value={s}>{s}</option>)}
          </select>
          <input type="number" inputMode="numeric" className="px-3 py-2 rounded-lg bg-slate-100 dark:bg-slate-900" placeholder="min fee" value={filters.minFee??''} onChange={e=>setFilters({...filters,minFee:e.target.value?Number(e.target.value):undefined})}/>
          <input type="number" inputMode="numeric" className="px-3 py-2 rounded-lg bg-slate-100 dark:bg-slate-900" placeholder="max fee" value={filters.maxFee??''} onChange={e=>setFilters({...filters,maxFee:e.target.value?Number(e.target.value):undefined})}/>
          <button onClick={()=>{ setPage(1); load(1,true) }} className="px-4 py-2 rounded-lg bg-accent text-white">Load data</button>
        </div>
      </div>
    </div>

    <main className="container py-6 grid md:grid-cols-5 gap-6">
      <section className="md:col-span-2 space-y-6">
        <KpiCards total={metrics.total} callers={metrics.callers} avgFee={metrics.avgFee} lastTs={metrics.lastTs}/>
        <TopCallers items={top}/>
        <MethodsHeatmap items={methods}/>
      </section>
      <section className="md:col-span-3 space-y-4">
        {error && (
          <div className="flex items-center justify-between rounded-lg border border-red-200 dark:border-red-800 bg-red-50/60 dark:bg-red-900/20 px-3 py-2 text-red-700 dark:text-red-300">
            <span className="text-sm">Wystąpił błąd podczas ładowania.</span>
            <button onClick={()=>setPanelOpen(true)} className="text-sm font-medium underline">Pokaż log</button>
          </div>
        )}
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800"><TxTable rows={rows}/></div>
        {!loading && rows.length>0 && <div className="flex justify-center py-4"><button onClick={()=>{ const next=page+1; setPage(next); load(next) }} className="px-4 py-2 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700">Load more</button></div>}
        {loading && <div className="text-sm text-slate-500">Loading…</div>}
      </section>
    </main>
    <ActivityPanel open={panelOpen} logs={logs} lastError={lastError} onClose={()=>setPanelOpen(false)}/>
  </div>)
}
