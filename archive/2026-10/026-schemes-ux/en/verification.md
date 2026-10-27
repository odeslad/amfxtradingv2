# 026 — Schemes page UX · Verification

| Task | Mechanism | Commands | Outcome | Est | Actual |
|---|---|---|---|---|---|
| 1 [frontend] | build + lint + local app at desktop width | `npm run build` · `npm run lint` · Vite on 5174 proxied to `api-v2` | ✅ pass | 2 | 1 |
| 2 [frontend] | build + lint + local app at 390 px | `npm run build` · `npm run lint` · Vite on 5174, device mode | ✅ pass | 1.5 | 1 |
| 3 [frontend] | build + lint + local app at 390 px | `npm run build` · `npm run lint` · Vite on 5174, device mode | ✅ pass | 2 | 1 |
| 4 [infra] | manual (user validation on production) | push `bbfa983..debb3fc`, "Deploy Frontend to VPS" green | ✅ pass | 0.5 | 0.5 |
| 5 [specs] | manual | this file, `Status: closed`, `git mv` to `archive/2026-10/` | ✅ pass | 0.25 | 0.25 |

**Total**: Est 6.25 SP · Actual 3.75 SP. Calibration: well under estimate because every piece reused an
existing pattern (Journal tab bar and hover row actions, `PositionCard` and `useSwipeActions`, the
shared drawer chrome); the mockup iterations with the user, which carried most of the design work, are
not counted against the tasks.

## Evidence

### Task 1

Build and lint clean. Accepted by the user on 2026-10-26 in the local app against production data: year
tab bar with + Nuevo esquema on the right, one-row totals strip, scheme rows (Inicio → Fin in one
column) stretched to the right edge, Journal-style hover actions (Editar orange / Eliminar red) on
scheme and operation rows that open the right panels without toggling the row, operations in 10
columns with no sideways scroll, borderless result text, compact ‹ › pagination. The phone layout is
unchanged until tasks 2–3, as expected.

### Task 2

Build and lint clean; accepted by the user on 2026-10-26 before moving to task 3: full-width year tabs
and 44 px + Nuevo esquema, totals block (title, Neto € / Neto R at 28 px, four labelled counts), the new
`SchemeCard` collapsed (▸ #N, result text, Inicio / Neto € / Neto R) and expanded (labelled grid, three
44 px actions), 44 px pagination. Ver operaciones appears with task 3.

### Task 3

Build and lint clean. Validated by the user on 2026-10-26: Ver operaciones opens the full-screen
`OperationsPanel`; operations in the Positions card format (Posición / Entrada / R summary, tap to expand
into labelled rows, left swipe for Editar / Eliminar); the trade panel and the confirmation stack on top
and return to the refreshed list; + Nueva operación at the bottom. The operations panel is separate state
in `BookPage`, so the stacking chosen in the design held without the fallback. Fixed along the way: the
numeric column headers of both desktop tables were left-aligned over right-aligned numbers
(`.table th` overrode `.num`).

### Task 4

Pushed `bbfa983..debb3fc` (three frontend commits); "Deploy Frontend to VPS" succeeded and production
served the new bundle. Accepted by the user on production (desktop and iPhone) against AC 1–10 on
2026-10-27.

### Task 5

Closed and archived under `archive/2026-10/`.
