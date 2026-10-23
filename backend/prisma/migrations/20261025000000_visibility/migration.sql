-- Spec 024 · Visibility: brokers and per-broker symbols hidden from the frontend,
-- stored with the global display settings.

ALTER TABLE "settings_display" ADD COLUMN "hiddenBrokers" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN "hiddenSymbols" JSONB NOT NULL DEFAULT '{}';
