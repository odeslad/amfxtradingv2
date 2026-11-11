# 042 — Limitación del repintado del chart · Verificación

## Tarea 1 · [frontend] Planificador de ticks en `LightweightChart`

- **Mecanismo:** `npm run build` + eslint + manual en el stack local contra la API de producción.
- **Comandos:** `npm run build` → ✓ built · `npx eslint src/features/chart/LightweightChart.tsx` → limpio.
- **Implementación:** `updateLive` ahora guarda el tick en `pendingLiveRef` (la cotización se actualiza al momento para las líneas de spread) y llama a `scheduleApply`; `scheduleApply` no hace nada si hay temporizador, la pestaña está oculta o no hay pendiente, y si no pide un frame ahora o tras lo que falte de `LIVE_MIN_INTERVAL_MS` (250 ms); `applyPending` toma el último tick y ejecuta el cuerpo anterior (`applyLive`); un tick `null` cancela y resetea como antes; `visibilitychange` a visible reprograma; el desmontaje cancela.
- **Pasos manuales (usuario):** Vite contra la API de producción, chart en M5 con 3 EMAs y el spread activo. Esperado: (1) vela viva, EMAs y líneas bid/ask se mueven con fluidez pero no más de ≈ 4 veces por segundo; (2) cambiar a otra pestaña 10 s y volver → la vela salta al precio actual en menos de 250 ms y sigue moviéndose; (3) cambiar de símbolo → ninguna vela vieja del anterior.
- **Resultado:** 🕐 pendiente de la comprobación manual del usuario.
- **Est vs Actual:** 1 SP · 0,5 SP de momento.
