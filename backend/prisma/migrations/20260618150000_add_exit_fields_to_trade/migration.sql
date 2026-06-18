ALTER TABLE "backtest_trades" RENAME COLUMN "closeTime" TO "exitTime";
ALTER TABLE "backtest_trades" ALTER COLUMN "entryTime" DROP NOT NULL;
ALTER TABLE "backtest_trades" ADD COLUMN "exitPrice" DOUBLE PRECISION;
ALTER TABLE "backtest_trades" DROP COLUMN "resultRR";
ALTER TABLE "backtest_trades" ADD COLUMN "reason" TEXT;
