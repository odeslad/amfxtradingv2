# 040 — Chart tool state remembered per chart · Tasks

Each task is one conventional commit. The project must build after every task. Tasks of different layers never share a commit. Deploy order: frontend only.

- [x] 1. [frontend] `useChartToolState(side)` in `features/chart/useChartToolState.ts` (lock, EMA cross trades and Positions mode on `useLocalStorage`, current keys kept, `chart.positions` / `.right` added, unknown Positions values mapped to `none`); `ChartSlot` uses it instead of its two `useLocalStorage` calls and the `useState` of `positionsMode`; `ChartSide` moves to the hook and is re-exported · **Verify:** `npm run build` + eslint + manual on local dev: cycle Positions, reload → same mode and positions drawn; lock and EMA trades unchanged; split: each side independent, close / reopen split keeps the right side; change symbol / timeframe keeps the tools; set `localStorage['chart.positions']` to `"bogus"` → starts at none · **Est:** 1 SP
- [ ] 2. [infra] Push `master` (frontend deploy) and **validate on production against the spec**: Chart page, Positions mode survives a reload on both charts of the split view (AC 1–2), survives a symbol / timeframe change (AC 3), lock and EMA cross trades still remembered (AC 4), drawing tool and panels still transient (AC 6) · **Verify:** manual (user validation) · **Est:** 0.25 SP
- [ ] 3. [specs] Record Est vs Actual in `verification.md` (both languages), mark the spec closed and archive it under `archive/2026-11/` · **Verify:** manual · **Est:** 0.25 SP

**Total estimate**: 1.5 SP
