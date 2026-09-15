# 002 — Broker stats

## Context

The Journal shows accounts, open positions and closed trades, but there is no place to answer "how is this broker performing?". The user wants a Stats section where, after choosing a broker and a period, they can see how many trades that broker closes per month and how much the account has grown (or shrunk) in percentage terms since the start of the period. The data already exists in the `trades` table (closed BUY/SELL trades synced from the EA) and in the `balances` table (one balance snapshot per broker per day since June 2026).

## User stories

- As a trader, I want to pick a broker and a period and see the number of closed trades per month, so that I know how active that account is.
- As a trader, I want to see the percentage return of the broker over the selected period relative to the balance at the start of that period, so that I can compare accounts on equal footing regardless of their size.
- As a trader, I want a small set of supporting figures (net P&L, win rate, trade count) for the same period, so that the percentage has context.
- As a trader, I want the stats page to work on mobile, so that I can check performance from my phone like the rest of the app.

## Acceptance criteria

1. A new `Stats` entry SHALL appear in the desktop sidebar and mobile bottom nav, routed at `/stats`, protected by auth like the other pages.
2. The page SHALL offer a broker selector (single broker, no "all") populated from the brokers present in `balances`, and a period selector with the same presets as the Journal history filter (`All time`, `Today`, `Yesterday`, `Last week`, `Last month`, `Custom` with from/to) plus `This month`, `This year` and `Last 3 months`. The selected broker and period SHALL persist in localStorage.
3. WHEN a broker and a period are selected THEN the backend SHALL return, for closed trades of that broker whose `closeTime` falls inside the period: total trade count, number of winning and losing trades (net profit > 0 / < 0), net P&L (profit + swap + commission), and a per-calendar-month breakdown with trade count and net P&L for every month in the period, including months with zero trades.
4. The page SHALL display "trades per month" as the total trade count divided by the number of calendar months covered by the period (partial months count as one), shown with one decimal.
5. The percentage return SHALL be computed as `net P&L of the period / balance at period start × 100`, where balance at period start is the most recent `balances` snapshot for that broker with `timestamp ≤ period start`.
6. WHEN no snapshot exists at or before the period start (period starts before June 2026, or `All time`) THEN the start balance SHALL be derived as `current balance − net P&L of all trades closed since period start`, and the page SHALL show a visible hint that the figure assumes no deposits or withdrawals in the period.
7. WHEN the start balance is zero or cannot be determined THEN the percentage SHALL be shown as `—` instead of a number.
8. The page SHALL show, as headline tiles: trades per month, % return, net P&L in the broker currency, total trades and win rate. Positive values use `--green`, negative `--red`, following the design system.
9. The monthly breakdown SHALL be rendered as a table on desktop and as cards on mobile (same pattern as the Journal history), one row per month with month label, trade count and net P&L.
10. The response for a broker with no trades in the period SHALL be a valid payload with zero counts, and the page SHALL show an empty state, not an error.
11. The endpoint SHALL require auth and reject a missing or unknown broker with 400.
12. `npm run build` SHALL succeed in `backend/` and `frontend/` with zero TypeScript errors after each commit, and no new dependencies SHALL be added.

## Out of scope

- Comparing several brokers side by side, or an "all brokers" aggregate.
- Equity curve or any chart. A follow-up spec may add one once the numbers are validated.
- Including open positions (floating P&L) in the figures. Stats are based on closed trades only.
- Accounting for deposits and withdrawals. The EA does not export balance operations, so they are not in the database.
- Backfilling `balances` for dates before June 2026.
- Per-symbol or per-strategy breakdown.
- Changes to the EA or the bridge.
