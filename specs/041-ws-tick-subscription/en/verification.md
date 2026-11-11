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
