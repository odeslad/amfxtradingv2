# 030 — Fast reflection of closed trades · Verification

| Task | Mechanism | Commands | Outcome | Evidence | Est | Actual |
|---|---|---|---|---|---|---|
| 1. [backend] Watcher skips unchanged history/account, 5 s interval | build + vitest | `npx vitest run` · `npm run build` | ✅ pass | 114/114 tests (5 new in `file-watcher.test.ts`: 5 s default, unchanged history handed once even when rewritten, changed content handed, failed handler retried, unchanged account skipped); `tsc` clean | 1 | 0.5 |
| 2. [backend] Broadcast `trades_updated` after a changed history is synced; docs | build + vitest | `npx vitest run` · `npm run build` | ✅ pass | 115/115 tests (new: `trades_updated` reaches the client with `broker` at the root); `tsc` clean; `architecture.md` + `.claude/CLAUDE.md` updated | 0.5 | 0.25 |
| 3. [frontend] `useTradesUpdated` + Stats / History refetch | build + manual | `npm run build` · `eslint` on the 3 files | ✅ pass | Build and lint clean. The local check against the DB tunnel cannot produce `trades_updated` (the local backend runs with `FEATURE_WATCHER=false`), so the refresh was validated on production in task 5 | 1 | 0.25 |
| 4. [ea] `history.json` on history change, ≥ `HISTORY_MIN_GAP_S` apart (EA 3.15) | EA pipeline compile | push `a8982da` → Deploy EA to VPS #41 | ✅ pass | "Compile EA files" and "Distribute to all MT4 instances" green; the same run reloads the 12 terminals through AMFX-Watchdog (no manual reload) | 0.5 | 0.25 |
| 5. [infra] Push and validate on production | manual (user) | pushes `09602e2` (backend, run #173 green) → `a10d63a` (frontend) → `a8982da` (EA, run #41) | ✅ pass | User closed a position with History and Stats open: both showed it without reloading (2026-10-29) | 1 | 0.5 |
| 6. [specs] Close | manual | backend + frontend `npm run build` | ✅ pass | Both builds clean | 0.25 | 0.25 |

**Total**: Est 4.25 SP · Actual 2 SP.

**Calibration**: small cross-layer spec on well-known code; the per-layer estimates were about double. The deploy wait (EA reload of 12 terminals, ~15 min) is not development time and is not counted.

**Deviations**
- Task 3: the manual check moved from local dev to production (the local backend has the watcher off).
- Task 4: the EA is compiled and reloaded by its pipeline, not in MetaEditor by hand; the tasks wording was corrected.

**Pending / follow-ups**
- Run #41 reported false `[FAILED]` reloads (Darwinex, IV, VI, VII, IX, X came back later; the script itself ended with 12/12 terminals running): AMFX-Watchdog ignores `/run` while already running. Noted as a future spec for `restart-mt4.ps1`.
