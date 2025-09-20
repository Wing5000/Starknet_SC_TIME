export type Network = 'mainnet' | 'sepolia'
export type TxType = 'INVOKE' | 'DECLARE' | 'DEPLOY' | 'L1_HANDLER'
export type TxStatus = 'ACCEPTED' | 'REJECTED'
export interface TxRow { timestamp:number; txHash:string; type:TxType; entrypoint?:string; caller:string; to:string; fee:number; status:TxStatus; network:Network }
export interface Filters { address:string; network:Network; fromDate:string; toDate:string; type?:TxType|'ALL'; method?:string; status?:TxStatus|'ALL'; minFee?:number; maxFee?:number }

export type ActivityLogLevel = 'info' | 'warn' | 'error'

export type ActivityLogEntry = {
  id:string
  level:ActivityLogLevel
  message:string
  timestamp:number
}
