# 002 — Broker stats · Tasks

Each task is one conventional commit. The project must build and run after every task. Backend tasks (1–3) and frontend tasks (4–9) never share a commit.

## Backend

- [x] 1. Create `backend/src/services/stats.ts` with `computeBrokerStats(broker, from?, to?)`: trade aggregate, month bucketing with zero-filled months, `tradesPerMonth`, start-balance resolution (`snapshot` → `derived` → `none`) and `returnPct`. Export the `BrokerStats` type. `npm run build` passes. — Design § Computation. `feat(backend): add broker stats service` [SP: 3]

- [x] 2. Create `backend/src/routes/stats.ts` (`GET /`, validates `broker` against `balances`, 400 on unknown, parses `from`/`to`, calls the service) and mount it in `app.ts` under `/stats` with `requireAuth`. `npm run build` passes. — Design § `GET /stats`. `feat(backend): expose GET /stats endpoint` [SP: 1]

- [x] 3. Verify against the VPS database through the tunnel with the local backend: `/stats?broker=darwinex` returns a payload whose `trades` count matches `SELECT count(*) FROM trades WHERE broker='darwinex'`, `monthly` covers every month with no gaps, a `from` inside the `balances` range yields `startBalanceSource: 'snapshot'`, a `from` before June 2026 yields `'derived'`, a broker with no trades in the period returns zeros, and an unknown broker returns 400. No commit; record the result in Outcome. — Requirements AC 3, 5, 6, 10, 11. [SP: 1]

## Frontend

- [ ] 4. Extend `features/journal/utils/dateRange.ts`: add `this_month`, `this_year`, `last_3_months` to `DateRange` and `dateRangeBounds`; move `DATE_RANGE_OPTIONS` there from `FiltersPanel.tsx` and import it back. Check the Journal History filter still works with every preset. `npm run build` passes. — Design § Affected files (frontend). `refactor(frontend): share date range presets and add month/year ranges` [SP: 2]

- [ ] 5. Create `features/stats/types.ts` (`BrokerStats`) and `features/stats/StatTile.tsx` + `StatTile.module.css` (label, mono value, tone colouring, optional hint; `--surface` panel with 3px `--orange` top border). `npm run build` passes. — Design § `StatTile`. `feat(frontend): add StatTile component` [SP: 1]

- [ ] 6. Create `features/stats/StatsFilters.tsx` + `.module.css`: broker select, period select from the shared `DATE_RANGE_OPTIONS`, custom from/to inputs; stacks on mobile. `npm run build` passes. — Design § `StatsFilters`. `feat(frontend): add StatsFilters component` [SP: 2]

- [ ] 7. Create `features/stats/MonthlyBreakdown.tsx` + `.module.css`: desktop table (Month · Trades · Net P&L) in an `overflow-x: auto` wrapper, mobile cards under 768px, month label from `YYYY-MM` without `Date` parsing, P&L coloured with `fmtPnl`. `npm run build` passes. — Design § `MonthlyBreakdown`. `feat(frontend): add MonthlyBreakdown component` [SP: 2]

- [ ] 8. Create `features/stats/StatsPage.tsx` + `.module.css`: filters in `useLocalStorage('stats.filters')`, broker list from `/balances` with fallback to the first broker, fetch `/stats` on filter change, loading / error / empty states, five tiles (trades per month, % return with `—` and derived hint, net P&L, total trades, win rate) and the monthly breakdown. Add `IconStats` to `shared/ui/icons.tsx`, the `/stats` route in `Router.tsx` and the nav entry in `AppLayout.tsx` between Scanner and Settings. `npm run build` passes. — Design § `StatsPage`; § Affected files. `feat(frontend): add Stats page` [SP: 3]

- [ ] 9. Verify locally against the VPS backend on desktop and phone width: broker switch, every period preset and custom range, `—` and hint on derived periods, empty state for a broker with no trades, Journal History filter unaffected, browser console clean. No commit; record the result in Outcome. Frontend is deployed only when the user asks. — Requirements AC 1, 2, 4, 7, 8, 9. [SP: 1]

## Estimation

Total: 16 SP.

Reference: spec 001 — its 1–2 SP tasks (1, 2, 3, 7) were mechanical and accurately estimated, its verification tasks (4, 8) were 1 SP and accurate. Task 1 here is new aggregation logic with edge cases (zero-fill, two balance sources), sized like 001's task 5 (3 SP); task 8 wires four new files plus three existing ones, also 3 SP. No task reaches 5 SP, so nothing needs splitting.
