-- Spec 037 · Fibonacci levels drawn by the chart tool, chosen in Settings > Display.

ALTER TABLE "settings_display" ADD COLUMN "fibLevels" DOUBLE PRECISION[] NOT NULL DEFAULT ARRAY[0,23.6,38.2,50,61.8,78.6,100]::DOUBLE PRECISION[];
