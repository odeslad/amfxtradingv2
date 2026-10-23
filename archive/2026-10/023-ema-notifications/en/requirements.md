# 023 — EMA cross notifications in Settings

> Status: **closed**

## Context

Today the only EMA warning is the one-shot alert created from the chart's Alerts panel: one broker,
one symbol, one timeframe, fires once when the EMAs converge within a threshold and disables itself.
The operator wants a **notifier** configured from Settings: standing rules that watch EMA crosses on one
or several symbols and timeframes, warn of confirmed crosses and / or of an approaching cross under a
pip threshold, for bullish or bearish crosses or both, can repeat every N minutes while the situation
lasts, can have an end time, and reach the operator by Web Push. The chart's alerts stay as they are.
Settings itself gets a new layout for desktop and mobile while the Notifications block is added, with the
push activation moved there from the chart.

Candles live per broker, so a rule names the broker whose candles it reads. Only EURUSD matters in the
near future, but a rule may target a list of symbols or every symbol of the broker.

## Affected layers

- frontend · backend · db

## User stories

- As the operator, I want to define EMA cross notifications from Settings, so that I am warned of the
  crosses I care about without opening a chart for each pair.
- As the operator, I want a notification to repeat every N minutes while the EMAs stay converging or
  crossed, and to stop by itself at a given time, so that it fits a session instead of firing once.
- As the operator, I want to pick bullish, bearish or both crosses, one symbol or a group, and the
  confirmed cross and / or its anticipation, so that one rule matches one way of trading.
- As the operator, I want Settings to be comfortable on desktop and on the phone, so that I can manage
  the mirror, the display and the notifications from either.

## Acceptance criteria

- AC 1. WHEN Settings opens THEN it shows three tabs — **Mirror**, **Display**, **Notifications** — with
  the same tab bar as the Journal; Mirror and Display keep their current fields and share one **Save**;
  the page uses the full content width on desktop and the New Trade form sizes on mobile.
- AC 2. WHEN the Notifications tab opens THEN its bar shows **Devices** (with the count of subscribed
  devices) next to **+ New notification**; Devices opens a side panel listing the user's push
  subscriptions (browser and system detected when subscribing, date, last push, "this device" marked)
  with Remove per row, and an **Enable this device** box when the current device is not subscribed (the
  control the chart's Alerts panel has today, moved here). The tab body is the list of the user's
  notifications: name / symbols, timeframe, EMA pair, event, direction, repeat, end, state (active,
  paused, ended) and last fired time, with a toggle, Edit and Delete per row (table on desktop, cards on
  mobile).
- AC 3. WHEN **New notification** is pressed THEN a side panel asks for: broker (reference candles),
  symbols (every symbol the broker trades, as chips in rows of five, one or several selectable, plus "all symbols of the broker"), timeframe (M5 / M15 / H1 / H4 / D1), EMA fast and slow,
  event (confirmed cross, approaching cross under N pips, or both), direction (bullish, bearish, both),
  repeat (once per event, or every N minutes while it lasts), end (optional date and time), note; Save
  creates it enabled. Edit opens the same panel filled in.
- AC 4. WHEN a candle of a rule's timeframe closes on a watched symbol THEN the backend evaluates the
  rule on the closed candles: a **confirmed cross** is the fast EMA changing side of the slow one on that
  candle; an **approaching cross** is the gap shrinking and within the threshold; the direction filter
  applies; a matching rule notifies through Web Push and a WebSocket message that the app shows as a
  toast.
- AC 5. WHEN a rule repeats every N minutes THEN after a notification the same symbol / timeframe is
  notified again at the first candle close at which the situation still holds and at least N minutes
  have passed; a rule set to once notifies one time per event (a confirmed cross once per crossing
  candle; an approach once until the gap leaves the threshold or the cross happens).
- AC 6. WHEN a rule's end time passes THEN it stops evaluating and shows as ended; WHEN its toggle is
  off THEN it is paused and nothing fires.
- AC 7. WHEN the user has no push subscription THEN the Devices block says so and the rules still fire
  in the app (toast) so nothing is lost on the open session; WHEN a device is removed THEN it stops
  receiving pushes at once.
- AC 8. WHEN the Mirror % risk (or any decimal field of Settings) is edited on the phone THEN the keyboard offers the decimal separator and the value keeps its decimals (today the iPhone keypad has none).
- AC 9. WHEN the chart's Alerts panel is used THEN its price and EMA alerts work exactly as before.

## Out of scope

- Email or any channel other than Web Push and the in-app toast.
- Removing or changing the chart's one-shot EMA alerts.
- Notifications on anything other than EMA crosses (price levels keep their own alerts).
- Evaluating between candle closes (live ticks); repeats are checked at candle closes.
