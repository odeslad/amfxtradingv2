CREATE TABLE "chart_indicators" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "emas" JSONB NOT NULL DEFAULT '[]',
    CONSTRAINT "chart_indicators_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "chart_indicators_userId_key" ON "chart_indicators"("userId");

ALTER TABLE "chart_indicators" ADD CONSTRAINT "chart_indicators_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
