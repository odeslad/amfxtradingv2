# 029 — Stats redesign and asset filter · Verification

## Task 1 — Backend: asset filter on `GET /stats`

- **Mechanism:** `npm run build` + `vitest` (stats-core); the local check against the DB was not possible (DB tunnel on 5434 down, it needs a Cloudflare browser login) — covered by the unit tests and the production validation (task 4).
- **Commands:** `cd backend && npm run build` → ✓; `npx vitest run src/services/stats-core.test.ts` → 9 passed (2 new).
- **Outcome:** ✅ pass.
- **Evidence:** optional `symbol` query param; with it only that symbol's trades load and no balance operations; `stats-core` `mode: 'asset'` → cash flow 0, start balance and return null (also monthly), curve = cumulative P&L from 0; `MonthlyStats.wins`; response adds `symbol` and `symbols` (distinct traded symbols of the broker). Additive contract — the current frontend is unaffected.
- **Est vs Actual:** 2 SP vs 1.5 SP.
