# 014 · BE-09 — Query indexes and legacy names · Design

> Status: **approved**

## Approach

Two independent, behaviour-preserving changes:

1. **`[backend]`** delete the `GET /candles/emas` handler.
2. **`[db]`** one hand-written migration that adds the trades index, drops the duplicate drawings index and renames the four legacy objects, plus the matching `schema.prisma` edit.

The migration runs during the deploy (`deploy.ps1` → `prisma migrate deploy`, before the build and the restart) while the **old** backend is still serving. Nothing in it changes a column, a row or a name the application code refers to, so the old process keeps working across the whole deploy, and the deploy's dist rollback never has to undo it.

## 1. `routes/candles.ts` (`[backend]`)

Remove the `/emas` handler, its comment and the now unused `calculateEma` import. `GET /candles` and `MAX_LIMIT` stay as they are. Express answers 404 for the removed path through the existing fallthrough (AC 1).

`calculateEma` keeps its three callers (`services/scanner.ts`, `routes/setup-levels.ts`, `alerts/ema-alert-evaluator.ts`) and its tests (AC 2). `backend/docs/architecture.md` does not mention the endpoint; the stale table there is BE-10's business.

## 2. Schema (`[db]`)

```prisma
model Trade {
  …
  @@index([broker, symbol])
  @@index([broker, closeTime])   // new
  @@index([closeTime])           // kept — see below
  @@map("trades")
}

model Drawing {
  …
  @@unique([userId, broker, symbol, timeframe])
  // @@index([userId, broker, symbol, timeframe]) removed
  @@map("drawings")
}
```

### Which trades queries use which index

| Query | Filter | Order | Index after this spec |
|---|---|---|---|
| `GET /trades` (Journal, default) | `broker`, optional `symbol`, optional `closeTime` range | `closeTime desc` | `(broker, closeTime)` — the range and the sort come from the same index; `symbol` is filtered on the few hundred rows it returns |
| `GET /trades` with no broker | optional `closeTime` range | `closeTime desc` | `(closeTime)` — this is why the standalone index stays |
| `GET /balances/daily-pnl` | `broker`, `closeTime >= midnight` | — | `(broker, closeTime)` |
| `services/stats.ts` | `broker`, optional `closeTime` range | `closeTime asc` | `(broker, closeTime)` |

`(broker, symbol)` has no reader today (`GET /trades?broker&symbol` is served well enough by `(broker, closeTime)` + filter at this table size) but dropping it is not in BE-09's scope and it costs nothing measurable; it stays.

### Migration `prisma/migrations/20261006000000_query_indexes_legacy_names/migration.sql`

```sql
-- Spec 014 · BE-09. Index the way trades are queried, drop the index that duplicated
-- the drawings unique constraint, and give the objects renamed with the
-- account_snapshots → balances and trendlines → drawings table renames the names
-- Prisma derives from schema.prisma. Every statement is a no-op when the object
-- already has its final name, so the migration is safe on any copy of the database.

CREATE INDEX IF NOT EXISTS "trades_broker_closeTime_idx" ON "trades"("broker", "closeTime");

DROP INDEX IF EXISTS "drawings_userId_broker_symbol_timeframe_idx";

ALTER INDEX IF EXISTS "account_snapshots_broker_timestamp_idx" RENAME TO "balances_broker_timestamp_idx";
ALTER SEQUENCE IF EXISTS "account_snapshots_id_seq" RENAME TO "balances_id_seq";
ALTER SEQUENCE IF EXISTS "trendlines_id_seq" RENAME TO "drawings_id_seq";

-- Drift found by `prisma migrate diff` on 2026-10-07 (design amendment, see below)
ALTER TABLE "settings_mirror" ALTER COLUMN "updatedAt" DROP DEFAULT;
ALTER TABLE "settings_display" ALTER COLUMN "updatedAt" DROP DEFAULT;
ALTER TABLE "users" ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMP(3);

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'account_snapshots_pkey') THEN
    ALTER TABLE "balances" RENAME CONSTRAINT "account_snapshots_pkey" TO "balances_pkey";
  END IF;
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'trendlines_pkey') THEN
    ALTER TABLE "drawings" RENAME CONSTRAINT "trendlines_pkey" TO "drawings_pkey";
  END IF;
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'trendlines_userId_fkey') THEN
    ALTER TABLE "drawings" RENAME CONSTRAINT "trendlines_userId_fkey" TO "drawings_userId_fkey";
  END IF;
END $$;
```

Notes:

- The primary keys are renamed through `RENAME CONSTRAINT`, which renames the backing index with them. `ALTER TABLE … RENAME CONSTRAINT` has no `IF EXISTS`, hence the `DO` block (AC 6).
- The sequences are renamed for consistency with the table; the column defaults reference them by OID, so the rename cannot break inserts. `prisma migrate diff` does not compare sequence names, so these two lines are cosmetic.
- The expected legacy names come from the migration history: `20260617171733_init` created `account_snapshots_pkey` and `account_snapshots_broker_timestamp_idx`, `20260623000000_add_trendlines` created `trendlines_pkey` and `trendlines_userId_fkey`, and the two table renames only renamed the table (plus the two `trendlines_*` unique/non-unique indexes). **Task 2 confirms the real names on production over the DB tunnel before the migration is committed**; if production turns out to hold a name this list misses, the migration gets one more guarded statement.
- `CREATE INDEX` without `CONCURRENTLY` (Prisma wraps the migration in a transaction) takes a `SHARE` lock on `trades` for the build. The table holds a few thousand rows, so the lock lasts milliseconds; the watcher's 30 s `createMany` either precedes or follows it (AC 6). The renames take an `ACCESS EXCLUSIVE` lock for a catalogue update — instantaneous.
- No `UPDATE`/`DELETE` anywhere (AC 8).

**Amendment (2026-10-07, task 2).** The production names matched the list above exactly, but the `migrate diff` also revealed three drifts outside the audit item, left by hand-written migrations: `settings_mirror.updatedAt` and `settings_display.updatedAt` carry a `DEFAULT CURRENT_TIMESTAMP` the schema does not declare (Prisma fills `@updatedAt` on every write, in the old and the new backend alike, so the default is unused), and `users.createdAt` is `TIMESTAMPTZ(6)` where the schema says `TIMESTAMP(3)` (1 row; the VPS runs in UTC, so the stored instant is unchanged). The user chose to align them in the same migration so AC 7 holds literally. The three statements are also no-ops on an already aligned database. `prisma/migrations/migration_lock.toml` (standard Prisma file, missing from the repo) is added so `migrate diff --from-migrations` can replay the history on a shadow database.

### Verification of the schema state

Before and after the migration, over the tunnel (`DATABASE_URL` on local port 5434):

```bash
npx prisma migrate diff --from-url "$DATABASE_URL" --to-schema-datamodel prisma/schema.prisma --script
```

Before: the output must contain exactly the renames and index changes this migration performs (that is the evidence the legacy names are what the design expects). After: `-- This is an empty migration.` (AC 7).

Index usage (AC 3), after the deploy, on a real broker:

```sql
EXPLAIN SELECT * FROM "trades" WHERE "broker" = 'FTMO' AND "closeTime" >= now() - interval '30 days'
ORDER BY "closeTime" DESC LIMIT 200;
```

The plan must show `Index Scan Backward using trades_broker_closeTime_idx`.

## Files

| File | Change |
|---|---|
| `backend/src/routes/candles.ts` | remove `/emas`, its comment, `calculateEma` import |
| `backend/prisma/schema.prisma` | `Trade` index added, `Drawing` index removed |
| `backend/prisma/migrations/20261006000000_query_indexes_legacy_names/migration.sql` | new |
| `backend/prisma/migrations/migration_lock.toml` | new (amendment) |
| `reports/2026-09-30-backend.md` | `Spec` column of BE-09 → `014` (on spec creation), `014 ✅` on close |

## Risks

- **Production holds a legacy name this design does not list** → `migrate diff` still shows a rename after the deploy. Mitigated by the pre-check in task 2; the fix would be one more guarded statement in the same migration before it ships.
- **A client still calling `/candles/emas`** → 404. Verified none exists (frontend grep, git history: the only consumer left with the backtest page in spec 001).
- **Migration fails mid-way** → Prisma rolls the transaction back and the deploy stops before touching `dist`; the old backend keeps running (spec 005 behaviour).

## Alternatives considered

- **`CREATE INDEX CONCURRENTLY`** — avoids the write lock but cannot run inside Prisma's migration transaction; not worth a manual step for a table this size.
- **Rename only the primary keys and leave the fk/index** — `migrate diff` would stay dirty; the point of the item is a clean diff.
- **Also drop `(broker, symbol)` and `(closeTime)`** — `(closeTime)` has a reader; `(broker, symbol)` is out of the audit's scope.
