# 042 — Limitación del repintado del chart · Verificación

## Tarea 1 · [frontend] Planificador de ticks en `LightweightChart`

- **Mecanismo:** `npm run build` + eslint + manual en el stack local contra la API de producción.
- **Comandos:** `npm run build` → ✓ built · `npx eslint src/features/chart/LightweightChart.tsx` → limpio.
- **Implementación:** `updateLive` ahora guarda el tick en `pendingLiveRef` (la cotización se actualiza al momento para las líneas de spread) y llama a `scheduleApply`; `scheduleApply` no hace nada si hay temporizador, la pestaña está oculta o no hay pendiente, y si no pide un frame ahora o tras lo que falte de `LIVE_MIN_INTERVAL_MS` (250 ms); `applyPending` toma el último tick y ejecuta el cuerpo anterior (`applyLive`); un tick `null` cancela y resetea como antes; `visibilitychange` a visible reprograma; el desmontaje cancela.
- **Pasos manuales (usuario):** Vite contra la API de producción, chart en M5 con 3 EMAs y el spread activo. Esperado: (1) vela viva, EMAs y líneas bid/ask se mueven con fluidez pero no más de ≈ 4 veces por segundo; (2) cambiar a otra pestaña 10 s y volver → la vela salta al precio actual en menos de 250 ms y sigue moviéndose; (3) cambiar de símbolo → ninguna vela vieja del anterior.
- **Resultado:** 🕐 pendiente de la comprobación manual del usuario.
- **Est vs Actual:** 1 SP · 0,5 SP.

## Tarea 2 · [frontend] `afterScaleChange()` + `DrawingTools.onScaleChange()`

- **Mecanismo:** `npm run build` + eslint + manual.
- **Comandos:** `npm run build` → ✓ built · `npx eslint src/features/chart/LightweightChart.tsx src/features/chart/DrawingTools.ts` → limpio · grep de `requestAnimationFrame` en `features/chart` → no quedan bucles: usos de un solo disparo (enfoque de input, reintento del error boundary, carga del slot), la comprobación coalescida de interacción y el planificador de ticks.
- **Implementación:** el efecto de 60 fps pasó a ser `afterScaleChange` (las mismas dos comprobaciones de firma, firmas en refs, después `trendlineManagerRef.current?.onScaleChange()`), llamada desde `applyPending`, el handler de rango visible, el `ResizeObserver`, `fitPrice` y un listener pasivo de `pointermove` (con botón pulsado) / `pointerup` / `wheel` / `touchmove` / `touchend` sobre el contenedor coalescido a un frame. `DrawingManager` perdió `rafId` / `scheduleRaf`; `onScaleChange()` repinta cuando la Y del ancla se movió más de 0,5 px y `resetScaleAnchor()` (los antiguos puntos de llamada a `scheduleRaf`) fuerza el siguiente repintado.
- **Pasos manuales (usuario):** fundidos con la validación en producción de la tarea 4: etiquetas de posición, marcadores de alertas, dibujos y regla siguen a scroll, zoom, arrastre del eje de precio y redimensionado; DevTools Performance no muestra actividad periódica sin ticks (fin de semana) o con la pestaña quieta.
- **Resultado:** 🕐 build y lint pasan; comprobación manual en la tarea 4.
- **Est vs Actual:** 1,25 SP · 0,75 SP.

## Tarea 3 · [frontend] Ajuste de `drawRollovers` por búsqueda binaria

- **Mecanismo:** `npm run build` + eslint + manual (líneas idénticas antes/después).
- **Comandos:** `npm run build` → ✓ built · `npx eslint src/features/chart/LightweightChart.tsx` → limpio · script de equivalencia (scratchpad, node): recorrido antiguo vs cota inferior nueva sobre 300 conjuntos aleatorios de velas ordenadas (pasos de M5 a D1, 10 % de huecos, velas de fin de semana incluidas) × 200 tiempos objetivo cada uno = 60 000 comprobaciones → 0 discrepancias.
- **Implementación:** `weekdayTimes` construido una vez por repintado; `snapToCandle` es una búsqueda binaria de cota inferior que devuelve el primer tiempo de vela de día laborable ≥ objetivo, o null pasado el final: el mismo resultado que producía el recorrido.
- **Pasos manuales (usuario):** fundidos con la tarea 4: las líneas de rollover, semanales y de inicio de mes se ven igual en M5, H1, H4 y D1.
- **Resultado:** 🕐 build, lint y equivalencia pasan; comprobación visual en la tarea 4.
- **Est vs Actual:** 0,5 SP · 0,25 SP.

## Tarea 4 · [infra] Push, deploy del frontend y validación en producción

- **Mecanismo:** manual (validación del usuario) + perfil de 10 s en reposo.
- **Deploy:** `da931c0` subido el 2026-11-11; producción sirvió `index-Cxz6PkRd.js` (Build 259.228.35) unos minutos después.
- **Perfil (AC 7)**, misma grabación que la de la mañana (página del chart, un par, 3 EMAs, alertas y dibujos, 10 s en reposo, Bottom-up de DevTools Performance):

  | Actividad | 2026-11-11 antes | después |
  |---|---|---|
  | Paint (self) | 3 938 ms | por debajo de 10 ms (no aparece en la lista) |
  | Animation frame fired (self / total) | 137 / 3 164 ms | 65 / 2 040 ms, de los que 1 211 ms son de una extensión del navegador (`quickpro-worker-page`, `toBlob`) |
  | Hilo principal ocupado | ≈ 8,3 s | ≈ 3,0 s (≈ 1,7 s sin la extensión) |

  Ambas cifras quedan muy por debajo de un tercio de las anteriores. Los picos periódicos de CPU que quedan en la grabación vienen de la extensión, no de la app.
- **Validación del usuario en producción:** ✅ 2026-11-11 — vela viva y EMAs, etiquetas / marcadores / dibujos con scroll, zoom y arrastre del eje, líneas de rollover, pestaña oculta y vuelta, vista dividida y móvil, todo como antes ("buenísimo... funciona").
- **Est vs Actual:** 0,5 SP · 0,5 SP.

## Tarea 5 · [specs] Cierre

- **Build final:** frontend `npm run build` → ✓ built (2026-11-11).
- **Est vs Actual por tarea:** 1: 1 · 0,5 — 2: 1,25 · 0,75 — 3: 0,5 · 0,25 — 4: 0,5 · 0,5 — 5: 0,25 · 0,25.
- **Total:** 3,5 SP estimados · 2,25 SP reales. Calibración: el diseño ya había localizado los bucles y los puntos de llamada, así que las tres tareas de código fueron casi mecánicas; mismo patrón que la spec 041.
- **Desviaciones:** ninguna. Las comprobaciones manuales locales de las tareas 1-3 se fundieron con la validación en producción por decisión del usuario.
- **Pendiente del usuario:** nada. Ideas de continuación fuera de esta spec: menos capas de canvas, o desactivar la extensión de terceros mientras se opera.
- **Est vs Actual:** 0,25 SP · 0,25 SP.
