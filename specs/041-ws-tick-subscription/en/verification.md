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
