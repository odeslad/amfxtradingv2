# 029 — Rediseño de Stats y filtro por activo · Tareas

Cada tarea es un commit convencional. El proyecto debe compilar tras cada tarea. Orden de despliegue: backend (solo añade) → frontend.

- [x] 1. [backend] `symbol` opcional en `GET /stats` (modo activo en `stats-core`: sin operaciones, curva de P&L acumulado, return nulo), `wins` mensual, `symbol` y `symbols` en la respuesta; tests del modo activo · **Verificar:** `npm run build` + `vitest` (stats-core) + `curl /stats?broker&symbol` en local · **Est:** 2 SP
- [x] 2. [frontend] Lista de periodos compartida (Hoy, Ayer, 7/30/90/365 días, Todo, Custom), `normalizeDateRange` para filtros guardados (Journal y Stats), Hasta de Custom limitado a hoy · **Verificar:** `npm run build` + prueba local en los filtros del Journal · **Est:** 1 SP
- [x] 3. [frontend] Rediseño de Stats: `PeriodTabs` con menú "Más", selects Broker + Activo, franja/bloque `StatsTotals`, gráfico a 2/3 del ancho y alto completo, tabla mensual (Mes, Trades, Win %, Net P&L) y tarjetas en móvil, modo activo ("—", gráfico de P&L acumulado) · **Verificar:** `npm run build` + prueba local en desktop y ancho de móvil · **Est:** 4 SP
- [x] 4. [infra] Push de `master` (despliegue de backend primero, luego frontend) y **validación en producción**: `/stats` en desktop e iPhone (periodos, menú Más, filtro por activo, totales, alto/ancho del gráfico, tarjetas mensuales) y el select de periodo del Journal · **Verificar:** manual (validación del usuario) · **Est:** 0,5 SP
- [x] 5. [specs] Registrar Est vs Actual en `verification.md` (ambos idiomas), cerrar la spec y archivarla en `archive/2026-10/` · **Verificar:** manual · **Est:** 0,25 SP

**Estimación total**: 7,75 SP
