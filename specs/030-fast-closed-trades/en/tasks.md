# 030 — Fast reflection of closed trades · Tasks

Each task is one conventional commit. The project must build after every task. Tasks of different layers never share a commit. Deploy order: backend → frontend → ea (the EA only needs a Watchdog reload; backend + frontend already bring the 5 s watcher and the auto refresh).

- [x] 1. [backend] `FileWatcher`: skip unchanged `history.json` / `account.json` (by `mtime`/size, then content), remember them only after the handler succeeds, default interval 5 s; tests for unchanged / changed / failed handler · **Verify:** `npm run build` + vitest · **Est:** 1 SP
- [x] 2. [backend] Broadcast `{ type: "trades_updated", broker }` after a changed history is synced; update `backend/docs/architecture.md` and the WS/watcher lines of `.claude/CLAUDE.md` · **Verify:** `npm run build` + vitest (ws broadcast) · **Est:** 0.5 SP
- [ ] 3. [frontend] `lib/useTradesUpdated.ts` (WS filter by broker + 1 s debounce); Stats and History (closed positions) refetch on it without a loading flash · **Verify:** `npm run build` + manual in local dev against the production DB tunnel · **Est:** 1 SP
- [ ] 4. [ea] Write `history.json` as soon as `OrdersHistoryTotal()` changes, at most every `HISTORY_MIN_GAP_S` (3 s); the 60 s cycle stays · **Verify:** MetaEditor compile (user) + `[STATE] History changed` in the terminal log after closing a demo trade · **Est:** 0.5 SP
- [ ] 5. [infra] Push `master` (backend first; frontend when the user asks; EA reloaded through AMFX-Watchdog) and **validate on production**: close a position with History and Stats (that broker, period Todo) open → both show it within ~10 s without reloading; backend log shows no history/account upserts while nothing changes · **Verify:** manual (user validation) · **Est:** 1 SP
- [ ] 6. [specs] Record Est vs Actual in `verification.md` (both languages), mark the spec closed and archive it under `archive/2026-10/` (or the closing month) · **Verify:** manual · **Est:** 0.25 SP

**Total estimate**: 4.25 SP
