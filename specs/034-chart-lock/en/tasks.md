# 034 — Chart lock · Tasks

Each task is one conventional commit. The project must build after every task. Frontend only; deploy when the user asks.

- [x] 1. [frontend] Lock state in `ChartPage` (localStorage `chart.locked`, unlock when picking a drawing tool or the ruler), `IconLock` / `IconUnlock` and the toolbar button after the alerts bell · **Verify:** `npm run build` + local check that the button toggles and survives a reload · **Est:** 0.75 SP
- [ ] 2. [frontend] Honour the lock in `DrawingTools` (no select / drag / Ctrl-duplicate, no double-click edit, no Delete; deselect on lock) and in `LightweightChart` (SL / TP / alert drag skipped, selection cleared, drag in progress cancelled, position labels with `pointer-events: none` and no ✕) · **Verify:** `npm run build` + local check on drawings, levels and alerts with the lock on and off · **Est:** 1.5 SP
- [ ] 3. [infra] Push `master` (frontend deploy) and **validate on production**: Chart page on desktop and mobile — with the lock on, drag / wheel over a drawing, an SL/TP line, a position label and an alert moves the chart and changes nothing; reload keeps the lock; picking Trendline turns it off · **Verify:** manual (user validation) · **Est:** 0.25 SP
- [ ] 4. [specs] Record Est vs Actual in `verification.md` (both languages), mark the spec closed and archive it under `archive/2026-10/` · **Verify:** manual · **Est:** 0.25 SP

**Total estimate**: 2.75 SP
