-- EMA cross trades overlay: take profit as a reward:risk ratio over the entry-SL distance.

ALTER TABLE "settings_display"
  ADD COLUMN "emaTradesTpRatio" DOUBLE PRECISION NOT NULL DEFAULT 2;
