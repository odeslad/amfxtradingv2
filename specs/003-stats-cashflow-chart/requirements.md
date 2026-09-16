# 003 — Stats: monthly return, cash flow and balance chart

## Context

Spec 002 shipped a Stats page whose return figure divides the period's trade P&L by a start balance that is either a daily snapshot or a back-calculation from the current balance. Both ignore deposits and withdrawals because the EA only exports BUY/SELL orders, so a deposit inside the period shows up as profit. The user also wants a return percentage per month in the breakdown table and a visual of how the balance evolved over the period. This spec closes those three gaps: the EA exports balance operations, the backend stores them and uses them in every return figure, and the page gains a balance chart next to the monthly table.

## User stories

- As a trader, I want deposits, withdrawals and balance adjustments taken into account so that the return percentage reflects trading performance and not money I moved in or out.
- As a trader, I want each month in the breakdown to show its own return percentage so that I can compare months regardless of the account size at the time.
- As a trader, I want to see the balance curve over the selected period beside the monthly table so that I can spot drawdowns and growth at a glance.

## Acceptance criteria

### EA

1. `history.json` SHALL include orders of type `OP_BALANCE` (6) and `OP_CREDIT` (7) in addition to BUY/SELL, with the same fields as today; for these orders `symbol` is empty, `lots`/prices are `0`, `profit` carries the signed amount and `comment` the broker's label (e.g. `Deposit`, `Withdrawal`).
2. The `HISTORY_MAX` cap and the `HISTORY_FULL_ON_START` full export SHALL apply to the combined list, newest first, exactly as they do today for trades.

### Backend — persistence

3. A new Prisma model `BalanceOperation` (table `balance_operations`) SHALL store: `ticket` (PK), `broker`, `type` (6 or 7), `amount` (signed, from `profit`), `comment`, `time` (from `closeTime`), indexed by `(broker, time)`.
4. WHEN the file watcher emits a history batch THEN the backend SHALL upsert BUY/SELL entries into `trades` and type 6/7 entries into `balance_operations`, never mixing them, and existing tickets SHALL be left untouched.
5. A migration SHALL create the table without altering `trades`.

### Backend — `GET /stats`

6. The **balance at any instant** SHALL be reconstructed as `latest balance snapshot − Σ trade net P&L closed after that instant − Σ balance operations after that instant`. The `balances` snapshot lookup and the `startBalanceSource` field are removed; the derived hint disappears from the page.
7. The period return SHALL be `netPnl / (balance at period start + deposits − withdrawals in the period) × 100`, where deposits are positive balance operations and withdrawals negative ones. WHEN the denominator is `≤ 0` THEN `returnPct` SHALL be `null`.
8. Each entry of `monthly` SHALL additionally carry `cashFlow` (Σ balance operations of that month, signed) and `returnPct` computed with the same rule as 7 using the balance at the start of that month.
9. The response SHALL include `cashFlow` for the whole period and a `curve` array with one point per calendar day from the period start (or first trade) to the period end (or today): `{ date: 'YYYY-MM-DD', balance: number }`, where `balance` is the reconstructed balance at the end of that day.
10. The response SHALL also include `operations`: the balance operations inside the period, `{ time, amount, comment }`, newest first, so the page can mark them on the chart.
11. WHEN the broker has no balance operations in the database THEN all figures SHALL equal the current 002 behaviour with a derived start balance (cash flow `0`).

### Frontend

12. The monthly breakdown SHALL add a **Return** column (`+x.xx %` / `—`, coloured by sign) and a **Cash flow** column (signed amount in the broker currency, `—` when `0`). Cards on mobile SHALL show the same two figures.
13. The `Return` tile SHALL use the new period `returnPct`; the derived hint is removed. A new tile **Cash flow** SHALL show the period's net deposits/withdrawals.
14. Below the tiles, on desktop (`min-width: 769px`) the page SHALL show the monthly breakdown in the left half and a balance chart in the right half, each 50 % of the width. On mobile they stack, chart first.
15. The balance chart SHALL render the `curve` as a line in the broker currency using the `lightweight-charts` library already in the project, with the design-system colours, a crosshair tooltip showing date and balance, and a marker at each balance operation labelled with its signed amount.
16. WHEN there are no trades in the period THEN the chart area SHALL show the same empty state as the table.
17. `npm run build` SHALL succeed in `backend/` and `frontend/` after each commit; no new dependencies SHALL be added.

## Out of scope

- Time-weighted return (chaining sub-periods between cash flows). The chosen formula treats cash flow as capital added at period start.
- Floating P&L of open positions in the balance curve; the curve is balance, not equity.
- Backfilling balance operations that MT4 no longer shows in Account History.
- Changing how `balances` daily snapshots are written; they stay as the anchor for "latest balance".
- Changing the Journal History view to show balance operations.
