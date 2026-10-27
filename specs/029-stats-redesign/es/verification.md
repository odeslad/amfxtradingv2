# 029 — Rediseño de Stats y filtro por activo · Verificación

## Tarea 1 — Backend: filtro por activo en `GET /stats`

- **Mecanismo:** `npm run build` + `vitest` (stats-core); la prueba local contra la BD no fue posible (el túnel de BD en 5434 está caído, necesita login de Cloudflare en el navegador) — cubierto por los tests unitarios y la validación en producción (tarea 4).
- **Comandos:** `cd backend && npm run build` → ✓; `npx vitest run src/services/stats-core.test.ts` → 9 passed (2 nuevos).
- **Resultado:** ✅ pass.
- **Evidencia:** parámetro opcional `symbol`; con él solo se cargan las operaciones de ese símbolo y ninguna operación de balance; `stats-core` `mode: 'asset'` → cash flow 0, balance inicial y return nulos (también mensuales), curva = P&L acumulado desde 0; `MonthlyStats.wins`; la respuesta añade `symbol` y `symbols` (símbolos operados del broker). Contrato que solo añade — el frontend actual no se ve afectado.
- **Est vs Actual:** 2 SP vs 1,5 SP.

## Tarea 2 — Lista de periodos compartida

- **Mecanismo:** `npm run build` + eslint + prueba local en los filtros del Journal.
- **Comandos:** `cd frontend && npm run build` → ✓; eslint journal/stats → limpio.
- **Resultado:** ✅ pass — validado por el usuario en local.
- **Evidencia:** Hoy, Ayer, Esta semana/Este mes/Este trimestre/Este año (últimos 7/30/90/365 días con hoy), Todo, Custom; `normalizeDateRange` lleva los valores guardados eliminados a Todo (Journal y Stats); `clampToToday` mantiene la fecha Hasta de Custom ≤ hoy.
- **Est vs Actual:** 1 SP vs 0,5 SP.
