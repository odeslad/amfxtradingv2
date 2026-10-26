# 026 — Schemes page UX · Tasks

Each task is one conventional commit. The project must build after every task. Tasks of different layers never share a commit. Deploy order: frontend only.

- [x] 1. [frontend] Desktop: tab bar header, totals strip, scheme table columns, Journal-style hover row actions on schemes and operations, operations table in 10 columns, borderless result text, compact pagination · **Verify:** `npm run build` + `npm run lint`; local app on the Vite proxy to production at desktop width: tabs switch the year, actions slide in on hover and open the right panels, no sideways scroll on the expanded operations · **Est:** 2 SP
- [x] 2. [frontend] Mobile list: tabs and full-width new button, totals block, `SchemeCard` (collapsed / expanded with Ver operaciones and the three actions), 44 px pagination · **Verify:** `npm run build` + `npm run lint`; local app at 390 px: card sizes and labels as in the mockup, expand / collapse, Editar / Eliminar / + Operación open their panels · **Est:** 1.5 SP
- [x] 3. [frontend] Mobile operations: `OperationsPanel` + `OperationCard` (Positions card format, swipe Editar / Eliminar, tap to expand, + Nueva operación), refresh after create / edit / delete · **Verify:** `npm run build` + `npm run lint`; local app at 390 px: open the panel, expand an operation, swipe and edit it (panel stacks and returns), delete one, add one; the list and totals update · **Est:** 2 SP
- [ ] 4. [infra] Push `master` (frontend deploy) and **validate on production**: desktop and iPhone against AC 1–10 · **Verify:** manual (user validation) · **Est:** 0.5 SP
- [ ] 5. [specs] Record Est vs Actual in `verification.md` (both languages), mark the spec closed and archive it under `archive/2026-10/` · **Verify:** manual · **Est:** 0.25 SP

**Total estimate**: 6.25 SP
