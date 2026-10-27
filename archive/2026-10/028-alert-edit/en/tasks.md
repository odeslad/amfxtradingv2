# 028 — Edit price alerts · Tasks

Each task is one conventional commit. The project must build after every task. Frontend only; one frontend deploy at the end.

- [x] 1. [frontend] `useAlerts.updatePrice` + Alerts panel: inline price edit in the row (input, Save/Cancel, Enter/Esc, validation, error toast), On/Off and Delete restyled like Positions, triggered row dims only symbol and price · **Verify:** `npm run build` + local check in Vite (edit a price, edit a triggered alert → it re-arms, invalid value) · **Est:** 2 SP
- [x] 2. [frontend] Chart: alerts join the SL/TP drag (union `DraggableLevel`, hit test, selected dashed line, live label with pips on desktop and price only on mobile, Esc cancels, optimistic save via `onMoveAlert`, rollback on error) · **Verify:** `npm run build` + local check (select, drag, release, Esc, SL/TP drag still works) · **Est:** 3 SP
- [x] 3. [frontend] Mobile `AlertActionBar` (Edit price opens the panel editing that alert, On/Off, Delete) wired through `onSelectAlert` · **Verify:** `npm run build` + local check at phone width · **Est:** 1.5 SP
- [x] 4. [infra] Push `master` (frontend deploy) and **validate on production**: `/chart` on desktop and iPhone — drag an alert, Esc, edit price in the panel, re-arm a triggered alert, mobile action bar, Positions-style buttons · **Verify:** manual (user validation) · **Est:** 0.5 SP
- [x] 5. [specs] Record Est vs Actual in `verification.md` (both languages), mark the spec closed and archive it under `archive/2026-10/` · **Verify:** manual · **Est:** 0.25 SP

**Total estimate**: 7.25 SP
