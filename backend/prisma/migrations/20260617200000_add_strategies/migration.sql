CREATE TABLE "strategies" (
    "id"        SERIAL PRIMARY KEY,
    "broker"    TEXT NOT NULL,
    "symbol"    TEXT NOT NULL,
    "timeframe" TEXT NOT NULL,
    "config"    JSONB NOT NULL,
    "active"    BOOLEAN NOT NULL DEFAULT true
);

CREATE INDEX "strategies_broker_active_idx" ON "strategies"("broker", "active");
