# 030 — Fast reflection of closed trades · Design

## Approach

Shorten every hop of the closed-trade path and add a push signal at the end:

```
EA (history changed → write history.json, ≥3 s apart)
  → bridge/history.json
  → FileWatcher (5 s, skips unchanged content) → syncTrades / syncBalanceOperations
  → WS broadcast { type: "trades_updated", broker }
  → Stats / History page refetch (debounced)
```

## Per-layer changes

### EA — `ea/HttpBridgeState.mq4`
- New global `int g_lastHistoryTotal = -1` and `ulong lastHistoryWrite = 0`.
- New input `HISTORY_MIN_GAP_S = 3`.
- In the timer loop, after the account block and before the state block: if `OrdersHistoryTotal() != g_lastHistoryTotal` and `now - lastHistoryWrite >= HISTORY_MIN_GAP_S * 1000`, call `WriteHistory()`, store the total and the time, and log `[STATE] History changed`.
- The state block keeps calling `WriteHistory()` every 60 s (and updates `lastHistoryWrite` / `g_lastHistoryTotal`), so a missed detection is still covered by the regular cycle (AC 2).
- `OrdersHistoryTotal()` counts what the terminal's Account History tab shows — same source `WriteHistory()` already uses, no new limitation.
- No change to the `history.json` format: the EA ↔ backend file contract is unchanged.

### Backend
- `bridge/file-watcher.ts`
  - Default interval `30_000` → `5_000` (AC 3).
  - `history.json` and `account.json` get the same skip the candle files have: first by `mtime`/size, then by **content** (the last raw string per file). The EA rewrites both every 60 s with mostly identical content, so the content check keeps a 60 s rewrite with no new trades from hitting the DB and from firing `trades_updated`. Today both files are re-upserted on every poll; this removes that load.
  - The stamp/content is remembered only after the handler succeeds, so a DB failure is retried next poll (same rule as candles).
- `index.ts`: after `syncTrades` + `syncBalanceOperations` succeed, `if (features.wsBroadcast) wss.broadcastTradesUpdated(brokerName)`.
- `ws/ws.ts`: `broadcastTradesUpdated(broker)` → `broadcast('trades_updated', { broker })` (AC 4, AC 7). Additive message.
- Tests: `file-watcher` — unchanged history file is not handed twice; changed content is; a failed handler is retried.

### Frontend
- `features/stats/StatsPage.tsx`: a `refreshKey` counter in the fetch effect's deps. `useWs` listens to `trades_updated` and, when `broker` matches the selected broker, bumps the counter after a 1 s debounce. The `requestKey` does not include `refreshKey`, so the current result stays on screen until the new one arrives — no loading flash (AC 5).
- `features/journal/ClosedPositions.tsx`: the same counter on its `/trades` effect, without setting `loading` for a refresh (only a range change shows the loader). It fetches every broker, so any `trades_updated` triggers it.
- A small shared hook `lib/useTradesUpdated.ts` (`useTradesUpdated(onUpdate, broker?)`) holds the WS filter + debounce so the two pages don't duplicate it.

## Mockup
Not applicable: no screen, panel or state changes visually — the pages only refresh their existing data.

## Data flow / contract
- EA ↔ backend: unchanged (same file, written more often).
- Backend ↔ frontend: new WS message `{ type: "trades_updated", broker }`; existing messages unchanged.

## Alternatives considered
- **Detect the close in the backend from the pipe positions** (a ticket disappears) and read `history.json` right away: no EA change, but the EA has not written the closed trade yet, so it would still wait for the 60 s cycle. Rejected.
- **Send the closed trades over the pipe**: fastest, but a new pipe message and a second persistence path for trades. Disproportionate for a few seconds of gain.

## Files
- `ea/HttpBridgeState.mq4`
- `backend/src/bridge/file-watcher.ts`, `backend/src/bridge/file-watcher.test.ts` (new or extended), `backend/src/index.ts`, `backend/src/ws/ws.ts`
- `frontend/src/lib/useTradesUpdated.ts` (new), `frontend/src/features/stats/StatsPage.tsx`, `frontend/src/features/journal/ClosedPositions.tsx`
- `.claude/CLAUDE.md` + `backend/docs/architecture.md`: watcher interval and the new WS message.

## Risks
- **EA deploy** needs the MT4 terminals reloaded — only through AMFX-Watchdog, never from SSH. Backend + frontend ship first and already help (5 s watcher, auto refresh); the EA can follow later.
- **Bursts of closes**: the 3 s gap caps EA writes; the watcher upserts, so repeated writes are harmless.
- **Partial file read**: the EA could be writing while the watcher reads — already the case today; a JSON parse error is logged and the next poll retries.
