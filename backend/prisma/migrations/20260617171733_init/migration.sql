-- CreateTable
CREATE TABLE "candles" (
    "id" SERIAL NOT NULL,
    "broker" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "timeframe" TEXT NOT NULL,
    "time" TIMESTAMP(3) NOT NULL,
    "open" DOUBLE PRECISION NOT NULL,
    "high" DOUBLE PRECISION NOT NULL,
    "low" DOUBLE PRECISION NOT NULL,
    "close" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "candles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "positions" (
    "ticket" INTEGER NOT NULL,
    "broker" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "type" INTEGER NOT NULL,
    "lots" DOUBLE PRECISION NOT NULL,
    "openPrice" DOUBLE PRECISION NOT NULL,
    "sl" DOUBLE PRECISION NOT NULL,
    "tp" DOUBLE PRECISION NOT NULL,
    "profit" DOUBLE PRECISION NOT NULL,
    "swap" DOUBLE PRECISION NOT NULL,
    "commission" DOUBLE PRECISION NOT NULL,
    "magic" INTEGER NOT NULL,
    "comment" TEXT NOT NULL,
    "openTime" TIMESTAMP(3) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "positions_pkey" PRIMARY KEY ("ticket")
);

-- CreateTable
CREATE TABLE "trades" (
    "ticket" INTEGER NOT NULL,
    "broker" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "type" INTEGER NOT NULL,
    "lots" DOUBLE PRECISION NOT NULL,
    "openPrice" DOUBLE PRECISION NOT NULL,
    "closePrice" DOUBLE PRECISION NOT NULL,
    "sl" DOUBLE PRECISION NOT NULL,
    "tp" DOUBLE PRECISION NOT NULL,
    "profit" DOUBLE PRECISION NOT NULL,
    "swap" DOUBLE PRECISION NOT NULL,
    "commission" DOUBLE PRECISION NOT NULL,
    "magic" INTEGER NOT NULL,
    "comment" TEXT NOT NULL,
    "openTime" TIMESTAMP(3) NOT NULL,
    "closeTime" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "trades_pkey" PRIMARY KEY ("ticket")
);

-- CreateTable
CREATE TABLE "account_snapshots" (
    "id" SERIAL NOT NULL,
    "broker" TEXT NOT NULL,
    "balance" DOUBLE PRECISION NOT NULL,
    "equity" DOUBLE PRECISION NOT NULL,
    "profit" DOUBLE PRECISION NOT NULL,
    "margin" DOUBLE PRECISION NOT NULL,
    "freeMargin" DOUBLE PRECISION NOT NULL,
    "leverage" INTEGER NOT NULL,
    "currency" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "account_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "candles_broker_symbol_timeframe_idx" ON "candles"("broker", "symbol", "timeframe");

-- CreateIndex
CREATE UNIQUE INDEX "candles_broker_symbol_timeframe_time_key" ON "candles"("broker", "symbol", "timeframe", "time");

-- CreateIndex
CREATE INDEX "positions_broker_idx" ON "positions"("broker");

-- CreateIndex
CREATE INDEX "trades_broker_symbol_idx" ON "trades"("broker", "symbol");

-- CreateIndex
CREATE INDEX "trades_closeTime_idx" ON "trades"("closeTime");

-- CreateIndex
CREATE INDEX "account_snapshots_broker_timestamp_idx" ON "account_snapshots"("broker", "timestamp");
