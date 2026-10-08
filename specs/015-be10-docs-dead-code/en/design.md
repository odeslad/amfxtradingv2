# 015 · BE-10 — Backend docs and dead code · Design

> Status: **approved**

## Approach

Four independent pieces, code first (so the docs describe the pruned code), docs last:

1. **`indicators/ema-cross.ts`** pruned to what `services/scanner.ts` and `routes/setup-levels.ts` read.
2. **Dead exports**, the stale `index.ts` comment, and a complete **`.env.example`**.
3. **`backend/docs/architecture.md`** rewritten against the code.
4. **`.claude/CLAUDE.md`** backend section rewritten; engine and strategy sections moved to **`epics/trading-engine/concept.md`**.

Nothing changes on the wire: no route, WS message, DB table or EA file is touched. The deploy is a normal backend deploy whose only observable effect is a faster scanner.

## 1. `indicators/ema-cross.ts` (`[backend]`)

### What the callers read

| Caller | Fields of `EmaCrossSetup` |
|---|---|
| `services/scanner.ts` | `direction`, `activationIndex`, `activationTime`, `activationPrice`, `mfePrice`, `maePrice` |
| `routes/setup-levels.ts` | `direction`, `activationTime`, `levels` |
| `ema-cross.test.ts` | the above plus `closeIndex`, `candleCount` |

### Resulting shape

```ts
export interface EmaCrossContext {
  emaFast: number;
  emaSlow: number;
  direction: 'buy' | 'sell' | 'both';
}

export interface EmaCrossSetup {
  direction: 'buy' | 'sell';
  activationIndex: number;
  activationTime: Date;
  activationPrice: number;
  closeIndex: number | null;
  closeTime: Date | null;
  closePrice: number | null;
  candleCount: number;
  levels: { ECC: number; EMA: number; EVL: number | null; MHL: number | null };
  mfePrice: number | null;
  mfeTime: Date | null;
  maePrice: number | null;
  maeTime: Date | null;
}
```

Removed: `WeakConfig`, `StrongConfig`, `PivotPoint`, `pivotLen` / `weakConfig` / `strongConfig` on the context, `weakCandles` / `strongCandles` / `pivots` on the setup, and the functions `classifyCandles`, `detectPivots`, `isSwingHigh`, `isSwingLow` (~130 lines). `closeTime` / `closePrice` stay: they cost nothing (already computed for `closeIndex`) and describe the setup's end, which `candleCount` depends on. The `pipSize` parameter of `detectEmaCrossSetups` was only consumed by `classifyCandles`; it goes too, and both callers drop the third argument (`pip` is still used by them for their own output).

Everything that remains (cross detection, `interpolateCross`, `findSetupClose`, `findPreviousOppositeCross`, `findEvl`, `findMhl`, `calculateMaeMfe`) is untouched, so every retained field keeps its value (AC 5).

### Verification of AC 5–6

Scanner and setup-levels answers depend on live candles, so a before/after comparison must use the same data:

1. Over the DB tunnel, dump the closed candles of two symbols × two timeframes (e.g. `EURUSD` H1 and `XAUUSD` H4, biggest broker) to the scratchpad as JSON fixtures — a few thousand rows, never committed.
2. A scratch `tsx` script (scratchpad) loads a fixture, calls `detectEmaCrossSetups(candles, { emaFast: 5, emaSlow: 20, direction: 'both' })` and writes the retained fields of every setup to a JSON file. Run once on the current `master` (before) and once after the prune; `diff` must be empty.
3. Local backend on port 3001 against the tunnel (pipe/watcher off): `curl` `/scanner?broker=…&tf=H4&emaFast=5&emaSlow=20` and `/setup-levels?…&tf=H4…` with a session cookie, before and after, inside the same H4 candle (the watcher is off locally and the H4 candle set only changes every four hours, so the input is stable); the two bodies must be byte-identical (AC 6). The `before` run happens at the start of task 1, before the file is edited.

`ema-cross.test.ts` loses the `pipSize` argument in its calls and nothing else: its assertions never touched the removed fields (AC 7).

## 2. Dead exports, `index.ts:1`, `.env.example` (`[backend]`)

An export-by-export search (every `export function|const|interface|type` grepped as a whole word across `src/`, tests included) finds no reader for:

| Export | Action |
|---|---|
| `store/positionColors.ts` `getColorsByBroker` | delete the function |
| `services/push.ts` `isPushEnabled` | delete the function |
| `bridge/command-io.ts` `POLL_MS` · `bridge/pipe-reader.ts` `RETRY_BASE_MS`, `RETRY_MAX_MS` · `services/chunk.ts` `CHUNK_SIZE` · `store/liveness.ts` `STALE_TICK_MS` · `routes/commands.ts` `ACTIONS` | drop the `export` keyword (module-private constants) |
| exported `interface` / `type` with no importer (`WaitOutcome`, `AccountHandler`, `ScannerRow`, `SizingResult`, `HealthReport`, …) | keep — they name the public shape of their module's result and cost nothing |

`index.ts:1` (`// deploy smoke test: verify deploy.ps1 recovers from the Prisma DLL lock`) is a leftover from spec 005's deploy rehearsal; deleted.

`.env.example` becomes the full list read by `config.ts` and `db/client.ts`:

```ini
# PostgreSQL connection string (required)
DATABASE_URL="postgresql://USER:PASSWORD@localhost:5432/amfxtradingv2"
# JWT signing secret for the session cookie (required; any long random string)
JWT_SECRET="change-me"
# Path to the brokers config: [{ "name": "...", "bridgePath": "C:\\...\\MQL4\\Files\\bridge" }] (required)
BROKERS_FILE="C:\\amfxtradingv2\\backend\\brokers.json"
# HTTP port (optional, default 3000)
PORT=3000
# Session cookie domain (optional, default .amfxtrading.com). "none" issues a host-only cookie for localhost.
COOKIE_DOMAIN=.amfxtrading.com
# Web Push VAPID keys (optional; push notifications are disabled when unset). Generate with `npx web-push generate-vapid-keys`.
VAPID_PUBLIC_KEY=
VAPID_PRIVATE_KEY=
VAPID_SUBJECT=mailto:info@amfxtrading.com
# Feature flags (optional; only the literal value false disables a feature)
FEATURE_PIPE=true
FEATURE_WATCHER=true
FEATURE_ALERTS=true
FEATURE_WS_BROADCAST=true
# Log every Prisma query (optional; set to "query" to enable)
PRISMA_LOG=
```

The DB name in the example changes from `amfxtrading` to `amfxtradingv2` (the real one). `web-push` is already a dependency (the key generation command uses its CLI).

## 3. `backend/docs/architecture.md` (`[backend]`)

Rewritten section by section; the `/health` and `POST /commands` sections from specs 010/012 are kept word for word.

- **Overview / data flow**: one `PipeReader` + one `FileWatcher` per broker from `brokers.json`; pipe `\\.\pipe\mt4tick_<broker>` (backend is the server) with three line types — array = tick batch (100 ms), `{type:"positions"}` (1 s), `{type:"account"}` (1 s); watcher polls every 30 s `account.json`, `history.json`, `candles_<SYM>_<TF>.json` (the EA writes them every 60 s; `positions.json` is written by the EA and read by nobody); in-memory stores (`ticks`, `positions`, `accounts`, `liveness`, `positionColors`); alerts evaluated on ticks (price) and at candle close (EMA convergence) → DB + WS + Web Push; `POST /commands` → `command.json` → `result.json` / `pending.json`.
- **Project structure**: the real `src/` tree (alerts, app, bridge, config, db, index, indicators, middleware, routes, services, store, version, ws).
- **Environment variables**: the table from `.env.example` above.
- **HTTP API**: route list from `app.ts` with one line each (`/auth`, `/commands`, `/trades`, `/positions`, `/balances`, `/settings`, `/symbols`, `/candles`, `/chart-indicators`, `/drawings`, `/alerts`, `/ema-alerts`, `/scanner`, `/setup-levels`, `/push`, `/stats`, `/health`), auth = JWT in an HttpOnly cookie, `requireAuth` on everything but `/auth` and `/health`; the existing `/health` and `POST /commands` sections.
- **WebSocket**: `/ws`, cookie JWT and `Origin` checked at upgrade, ping/pong, backpressure policy; message types `ticks`, `positions`, `account`, `command_result`, `alert`, `ema_alert` with `broker` at the root.
- **Database**: existing tables with their write pattern — `candles` (createMany skipDuplicates, closed candles only), `trades` (createMany skipDuplicates by ticket), `balance_operations`, `balances` (one upsert per broker and UTC day), `settings_mirror`, `settings_display`, `position_colors`, `users`, `price_alerts`, `ema_cross_alerts`, `push_subscriptions`, `drawings`, `chart_indicators`.
- **Running / deploy**: scripts (`dev`, `build`, `start`, `lint`, `typecheck`, `test`, `db:*`), `deploy.ps1` summary (migrate → build to `dist.next` → swap → pm2 restart → `/health`, rollback on failure).

## 4. `.claude/CLAUDE.md` and `epics/trading-engine/concept.md` (`[docs]`)

- Lines 320–575 of today's file (`## Trading Engine (Fase 2 — en diseño)`, `## Diseño del sistema de estrategias`, `## Pendiente backend (Fase 2)`) move verbatim to `epics/trading-engine/concept.md`, preceded by:

  ```markdown
  # Trading Engine — concept (moved from CLAUDE.md)

  > Moved on 2026-10-08 by spec 015 (BE-10). Design notes written during Fase 2 for an engine that was
  > started and then removed in spec 001; nothing below is implemented. Split into specs with /amfx-spec-new
  > when the engine is taken up again. Open items at the time of the move: trailing `riskCut`, levels `EMCC`
  > and `SHL`, entry distance filters, realtime mode.
  ```

- `## Arquitectura del backend (Fase 2 — implementada)` (lines 273–318) is rewritten in Spanish, same heading, with: communication table (pipe with its three message types, bridge files read by the watcher, command bridge with `pending.json` / late results / withdrawal), WS `/ws` message types with `broker` at the root, active candles built from ticks on the frontend, multi-broker, DB models list, deploy summary. It stays a summary (~50 lines) and points to `backend/docs/architecture.md` for detail; the two documents must not contradict each other.
- A one-line pointer to the epic goes under `## Estructura del proyecto` where `epics/` is described (already there) — no other section changes.

## Files

| File | Change |
|---|---|
| `backend/src/indicators/ema-cross.ts`, `ema-cross.test.ts` | prune; tests drop `pipSize` |
| `backend/src/services/scanner.ts`, `backend/src/routes/setup-levels.ts` | drop the third argument of `detectEmaCrossSetups` |
| `backend/src/store/positionColors.ts`, `backend/src/services/push.ts` | delete unused functions |
| `backend/src/bridge/command-io.ts`, `bridge/pipe-reader.ts`, `services/chunk.ts`, `store/liveness.ts`, `routes/commands.ts` | un-export constants |
| `backend/src/index.ts` | remove line 1 |
| `backend/.env.example` | full variable list |
| `backend/docs/architecture.md` | rewrite |
| `.claude/CLAUDE.md` | backend section rewritten; engine sections removed |
| `epics/trading-engine/concept.md` | new (moved content) |
| `reports/2026-09-30-backend.md` | `Spec` column of BE-10 → `015` / `015 ✅` |

## Risks

- **A retained field changes value after the prune** — ruled out by the fixture diff and the byte-identical route check; the retained functions are not edited.
- **Docs drift again** — mitigated by keeping `CLAUDE.md` a summary that defers to `architecture.md`, and by `architecture.md` naming only paths that exist (checked with a scripted `test -e` over every path it mentions, task 3).
- **Un-exporting a constant a future test wants** — re-export it then; no runtime effect.

## Alternatives considered

- **Delete the engine sections** — the user prefers to keep them as an epic.
- **Keep `pipSize` on `detectEmaCrossSetups` for future use** — unused parameters are exactly what this spec removes; it is one line to add back.
- **`ts-prune` / `knip` for dead exports** — a new dev dependency for a one-off; the grep search is enough and leaves no tooling behind.
