ALTER TABLE "trendlines" RENAME TO "drawings";
ALTER TABLE "drawings" RENAME COLUMN "lines" TO "items";
ALTER INDEX "trendlines_userId_broker_symbol_timeframe_key" RENAME TO "drawings_userId_broker_symbol_timeframe_key";
ALTER INDEX "trendlines_userId_broker_symbol_timeframe_idx" RENAME TO "drawings_userId_broker_symbol_timeframe_idx";
