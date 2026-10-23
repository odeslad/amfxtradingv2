# 023 — EMA cross notifications in Settings · Verification

| Task | Mechanism | Outcome | Est | Actual |
|---|---|---|---|---|
| 1 | `prisma generate` + `npm run build` + `prisma migrate diff` | ✅ | 0.5 | 0.25 |
| 2 | `npm test` (7 on the pure rules) + `npm run build` + lint | ✅ | 1.5 | 1 |
| 3 | `npm run build` + local backend probes against the production database | ✅ | 1 | 1 |
| 4 | `npm run build` + `npm run lint` + local app against production (user) | ✅ | 1.5 | 1 |
| 5 | `npm run build` + `npm run lint` + local app against the local backend (user) | ✅ | 2 | 1.5 |
| 6 | `npm run build` + `npm run lint` + local app against the local backend (user) | ✅ | 1 | 0.75 |

## Task 1 — Migration and models (db)

- `prisma/migrations/20261024000000_ema_notifications/migration.sql`: `push_subscriptions` + `userAgent`, `lastPushAt`; `ema_notifications` (rule: broker, `symbols` text[], timeframe, EMAs, event, thresholdPips default 2, direction, repeatMinutes nullable, endsAt nullable, enabled, note) with indexes on `userId` and `(broker, enabled)`; `ema_notification_events` (notificationId cascade, symbol, kind, direction, candleTime, firedAt) with the `(notificationId, symbol, firedAt desc)` index. Prisma models `EmaNotification` / `EmaNotificationEvent`, `User.emaNotifications`, `PushSubscription` columns.
- `npx prisma generate` and `npm run build` clean; `prisma migrate diff --from-url <production> --to-schema-datamodel --script` (through the 5433 tunnel) prints exactly the migration's statements: the two columns, two tables, three indexes, two foreign keys.
- Est vs Actual: 0.5 vs 0.25 SP.

## Task 2 — Rule cache and evaluator (backend)

- `alerts/ema-notification-rules.ts`: pure `detectSituation(gapNow, gapPrev, threshold)` (cross = the gap changes sign; approach = converging, inside the threshold, no cross) and `decideFire(rule, gapNow, gapPrev, candleTime, lastEvent, approachOpen, now)` (event / direction filters; a cross fires once per crossing candle whatever the repeat; a once-per-event approach fires when it opens and stays quiet while open, firing again after the gap left the threshold or a cross; an every-N-minutes approach fires when the last event is N minutes old). `alerts/ema-notification-store.ts`: cache of enabled, not ended rules indexed broker → timeframe, `getActiveRules(broker, tf, symbol)` honouring the symbol list (empty = all), refresh from the routes and a one-minute timer. `alerts/ema-notification-evaluator.ts`: same candle-close detection as the EMA alerts on the tick batch, one candle query per symbol and close shared by its rules, EMAs with `calculateEma`, last event from `ema_notification_events`, in-memory `approachOpen` per rule and symbol, fire = event row + Web Push (title "EURUSD H1 · bullish cross" / "· bullish approach (2.1 p)") + WS `ema_notification` to the owner. Wired in `index.ts` (refresh + timer at start, evaluation next to the EMA alerts, broadcaster) and `ws.ts` (`broadcastEmaNotification`).
- `npx vitest run src/alerts`: 7 tests pass (crosses up / down, approach only while converging inside the threshold, cross once per candle with repeat 5, direction and event filters, once-per-event approach open / closed / reopened, every-30-min repeat, approach closed by the cross). `npm run build` and `npx eslint src/alerts src/index.ts src/ws/ws.ts` clean.
- Est vs Actual: 1.5 vs 1 SP.

## Task 3 — Routes, devices and docs (backend)

- `routes/ema-notifications.ts` mounted at `/ema-notifications` (17 routers): `GET /` (rules of the user with `state` active / paused / ended and `lastFired`), `POST /`, `PUT /:id`, `DELETE /:id`; parsing with the `middleware/parse` helpers (symbols array upper-cased and de-duplicated, empty = all; timeframe / event / direction enums; EMAs positive and different; thresholdPips > 0 unless event = cross; repeatMinutes null or ≥ 1; endsAt ISO or null; note trimmed to 500 or null). Every write refreshes the rule cache. `routes/push.ts`: `POST /subscribe` stores the user agent, `GET /` lists the devices (label "Chrome · Windows" / "Safari · iPhone" parsed from it, endpoint hash, since, last push), `DELETE /:id`; `services/push.ts` sets `lastPushAt` after each delivered push. Docs: `architecture.md` (tree, routes table, WS `ema_notification`, tables) and `.claude/CLAUDE.md` (17 routers, models).
- Migration applied to production through the tunnel (`prisma migrate deploy`: `20261024000000_ema_notifications` applied; `migrate diff` → empty) so the pipeline of task 7 finds nothing pending.
- Local backend (3001, bridges off, production database) with a forged session: list → `[]`; POST missing symbols / equal EMAs / timeframe H2 / approach with threshold 0 → 400 with the field named; POST ok → 201 (symbols `["eurusd","EURUSD","gbpusd"]` stored as `["EURUSD","GBPUSD"]`, state active, lastFired null); PUT pause + past end → state ended; PUT once per event + all symbols → `repeatMinutes` null, `symbols` `[]`; PUT / DELETE on 999999 → 404; DELETE → 204, again → 404. `GET /push` lists the two existing devices as "Unknown device" (subscribed before the user agent was stored; they relabel on the next subscribe); `DELETE /push/999999` → 404. First run exposed that `integer()` rejects a path param string: switched to `intParam`. Test rule removed afterwards.
- Est vs Actual: 1 vs 1 SP.

## Task 4 — Settings shell, Mirror and Display tabs (frontend)

- `SettingsPage.tsx` rewritten as the shell: Journal-style tab bar (Mirror / Display / Notifications), one Save for Mirror + Display with an "Unsaved changes" marker and a success toast, settings and balances loaded together; `SettingsPage.module.css` rewritten (tab bar and bar buttons from the Journal, table, toggle, inputs, display rows, mobile rules: full-width tabs, button row under the tabs, stacked broker cards, 44 px inputs at 16 px). `MirrorTab.tsx`: desktop table (Broker, Mirror toggle, Sizing, Lots / %, Account, Balance from `/balances`), mobile cards; the lots / % input is a text field with `inputMode="decimal"` parsed on change (AC 8). `DisplayTab.tsx`: today's four rows. The Notifications tab is a placeholder until task 5; the 600 px cap is gone.
- `npm run build` and `npx eslint src/features/settings` clean.
- Local app (Vite 5174 against the production API), checked by the user on 2026-10-23: tabs, mirror table edited and saved, reload keeps the values, display options, mobile layout and decimal keyboard. Validated by the user.
- Est vs Actual: 1.5 vs 1 SP.

## Task 5 — Notifications tab, panel and hook (frontend)

- `lib/useEmaNotifications.ts` (types, `useRemoteList` over `/ema-notifications`, create / update / toggle / remove, label helpers). `NotificationsTab.tsx` + `.module.css`: desktop table (On toggle, Symbols + broker, TF, EMAs, Event, Direction, Repeat, Ends, State badge green / muted / gold, Last fired, Edit / Delete), mobile cards (toggle, symbols, state; tap expands timeframe · EMAs, event, direction, repeat, ends, broker, last fired, note, Edit / Delete); paused and ended rows dimmed. `NotificationPanel.tsx` + `.module.css`: the mockup form in the edit-panel sizes — broker and timeframe selects, symbol chips in a 5-column grid from `/symbols?broker=` plus "All symbols of the broker", EMA fast / slow, event and direction segmented buttons (threshold hidden for cross), repeat select + minutes, ends typed as `dd/mm/yyyy hh:mm` in local time, note; client-side checks with toasts; `nonce` restarts the form on every open. `SettingsPage`: + New notification in the bar, edit / toggle / delete (ConfirmPanel) wired. `AppLayout`: WS `ema_notification` → toast "EURUSD H1 · bullish cross · darwinex" (green for bullish, red for bearish, 8 s).
- `npm run build` and `npx eslint` clean.
- Local app (Vite 5174 against the local backend 3001 on the production database, incognito session), checked by the user on 2026-10-23: rule created (EURUSD H1, approach ≤ 3 p, every 15 min), edit with the panel filled in, pause / resume, ended state with a past end, delete with confirmation, mobile cards. Fixed on review: the Ends column rendered the date with the book's UTC formatter, two hours off the typed local time → local formatter. The fire toast is checked in production (task 7).
- Est vs Actual: 2 vs 1.5 SP.

## Task 6 — Devices panel (frontend)

- `lib/usePushDevices.ts`: list from `GET /push`, remove (`DELETE /push/:id`), this browser's subscription endpoint hashed with `crypto.subtle` like the server, `thisDeviceSubscribed`, reload after a subscribe. `DevicesPanel.tsx` + `.module.css`: "This device · notifications off" box with **Enable this device** (`usePush().subscribe`; the unsupported / denied cases explain what to do), the subscribed devices with label, since, last push, "this device", and Remove with a second-click confirm. `SettingsPage`: **Devices · n** in the bar with an orange dot while this browser is not subscribed. Chart `AlertsPanel`: the enable button is replaced by a hint to Settings → Notifications → Devices.
- `npm run build` and `npx eslint` clean (one `set-state-in-effect` rewritten as a promise started in the effect).
- Local app against the local backend, checked by the user on 2026-10-23: Devices button and dot, panel with the two existing subscriptions ("Unknown device": subscribed before the user agent was stored), Remove with confirmation, chart hint. The Enable flow needs the VAPID keys of production and is checked in task 7.
- Est vs Actual: 1 vs 0.75 SP.
