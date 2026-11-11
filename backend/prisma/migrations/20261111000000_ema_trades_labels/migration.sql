-- EMA cross trades overlay: what the SL / TP labels show (price, R multiple, pips), combinable.

ALTER TABLE "settings_display"
  ADD COLUMN "emaTradesLabels" TEXT[] NOT NULL DEFAULT ARRAY['price', 'r', 'pips']::TEXT[];
