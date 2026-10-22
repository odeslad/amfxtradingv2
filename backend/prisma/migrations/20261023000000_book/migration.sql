-- Spec 020 · Libro de esquemas EURUSD: the operator's hand-kept backtest
-- (schemes and their operations), independent of the live trading tables.

CREATE TABLE "book_schemes" (
    "id"        SERIAL NOT NULL,
    "number"    INTEGER NOT NULL,
    "start"     DATE NOT NULL,
    "end"       DATE,
    "result"    TEXT NOT NULL DEFAULT 'auto',
    "note"      TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "book_schemes_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "book_trades" (
    "id"           SERIAL NOT NULL,
    "ticket"       INTEGER NOT NULL,
    "schemeId"     INTEGER NOT NULL,
    "slot"         TEXT NOT NULL,
    "direction"    TEXT NOT NULL,
    "lots"         DOUBLE PRECISION NOT NULL,
    "entry"        DOUBLE PRECISION NOT NULL,
    "sl"           DOUBLE PRECISION NOT NULL,
    "openTime"     TIMESTAMP(3) NOT NULL,
    "closeTime"    TIMESTAMP(3),
    "closePrice"   DOUBLE PRECISION,
    "profit"       DOUBLE PRECISION,
    "r"            DOUBLE PRECISION,
    "balanceAfter" DOUBLE PRECISION,
    "note"         TEXT,
    "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"    TIMESTAMP(3) NOT NULL,

    CONSTRAINT "book_trades_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "book_schemes_number_key" ON "book_schemes"("number");
CREATE INDEX "book_schemes_start_idx" ON "book_schemes"("start");
CREATE UNIQUE INDEX "book_trades_ticket_key" ON "book_trades"("ticket");
CREATE INDEX "book_trades_schemeId_idx" ON "book_trades"("schemeId");

ALTER TABLE "book_trades" ADD CONSTRAINT "book_trades_schemeId_fkey" FOREIGN KEY ("schemeId") REFERENCES "book_schemes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
