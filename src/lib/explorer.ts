import { Network } from '../types'
export const explorerBase=(net:Network)=> net==='mainnet' ? 'https://starkscan.co' : 'https://sepolia.starkscan.co'
export const txLink=(net:Network,hash:string)=> `${explorerBase(net)}/tx/${hash}`
export const addrLink=(net:Network,addr:string)=> `${explorerBase(net)}/contract/${addr}`
