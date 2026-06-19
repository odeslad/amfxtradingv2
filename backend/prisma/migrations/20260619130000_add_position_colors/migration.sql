CREATE TABLE "position_colors" (
  "id"     SERIAL PRIMARY KEY,
  "broker" TEXT NOT NULL,
  "ticket" INTEGER NOT NULL,
  "color"  TEXT NOT NULL,
  CONSTRAINT "position_colors_broker_ticket_key" UNIQUE ("broker", "ticket")
);
