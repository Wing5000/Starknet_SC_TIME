export const fmtTime=(ts:number)=> new Date(ts*1000).toLocaleString()
export const fmtHash=(h:string)=> h.slice(0,8)+'…'+h.slice(-6)
export const fmtAddr=(a:string)=> a.slice(0,8)+'…'+a.slice(-6)
export const fmtNum=(n:number)=> n>=1e6? (n/1e6).toFixed(1).replace(/\.0$/,'')+'M' : n>=1e3? (n/1e3).toFixed(1).replace(/\.0$/,'')+'k' : String(n)
export const fmtFee=(n:number)=>{ if(n===0) return '0'; const u=['wei','k','M','G']; let i=0,v=n; while(v>=1000&&i<u.length-1){v/=1000;i++} return v.toFixed(2).replace(/\.00$/,'')+' '+u[i] }
