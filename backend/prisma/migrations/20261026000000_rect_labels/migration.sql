-- Spec 025 · Rectangle price / pips labels on the chart, switchable from Settings > Display.

ALTER TABLE "settings_display" ADD COLUMN "rectLabels" BOOLEAN NOT NULL DEFAULT true;
