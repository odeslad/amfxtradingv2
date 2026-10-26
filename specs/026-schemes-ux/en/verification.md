# 026 — Schemes page UX · Verification

| Task | Mechanism | Commands | Outcome | Est | Actual |
|---|---|---|---|---|---|
| 1 [frontend] | build + lint + local app at desktop width | `npm run build` · `npm run lint` · Vite on 5174 proxied to `api-v2` | ✅ pass | 2 | 1 |
| 2 [frontend] | build + lint + local app at 390 px | `npm run build` · `npm run lint` · Vite on 5174, device mode | ✅ pass | 1.5 | 1 |

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
