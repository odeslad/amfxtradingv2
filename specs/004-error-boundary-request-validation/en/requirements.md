# 004 — Error boundary and request validation

> Status: **approved**
> Origin: [backend audit 2026-09-30](../../../reports/2026-09-30-backend.md), improvement 1 (diagnosis A)

## Context

The backend is a single Node process (Express 4) that hosts every broker's pipe reader, the file watchers, the alert evaluators, the WebSocket and the HTTP API. Express 4 does not catch rejected promises from `async` route handlers, the app has no error middleware and the process has no `unhandledRejection` handler. On Node ≥ 15 an unhandled rejection terminates the process, so any request whose Prisma call throws — `GET /trades?limit=abc` (`take: NaN`), `?from=x` (Invalid Date), `GET /candles?before=x`, `PUT /chart-indicators` without `emas`, `PUT /settings` with a malformed `mirror`, or any transient database error — restarts the whole backend: ticks, live positions, armed alerts and in-flight command results are lost for several seconds. The user has confirmed sporadic restarts in production. Today only `stats`, `alerts`, `ema-alerts`, `setup-levels`, `scanner`, `drawings` and `push` validate their input; `trades`, `candles`, `positions/color`, `settings`, `chart-indicators` and `commands` pass raw values to Prisma or to the EA.

## Affected layers

- backend

## User stories

- As the operator, I want a malformed or failing request to produce an HTTP error response instead of restarting the backend, so that price feeds, alerts and pending orders are never interrupted by a bad request.
- As the frontend, I want invalid parameters rejected with a `400` and a clear message, so that bugs in the UI surface immediately instead of as `500`s or silent crashes.
- As the operator, I want every unexpected error logged with method, path and stack, so that the cause of a `500` can be found in the pm2 log.

## Acceptance criteria

- AC 1. WHEN an `async` route handler throws or rejects THEN the client receives `500 { "error": "Internal error" }`, the error is logged with method, path and stack, and the process keeps running.
- AC 2. WHEN a promise is rejected anywhere in the process without a handler THEN it is logged with a `[UNHANDLED]` prefix and the process keeps running.
- AC 3. WHEN `GET /trades` receives `limit` or `offset` that is not a non-negative integer, or `from`/`to` that is not a parseable date THEN it responds `400` with a message naming the parameter. Valid values keep today's behaviour (`limit` capped at 1000, default 200; `offset` default 0).
- AC 4. WHEN `GET /candles` receives `limit`, `before` or `after` that is not a positive integer (epoch seconds for `before`/`after`) THEN it responds `400`. Valid values keep today's behaviour (`limit` capped at 5000, default 500).
- AC 5. WHEN `GET /candles/emas` receives `emaFast` or `emaSlow` that is not a positive integer, or `from`/`to` that is not a positive integer THEN it responds `400`.
- AC 6. WHEN `PATCH /positions/color` receives a `ticket` that is not an integer or a `color` that is not a string THEN it responds `400`.
- AC 7. WHEN `PUT /settings` receives a `mirror` item without a non-empty string `broker`, a boolean `enabled`, a `lotsMode` of `"fixed"` or `"risk_pct"` and a finite positive `lots`, or a `display` without a `pnlMode` in `net | gross | pips | pct`, a `trendlineStyle` present but outside `solid | dashed | dotted`, a `trendlineColor` present but not a string, or a `trendlineWidth` present but not a positive integer THEN it responds `400` and writes nothing.
- AC 8. WHEN `PUT /chart-indicators` receives an `emas` that is not an array THEN it responds `400`.
- AC 9. WHEN `PUT /alerts/:id` or `PUT /ema-alerts/:id` receives a field with an invalid type or value (same rules as the corresponding `POST`, applied only to the fields present) THEN it responds `400` and updates nothing.
- AC 10. WHEN `POST /commands` receives an `action` outside `buy, sell, buylimit, selllimit, buystop, sellstop, close, modify`, a `lots` that is not a finite positive number when `lotsMode` is not `risk_pct`, an `sl`/`tp`/`price` that is present but not a finite number, a `ticket` that is present but not an integer, or an `id` that does not match `^[A-Za-z0-9_-]{1,64}$` THEN it responds `400` and nothing is written to `command.json`.
- AC 11. WHEN a query parameter that must be a single value is repeated (`?broker=a&broker=b`) THEN it responds `400` instead of receiving an array.
- AC 12. WHEN every request in the manual smoke list of `tasks.md` is sent against production THEN each returns the documented status and `pm2 list` shows no restart of `amfxtrading-backend` during the test.
- AC 13. WHEN all valid requests used by the frontend today are replayed THEN their responses are byte-identical to before the change (no behaviour change for valid input).

## Out of scope

- Login rate limiting, logout cookie fix, timing-safe login (spec 005).
- WebSocket origin check, heartbeat, per-user delivery (audit improvement 5).
- Command timeouts, atomic `command.json` write, `pending.json`, late results (audit improvement 6) — this spec validates the command body only.
- Sizing correctness (audit improvement 7).
- Bounded `GET /candles/emas` history (audit improvement 9) — this spec validates its parameters only.
- Upgrading to Express 5 (native async error handling); the wrapper introduced here becomes removable when that happens.
- Adding a validation library (zod/valibot): the handful of checks needed are written as small typed helpers with no new dependency.
