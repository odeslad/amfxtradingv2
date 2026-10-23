-- Spec 023 · EMA cross notifications: standing rules configured from Settings,
-- their fired events, and the device label / last push of push subscriptions.

ALTER TABLE "push_subscriptions" ADD COLUMN "userAgent" TEXT,
ADD COLUMN "lastPushAt" TIMESTAMP(3);

CREATE TABLE "ema_notifications" (
    "id"            SERIAL NOT NULL,
    "userId"        INTEGER NOT NULL,
    "broker"        TEXT NOT NULL,
    "symbols"       TEXT[],
    "timeframe"     TEXT NOT NULL,
    "emaFast"       INTEGER NOT NULL,
    "emaSlow"       INTEGER NOT NULL,
    "event"         TEXT NOT NULL,
    "thresholdPips" DOUBLE PRECISION NOT NULL DEFAULT 2,
    "direction"     TEXT NOT NULL,
    "repeatMinutes" INTEGER,
    "endsAt"        TIMESTAMP(3),
    "enabled"       BOOLEAN NOT NULL DEFAULT true,
    "note"          TEXT,
    "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ema_notifications_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ema_notification_events" (
    "id"             SERIAL NOT NULL,
    "notificationId" INTEGER NOT NULL,
    "symbol"         TEXT NOT NULL,
    "kind"           TEXT NOT NULL,
    "direction"      TEXT NOT NULL,
    "candleTime"     TIMESTAMP(3) NOT NULL,
    "firedAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ema_notification_events_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ema_notifications_userId_idx" ON "ema_notifications"("userId");
CREATE INDEX "ema_notifications_broker_enabled_idx" ON "ema_notifications"("broker", "enabled");
CREATE INDEX "ema_notification_events_notificationId_symbol_firedAt_idx" ON "ema_notification_events"("notificationId", "symbol", "firedAt" DESC);

ALTER TABLE "ema_notifications" ADD CONSTRAINT "ema_notifications_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ema_notification_events" ADD CONSTRAINT "ema_notification_events_notificationId_fkey" FOREIGN KEY ("notificationId") REFERENCES "ema_notifications"("id") ON DELETE CASCADE ON UPDATE CASCADE;
