ALTER TABLE "settings_display" ADD COLUMN IF NOT EXISTS "trendlineColor" TEXT NOT NULL DEFAULT '#8c8c8c';
ALTER TABLE "settings_display" ADD COLUMN IF NOT EXISTS "trendlineStyle" TEXT NOT NULL DEFAULT 'dashed';
