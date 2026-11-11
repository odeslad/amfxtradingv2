# 041 — WebSocket tick subscription · Verification

## Task 1 · [backend] `parseSubscription` + limits in `ws/policy.ts`

- **Mechanism:** `npm run build` + vitest on `policy.test.ts`.
- **Commands:** `npm run build` → ✓ (tsc clean) · `npx vitest run src/ws/policy.test.ts` → 12 passed (6 new: valid set deduplicated; empty list → empty set; Buffer input; 17 pairs rejected and 16 accepted; unknown type / missing list / non-array / non-JSON / null / array root rejected; bad types, empty and 65-char names, string and null items rejected).
- **Outcome:** ✅ pass on 2026-11-11.
- **Est vs Actual:** 0.75 SP · 0.5 SP.

## Task 2 · [backend] Per-client `tickKeys`, inbound `subscribe`, filtered `broadcastTicks`

- **Mechanism:** `npm run build` + vitest on `ws.test.ts`.
- **Commands:** `npm run build` → ✓ · `npx eslint src/ws/*.ts` → clean · `npx vitest run src/ws` → 23 passed (ws.test.ts 11: no ticks before subscribing; client A gets only EURUSD and client B both symbols of the same batch, another broker's batch and a GBPUSD-only batch are not delivered; a new frame replaces the set, non-JSON and a non-array list keep it, an empty list stops the ticks; alerts still only to their owner; upgrade gate and heartbeat unchanged).
- **Outcome:** ✅ pass on 2026-11-11.
- **Est vs Actual:** 1.5 SP · 1 SP.

## Task 3 · [backend] `scripts/ws-measure.ts` + docs

- **Mechanism:** the script runs against a backend without throwing; docs reviewed.
- **Deviation:** the script is `ws-measure.ts` run with `npx tsx --env-file=.env`, like the other scripts in the folder, instead of the `.js` named in the design.
- **Commands:** `npx eslint scripts/ws-measure.ts` → clean · `npm run build` → ✓ · no local backend was up (it needs the DB tunnel), so a throwaway harness booted the real `createWss` on port 3999 emitting fake batches every 100 ms (`alpha`: EURUSD, GBPUSD, XAUUSD · `beta`: EURUSD, USDJPY) plus `account` every second. Runs of 5 s: no subscription → 0 ticks, 5 `account` (310 B) · `--subscribe alpha:EURUSD` → 46 ticks, 1 distinct pair, 4 922 B · two pairs → 92 ticks, 2 pairs · wrong `JWT_SECRET` → `handshake rejected: HTTP 401`, exit 1. Harness removed afterwards.
- **Docs:** `backend/docs/architecture.md` WebSocket section (subscription paragraph, `ticks` row) and `.claude/CLAUDE.md` WS line updated.
- **Outcome:** ✅ pass on 2026-11-11.
- **Est vs Actual:** 0.5 SP · 0.75 SP (the harness and a stray process on the port).

## Task 4 · [frontend] Subscription registry in `lib/ws.ts` + `useTickSubscription`

- **Mechanism:** `npm run build` + eslint on the new/changed files.
- **Commands:** `npm run build` → ✓ built · `npx eslint src/lib/ws.ts src/lib/useTickSubscription.ts` → clean.
- **Outcome:** ✅ pass on 2026-11-11. Ref-counted `Map` of `broker|symbol`, one microtask flush per change, frame skipped when identical to the last one sent, `lastSent` reset on `onopen` so every reconnect re-sends. Behaviour on screen is checked in task 5 together with the consumers.
- **Est vs Actual:** 0.75 SP · 0.5 SP.

## Task 5 · [frontend] Declare the pair in `ChartSlot`, `ChartPage`, `NewTradePanel`

- **Mechanism:** `npm run build` + manual on the local stack (DevTools WS frames).
- **Commands:** `npm run build` → ✓ built · `npx eslint` on the three files → clean.
- **Manual steps (user):** Vite against the production API (the local backend has no pipes, so no ticks). DevTools > Network > `ws` > Messages. Expect: (1) on load one outbound `{"type":"subscribe","ticks":[{broker,symbol}]}` with the chart pair; (2) change broker or symbol → one new frame with the new pair only; (3) split view → one frame with both pairs, back to single → one frame with one; (4) open New Trade with a preset whose levels broker differs from the chart → frame with two pairs, close it → back to one; (5) kill the connection (DevTools offline toggle on/off) → after the reconnect the frame is sent again. Live candle, alerts panel price and New Trade bid/ask keep updating (the production backend still sends every tick until task 6 deploys the filter).
- **Outcome:** 🕐 pending the user's manual check.
- **Est vs Actual:** 1 SP · 0.5 SP.

## Task 6 · [infra] Push, deploys and production validation

- **Mechanism:** manual (user validation) + `ws-measure.ts` on the VPS.
- **Deploys:** backend pushed first (`1acbab3`, 2026-11-11 ≈ 10:02 UTC; the GitHub API was rate-limited, so the restart was confirmed by `/health` `uptimeS` dropping to 15 s), frontend right after (`7e435e4`; production served `index-D2uagtMM.js` a few minutes later; the app shows Build 256.228.35 = frontend 256 · backend 228 · EA 35).
- **AC 7 measurement** (VPS, `npx tsx --env-file=.env scripts/ws-measure.ts --seconds 60`, 2026-11-11 ≈ 10:10 UTC, market open):

  | Run | Total | Ticks | Rest |
  |---|---|---|---|
  | 2026-11-10, before the spec | 319 277 B/s | 313 523 B/s (38 824 items, 74 pairs) | 5 754 B/s |
  | No subscription | 5 973 B/s | 0 | positions + account + candle |
  | `solidary III:EURUSD` | 10 614 B/s | 4 751 B/s (542 items, 1 pair) | 5 863 B/s |

  One subscribed pair receives 3.3 % of the previous volume (AC 7 asks for < 5 % / < 16 KB/s) → ≈ 38 MB per hour instead of ≈ 1.15 GB. The remaining ≈ 6 KB/s is `positions` + `account` of all 11 brokers, out of scope.
- **User validation on production:** 🕐 pending — chart live on desktop and mobile, split view, alerts panel price, New Trade bid/ask, Accounts / Positions / Orders live for every broker (AC 2, 4, 5, 8).
- **Est vs Actual:** 0.75 SP · 0.75 SP.

## Task 7 · [specs] Close

- **Final builds:** backend `npm run build` → ✓ · frontend `npm run build` → ✓ built (2026-11-11).
- **Est vs Actual per task:** 1: 0.75 · 0.5 — 2: 1.5 · 1 — 3: 0.5 · 0.75 — 4: 0.75 · 0.5 — 5: 1 · 0.5 — 6: 0.75 · 0.75 — 7: 0.25 · 0.25.
- **Total:** 5.5 SP estimated · 4.25 SP actual. Calibration: the two WebSocket tasks came in under estimate because the design pinned the protocol and the test cases beforehand; the measurement script went over because a local backend was not available and a harness had to stand in. The DevTools check of task 5 moved to production by the user's choice.
- **Deviations:** `scripts/ws-measure.ts` (TypeScript via tsx) instead of the `.js` named in the design.
- **Pending on the user:** nothing. Follow-ups outside this spec: `permessage-deflate` and a slimmer tick payload would cut the remaining ≈ 6 KB/s of `positions` / `account` and the per-tick size.
- **Est vs Actual:** 0.25 SP · 0.25 SP.
