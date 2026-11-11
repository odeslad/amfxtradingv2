# 041 — WebSocket tick subscription

> Status: **closed**

## Context

The backend broadcasts every tick batch of every broker to every WebSocket client. Measured on production on 2026-11-10 (12:55 UTC, 11 brokers connected, 74 broker/symbol pairs): one open frontend receives ~320 KB/s (≈ 2.5 Mbit/s, ≈ 1.15 GB per hour), and 98 % of that volume is `ticks` messages. The frontend only uses the ticks of the broker/symbol pairs it has on screen: the live candle of each chart slot (one or two in split view), the price of the alerts panel, and the bid/ask of the New Trade panel. Everything else is parsed and discarded. On a mobile data plan an afternoon with the app open costs several GB.

The broker is only selectable on the chart. Accounts, Positions and Orders show every broker at once, but they do not read `ticks`: Accounts uses the `account` message and Positions / Orders use the `positions` message, which already carries the current bid/ask of each position (injected by the backend every second). Those pages keep working with no subscription at all.

This spec makes the tick stream per client: the frontend tells the backend which broker/symbol pairs it needs and the backend sends only those. `positions`, `account`, `candle`, `trades_updated`, `command_result`, `alert` and `ema_alert` keep their current behaviour.

## Affected layers

- backend · frontend

## User stories

- As a trader on a mobile connection, I want the app to download only the prices of the charts I am looking at, so that keeping it open does not eat my data plan.
- As a trader, I want the chart, the alerts panel and the New Trade panel to keep updating live exactly as they do today, so that the saving is invisible to me.
- As the operator of the VPS, I want the backend to send fewer bytes per client, so that more open devices do not saturate the upload link.

## Acceptance criteria

- AC 1. WHEN a WebSocket client connects THEN it receives no `ticks` messages until it has sent a subscription.
- AC 2. WHEN a client sends a subscription with a set of broker/symbol pairs THEN from then on it receives `ticks` messages containing only ticks of those pairs; a batch with no matching tick is not sent to that client.
- AC 3. WHEN a client sends a new subscription THEN it replaces the previous set entirely (an empty set stops the ticks).
- AC 4. WHEN the frontend's set of needed pairs changes (chart selection, split view, New Trade panel opened with another broker, panel closed) THEN it sends the new set within one tick interval, and the components depending on it keep updating live without a visible gap.
- AC 5. WHEN the WebSocket reconnects THEN the frontend re-sends its current set before any component notices a missing update.
- AC 6. WHEN a client sends a malformed subscription (wrong shape, unknown type, oversized) THEN the backend ignores it and keeps the previous set; a client that floods subscriptions is handled as a slow client today is (skipped, then terminated) rather than crashing the process.
- AC 7. WHEN the measurement script of 2026-11-10 is run again against the deployed backend with a subscription of one broker/symbol pair THEN the received volume is below 5 % of the unsubscribed volume (≈ 16 KB/s or less at the same market activity).
- AC 8. WHEN `positions`, `account`, `candle`, `trades_updated`, `command_result`, `alert` or `ema_alert` are emitted THEN they reach the clients exactly as before, regardless of the tick subscription; Accounts, Positions and Orders keep showing every broker live with no subscription.
- AC 9. WHEN a backend client that never subscribes (an old frontend build still cached) connects THEN it simply receives no ticks and the rest of the app works; the frontend deploy follows the backend deploy as usual.

## Out of scope

- Compressing the WebSocket (`permessage-deflate`).
- Slimming the tick payload (per-timeframe OHLC fields) or throttling the tick rate.
- Subscriptions for other message types (positions and account stay per broker as today).
- Server-side use of `hiddenBrokers` / `hiddenSymbols` (visibility stays a frontend concern).
