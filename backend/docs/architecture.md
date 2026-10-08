# Backend — Architecture

## Overview

The backend is one Node.js + TypeScript process (pm2 on the Windows VPS) that sits between the MT4 Expert Advisors and the frontend:

1. **Ingest** — one `PipeReader` and one `FileWatcher` per broker listed in `brokers.json`.
2. **Persist** — candles, trades, balance operations and daily balances in PostgreSQL (Prisma).
3. **Serve** — a cookie-authenticated HTTP API, a WebSocket that streams ticks, positions, account and alerts, and the command bridge back to the EA.

## Data flow

```
MT4 EA (one terminal per broker)
    │
    ├── Named Pipe \\.\pipe\mt4tick_<broker>   (backend is the SERVER, the EA connects)
    │       └── bridge/pipe-reader.ts — one JSON line per message:
    │               [ …ticks ]                   every 100 ms → store/ticks, WS 'ticks', alerts
    │               { "type": "positions", … }   every 1 s   → store/positions, WS 'positions', position colours
    │               { "type": "account", … }     every 1 s   → store/accounts, WS 'account'
    │
    └── <bridgePath>/*.json (written by the EA every 60 s)
            └── bridge/file-watcher.ts — polls every 30 s, skips files whose mtime/size did not change
                    ├── candles_<SYM>_<TF>.json → services/candles.ts            → candles (closed bars only)
                    ├── history.json            → services/trades.ts             → trades
                    │                           → services/balance-operations.ts → balance_operations
                    └── account.json            → services/account.ts            → balances (one row per broker and UTC day)
                                                → WS 'account'
                (positions.json is also written by the EA but nobody reads it)

Frontend ──HTTP (JWT cookie)──▶ Express routes ──▶ PostgreSQL / in-memory stores
Frontend ◀──WebSocket /ws────── ws/ws.ts
Frontend ──POST /commands──▶ bridge/command-io.ts ──▶ <bridgePath>/command.json ──▶ EA
                                                   ◀── <bridgePath>/result.json, pending.json
```

Alerts run on the tick stream (`alerts/`): price alerts fire when the bid crosses the level between two ticks; EMA alerts fire at candle close (detected by a change of `<tf>_time` in the tick) when the fast and slow EMAs are converging within the threshold. A fired alert is updated in the DB, broadcast over the WebSocket to its owner and sent as a Web Push notification.

Feature flags (`FEATURE_PIPE`, `FEATURE_WATCHER`, `FEATURE_ALERTS`, `FEATURE_WS_BROADCAST`) switch each stage off with the literal value `false`; this is how a local backend runs against the production database without touching the bridges.

## Project structure

```
backend/
├── prisma/
│   ├── schema.prisma             # DB models
│   └── migrations/               # hand-written SQL, applied by `prisma migrate deploy`
├── scripts/
│   ├── deploy.ps1                # run on the VPS by the GitHub Actions deploy
│   └── db-tunnel.ps1             # local port → VPS PostgreSQL over SSH
├── src/
│   ├── index.ts                  # entry point: DB connect, WS server, one PipeReader + FileWatcher per broker
│   ├── app.ts                    # Express app: cors, json, cookies, routers, error handler
│   ├── config.ts                 # env vars, feature flags, brokers.json
│   ├── version.ts                # build number exposed by /health
│   ├── alerts/
│   │   ├── alert-evaluator.ts    # price alerts on every tick
│   │   ├── alert-store.ts        # armed price alerts cache
│   │   ├── ema-alert-evaluator.ts# EMA convergence alerts at candle close
│   │   └── ema-alert-store.ts    # armed EMA alerts cache
│   ├── bridge/
│   │   ├── pipe-reader.ts        # named-pipe server per broker, retries listen with backoff
│   │   ├── file-watcher.ts       # polls bridge/*.json, awaited handlers per file
│   │   └── command-io.ts         # command.json / result.json / pending.json I/O and waits
│   ├── db/
│   │   └── client.ts             # Prisma singleton (PRISMA_LOG=query logs queries)
│   ├── indicators/
│   │   ├── ema.ts                # EMA series
│   │   ├── ema-cross.ts          # EMA cross setups and their levels (ECC, EMA, EVL, MHL)
│   │   ├── pip-size.ts           # pip size per symbol
│   │   └── timeframe.ts          # timeframe → milliseconds
│   ├── middleware/
│   │   ├── asyncRoute.ts         # async handler wrapper
│   │   ├── errors.ts             # BadRequest & co, final error handler
│   │   ├── loginLimiter.ts       # in-memory login attempt limiter
│   │   ├── parse.ts              # query/body parsing helpers
│   │   └── requireAuth.ts        # JWT cookie → req.userId
│   ├── routes/                   # one router per path, see HTTP API
│   ├── services/
│   │   ├── account.ts            # daily balance upsert
│   │   ├── balance-operations.ts # deposits/withdrawals from history.json
│   │   ├── candles.ts            # closed candles createMany
│   │   ├── chunk.ts              # chunked createMany helper
│   │   ├── push.ts               # Web Push delivery (VAPID)
│   │   ├── scanner.ts            # EMA cross scanner per broker/timeframe
│   │   ├── sizing.ts             # risk % → lots
│   │   ├── stats.ts / stats-core.ts # account statistics
│   │   └── trades.ts             # closed trades createMany
│   ├── store/                    # in-memory, per broker
│   │   ├── ticks.ts              # last bid/ask per symbol
│   │   ├── positions.ts          # open positions from the pipe
│   │   ├── accounts.ts           # balance/currency from the pipe
│   │   ├── liveness.ts           # pipe state, last tick, last sync → /health
│   │   └── positionColors.ts     # user colours per ticket (DB-backed cache)
│   └── ws/
│       ├── ws.ts                 # WebSocket server on /ws
│       └── policy.ts             # allowed origins, heartbeat, backpressure thresholds
├── .env.example
├── package.json
└── tsconfig.json
```

## Environment variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `DATABASE_URL` | yes | — | PostgreSQL connection string |
| `JWT_SECRET` | yes | — | Signing secret of the session cookie |
| `BROKERS_FILE` | yes | — | Path to `brokers.json`: `[{ "name", "bridgePath" }]` (never committed) |
| `PORT` | no | `3000` | HTTP port |
| `COOKIE_DOMAIN` | no | `.amfxtrading.com` | Session cookie domain; `none` issues a host-only cookie for localhost |
| `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` | no | empty | Web Push keys; push is disabled when unset |
| `VAPID_SUBJECT` | no | `mailto:info@amfxtrading.com` | Web Push contact |
| `FEATURE_PIPE` / `FEATURE_WATCHER` / `FEATURE_ALERTS` / `FEATURE_WS_BROADCAST` | no | on | Only the literal value `false` disables a stage |
| `PRISMA_LOG` | no | empty | `query` logs every SQL statement |

Copy `.env.example` to `.env` and fill in the values before starting.

## HTTP API

Every router except `/auth` and `/health` sits behind `requireAuth`: the JWT travels in the HttpOnly cookie `token`, issued by `POST /auth/login` for 7 days. Query and body parameters are validated; a bad request answers `400 { error }` and any other failure reaches the final error handler (`500`) without crashing the process.

| Path | Methods | Purpose |
|------|---------|---------|
| `/auth` | `POST /login`, `POST /logout`, `GET /me` | Session (bcrypt, login attempt limiter) |
| `/health` | `GET` | Liveness per broker, unauthenticated (below) |
| `/commands` | `POST` | Send an order to the EA (below) |
| `/trades` | `GET` | Closed trades (broker, symbol, from, to, limit, offset) |
| `/positions` | `GET /live`, `PATCH /color` | Open positions from the stores; colour per ticket |
| `/balances` | `GET`, `GET /daily-pnl` | Daily balance rows; today's P&L per broker |
| `/settings` | `GET`, `PUT` | EA mirror settings per broker and display settings |
| `/symbols` | `GET` | Symbols with a tick per broker |
| `/candles` | `GET` | Closed candles (`before` / `after` paging, up to 5 000) |
| `/chart-indicators` | `GET`, `PUT` | The user's EMA list for the chart |
| `/drawings` | `GET`, `PUT` | Chart drawings per user, broker, symbol, timeframe |
| `/alerts` | `GET`, `POST`, `PUT /:id`, `DELETE /:id` | Price alerts |
| `/ema-alerts` | `GET`, `POST`, `PUT /:id`, `DELETE /:id` | EMA convergence alerts |
| `/scanner` | `GET` | EMA cross state of every symbol of a broker and timeframe |
| `/setup-levels` | `GET` | Levels of the last EMA cross setup of a symbol |
| `/push` | `GET /vapid`, `POST /subscribe`, `POST /unsubscribe` | Web Push subscriptions |
| `/stats` | `GET` | Account statistics per broker and period |

### `GET /health`
Unauthenticated, always `200` (the deploy and startup scripts only check the status code). Lists every configured broker with its liveness:

```json
{
  "status": "ok" | "degraded",
  "uptimeS": 5121,
  "brokers": [
    { "name": "darwinex", "pipe": "connected", "lastTickAt": "2026-10-02T08:14:03.120Z",
      "lastSyncAt": "2026-10-02T08:13:50.002Z", "tickAgeS": 1, "syncAgeS": 14 }
  ]
}
```

- `pipe`: `listening` (pipe open, EA not connected) · `connected` · `error` (listen failed, retried with backoff 1 s → 30 s) · `disabled` (`FEATURE_PIPE=false`).
- `lastTickAt` / `tickAgeS`: last message of any kind on the pipe. `lastSyncAt` / `syncAgeS`: last completed poll of the file watcher.
- `status` is `degraded` when any enabled broker is not `connected` or has no tick in the last 5 minutes (so it reads `degraded` over the weekend).

### `POST /commands`
Sends a trading command to the EA by writing `command.json` to the bridge folder (written as `command.tmp` and renamed, so the EA never reads a partial file). Answers `202 { status: "pending", id }`; the outcome arrives over the WebSocket as `command_result`:

- The backend polls `result.json` for 10 s; while the EA's `pending.json` carries the same `id` the wait extends up to 30 s.
- On expiry, if `command.json` is still there (the EA never read it) the backend removes it and broadcasts `{ id, status: "cancelled", error: "EA not running — order cancelled" }`: the order cannot execute later. Otherwise it broadcasts `{ id, status: "timeout", error: "No response from EA" }` and keeps watching 60 s more; a result that still arrives is broadcast with its real `status`/`ticket`/`error` plus `late: true` and logged as `[CMD:<broker>] late result id=…`.
- `error` carries the EA's `message` when present: `EA error: ticket not found (code 130)`.
- A `result.json` left over from an earlier command is removed and logged before the next command is written.

**Request body:**
```json
{
  "id": "cmd-abc123",
  "action": "buy",
  "symbol": "EURUSD",
  "lots": 0.10,
  "sl": 1.08500,
  "tp": 1.09500,
  "price": 0,
  "magic": 42
}
```

**Responses:**

| Status | Meaning |
|--------|---------|
| `202 Accepted` | Command written, EA will pick it up within 1s |
| `400 Bad Request` | Missing `action` or `id` |
| `409 Conflict` | A command is already pending (previous not yet processed) |
| `500 Internal Server Error` | Failed to write to bridge folder |

`action` is one of `buy`, `sell`, `buylimit`, `selllimit`, `buystop`, `sellstop`, `close`, `modify`. With `lotsMode: "risk_pct"` the backend sizes the order from the stop distance (`services/sizing.ts`, forex pairs only) and refuses with `400`/`503` when it cannot.

## WebSocket

### `/ws`

The upgrade is accepted only for an allowed `Origin` (`*.amfxtrading.com`) and a valid session cookie; anything else gets a plain HTTP `403`/`401`. Clients are pinged every 30 s and terminated when they miss a whole interval; a client whose send buffer grows past 1 MiB stops receiving until it drains, past 8 MiB it is terminated.

Every message is `{ "type", … }` with `broker` at the root (never per item):

| `type` | Payload | Source |
|--------|---------|--------|
| `ticks` | `{ broker, ticks: [ …tick ] }` | pipe, every 100 ms, only when `FEATURE_WS_BROADCAST` is on |
| `positions` | `{ broker, currency, brokerOffset, positions: [ …open positions with current bid/ask and colour ] }` | pipe, every 1 s |
| `account` | `{ broker, account }` | pipe every 1 s, and `account.json` every 30 s |
| `command_result` | `{ id, status, ticket?, error?, late? }` | command bridge |
| `alert` | `{ broker, symbol, price, direction }` | price alert, only to its owner |
| `ema_alert` | `{ broker, symbol, timeframe, direction }` | EMA alert, only to its owner |

A tick carries `symbol`, `bid`, `ask`, `time`, `broker_offset` and the open/high/low/time of the current M5, M15, H1, H4 and D1 candles, so the frontend builds the live candle itself; only closed candles are persisted.

## Database

Managed with **Prisma**; see `prisma/schema.prisma`. Migrations are hand-written SQL under `prisma/migrations/` and applied by `prisma migrate deploy` during the deploy.

| Table | Written by | Pattern |
|-------|------------|---------|
| `candles` | file watcher | `createMany({ skipDuplicates })` of closed bars; PK `(broker, symbol, timeframe, time)`; `time` is the bar open in broker time stored as UTC |
| `trades` | file watcher | `createMany({ skipDuplicates })` by ticket, never updated; indexes `(broker, closeTime)`, `(closeTime)`, `(broker, symbol)` |
| `balance_operations` | file watcher | deposits/withdrawals from `history.json`, `createMany({ skipDuplicates })` by ticket |
| `balances` | file watcher | one `upsert` per broker and UTC `day`, `timestamp` refreshed on every poll |
| `settings_mirror` | `/settings` | EA mirror settings per broker |
| `settings_display` | `/settings` | display settings (single row) |
| `position_colors` | `/positions/color` | colour per broker and ticket |
| `users` | — | created out of band; bcrypt password hash |
| `price_alerts`, `ema_cross_alerts` | `/alerts`, `/ema-alerts`, evaluators | per user; `triggeredAt` set when fired |
| `push_subscriptions` | `/push` | Web Push endpoints per user |
| `drawings` | `/drawings` | chart drawings JSON per user, broker, symbol, timeframe |
| `chart_indicators` | `/chart-indicators` | the user's EMA list |

### Common commands

```bash
npm run db:migrate    # prisma migrate deploy
npm run db:generate   # prisma generate
npm run db:studio     # prisma studio
```

## Running locally

```bash
npm install
npx prisma generate
npm run dev           # tsx watch src/index.ts
```

Against the production database: open the tunnel (`scripts/db-tunnel.ps1`), point `DATABASE_URL` at it and start with `FEATURE_PIPE=false FEATURE_WATCHER=false FEATURE_ALERTS=false` so the local process neither opens pipes nor writes to the DB.

Checks: `npm run lint`, `npm run typecheck`, `npm test` (Vitest, pure modules), `npm run build` (tsc → `dist/`).

## Deploy

Push to `master` touching `backend/**` → GitHub Actions (`.github/workflows/deploy-backend.yml`) runs the checks, then copies `scripts/deploy.ps1` to the VPS over the Cloudflare tunnel and runs it: `git reset/clean/pull` → `pm2 delete` → free port 3000 → `npm install` → `prisma generate` → `prisma migrate deploy` → `tsc` into `dist.next` → swap `dist` → `pm2 start` → `GET /health` → `pm2 save`. If any step after the build fails, the previous `dist` is restored and pm2 restarted on it; a failed migration stops the deploy before `dist` is touched.
