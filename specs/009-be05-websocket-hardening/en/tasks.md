# 009 · BE-05 — WebSocket hardening · Tasks

Each task is one conventional commit. The project must build after every task. Tasks of different layers never share a commit. Deploy order: backend only (no frontend or EA change).

- [x] 1. [backend] Add `ws/policy.ts` (origin allow-list moved from `app.ts`, `tokenFromCookie`, heartbeat/backpressure constants, `sendDecision`) with `policy.test.ts`; `app.ts` imports the shared list · **Verify:** `npm run lint && npm run typecheck && npm test` (new tests green) + `npm run build` · **Est:** 0.75 SP
- [ ] 2. [backend] Rewrite `ws/ws.ts`: `noServer` + `upgrade` gate (403 origin / 401 token), `userId` per socket, heartbeat, backpressure, `sendToUser` for `alert`/`ema_alert`, `close()`; `index.ts` shutdown order · **Verify:** build + `ws.test.ts` integration tests (403 / 401 / 101, per-user alerts, heartbeat with fake timers) + manual on the local stack: frontend over the Vite proxy keeps receiving ticks; a `wscat`/node client from an unlisted origin gets 403 · **Est:** 2 SP
- [ ] 3. [infra] Push `master` (backend deploy) and **validate on production**: (a) web app at `app-v2` keeps live prices, positions and account after a reload; (b) pm2 log shows `[WS] Client connected` only for the real tab; (c) `node` one-liner from the user's PC with `Origin: https://evil.com` and the session cookie → `403`, without cookie → `401`; (d) close the laptop lid / switch the phone to airplane mode for 2 min → client count drops in the log; (e) arm a price alert and trigger it → flash/beep still arrives · **Verify:** manual (user validation) · **Est:** 0.75 SP
- [ ] 4. [specs] Record Est vs Actual in `verification.md` (both languages), set the `Spec` column of BE-05 in the audit report to `009 ✅`, mark the spec closed and archive it under `archive/2026-10/` · **Verify:** manual · **Est:** 0.25 SP

**Total estimate**: 3.75 SP (audit: 4 SP)
