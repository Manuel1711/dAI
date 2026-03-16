# ERC-8004 Ops API (MVP)

Minimal control-plane API to add operational actions on top of the analytics site.

## Endpoints

- `POST /agents/register`
- `POST /feedback/give`
- `POST /feedback/respond`
- `GET /health`

All write endpoints require:

- `Authorization: Bearer <OPS_API_TOKEN>`
- `Content-Type: application/json`

## Run

```bash
cd ops-api
cp .env.example .env
# edit OPS_API_TOKEN
node server.mjs
```

## Notes

- This MVP uses strict auth + in-memory rate limiting + append-only audit log.
- Current implementation is `dryRun` (no on-chain writes yet).
- Next step: wire `execute*` functions in `server.mjs` to Agent0 SDK methods.
