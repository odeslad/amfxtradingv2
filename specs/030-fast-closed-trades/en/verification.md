# 030 — Fast reflection of closed trades · Verification

| Task | Mechanism | Commands | Outcome | Evidence | Est | Actual |
|---|---|---|---|---|---|---|
| 1. [backend] Watcher skips unchanged history/account, 5 s interval | build + vitest | `npx vitest run` · `npm run build` | ✅ pass | 114/114 tests (5 new in `file-watcher.test.ts`: 5 s default, unchanged history handed once even when rewritten, changed content handed, failed handler retried, unchanged account skipped); `tsc` clean | 1 | 0.5 |
| 2. [backend] Broadcast `trades_updated` after a changed history is synced; docs | build + vitest | `npx vitest run` · `npm run build` | ✅ pass | 115/115 tests (new: `trades_updated` reaches the client with `broker` at the root); `tsc` clean; `architecture.md` + `.claude/CLAUDE.md` updated | 0.5 | 0.25 |
| 3. [frontend] `useTradesUpdated` + Stats / History refetch | build + manual | `npm run build` · `eslint` on the 3 files | ✅ build · 🕐 manual moved to task 5 | Build and lint clean. The local check against the DB tunnel cannot produce `trades_updated` (the local backend runs with `FEATURE_WATCHER=false`), so the refresh is validated on production in task 5 | 1 | 0.25 |
| 4. [ea] `history.json` on history change, ≥ `HISTORY_MIN_GAP_S` apart (EA 3.15) | MetaEditor compile + terminal log | — (user) | 🕐 pending: user compiles in MetaEditor; after deploy + Watchdog reload, closing a trade logs `[STATE] History changed` | — | 0.5 | 0.25 |
