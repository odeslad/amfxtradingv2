# 011 — Accounts row liveness · Tasks

Each task is one conventional commit. Deploy order: backend only.

- [x] 1. [backend] `isPipeLive` / `pipeStateOf` in `store/liveness.ts` with tests; `daily-pnl` skips non-live brokers (AC 1–4) · **Verify:** `npm run lint && npm run typecheck && npm test` + `npm run build` · **Est:** 0.25 SP
- [ ] 2. [infra] Push `master` (backend deploy) and **validate on production**: the user removes one EA again → its Accounts row turns grey within 5 s, Day P&L `—`; re-attach → row back to normal; other rows unchanged · **Verify:** manual (user validation) · **Est:** 0.25 SP
- [ ] 3. [specs] Record Est vs Actual, `Status: closed`, archive under `archive/2026-10/` · **Verify:** manual · **Est:** 0.1 SP

**Total estimate**: 0.6 SP
