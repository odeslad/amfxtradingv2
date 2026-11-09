# 040 — Estado de las herramientas del chart recordado por chart · Tareas

Cada tarea es un commit convencional. El proyecto debe compilar tras cada tarea. Tareas de capas distintas nunca comparten commit. Orden de despliegue: solo frontend.

- [ ] 1. [frontend] `useChartToolState(side)` en `features/chart/useChartToolState.ts` (candado, EMA cross trades y modo Positions sobre `useLocalStorage`, claves actuales conservadas, `chart.positions` / `.right` añadidas, valores desconocidos de Positions mapeados a `none`); `ChartSlot` lo usa en vez de sus dos llamadas a `useLocalStorage` y el `useState` de `positionsMode`; `ChartSide` se mueve al hook y se reexporta · **Verificar:** `npm run build` + eslint + manual en local: ciclar Positions, recargar → mismo modo y posiciones pintadas; candado y EMA trades sin cambios; split: cada lado independiente, cerrar / reabrir el split conserva el derecho; cambiar símbolo / timeframe conserva las herramientas; poner `localStorage['chart.positions']` a `"bogus"` → arranca en none · **Est:** 1 SP
- [ ] 2. [infra] Push de `master` (deploy de frontend) y **validar en producción contra la spec**: página Chart, el modo Positions sobrevive a una recarga en los dos charts del split view (AC 1–2), sobrevive a un cambio de símbolo / timeframe (AC 3), candado y EMA cross trades siguen recordándose (AC 4), herramienta de dibujo y paneles siguen siendo transitorios (AC 6) · **Verificar:** manual (validación del usuario) · **Est:** 0.25 SP
- [ ] 3. [specs] Registrar Est vs Actual en `verification.md` (ambos idiomas), marcar la spec como cerrada y archivarla en `archive/2026-11/` · **Verificar:** manual · **Est:** 0.25 SP

**Estimación total**: 1.5 SP
