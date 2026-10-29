# 032 — Spread on the chart · Tasks

Each task is one conventional commit. The project must build after every task. Tasks of different layers never share a commit. Deploy order: db + backend first (the column must exist before the frontend writes it), then frontend.

- [x] 1. [db] Add `showSpread Boolean @default(false)` to `SettingsDisplay` and the hand-written migration `20261029000000_show_spread` · **Verify:** `prisma generate` + `npm run build` in `backend/` · **Est:** 0.25 SP
- [ ] 2. [backend] Read and write `display.showSpread` in `/settings` (validated with `optionalBoolean`, default `false`) and cover it in the route test · **Verify:** vitest + `npm run build` · **Est:** 0.5 SP
- [ ] 3. [frontend] Settings › Display toggle "Spread (ASK and BID lines)" with its hint, `DEFAULT_DISPLAY.showSpread = false`, as in the mockup · **Verify:** `npm run build` + local check against the mockup · **Est:** 0.5 SP
- [ ] 4. [frontend] Chart: ChartPage reads `showSpread` and passes `last.ask` to `updateLive`; LightweightChart hides the series price line and draws the ASK and BID price lines when on (ASK only once a tick with ask arrived) · **Verify:** `npm run build` + local check (toggle on/off, lines move with ticks, AC 1–6) · **Est:** 1.5 SP
- [ ] 5. [infra] Push `master` (backend deploy first, then frontend when the user asks) and **validate on production**: Settings › Display shows the toggle off; turning it on shows ASK and BID on FTMO · EURUSD and they move with the price; turning it off restores the single line; the setting survives a reload and shows the same on mobile · **Verify:** manual (user validation) · **Est:** 0.5 SP
- [ ] 6. [specs] Record Est vs Actual in `verification.md` (both languages), mark the spec closed and archive it under `archive/YYYY-MM/` · **Verify:** manual · **Est:** 0.25 SP

**Total estimate**: 3.5 SP
