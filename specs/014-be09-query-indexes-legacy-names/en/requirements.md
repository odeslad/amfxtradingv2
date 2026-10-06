# 014 · BE-09 — Query indexes and legacy names

> Status: **approved**
> Origin: [backend audit 2026-09-30](../../../reports/2026-09-30-backend.md), improvement 9 (diagnosis E)

## Context

The audit grouped four small query and schema items under BE-09:

- `GET /candles/emas` loads the full candle history of a symbol (~10⁵ rows on M5) to return an EMA series. Since the audit was written we found that **nobody calls it**: its only consumer was the backtest page removed in spec 001, and the chart computes its EMAs in the frontend (`calcEma` in `LightweightChart.tsx`). The user decided to delete the endpoint instead of bounding its warm-up.
- Every trades query filters by `broker` and filters or sorts by `closeTime` (`routes/trades.ts`, `routes/balances.ts` daily P&L, `services/stats.ts`), but `trades` only has the indexes `(broker, symbol)` and `(closeTime)`.
- `drawings` declares `@@unique([userId, broker, symbol, timeframe])` and an `@@index` on the same four columns. The unique index already serves every lookup; the second one is only write cost.
- Two tables were renamed with `ALTER TABLE … RENAME` (`account_snapshots` → `balances`, `trendlines` → `drawings`) and kept the names of their old primary key, index and foreign key (`account_snapshots_pkey`, `account_snapshots_broker_timestamp_idx`, `trendlines_pkey`, `trendlines_userId_fkey`). The database works, but it no longer matches the names Prisma derives from `schema.prisma`, so `prisma migrate diff` is not clean and a future `migrate dev` would propose spurious renames.

## Affected layers

- backend
- db

No frontend change: the removed endpoint has no caller. The EA ↔ backend contract is untouched.

## User stories

- As the user, I want the trades list, the daily P&L and the stats to be served by an index that matches how they are queried, so that they stay fast as the history grows.
- As the developer, I want the database object names to match `schema.prisma`, so that the next migration contains only the change I intend.
- As the developer, I want an endpoint nobody uses removed, so that it is not maintained, audited or exposed.

## Acceptance criteria

- AC 1. WHEN `GET /candles/emas` is requested THEN the backend answers 404 like any unknown route; `GET /candles` is unchanged.
- AC 2. No code or comment in `backend/src` refers to the removed endpoint; `calculateEma` stays (scanner, setup levels and EMA alerts use it).
- AC 3. `trades` has an index on `(broker, closeTime)`. WHEN the trades list, the daily P&L or the stats query runs for one broker THEN PostgreSQL can resolve the broker filter and the `closeTime` range/order from that index (checked with `EXPLAIN` on production data).
- AC 4. `drawings` keeps its unique constraint on `(userId, broker, symbol, timeframe)` and no longer has the duplicate non-unique index. Loading and saving drawings behave as today.
- AC 5. The primary key, index and foreign key of `balances` and `drawings` carry the names Prisma expects (`balances_pkey`, `balances_broker_timestamp_idx`, `drawings_pkey`, `drawings_userId_fkey`).
- AC 6. The migration is safe to apply on a database where some of those objects already carry the new name (it renames only what still has the legacy name) and it does not rewrite or lock any table for longer than the index build on `trades`.
- AC 7. After the migration, `prisma migrate diff` between the production database and `schema.prisma` reports no difference.
- AC 8. No row of `trades`, `balances` or `drawings` is modified or deleted.

## Out of scope

- Moving the chart's EMA calculation to the backend (the reason the endpoint once existed).
- The timezone of `trades.openTime/closeTime` (audit contract table; separate candidate spec).
- Dropping the standalone `(closeTime)` index of `trades`: decided in the design after checking which queries use it.
- Other dead code and docs (BE-10).
