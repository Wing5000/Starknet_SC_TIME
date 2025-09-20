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
- `VITE_RPC_REQUESTS_PER_SECOND` (domyślnie 3)
- `VITE_RPC_MAX_CONCURRENCY` (domyślnie 2)

Domyślne publiczne endpointy oraz własne adresy w zmiennych środowiskowych powinny wskazywać na Starknet JSON-RPC w wersji co najmniej `v0_8` (np. `/rpc/v0_8`).
