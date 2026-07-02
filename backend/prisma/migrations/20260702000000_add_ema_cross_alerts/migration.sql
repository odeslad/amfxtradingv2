CREATE TABLE "ema_cross_alerts" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "broker" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "timeframe" TEXT NOT NULL,
    "emaFast" INTEGER NOT NULL,
    "emaSlow" INTEGER NOT NULL,
    "direction" TEXT NOT NULL,
    "thresholdPips" DOUBLE PRECISION NOT NULL,
    "note" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "triggeredAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ema_cross_alerts_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ema_cross_alerts_userId_idx" ON "ema_cross_alerts"("userId");

CREATE INDEX "ema_cross_alerts_broker_symbol_enabled_idx" ON "ema_cross_alerts"("broker", "symbol", "enabled");

ALTER TABLE "ema_cross_alerts" ADD CONSTRAINT "ema_cross_alerts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
