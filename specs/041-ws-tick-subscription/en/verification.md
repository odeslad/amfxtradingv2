# 041 — WebSocket tick subscription · Verification

## Task 1 · [backend] `parseSubscription` + limits in `ws/policy.ts`

- **Mechanism:** `npm run build` + vitest on `policy.test.ts`.
- **Commands:** `npm run build` → ✓ (tsc clean) · `npx vitest run src/ws/policy.test.ts` → 12 passed (6 new: valid set deduplicated; empty list → empty set; Buffer input; 17 pairs rejected and 16 accepted; unknown type / missing list / non-array / non-JSON / null / array root rejected; bad types, empty and 65-char names, string and null items rejected).
- **Outcome:** ✅ pass on 2026-11-11.
- **Est vs Actual:** 0.75 SP · 0.5 SP.
