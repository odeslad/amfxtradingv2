# 042 — Limitación del repintado del chart · Verificación

## Tarea 1 · [frontend] Planificador de ticks en `LightweightChart`

- **Mecanismo:** `npm run build` + eslint + manual en el stack local contra la API de producción.
- **Comandos:** `npm run build` → ✓ built · `npx eslint src/features/chart/LightweightChart.tsx` → limpio.
- **Implementación:** `updateLive` ahora guarda el tick en `pendingLiveRef` (la cotización se actualiza al momento para las líneas de spread) y llama a `scheduleApply`; `scheduleApply` no hace nada si hay temporizador, la pestaña está oculta o no hay pendiente, y si no pide un frame ahora o tras lo que falte de `LIVE_MIN_INTERVAL_MS` (250 ms); `applyPending` toma el último tick y ejecuta el cuerpo anterior (`applyLive`); un tick `null` cancela y resetea como antes; `visibilitychange` a visible reprograma; el desmontaje cancela.
- **Pasos manuales (usuario):** Vite contra la API de producción, chart en M5 con 3 EMAs y el spread activo. Esperado: (1) vela viva, EMAs y líneas bid/ask se mueven con fluidez pero no más de ≈ 4 veces por segundo; (2) cambiar a otra pestaña 10 s y volver → la vela salta al precio actual en menos de 250 ms y sigue moviéndose; (3) cambiar de símbolo → ninguna vela vieja del anterior.
- **Resultado:** 🕐 pendiente de la comprobación manual del usuario.
- **Est vs Actual:** 1 SP · 0,5 SP de momento.

## Tarea 2 · [frontend] `afterScaleChange()` + `DrawingTools.onScaleChange()`

- **Mecanismo:** `npm run build` + eslint + manual.
- **Comandos:** `npm run build` → ✓ built · `npx eslint src/features/chart/LightweightChart.tsx src/features/chart/DrawingTools.ts` → limpio · grep de `requestAnimationFrame` en `features/chart` → no quedan bucles: usos de un solo disparo (enfoque de input, reintento del error boundary, carga del slot), la comprobación coalescida de interacción y el planificador de ticks.
- **Implementación:** el efecto de 60 fps pasó a ser `afterScaleChange` (las mismas dos comprobaciones de firma, firmas en refs, después `trendlineManagerRef.current?.onScaleChange()`), llamada desde `applyPending`, el handler de rango visible, el `ResizeObserver`, `fitPrice` y un listener pasivo de `pointermove` (con botón pulsado) / `pointerup` / `wheel` / `touchmove` / `touchend` sobre el contenedor coalescido a un frame. `DrawingManager` perdió `rafId` / `scheduleRaf`; `onScaleChange()` repinta cuando la Y del ancla se movió más de 0,5 px y `resetScaleAnchor()` (los antiguos puntos de llamada a `scheduleRaf`) fuerza el siguiente repintado.
- **Pasos manuales (usuario):** fundidos con la validación en producción de la tarea 4: etiquetas de posición, marcadores de alertas, dibujos y regla siguen a scroll, zoom, arrastre del eje de precio y redimensionado; DevTools Performance no muestra actividad periódica sin ticks (fin de semana) o con la pestaña quieta.
- **Resultado:** 🕐 build y lint pasan; comprobación manual en la tarea 4.
- **Est vs Actual:** 1,25 SP · 0,75 SP de momento.

## Tarea 3 · [frontend] Ajuste de `drawRollovers` por búsqueda binaria

- **Mecanismo:** `npm run build` + eslint + manual (líneas idénticas antes/después).
- **Comandos:** `npm run build` → ✓ built · `npx eslint src/features/chart/LightweightChart.tsx` → limpio · script de equivalencia (scratchpad, node): recorrido antiguo vs cota inferior nueva sobre 300 conjuntos aleatorios de velas ordenadas (pasos de M5 a D1, 10 % de huecos, velas de fin de semana incluidas) × 200 tiempos objetivo cada uno = 60 000 comprobaciones → 0 discrepancias.
- **Implementación:** `weekdayTimes` construido una vez por repintado; `snapToCandle` es una búsqueda binaria de cota inferior que devuelve el primer tiempo de vela de día laborable ≥ objetivo, o null pasado el final: el mismo resultado que producía el recorrido.
- **Pasos manuales (usuario):** fundidos con la tarea 4: las líneas de rollover, semanales y de inicio de mes se ven igual en M5, H1, H4 y D1.
- **Resultado:** 🕐 build, lint y equivalencia pasan; comprobación visual en la tarea 4.
- **Est vs Actual:** 0,5 SP · 0,25 SP de momento.
