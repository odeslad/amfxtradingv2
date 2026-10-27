# 027 — One date field · Tasks

Each task is one conventional commit. The project must build after every task. Tasks of different layers never share a commit. Deploy order: frontend only.

- [ ] 1. [frontend] `lib/dateField.ts`, `DateField` + `IsoDateField` + `Calendar` (desktop popover kept inside the viewport, phone bottom sheet), applied to the scheme book panels (operation Apertura / Cierre, scheme Inicio / Fin) · **Verify:** `npm run build` + `npm run lint`; local app on the Vite proxy to production: type `121020261400`, delete across separators, paste, an invalid date blocks saving, pick days in the calendar (popover aligned right on the Fin / Cierre column, flips up near the bottom), edit an existing scheme and operation (values shown in the new format, saved values unchanged), the same at 390 px with the bottom sheet · **Est:** 3 SP
- [ ] 2. [frontend] EMA notification Ends, Journal filters From / To and Stats filters From / To on the shared field · **Verify:** `npm run build` + `npm run lint`; local app: create / edit a notification with an end (stored as today), apply a custom date range in Journal and in Stats (same rows as before), reopen the filters (dates shown in the new format), desktop and 390 px · **Est:** 1.5 SP
- [ ] 3. [infra] Push `master` (frontend deploy) and **validate on production**: desktop and iPhone, the nine fields against AC 1–8 · **Verify:** manual (user validation) · **Est:** 0.5 SP
- [ ] 4. [specs] Record Est vs Actual in `verification.md` (both languages), mark the spec closed and archive it under `archive/2026-10/` · **Verify:** manual · **Est:** 0.25 SP

**Total estimate**: 5.25 SP
