# 023 — EMA cross notifications in Settings · Design

## Approach

A new, standing rule type next to the chart's one-shot alerts, with its own table, routes, in-memory
cache and evaluator, built on the pieces the EMA alerts already use (candle-close detection on the tick
stream, `indicators/ema`, `services/push`, the WebSocket user broadcast). The chart's alerts are not
touched. Settings is rebuilt as a tabbed page (Mirror, Display, Notifications) with the Journal's tab
bar, full width on desktop, New Trade sizes on mobile, and two side panels (notification form, devices).

Alternatives considered: extending `EmaCrossAlert` with repeat / end / symbol lists — rejected, the
one-shot semantics (disable on trigger, `triggeredAt`) and the chart panel would have to carry every new
field; a separate model keeps both simple.

## Data (db)

Migration `20261024000000_ema_notifications`:

```
ema_notifications
  id            serial PK
  userId        int → users (index)
  broker        text
  symbols       text[]      -- empty = every symbol of the broker
  timeframe     text        -- M5 | M15 | H1 | H4 | D1
  emaFast       int
  emaSlow       int
  event         text        -- cross | approach | both
  thresholdPips float       -- approach distance (ignored for event = cross)
  direction     text        -- buy | sell | both
  repeatMinutes int null    -- null = once per event
  endsAt        timestamptz null
  enabled       bool default true
  note          text null
  createdAt     timestamptz default now()
  index (userId), index (broker, enabled)

ema_notification_events          -- what fired, for "last fired" and the repeat clock
  id             serial PK
  notificationId int → ema_notifications (cascade, index)
  symbol         text
  kind           text        -- cross | approach
  direction      text        -- buy | sell
  candleTime     timestamptz -- close of the evaluated candle
  firedAt        timestamptz default now()
  index (notificationId, symbol, firedAt desc)

push_subscriptions + userAgent text null, lastPushAt timestamptz null
```

Prisma models `EmaNotification`, `EmaNotificationEvent`; `PushSubscription` gains the two columns.
`prisma migrate diff` against production must list exactly these statements.

## Backend

### `alerts/ema-notification-store.ts`

Cache of enabled rules whose `endsAt` is null or in the future, indexed broker → timeframe → rules,
refreshed by the routes after any change and every minute by a timer (so a rule ends on time without
a request). `getRules(broker, timeframe)`; `hasAny()`.

### `alerts/ema-notification-evaluator.ts`

Hooks into the same candle-close detection the EMA alerts use: `evaluateEmaNotifications(broker,
batch)` is called next to `evaluateEmaAlerts` in `index.ts` and keeps its own `broker:symbol:tf → last
candle time` map. On a close of `tf` for `symbol`:

1. Rules of (broker, tf) whose `symbols` is empty or contains `symbol`.
2. Candles: last `max(fast, slow) + 2` closed candles of the symbol (max 200), EMAs with
   `calculateEma`, gap now / previous in pips (`getPipSize`).
3. **Cross** = sign(gapNow) ≠ sign(gapPrev) → direction `buy` when gapNow > 0 else `sell`.
   **Approach** = |gapNow| < |gapPrev| and |gapNow| ≤ thresholdPips and no cross on this candle →
   direction `buy` when gapNow < 0 (fast rising to the slow) else `sell`.
4. Direction filter; event filter (`cross`, `approach`, `both`).
5. Repeat: the latest `ema_notification_events` row of (rule, symbol). For a **cross** fire only when
   its `candleTime` differs from the crossing candle (once per crossing candle, whatever `repeatMinutes`).
   For an **approach**: `repeatMinutes` null → fire only if the latest event is not an approach of the
   same direction still "open" (the gap left the threshold or a cross happened since; detected by the
   last event being a cross or older than the moment the gap was last outside the threshold — tracked
   in memory per rule+symbol as `approachOpenSince`); `repeatMinutes` N → fire when `firedAt` is at
   least N minutes ago.
6. Fire: insert the event row, `sendToUser(push)` with title `EURUSD H1 · bullish cross` / `· approach
   (2.1 p)` and body with broker, EMAs, note; WS `ema_notification` to the user (new broadcaster in
   `ws.ts`, same pattern as `broadcastEmaAlert`).

The chart's `ema-alert-evaluator` is untouched; both consume the batch.

### Routes

- `routes/ema-notifications.ts` mounted at `/ema-notifications` (17 routers): `GET /` (rules with
  their latest event per symbol → `lastFired`, and `state`: `active` | `paused` | `ended`), `POST /`,
  `PUT /:id`, `DELETE /:id`, with the validation style of `ema-alerts.ts` (symbols array of non-empty
  strings, timeframe enum, event / direction enums, thresholdPips > 0 when event ≠ cross,
  repeatMinutes null or integer ≥ 1, endsAt null or ISO date, note string | null). Every write calls
  `refreshEmaNotifications()`.
- `routes/push.ts`: `POST /subscribe` stores `userAgent` from the request header; `GET /` lists the
  user's subscriptions (`id`, `label` parsed from the user agent: browser · OS, `createdAt`,
  `lastPushAt`, `endpoint` hash so the client can mark its own); `DELETE /:id`. `services/push.ts`
  updates `lastPushAt` on a successful send.
- `GET /symbols?broker=` already exists for the chip list (checked in task 4).

### Docs

`docs/architecture.md` (routers 17, models, alerts section) and `.claude/CLAUDE.md` mirror it.

## Frontend

### Settings page

`features/settings/SettingsPage.tsx` becomes the shell: Journal-style tab bar (`JournalPage.module.css`
patterns copied into `SettingsPage.module.css`, mobile rules included), tabs **Mirror** / **Display** /
**Notifications**, right side per tab: Mirror and Display show "Unsaved changes" + **Save** (one save
for both, as today's `PUT /settings`); Notifications shows **Devices · n** and **+ New notification**.
On mobile the right side becomes the full-width button row under the tabs. Content width: the page's
full width (the 600 px cap goes).

- `MirrorTab.tsx`: table on desktop (Broker, Mirror toggle, Sizing, Lots / %, Account, Balance from
  `/balances`), stacked rows on mobile; `inputMode="decimal"` on the lots / % input (AC 8).
- `DisplayTab.tsx`: today's rows, same look.
- `NotificationsTab.tsx`: table on desktop (On toggle, Symbols + broker, TF, EMAs, Event, Direction,
  Repeat, Ends, State badge, Last fired, Edit / Delete), cards on mobile (`PositionCard`-style summary:
  toggle, symbols, "TF · EMAs · event" label, state badge; expanded details; Edit / Delete). State
  colours: active green, paused muted, ended gold.
- `NotificationPanel.tsx`: the mockup's form in `BulkEditPanel.module.css` sizes: broker + timeframe
  selects, symbol chips in a 5-column grid from `/symbols?broker=` with "All symbols of the broker",
  EMA fast / slow, event and direction as segmented buttons, threshold (hidden when event = cross),
  repeat select + minutes, ends as `dd/mm/yyyy hh:mm` text (parsed as in the book), note. Create / Save.
- `DevicesPanel.tsx`: "This device · off" box with **Enable this device** (`usePush().subscribe`) when
  the current endpoint is not in the list; the list with label, since, last push, "this device", Remove.
- `lib/useEmaNotifications.ts` (list, create, update, delete, toggle) and `lib/usePushDevices.ts`
  (list, remove, current endpoint via the service worker's `pushManager.getSubscription()`).
- Toast: `useWs` consumers already show `ema_alert`; the same place shows `ema_notification` ("EURUSD H1
  · bullish cross · darwinex").
- Chart's `AlertsPanel`: its push control is replaced by a one-line hint "Manage devices in Settings";
  everything else untouched.

### Files

```
backend/prisma/migrations/20261024000000_ema_notifications/migration.sql   new
backend/prisma/schema.prisma                                              edit
backend/src/alerts/ema-notification-store.ts, ema-notification-evaluator.ts  new
backend/src/routes/ema-notifications.ts                                   new
backend/src/routes/push.ts, services/push.ts, ws/ws.ts, index.ts, app.ts  edit
backend/docs/architecture.md, .claude/CLAUDE.md                           edit
frontend/src/features/settings/SettingsPage.tsx + .module.css             rewrite
frontend/src/features/settings/MirrorTab.tsx, DisplayTab.tsx, NotificationsTab.tsx,
  NotificationPanel.tsx, DevicesPanel.tsx (+ .module.css where needed)    new
frontend/src/lib/useEmaNotifications.ts, usePushDevices.ts               new
frontend/src/features/chart/AlertsPanel.tsx                               edit (push control → hint)
frontend/src/lib/book.ts                                                  edit (export parseBookInput / toBookInput for reuse) or a shared util
```

## Mockup

Design artifact approved by the user on 2026-10-23: https://claude.ai/artifact/9wXuSNmvu7y1fg4dHrNb2t.
Artboards: Settings · Notifications desktop (tab bar with Devices · n and + New notification, table),
Settings · Mirror desktop (full-width table, Unsaved changes + Save in the bar), Settings · Notifications
mobile (Devices and + New notification in the button row, cards), Settings · Mirror mobile (rows with
New Trade sizes, Save in the button row), New notification panel (mobile sizes, symbol chips in rows of
five), Devices panel (Enable this device box, subscribed devices with Remove).

## Risks

- A rule on "all symbols" of a broker with many symbols evaluates one query per symbol per candle
  close; M5 across 30 symbols is 30 small queries every 5 minutes — fine, but D1 / H4 rules are the
  intended use for groups.
- Candle closes are detected from ticks: a timeframe with no tick after the close is evaluated at the
  next tick, as the EMA alerts are today.
- Push delivery is best effort (iOS needs the installed PWA); the in-app toast always fires.
