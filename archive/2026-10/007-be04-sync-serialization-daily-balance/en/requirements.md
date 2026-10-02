# 007 · BE-04 — Sync serialization and daily balance uniqueness

> Status: **closed**
> Origin: [backend audit 2026-09-30](../../../reports/2026-09-30-backend.md), improvement 4 (diagnosis E)

## Context

Every 30 s per broker the `FileWatcher` reads `account.json`, `history.json` and every `candles_*.json` and persists them. Four weaknesses were found: (1) `saveDailyBalances` is check-then-act (`findFirst` today → `update` or `create`) with no unique key, so two overlapping calls for the same broker on the first write of a day create two rows — the "duplicate balance records" item of `.claude/CLAUDE.md`; a production count on 2026-10-01 shows **0 duplicates** in 359 rows, so this is prevention, not repair; (2) the watcher's `polling` guard only covers candles — the `account` and `history` handlers are `async` listeners nobody awaits, so a slow DB lets syncs overlap; (3) `syncTrades` and `syncBalanceOperations` issue one sequential `upsert` per row with `update: {}` (insert-only semantics) — ~50 round trips per broker per cycle, thousands on EA start — where one `createMany({ skipDuplicates })` does the same; (4) every `candles_*.json` is parsed and re-inserted (`createMany skipDuplicates`, ~7 500 key lookups per broker per cycle) although the EA rewrites it only every 60 s, so half the cycles repeat identical work. Also, `Balance.timestamp` is never updated on the daily `update`, yet `stats.ts` uses the latest row's `timestamp` as the balance anchor. The VPS runs Node and PostgreSQL in UTC; the day boundary becomes explicit UTC so local development (Europe/Madrid) behaves the same.

## Affected layers

- db (schema + migration)
- backend

## User stories

- As the operator, I want one balance row per broker and UTC day enforced by the database, so that duplicates are impossible rather than unlikely.
- As the operator, I want the 30 s sync to do only the work that changed, so that DB load stays flat as history and symbols grow.
- As the operator, I want syncs never to overlap, so that a slow database cannot cascade into racing writes.

## Acceptance criteria

- AC 1. WHEN the schema is migrated THEN `balances` has a `day DATE NOT NULL` column and a unique constraint on `(broker, day)`; existing rows get `day = date(timestamp AT TIME ZONE 'UTC')`; if duplicates exist at migration time the one with the highest `id` per `(broker, day)` is kept and the others deleted, before the constraint is added.
- AC 2. WHEN `saveDailyBalances` runs THEN it performs a single `upsert` keyed on `(broker, day)` with `day` = current UTC date, and sets `timestamp = now()` on both create and update.
- AC 3. WHEN two `saveDailyBalances` calls for the same broker run concurrently on a fresh day THEN exactly one row exists afterwards and neither call throws.
- AC 4. WHEN `GET /balances`, `GET /balances/daily-pnl`, `GET /stats` and `GET /trades` are called THEN their responses are unchanged in shape and values (`day` is not exposed; `timestamp` now reflects the last write, which is the intended anchor for stats).
- AC 5. WHEN the watcher polls THEN `account` and `history` handlers are awaited inside the poll, so a cycle does not start while the previous one's handlers are still running; the 30 s interval still skips ticks while a poll is in progress.
- AC 6. WHEN `syncTrades` / `syncBalanceOperations` run THEN they issue one `createMany({ skipDuplicates: true })` per call (chunked at 5 000 rows like candles); rows already present are untouched (same insert-only semantics as today).
- AC 7. WHEN a `candles_*.json` file has the same `mtime` and size as in the previous poll for that broker THEN it is neither read nor parsed nor written; when it changed, behaviour is as today. The first poll after startup processes every file.
- AC 8. WHEN a handler throws THEN the error is logged with the broker prefix (as today) and the poll continues with the next file/handler; the `polling` flag is always released.
- AC 9. WHEN the change is deployed THEN `pg_stat_statements`-free evidence of the reduction is recorded: a count of `INSERT` statements per cycle from the Prisma query log (`log: ['query']` enabled locally for the measurement only) before and after.

## Out of scope

- Reading `positions.json` or any EA change.
- Changing the candle write strategy beyond skipping unchanged files (e.g. inserting only the last N bars).
- Adding `(broker, closeTime)` and dropping the redundant `drawings` index (audit improvement 9).
- Fixing time conventions (broker offset for candles/trades).
- Retention/cleanup of old candles.
