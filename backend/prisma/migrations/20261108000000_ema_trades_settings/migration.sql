-- Spec 039 · EMA cross trades overlay: EMA pair, entry offset, max duration and count, chosen in Settings > Display.

ALTER TABLE "settings_display"
  ADD COLUMN "emaTradesFast" INTEGER NOT NULL DEFAULT 24,
  ADD COLUMN "emaTradesSlow" INTEGER NOT NULL DEFAULT 48,
  ADD COLUMN "emaTradesEntryPips" DOUBLE PRECISION NOT NULL DEFAULT 5,
  ADD COLUMN "emaTradesHours" INTEGER NOT NULL DEFAULT 24,
  ADD COLUMN "emaTradesCount" INTEGER NOT NULL DEFAULT 3;
