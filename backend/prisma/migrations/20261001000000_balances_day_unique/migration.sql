-- One balance row per broker and UTC day, enforced by the database (spec 007 · BE-04).
-- DEFAULT CURRENT_DATE keeps the previous backend (which never writes "day") working
-- between applying this migration and deploying the new code.
ALTER TABLE "balances" ADD COLUMN "day" DATE NOT NULL DEFAULT CURRENT_DATE;

UPDATE "balances" SET "day" = ("timestamp" AT TIME ZONE 'UTC')::date;

-- Guard: keep the newest row per (broker, day). Production had 0 duplicates on 2026-10-01.
DELETE FROM "balances" b
  USING "balances" newer
  WHERE newer."broker" = b."broker"
    AND newer."day" = b."day"
    AND newer."id" > b."id";

CREATE UNIQUE INDEX "balances_broker_day_key" ON "balances"("broker", "day");
