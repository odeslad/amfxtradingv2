-- Spec 035 · Setup levels listed in New Trade, chosen in Settings > Display.

ALTER TABLE "settings_display" ADD COLUMN "setupLevels" TEXT[] NOT NULL DEFAULT ARRAY['ECC','EMA','EVL','MHL']::TEXT[];
