# 026 — Schemes page UX · Verification

| Task | Mechanism | Commands | Outcome | Est | Actual |
|---|---|---|---|---|---|
| 1 [frontend] | build + lint + local app at desktop width | `npm run build` · `npm run lint` · Vite on 5174 proxied to `api-v2` | ✅ pass | 2 | 1 |

## Evidence

### Task 1

Build and lint clean. Accepted by the user on 2026-10-26 in the local app against production data: year
tab bar with + Nuevo esquema on the right, one-row totals strip, scheme rows (Inicio → Fin in one
column) stretched to the right edge, Journal-style hover actions (Editar orange / Eliminar red) on
scheme and operation rows that open the right panels without toggling the row, operations in 10
columns with no sideways scroll, borderless result text, compact ‹ › pagination. The phone layout is
unchanged until tasks 2–3, as expected.
