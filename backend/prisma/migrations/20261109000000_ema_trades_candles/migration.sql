-- EMA cross trades overlay: the max duration is counted in candles of the chart timeframe, not in hours.

ALTER TABLE "settings_display" RENAME COLUMN "emaTradesHours" TO "emaTradesCandles";

UPDATE "settings_display" SET "emaTradesCandles" = 50 WHERE "emaTradesCandles" > 50;
