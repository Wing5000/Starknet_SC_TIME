import { ActivityLogEntry } from '../types'

type ActivityPanelProps = {
  open:boolean
  logs:ActivityLogEntry[]
  lastError:string|null
  onClose:()=>void
}

export default function ActivityPanel({ open, logs, lastError, onClose }:ActivityPanelProps){
  if(!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4">
      <div className="w-full max-w-2xl rounded-2xl bg-white dark:bg-slate-900 shadow-xl border border-slate-200 dark:border-slate-800">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-slate-800">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Activity log</h2>
          <button onClick={onClose} className="text-sm text-slate-500 hover:text-slate-800 dark:hover:text-slate-200">Close</button>
        </div>
        <div className="max-h-96 overflow-y-auto px-5 py-4 space-y-3 text-sm">
          {logs.length===0 && <p className="text-slate-500">No activity yet.</p>}
          {logs.map(entry=> {
            const color = entry.level==='error'
              ? 'bg-red-500'
              : entry.level==='warn'
                ? 'bg-amber-500'
                : 'bg-emerald-500'

            return (
              <div key={entry.id} className="flex items-start gap-3">
                <span className={`mt-0.5 h-2.5 w-2.5 rounded-full ${color}`}></span>
                <div>
                  <p className="font-medium text-slate-900 dark:text-slate-100">{new Date(entry.timestamp).toLocaleTimeString()} – {entry.message}</p>
                  <p className="text-xs text-slate-500">{entry.level.toUpperCase()}</p>
                </div>
              </div>
            )
          })}
        </div>
        <div className="border-t border-slate-200 dark:border-slate-800 px-5 py-4 space-y-2">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Last error</h3>
          <p className="text-sm text-slate-500 break-words">{lastError ?? 'No errors recorded.'}</p>
        </div>
      </div>
    </div>
  )
}
