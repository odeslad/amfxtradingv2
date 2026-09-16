# 003 — Stats: monthly return, cash flow and balance chart · Tasks

Each task is one conventional commit. The project must build and run after every task. Backend, frontend and EA tasks never share a commit. Deploy order: backend (tasks 1–4) → frontend (5–9) → EA (10); the EA goes last so the backend already knows how to store balance operations when they arrive.

## Backend

- [x] 1. Add the `BalanceOperation` model to `schema.prisma`, run `prisma generate`, add migration `20260916000000_add_balance_operations/migration.sql`. `npm run build` passes. — Design § Prisma. `feat(db): add balance_operations table` [SP: 1]

- [x] 2. Create `services/balance-operations.ts` (`syncBalanceOperations`, upsert by ticket) and partition the history batch by type in `index.ts`. `npm run build` passes. — Design § History handler. `feat(backend): persist balance operations from history` [SP: 1]

- [x] 3. Rewrite `services/stats.ts` around `balanceAt`: suffix-sum reconstruction over trades and operations, `cashFlow`, period `returnPct` with the cash-flow denominator, per-month `returnPct`/`cashFlow`, daily `curve` clamped after the latest snapshot, `operations`; remove the snapshot lookup and `startBalanceSource`. `npm run build` passes. — Design § Computation. `feat(backend): cash-flow aware stats with balance curve` [SP: 3]

- [x] 4. Verify against the VPS database through the tunnel with a tsx script: for darwinex, `startBalance` for `All time` equals the value 002 returned (no operations yet → identical), `curve` has one point per day with no gaps and its last value equals the latest snapshot, monthly `returnPct` sums are consistent with `netPnl` per month, `cashFlow = 0` everywhere. Insert a fake deposit row for a test broker, re-run and confirm `returnPct` shrinks by the expected ratio and the operation appears in `operations`; delete the fake row. No commit; record in Outcome. — Requirements AC 6–11. [SP: 2]

## Frontend

- [x] 5. Update `features/stats/types.ts` and extract `fmtPct` into `features/stats/format.ts`. `npm run build` passes. — Design § Affected files (frontend). `refactor(frontend): update stats types and share fmtPct` [SP: 1]

- [x] 6. `MonthlyBreakdown`: add Return and Cash flow columns and card fields, coloured by sign, `—` for null / zero. `npm run build` passes. — Design § `MonthlyBreakdown`. `feat(frontend): add return and cash flow to monthly breakdown` [SP: 1]

- [x] 7. Create `features/stats/BalanceChart.tsx` + `.module.css`: lightweight-charts line series, business-day times, operation markers, crosshair, resize observer, cleanup. `npm run build` passes. — Design § `BalanceChart`. `feat(frontend): add BalanceChart component` [SP: 3]

- [x] 8. `StatsPage`: Cash flow tile, six-tile grid, remove the derived hint, `split` layout with the chart on the right (first on mobile), empty state covering both halves. `npm run build` passes. — Design § `StatsPage`. `feat(frontend): show balance chart beside monthly breakdown` [SP: 2]

- [x] 9. Verify locally on desktop and phone width against the local backend + tunnel: two columns at 50 %, chart fits the period, tooltip shows date and balance, markers appear when a fake deposit is present, table columns and cards, empty state, console clean. No commit; record in Outcome. — Requirements AC 12–16. [SP: 1]

## EA

- [x] 10. `WriteHistory()` in `HttpBridgeState.mq4`: accept `OP_BALANCE` and `OP_CREDIT`; document in `ea/docs/HttpBridgeState.md`. Push only after the backend is deployed; the user then reloads the EA per terminal (Account History on *All History*). Afterwards check on the VPS that `balance_operations` has rows and that Stats shows the cash flow. — Design § Affected files (EA); § Risks. `feat(ea): export balance and credit operations in history` [SP: 1]

## Estimation

Total: 16 SP.

Reference: spec 002 — its backend service task (1) was 3 SP and accurate, so the rewrite here with the extra curve is kept at 3; its DB-through-tunnel verification (task 3) ran over by one point, so task 4 here is 2 SP up front. Spec 001's chart-component work (task 5, 3 SP accurate) sets `BalanceChart` at 3. Small wiring tasks are 1 SP as in both prior specs, where they came in at or under estimate.

## Outcome

**Shipped (2026-09-16).** Balance operations table and sync, cash-flow aware stats with a daily balance curve, Return / Cash flow columns, a paginated monthly breakdown beside an area chart, and the EA change that exports balance/credit orders. Ten commits (`3e4b3bb` → `01fa7fe`) plus one dev-environment commit. Backend and frontend deployed together at `62d2b67` without the concurrent-pull incident; EA deployed from `01fa7fe`. The migration was applied through the tunnel before the deploy so task 4 could run against production data; `prisma migrate deploy` then found it already recorded.

**Deviations agreed during implementation:**
- `startBalance` uses the instant *before* the period start (`balanceAt(t − 1 ms)`), otherwise a trade closing exactly at the period start leaked into the start balance. Same for month starts.
- Monthly breakdown is **paginated** (12 months, newest first, Newer / Older pager) after the user saw brokers with five years of history overflow the page; months without trades show `—`.
- `BalanceChart` is an **area** series in `--orange` with a 1 px line (user preference over the blue line in the design), auto-sized to the table height on desktop (280 px on mobile), and `minBarSpacing: 0.01` so years of daily points fit; the default 0.5 px minimum clipped everything before 2023.
- Dev environment (outside the spec, committed separately): `COOKIE_DOMAIN` env var (default `.amfxtrading.com`, `none` for host-only), a Vite `/__api` proxy so the local API is same-origin, and a relative-base WebSocket URL. Without it the local login silently failed (cookie domain mismatch plus Chrome third-party cookie blocking), which means spec 002's task 9 could not have been exercised end-to-end locally as recorded.

**Pending on the user:** reload `HttpBridgeState` on each terminal with Account History set to *All History* so balance operations reach `balance_operations`; the table is empty until then and Cash flow shows `—`.

**Actual effort:**
- Task 1: estimated 1, accurate.
- Task 2: estimated 1, accurate.
- Task 3: estimated 3, accurate — the boundary bug at the period start was the only surprise.
- Task 4: estimated 2, accurate — script plus fake rows, tunnel reopened once.
- Task 5: estimated 1, accurate.
- Task 6: estimated 1, felt like 2 — pagination and the `—` rules were added on review.
- Task 7: estimated 3, felt like 3 — area/autosize/minBarSpacing iterations were small each.
- Task 8: estimated 2, accurate.
- Task 9: estimated 1, felt like 5 — the local stack did not authenticate (cookie domain, third-party cookies, Git Bash path mangling of `/__api`); most of the day's effort went here, none of it spec work.
- Task 10: estimated 1, accurate.
