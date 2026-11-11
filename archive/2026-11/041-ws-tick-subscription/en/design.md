# 041 — WebSocket tick subscription · Design

> Status: **closed**

## Approach

The WebSocket becomes bidirectional for one message only: the client sends `subscribe` with the broker/symbol pairs it needs, the backend keeps that set per client and filters every tick batch against it before sending. Everything else (handshake, heartbeat, backpressure, the other message types) stays as it is.

The frontend centralises the set in `lib/ws.ts`: components declare the pair they need through a hook, the module keeps a reference-counted union and sends it whenever it changes and on every (re)connect. Components keep reading `ticks` messages exactly as today, so the filtering is invisible to them.

No visual change: no mockup for this spec.

## Protocol

Client → server, the only inbound message:

```json
{ "type": "subscribe", "ticks": [ { "broker": "solidary III", "symbol": "EURUSD" } ] }
```

- Full replacement: the list is the whole set; `[]` stops the ticks.
- Limits: at most 16 pairs; `broker` and `symbol` non-empty strings up to 64 characters; the frame up to 4 KiB (`maxPayload` of the `ws` server). Anything else is ignored and the previous set is kept (AC 6).
- No acknowledgement: the next matching batch is the confirmation.

Server → client, unchanged shape:

```json
{ "type": "ticks", "broker": "solidary III", "ticks": [ ...only subscribed symbols of that broker... ] }
```

## Backend changes (`backend/src/ws/`)

**`policy.ts`**
- `parseSubscription(raw: unknown): Set<string> | null` — validates the message and returns the set of `broker|symbol` keys, or `null` when it is not a valid `subscribe` (pure, unit-tested).
- Constants `SUBSCRIBE_MAX_PAIRS = 16`, `SUBSCRIBE_MAX_PAYLOAD = 4096`.

**`ws.ts`**
- `Client` gains `tickKeys: Set<string>` (empty on connect, AC 1).
- `WebSocketServer({ noServer: true, maxPayload: SUBSCRIBE_MAX_PAYLOAD })`. `ws` closes a client that exceeds `maxPayload` with 1009; a client sending many small valid frames costs one `JSON.parse` per frame, cheap enough that no extra rate limit is needed (the existing `sendDecision` keeps handling slow readers).
- `ws.on('message')`: `parseSubscription` → replace `client.tickKeys` or ignore.
- `broadcastTicks(broker, batch)`: for each client with a non-empty set, filter `batch` to the ticks whose `broker|symbol` is in the set; skip the client when the filtered batch is empty; otherwise `send`. Messages are encoded once per distinct filtered batch (a small `Map<string, string>` keyed by the joined symbol list, built per broadcast) so N clients on the same chart cost one `JSON.stringify`.
- The other `broadcast*` functions do not look at `tickKeys` (AC 8).

**Tests (`ws.test.ts`)**
- Existing "broadcasts ticks to every client" becomes: no ticks before subscribing; each client receives only its pairs; a batch with no match is not sent; an empty subscription stops the ticks; a malformed frame keeps the previous set; alerts still per owner.
- `policy.test.ts` (new or extended): `parseSubscription` on valid, too many pairs, bad types, unknown `type`.

**Docs**: `backend/docs/architecture.md` WebSocket section and the `.claude/CLAUDE.md` WS line gain the `subscribe` message and the "no ticks until subscribed" rule.

## Frontend changes (`frontend/src/`)

**`lib/ws.ts`**
- `const tickRefs = new Map<string, number>()` — key `broker|symbol`, value reference count.
- `addTickSubscription(broker, symbol)` / `removeTickSubscription(broker, symbol)` update the map and schedule `flushSubscription()` on a microtask (several components changing in the same render produce one frame).
- `flushSubscription()` sends `{ type: 'subscribe', ticks: [...] }` when the socket is open and the serialised set differs from the last one sent.
- `socket.onopen` calls `flushSubscription()` with `lastSent = null`, so every reconnect re-sends the current set (AC 5).

**`lib/useTickSubscription.ts`** (new)
```ts
export function useTickSubscription(broker: string, symbol: string): void
```
`useEffect` on `[broker, symbol]`: adds when both are non-empty, removes on cleanup. Pure declaration, no return value.

**Consumers**
- `features/chart/ChartSlot.tsx`: `useTickSubscription(broker, symbol)` — one call per slot, so split view subscribes both pairs (AC 4).
- `features/chart/ChartPage.tsx`: the alerts panel price uses the same pair as the chart; it declares it too so the panel keeps working if the slots ever change independently. The reference count collapses the duplicate.
- `features/journal/NewTradePanel.tsx`: `useTickSubscription(open ? levelsBroker : '', open ? symbol : '')` — subscribed only while the panel is open, released on close.

Nothing else changes: the `useWs` listeners still receive `ticks` messages and filter by broker/symbol as today, which also covers the few batches of the previous selection that may arrive between a selection change and the new subscription taking effect.

## Data flow

```
EA ──pipe──▶ PipeReader ──'ticks'──▶ index.ts ──▶ wss.broadcastTicks(broker, batch)
                                                        │ per client: filter by tickKeys
                                                        ▼
Frontend lib/ws.ts ◀──{type:'ticks', broker, ticks:[subset]}──┘
        ▲
        └──{type:'subscribe', ticks:[{broker,symbol}...]}── on change / on open
             ▲
   useTickSubscription() in ChartSlot · ChartPage · NewTradePanel
```

## Files to touch

| Layer | File | Change |
|---|---|---|
| backend | `src/ws/policy.ts` | `parseSubscription`, limits |
| backend | `src/ws/ws.ts` | `tickKeys` per client, `maxPayload`, inbound handler, filtered `broadcastTicks` |
| backend | `src/ws/ws.test.ts`, `src/ws/policy.test.ts` | subscription tests |
| backend | `docs/architecture.md` | WebSocket section |
| frontend | `src/lib/ws.ts` | subscription registry + `subscribe` frame |
| frontend | `src/lib/useTickSubscription.ts` | new hook |
| frontend | `src/features/chart/ChartSlot.tsx`, `ChartPage.tsx`, `src/features/journal/NewTradePanel.tsx` | declare their pair |
| — | `.claude/CLAUDE.md` | WS line |

No DB change, no new dependency.

## Verification of AC 7

The measurement script used on 2026-11-10 (connects to `ws://localhost:3000/ws` on the VPS with a signed token and counts bytes for 60 s) is kept under `backend/scripts/ws-measure.js` and gains an optional `--subscribe broker:symbol` argument. Run twice after the backend deploy: without subscription (expect ≈ 0 B of ticks) and with one pair (expect well under 16 KB/s at similar market activity). The two numbers go to `verification.md`.

## Risks

- **Cached old frontend after the backend deploy**: it never subscribes, so its charts stop updating live until the user reloads (AC 9 accepts this; the PWA service worker may serve the old bundle for one more visit). Deploy the frontend right after the backend to keep that window short.
- **Selection change race**: between `subscribe` leaving the browser and the backend applying it, a few batches of the old pair may still arrive; the existing per-component broker/symbol checks discard them. Conversely, up to one tick interval (100 ms) can pass before the first tick of the new pair: invisible next to the REST candle load that runs at the same time.
- **Backpressure interaction**: a filtered batch is smaller, so `bufferedAmount` grows slower; `sendDecision` thresholds stay as they are.

## Alternatives considered

- **Send everything to clients that never subscribe** (backward compatible): keeps old bundles working but defeats the saving for any client that fails to subscribe, and hides bugs. Rejected by the requirements (AC 1).
- **Subscribe by broker only**: simpler frame, but a broker with 7 symbols still sends 7× what the chart needs. Rejected; pair granularity costs nothing extra.
- **Query string on the upgrade** (`/ws?broker=…&symbol=…`): no inbound message needed, but every selection change would reconnect. Rejected.
