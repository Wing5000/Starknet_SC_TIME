import { clsx } from 'clsx'
export default function Badge({ children, tone='slate' }:{ children:React.ReactNode; tone?:'green'|'red'|'blue'|'slate' }){
  const base='px-2 py-0.5 rounded-full text-xs font-medium'
  const toneCls={ green:'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300', red:'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300', blue:'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300', slate:'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'}[tone]
  return <span className={clsx(base,toneCls)}>{children}</span>
}
