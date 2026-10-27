# 029 — Stats redesign and asset filter · Tasks

Each task is one conventional commit. The project must build after every task. Deploy order: backend (additive) → frontend.

- [ ] 1. [backend] `GET /stats` optional `symbol` (asset mode in `stats-core`: no operations, cumulative P&L curve, null return), monthly `wins`, `symbol` and `symbols` in the response; tests for asset mode · **Verify:** `npm run build` + `vitest` (stats-core) + local `curl /stats?broker&symbol` · **Est:** 2 SP
- [ ] 2. [frontend] Shared period list (Hoy, Ayer, 7/30/90/365 days, Todo, Custom), `normalizeDateRange` for stored filters (Journal and Stats), Custom To clamped to today · **Verify:** `npm run build` + local check in the Journal filters · **Est:** 1 SP
- [ ] 3. [frontend] Stats redesign: `PeriodTabs` with "Más" menu, Broker + Activo selects, `StatsTotals` strip/block, chart 2/3 width and full height, monthly table (Mes, Trades, Win %, Net P&L) and phone cards, asset mode ("—", cumulative P&L chart) · **Verify:** `npm run build` + local check desktop and phone width · **Est:** 4 SP
- [ ] 4. [infra] Push `master` (backend deploy first, then frontend) and **validate on production**: `/stats` on desktop and iPhone (periods, Más menu, asset filter, totals, chart height/width, monthly cards) and the Journal period select · **Verify:** manual (user validation) · **Est:** 0.5 SP
- [ ] 5. [specs] Record Est vs Actual in `verification.md` (both languages), mark the spec closed and archive it under `archive/2026-10/` · **Verify:** manual · **Est:** 0.25 SP

**Total estimate**: 7.75 SP
