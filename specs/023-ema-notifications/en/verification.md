# 023 — EMA cross notifications in Settings · Verification

| Task | Mechanism | Outcome | Est | Actual |
|---|---|---|---|---|
| 1 | `prisma generate` + `npm run build` + `prisma migrate diff` | ✅ | 0.5 | 0.25 |
| 2 | `npm test` (7 on the pure rules) + `npm run build` + lint | ✅ | 1.5 | 1 |

## Task 1 — Migration and models (db)

- `prisma/migrations/20261024000000_ema_notifications/migration.sql`: `push_subscriptions` + `userAgent`, `lastPushAt`; `ema_notifications` (rule: broker, `symbols` text[], timeframe, EMAs, event, thresholdPips default 2, direction, repeatMinutes nullable, endsAt nullable, enabled, note) with indexes on `userId` and `(broker, enabled)`; `ema_notification_events` (notificationId cascade, symbol, kind, direction, candleTime, firedAt) with the `(notificationId, symbol, firedAt desc)` index. Prisma models `EmaNotification` / `EmaNotificationEvent`, `User.emaNotifications`, `PushSubscription` columns.
- `npx prisma generate` and `npm run build` clean; `prisma migrate diff --from-url <production> --to-schema-datamodel --script` (through the 5433 tunnel) prints exactly the migration's statements: the two columns, two tables, three indexes, two foreign keys.
- Est vs Actual: 0.5 vs 0.25 SP.

## Task 2 — Rule cache and evaluator (backend)

- `alerts/ema-notification-rules.ts`: pure `detectSituation(gapNow, gapPrev, threshold)` (cross = the gap changes sign; approach = converging, inside the threshold, no cross) and `decideFire(rule, gapNow, gapPrev, candleTime, lastEvent, approachOpen, now)` (event / direction filters; a cross fires once per crossing candle whatever the repeat; a once-per-event approach fires when it opens and stays quiet while open, firing again after the gap left the threshold or a cross; an every-N-minutes approach fires when the last event is N minutes old). `alerts/ema-notification-store.ts`: cache of enabled, not ended rules indexed broker → timeframe, `getActiveRules(broker, tf, symbol)` honouring the symbol list (empty = all), refresh from the routes and a one-minute timer. `alerts/ema-notification-evaluator.ts`: same candle-close detection as the EMA alerts on the tick batch, one candle query per symbol and close shared by its rules, EMAs with `calculateEma`, last event from `ema_notification_events`, in-memory `approachOpen` per rule and symbol, fire = event row + Web Push (title "EURUSD H1 · bullish cross" / "· bullish approach (2.1 p)") + WS `ema_notification` to the owner. Wired in `index.ts` (refresh + timer at start, evaluation next to the EMA alerts, broadcaster) and `ws.ts` (`broadcastEmaNotification`).
- `npx vitest run src/alerts`: 7 tests pass (crosses up / down, approach only while converging inside the threshold, cross once per candle with repeat 5, direction and event filters, once-per-event approach open / closed / reopened, every-30-min repeat, approach closed by the cross). `npm run build` and `npx eslint src/alerts src/index.ts src/ws/ws.ts` clean.
- Est vs Actual: 1.5 vs 1 SP.
