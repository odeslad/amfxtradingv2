-- Replace exhausted int4 autoincrement id with composite primary key.
-- createMany(skipDuplicates) burned a sequence value per attempted row,
-- exhausting candles_id_seq (int4 max). No code reads candles.id.
ALTER TABLE "candles" DROP CONSTRAINT "candles_pkey";
ALTER TABLE "candles" DROP COLUMN "id";
ALTER TABLE "candles" ADD CONSTRAINT "candles_pkey" PRIMARY KEY ("broker", "symbol", "timeframe", "time");
DROP INDEX IF EXISTS "candles_broker_symbol_timeframe_time_key";
DROP INDEX IF EXISTS "candles_broker_symbol_timeframe_idx";
