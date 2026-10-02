# 012 · BE-06 — Command result robustness · Tasks

Each task is one conventional commit. The project must build after every task. Tasks of different layers never share a commit. Deploy order: backend only (EA doc change is documentation).

- [x] 1. [backend] `bridge/command-io.ts` (`writeCommand`, `readResult`, `errorText`, `discardStaleResult`, `waitForResult` with base/pending/late phases) + `command-io.test.ts` (temp dir, fake timers) · **Verify:** `npm run lint && npm run typecheck && npm test` + `npm run build` · **Est:** 1.5 SP
- [x] 2. [backend] `routes/commands.ts` uses the module (stale cleanup, atomic write, late broadcast with `errorText`); `ws.ts` / `index.ts` carry `late`; `docs/architecture.md` note (AC 1–8) · **Verify:** build + tests; local backend with a scratch broker dir and a node script acting as the EA: (a) answers in 2 s → `command_result ok`; (b) writes `pending.json` and answers at 20 s → `ok` with no timeout; (c) answers at 25 s without pending → `timeout` at 10 s then `ok` with `late: true`; (d) answers `{status:'error',code:130,message:'ticket not found'}` → `error: "EA error: ticket not found (code 130)"`; (e) a stale `result.json` left before a command is discarded and logged · **Est:** 1.25 SP
- [x] 3. [ea] `ea/docs/HttpBridgeCommands.md`: state that the backend honours `pending.json` (wait up to 30 s) and watches 60 s more for a late result · **Verify:** manual (doc only, no MQL change) · **Est:** 0.1 SP
- [x] 4. [infra] Push `master` (backend deploy) and **validate on production** (demo account / minimum size): `modify` with a non-existent ticket → toast `EA error: ticket not found`; a normal market order → `Order executed — ticket #`; EA of that broker removed, order sent, EA re-attached ~15 s later → first "No response from EA", then "Order executed — ticket #" (late), pm2 log shows `late result id=…` · **Verify:** manual (user validation) · **Est:** 0.75 SP
- [x] 5. [specs] Record Est vs Actual, `Spec` column of BE-06 → `012 ✅`, `Status: closed`, archive under `archive/2026-10/` · **Verify:** manual · **Est:** 0.25 SP

**Total estimate**: 3.85 SP (audit: 4 SP, of which the validation part shipped in spec 004)
