# 009 · BE-05 — WebSocket hardening

> Status: **closed**
> Origin: [backend audit 2026-09-30](../../../reports/2026-09-30-backend.md), improvement 5 (diagnosis D)

## Context

The backend exposes `/ws` for the real-time feed (ticks, positions, account, command results, price and EMA-cross alerts). Today the socket is accepted first and the JWT cookie is checked afterwards, in the `connection` handler, which closes the socket with code 1008 when it is missing or invalid. The `Origin` header is never checked, while the session cookie is issued with `SameSite=None` for `.amfxtrading.com`: any web page open in the user's browser can open `/ws` and read the whole feed (cross-site WebSocket hijacking). There is no ping/pong, so a client whose TCP connection died silently (laptop lid closed, mobile network switch) stays in `wss.clients` and keeps receiving writes that pile up in its send buffer with no limit; the same happens to a tab the browser has frozen. Finally every message goes to every client: price and EMA alerts carry the owner's `userId` and the frontend discards the ones that are not its own, so a second user would see the alerts of the first on the wire.

The REST API already has an allow-list of origins for CORS (`app.ts`, `*.amfxtrading.com` with an optional port, which also covers the local HTTPS dev host); the WS must apply the same rule.

## Affected layers

- backend

No frontend change: the client already reconnects on close and already filters alerts by `userId`; those fields stay in the messages.

## User stories

- As the only user of the platform, I want a page from another site to be unable to open my real-time feed with my session cookie, so that my prices, positions and account stay private even if I browse a hostile site.
- As the operator, I want dead or frozen clients to be dropped within a minute, so that the backend's memory does not grow with stale sockets between pm2 restarts.
- As a user, I want my price and EMA alerts to be delivered only to my own sessions, so that another account on the same backend never receives them.

## Acceptance criteria

- AC 1. WHEN an upgrade request to `/ws` carries an `Origin` not in the allow-list THEN the server answers `403` and no WebSocket is created (nothing is logged as a client connection).
- AC 2. WHEN an upgrade request to `/ws` has no valid `token` cookie THEN the server answers `401` and no WebSocket is created.
- AC 3. WHEN the upgrade passes both checks THEN the socket is created with the `userId` from the JWT attached to it.
- AC 4. WHEN a connected client does not answer a ping within the heartbeat interval (30 s) THEN the server terminates it and it disappears from the client count; a healthy client is never dropped by the heartbeat.
- AC 5. WHEN a client's send buffer exceeds 1 MB THEN broadcasts skip it (the socket stays open); WHEN it exceeds 8 MB THEN the server terminates it. A client that reads normally never hits either threshold.
- AC 6. WHEN a price alert or EMA-cross alert fires for user U THEN only the sockets whose `userId` is U receive `alert` / `ema_alert`; ticks, positions, account and `command_result` keep going to every authenticated client.
- AC 7. WHEN the frontend in production and in local development (Vite proxy, `local.amfxtrading.com`) connects THEN it keeps receiving ticks, positions, account and alerts exactly as today, including after a reconnect.
- AC 8. WHEN the process receives `SIGTERM` THEN the heartbeat interval is cleared and the WebSocket server is closed before the HTTP server (no dangling timer keeps the process alive).

## Out of scope

- Per-broker or per-page subscriptions (every client still receives every broker's feed).
- Changing the frontend's reconnect policy (it retries every 3 s even when logged out; same as today).
- `ema_alert` consumption in the frontend (emitted, nobody listens; audit BE-10 / frontend audit).
- Message schema changes: all payloads keep their current shape.
