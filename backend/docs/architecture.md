# Backend — Architecture

## Overview

The backend is a Node.js + TypeScript process that runs persistently on the VPS. It sits between the MT4 EA bridge and the frontend, handling three responsibilities:

1. **Ingest** — read data from the EA (Named Pipe + bridge files)
2. **Persist** — store relevant data in PostgreSQL
3. **Serve** — expose ticks via WebSocket and accept commands via HTTP

## Data flow

```
MT4 EA (HttpBridgeState)
    │
    ├── Named Pipe \\.\pipe\mt4tick (100ms tick batches)
    │       └── pipe-reader.ts → EventEmitter('ticks')
    │               └── ws/ticks.ts → WebSocket /ws/ticks → Frontend
    │
    └── bridge/*.json (every 60s, written by EA)
            └── file-watcher.ts (polls every 30s) → EventEmitter
                    ├── 'candles'   → services/candles.ts   → PostgreSQL
                    ├── 'positions' → services/positions.ts → PostgreSQL
                    ├── 'history'   → services/trades.ts    → PostgreSQL
                    └── 'account'   → services/account.ts   → PostgreSQL

Frontend
    └── POST /commands
            └── routes/commands.ts → writes command.json to bridge/
                    └── MT4 EA (HttpBridgeCommands) picks it up within 1s
```

## Project structure

```
backend/
├── prisma/
│   └── schema.prisma         # DB models
├── src/
│   ├── index.ts              # Entry point: connects DB, starts pipe + watcher + HTTP server
│   ├── app.ts                # Express app: middlewares, routes
│   ├── config.ts             # Env var validation and export
│   ├── db/
│   │   └── client.ts         # Prisma singleton
│   ├── bridge/
│   │   ├── pipe-reader.ts    # Named Pipe client, emits 'ticks' batches
│   │   └── file-watcher.ts   # Polls bridge/*.json, emits typed events
│   ├── services/
│   │   ├── candles.ts        # Upsert candles (M5/M15/H1/H4/D1)
│   │   ├── positions.ts      # Sync open positions (delete closed, upsert open)
│   │   ├── trades.ts         # Upsert closed trades from history
│   │   └── account.ts        # Insert account snapshot
│   ├── routes/
│   │   └── commands.ts       # POST /commands → writes command.json
│   └── ws/
│       └── ticks.ts          # WebSocket server, broadcasts tick batches
├── .env.example
├── package.json
└── tsconfig.json
```

## Environment variables

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL connection string |
| `PORT` | HTTP server port (default: 3000) |
| `BRIDGE_PATH` | Absolute path to `MQL4/Files/bridge/` of the target MT4 terminal |
| `BROKER_NAME` | Broker identifier stored with all DB records (matches EA config.json) |

Copy `.env.example` to `.env` and fill in the values before starting.

## HTTP API

### `GET /health`
Returns `{ "status": "ok" }`. Used to verify the server is running.

### `POST /commands`
Sends a trading command to the EA by writing `command.json` to the bridge folder.

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

## WebSocket

### `ws://host/ws/ticks`

Broadcasts tick batches every 100ms. Each message is a JSON array — one object per configured symbol:

```json
[
  {
    "symbol": "EURUSD",
    "bid": 1.08432,
    "ask": 1.08435,
    "time": 1718620800000,
    "broker_offset": 7200,
    "m5_time": 1718620500000, "m5_open": 1.08410, "m5_high": 1.08445, "m5_low": 1.08398,
    "m15_time": 1718619600000, "m15_open": 1.08380, "m15_high": 1.08450, "m15_low": 1.08370,
    "h1_time": 1718618400000, "h1_open": 1.08300, "h1_high": 1.08460, "h1_low": 1.08280,
    "h4_time": 1718604000000, "h4_open": 1.08150, "h4_high": 1.08470, "h4_low": 1.08100,
    "d1_time": 1718496000000, "d1_open": 1.07900, "d1_high": 1.08470, "d1_low": 1.07850
  }
]
```

Messages only flow when there are connected clients — the backend skips broadcast if `clients.size === 0`.

## Database

Managed with **Prisma**. See `prisma/schema.prisma` for the full schema.

| Table | Description | Write pattern |
|-------|-------------|---------------|
| `candles` | OHLC bars for M5/M15/H1/H4/D1 | Upsert on (broker, symbol, timeframe, time) |
| `positions` | Currently open positions | Full sync: deletes closed, upserts open |
| `trades` | Closed trade history | Upsert by ticket (insert once, never update) |
| `account_snapshots` | Account state over time | Insert on every poll cycle |

### Common commands

```bash
# Run migrations on the VPS
npm run db:migrate

# Regenerate Prisma client after schema changes
npm run db:generate

# Open Prisma Studio (local DB browser)
npm run db:studio
```

## Running locally / on VPS

```bash
# Install dependencies
npm install

# Generate Prisma client
npx prisma generate

# Run migrations
npx prisma migrate deploy

# Development (hot reload)
npm run dev

# Production build
npm run build
npm start
```
