-- Spec 032 · ASK and BID lines on the chart, switchable from Settings > Display.

ALTER TABLE "settings_display" ADD COLUMN "showSpread" BOOLEAN NOT NULL DEFAULT false;
