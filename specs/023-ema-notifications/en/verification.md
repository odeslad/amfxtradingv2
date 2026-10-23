# 023 — EMA cross notifications in Settings · Verification

| Task | Mechanism | Outcome | Est | Actual |
|---|---|---|---|---|
| 1 | `prisma generate` + `npm run build` + `prisma migrate diff` | ✅ | 0.5 | 0.25 |

## Task 1 — Migration and models (db)

- `prisma/migrations/20261024000000_ema_notifications/migration.sql`: `push_subscriptions` + `userAgent`, `lastPushAt`; `ema_notifications` (rule: broker, `symbols` text[], timeframe, EMAs, event, thresholdPips default 2, direction, repeatMinutes nullable, endsAt nullable, enabled, note) with indexes on `userId` and `(broker, enabled)`; `ema_notification_events` (notificationId cascade, symbol, kind, direction, candleTime, firedAt) with the `(notificationId, symbol, firedAt desc)` index. Prisma models `EmaNotification` / `EmaNotificationEvent`, `User.emaNotifications`, `PushSubscription` columns.
- `npx prisma generate` and `npm run build` clean; `prisma migrate diff --from-url <production> --to-schema-datamodel --script` (through the 5433 tunnel) prints exactly the migration's statements: the two columns, two tables, three indexes, two foreign keys.
- Est vs Actual: 0.5 vs 0.25 SP.
