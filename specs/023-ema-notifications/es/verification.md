# 023 — Notificaciones de cruce de EMAs en Settings · Verificación

| Tarea | Mecanismo | Resultado | Est | Real |
|---|---|---|---|---|
| 1 | `prisma generate` + `npm run build` + `prisma migrate diff` | ✅ | 0,5 | 0,25 |

## Tarea 1 — Migración y modelos (db)

- `prisma/migrations/20261024000000_ema_notifications/migration.sql`: `push_subscriptions` + `userAgent`, `lastPushAt`; `ema_notifications` (regla: broker, `symbols` text[], timeframe, EMAs, evento, thresholdPips por defecto 2, dirección, repeatMinutes anulable, endsAt anulable, enabled, nota) con índices por `userId` y `(broker, enabled)`; `ema_notification_events` (notificationId en cascada, par, tipo, dirección, candleTime, firedAt) con el índice `(notificationId, symbol, firedAt desc)`. Modelos Prisma `EmaNotification` / `EmaNotificationEvent`, `User.emaNotifications`, columnas de `PushSubscription`.
- `npx prisma generate` y `npm run build` limpios; `prisma migrate diff --from-url <producción> --to-schema-datamodel --script` (por el túnel 5433) imprime exactamente las sentencias de la migración: las dos columnas, dos tablas, tres índices, dos claves foráneas.
- Est vs Real: 0,5 vs 0,25 SP.
