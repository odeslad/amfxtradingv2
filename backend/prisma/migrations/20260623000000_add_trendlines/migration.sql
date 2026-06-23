CREATE TABLE "trendlines" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "broker" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "timeframe" TEXT NOT NULL,
    "lines" JSONB NOT NULL DEFAULT '[]',
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "trendlines_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "trendlines_userId_broker_symbol_timeframe_key"
    ON "trendlines"("userId", "broker", "symbol", "timeframe");

CREATE INDEX "trendlines_userId_broker_symbol_timeframe_idx"
    ON "trendlines"("userId", "broker", "symbol", "timeframe");

ALTER TABLE "trendlines" ADD CONSTRAINT "trendlines_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
