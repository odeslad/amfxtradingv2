# 036 — Vista dividida del gráfico · Verificación

## Tarea 1 · [frontend] Extraer `ChartSlot` de `ChartPage`

- **Mecanismo:** `npm run build` + comprobación manual en la app local.
- **Comandos:** `cd frontend && npm run build` → ✓ built; `npx eslint src/features/chart/ChartPage.tsx src/features/chart/ChartSlot.tsx` → limpio.
- **Resultado:** ✅ pasa (el usuario comprobó la lista siguiente el 2026-11-02 contra la API de producción a través del proxy local de Vite).
- **Pasos manuales (local, un solo gráfico, debe comportarse como hoy):** cambiar timeframe · scroll a la izquierda para paginar velas antiguas · la vela activa se mueve con los ticks · dibujar y recargar conserva los dibujos · bloqueo on/off · ciclo de posiciones none/all/buys/sells y aparece el botón New Trade · tocar una alerta → barra de acciones · pantalla completa entrar/salir · Ctrl+Flechas cambian símbolo/broker · New Trade desde la barra preselecciona broker/símbolo/timeframe · el panel de alertas muestra el precio en vivo.
- **Desviación respecto a design.md:** la pantalla completa sigue pidiéndose sobre la página (no sobre el slot): los paneles laterales son hijos `position: fixed` de `.page`, así que un slot en fullscreen nativo los ocultaría. En split, el fullscreen mostrará solo el slot elegido dentro de la página (tarea 3); design.md se actualizará en consecuencia.
- **Est vs Actual:** 2 SP · 1.25 SP.
