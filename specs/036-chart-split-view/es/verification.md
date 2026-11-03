# 036 — Vista dividida del gráfico · Verificación

## Tarea 1 · [frontend] Extraer `ChartSlot` de `ChartPage`

- **Mecanismo:** `npm run build` + comprobación manual en la app local.
- **Comandos:** `cd frontend && npm run build` → ✓ built; `npx eslint src/features/chart/ChartPage.tsx src/features/chart/ChartSlot.tsx` → limpio.
- **Resultado:** ✅ pasa (el usuario comprobó la lista siguiente el 2026-11-02 contra la API de producción a través del proxy local de Vite).
- **Pasos manuales (local, un solo gráfico, debe comportarse como hoy):** cambiar timeframe · scroll a la izquierda para paginar velas antiguas · la vela activa se mueve con los ticks · dibujar y recargar conserva los dibujos · bloqueo on/off · ciclo de posiciones none/all/buys/sells y aparece el botón New Trade · tocar una alerta → barra de acciones · pantalla completa entrar/salir · Ctrl+Flechas cambian símbolo/broker · New Trade desde la barra preselecciona broker/símbolo/timeframe · el panel de alertas muestra el precio en vivo.
- **Desviación respecto a design.md:** la pantalla completa sigue pidiéndose sobre la página (no sobre el slot): los paneles laterales son hijos `position: fixed` de `.page`, así que un slot en fullscreen nativo los ocultaría. En split, el fullscreen mostrará solo el slot elegido dentro de la página (tarea 3); design.md se actualizará en consecuencia.
- **Est vs Actual:** 2 SP · 1.25 SP.

## Tarea 2 · [frontend] Botón de split en `ChartToolbar`

- **Mecanismo:** `npm run build` + botón visible/activo en desktop, ausente en ancho móvil.
- **Comandos:** `npm run build` → ✓ built; `npx eslint src/features/chart src/shared/ui/icons.tsx` → limpio.
- **Resultado:** ✅ pasa (el usuario lo comprobó el 2026-11-02 en la app local: botón junto a Pantalla completa, alterna activo, oculto por debajo de 768 px). La página lleva un `useState` temporal que la tarea 3 sustituye por el estado persistido del split.
- **Est vs Actual:** 0.5 SP · 0.25 SP.

## Tarea 3 · [frontend] Estado y layout del split

- **Mecanismo:** `npm run build` + manual: abrir split, cambiar cada timeframe, cambiar broker/símbolo, ticks en vivo en ambos, cerrar desde el derecho, recargar mantiene el split.
- **Comandos:** `npm run build` → ✓ built; `npx eslint src/features/chart src/lib/useMediaQuery.ts` → limpio.
- **Resultado:** ✅ pasa (el usuario lo comprobó el 2026-11-02 en la app local contra la API de producción). El primer render desbordaba por la derecha: las columnas `fr` del grid no se encogen por debajo del ancho mínimo de la barra → columnas `minmax(0, Nfr)`.
- **Notas:** `useMediaQuery` usa `useSyncExternalStore` (la regla de lint rechaza setState dentro de un efecto). Pantalla completa por slot implementada como "página en fullscreen, solo ese slot renderizado" (ver riesgos en design.md).
- **Est vs Actual:** 1.5 SP · 1 SP.

## Tarea 4 · [frontend] Divisor arrastrable

- **Mecanismo:** `npm run build` + arrastre manual hasta ambos límites, recargar mantiene la proporción, cerrar desde cada lado y reabrir.
- **Comandos:** `npm run build` → ✓ built; `npx eslint src/features/chart` → limpio.
- **Resultado:** ✅ pasa (el usuario lo comprobó el 2026-11-02 en la app local).
- **Cambios acordados durante la tarea:** el suelo del 25 % no bastaba (los botones de la barra se cortaban) → el límite usa también el ancho mínimo de la barra, medido desde sus dos grupos, y un `ResizeObserver` recorta un ratio persistido en una ventana más estrecha; cerrar desde el gráfico derecho conserva su timeframe (AC 5 reescrito) y el par cerrado (`leftTimeframe` + `rightTimeframe`) se restaura al reabrir. La tarea 5 pierde la barra compacta.
- **Est vs Actual:** 0.75 SP · 0.75 SP.

## Tarea 5 · [frontend] Preselección de paneles

- **Mecanismo:** `npm run build` + manual abriendo New Trade desde cada gráfico.
- **Comandos:** `npm run build` → ✓ built; `npx eslint src/features/chart` → limpio.
- **Resultado:** ✅ pasa (el usuario lo comprobó el 2026-11-03 en la app local: New Trade abre con el timeframe del gráfico de origen). El precio del panel de alertas no necesita cambio: ambos gráficos comparten símbolo, así que el último bid de la página es el mismo para los dos.
- **Est vs Actual:** 0.5 SP · 0.25 SP.
