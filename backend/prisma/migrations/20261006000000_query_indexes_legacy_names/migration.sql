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

-- Drift found by `prisma migrate diff` on 2026-10-07: hand-written migrations gave
-- these columns a default / type Prisma does not declare. @updatedAt is filled by
-- the client on every write, so the defaults are unused; users.createdAt holds UTC.
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
