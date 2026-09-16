CREATE TABLE "balance_operations" (
  "ticket" INTEGER NOT NULL,
  "broker" TEXT NOT NULL,
  "type" INTEGER NOT NULL,
  "amount" DOUBLE PRECISION NOT NULL,
  "comment" TEXT NOT NULL,
  "time" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "balance_operations_pkey" PRIMARY KEY ("ticket")
);

CREATE INDEX "balance_operations_broker_time_idx" ON "balance_operations"("broker", "time");
