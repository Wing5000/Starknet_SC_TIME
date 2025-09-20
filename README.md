# Starknet Contract Dashboard – LIVE ONLY

Bez danych mock. Łączy się wyłącznie przez Starknet JSON‑RPC (public RPC lub własny endpoint).

## Start
```bash
pnpm i
VITE_DATA_MODE=live pnpm dev
```
Opcjonalne env:
- `VITE_STARKNET_RPC_MAINNET`
- `VITE_STARKNET_RPC_SEPOLIA`
