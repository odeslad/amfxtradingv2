# 042 — Chart render throttle · Tasks

Each task is one conventional commit. The project must build after every task. Tasks of different layers never share a commit. Deploy order: frontend only.

- [x] 1. [frontend] Tick scheduler in `LightweightChart`: pending tick, ≤ 1 apply per frame and ≥ 250 ms apart, visibility gating, cancel on unmount; `updateLive` keeps its signature · **Verify:** `npm run build` + eslint + manual on the local stack against the production API (live candle, EMAs and spread lines move at ≈ 4 Hz; tab hidden → no updates; visible → catches up) · **Est:** 1 SP
- [x] 2. [frontend] `afterScaleChange()` replacing the 60 fps loop: signature checks in refs, called after apply, on range change, resize, pointer / wheel on the pane and `fitPrice`; `DrawingTools.onScaleChange()` replacing its rAF loop · **Verify:** `npm run build` + eslint + manual (position labels, alert markers, drawings and ruler follow scroll / zoom / price-axis drag / resize; DevTools Performance shows no periodic activity with no ticks) · **Est:** 1.25 SP
- [x] 3. [frontend] `drawRollovers` snapping by binary search over the weekday candle times built once per repaint · **Verify:** `npm run build` + eslint + manual (rollover, weekly and month-start lines identical before/after on M5, H1, H4, D1) · **Est:** 0.5 SP
- [ ] 4. [infra] Push `master` (frontend deploy) and **validate on production against the spec**: record the same 10 s idle profile (chart page, one pair, 3 EMAs, alerts and drawings on screen) and put Paint / "Animation frame fired" self times in `verification.md` next to the 2026-11-11 figures (AC 7); check live candle, alerts panel, position labels, drawings, split view, mobile, tab hidden / visible · **Verify:** manual (user validation) + profile · **Est:** 0.5 SP
- [ ] 5. [specs] Record Est vs Actual in `verification.md` (both languages), mark the spec closed and archive it under `archive/2026-11/` · **Verify:** manual · **Est:** 0.25 SP

**Total estimate**: 3.5 SP
