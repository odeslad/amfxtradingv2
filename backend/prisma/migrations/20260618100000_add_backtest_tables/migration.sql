CREATE TABLE "backtest_runs" (
    "id"          SERIAL PRIMARY KEY,
    "strategyId"  INTEGER NOT NULL REFERENCES "strategies"("id"),
    "broker"      TEXT NOT NULL,
    "symbol"      TEXT NOT NULL,
    "timeframe"   TEXT NOT NULL,
    "dateFrom"    TIMESTAMPTZ NOT NULL,
    "dateTo"      TIMESTAMPTZ NOT NULL,
    "configHash"  TEXT NOT NULL,
    "createdAt"   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX "backtest_runs_strategyId_idx" ON "backtest_runs"("strategyId");

CREATE TABLE "backtest_setups" (
    "id"              SERIAL PRIMARY KEY,
    "runId"           INTEGER NOT NULL REFERENCES "backtest_runs"("id"),
    "direction"       TEXT NOT NULL,
    "activationTime"  TIMESTAMPTZ NOT NULL,
    "activationPrice" FLOAT NOT NULL,
    "closeTime"       TIMESTAMPTZ,
    "closePrice"      FLOAT,
    "levels"          JSONB NOT NULL,
    "candleCount"     INTEGER NOT NULL
);
CREATE INDEX "backtest_setups_runId_idx" ON "backtest_setups"("runId");

CREATE TABLE "backtest_trades" (
    "id"          SERIAL PRIMARY KEY,
    "setupId"     INTEGER NOT NULL REFERENCES "backtest_setups"("id"),
    "entryType"   TEXT NOT NULL,
    "entryPrice"  FLOAT NOT NULL,
    "sl"          FLOAT NOT NULL,
    "tp"          FLOAT NOT NULL,
    "entryTime"   TIMESTAMPTZ NOT NULL,
    "closeTime"   TIMESTAMPTZ,
    "resultPips"  FLOAT,
    "resultRR"    FLOAT,
    "status"      TEXT NOT NULL
);
CREATE INDEX "backtest_trades_setupId_idx" ON "backtest_trades"("setupId");
