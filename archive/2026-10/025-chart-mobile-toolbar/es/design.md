# 025 — Arreglos del gráfico · Diseño

## Enfoque

Nueve arreglos independientes agrupados por el fichero que tocan, así cada tarea es un commit coherente:
el flujo de vela cerrada del backend, la ruta de datos del gráfico (velas, EMAs, overlay), las
herramientas de dibujo, y la barra más el panel de alertas. Sin dependencias nuevas ni cambios de
esquema. La única pieza entre capas es el nuevo mensaje WebSocket `candle`; el frontend lo ignora hasta
desplegarse y el backend lo envía a todos, así que el orden backend → frontend es seguro.

## Backend (CA 14)

`services/candle-close.ts` (nuevo): `trackCandleCloses(broker, batch)` guarda, por `broker:symbol:tf`,
el `<tf>_time` / `<tf>_open` / `<tf>_high` / `<tf>_low` / `bid` del último tick. Cuando un tick trae un
`<tf>_time` distinto para esa clave, la instantánea anterior es la vela cerrada: `db.candle.upsert` sobre
`(broker, symbol, timeframe, time = new Date(prevTime))` con `create` = el OHLC (cierre = último bid) y
`update: {}` (una fila existente, que solo puede venir del EA, se deja intacta), y después
`wss.broadcastCandle(broker, { symbol, timeframe, time: prevTime / 1000, open, high, low, close })`.
Se llama desde el handler de `ticks` en `index.ts` junto a los evaluadores, independiente de
`FEATURE_ALERTS`, y `FEATURE_WS_BROADCAST` solo condiciona la emisión. Mismos cinco `TF_FIELDS` que los
evaluadores de EMA. El primer tick tras el arranque solo siembra el mapa (ninguna vela sin una anterior
completa).

`services/candles.ts` `upsertCandles`: el fichero del EA conserva la autoridad (CA 14). La lista cerrada
se sigue insertando con `createMany({ skipDuplicates })`, y sus dos últimas velas se escriben además con
`upsert` + `update` del OHLC, así una fila construida desde ticks se sustituye por los valores del EA en
el siguiente poll. Dos consultas más por fichero.

`ws/ws.ts`: `broadcastCandle(broker, candle)` → `broadcast('candle', { broker, ...candle })`. Docs: la
tabla WS de `architecture.md` y la línea WS de `.claude/CLAUDE.md` ganan `candle`.

Base temporal: `<tf>_time` llega en ms en la misma base de hora broker que ya usa `candles.time` (el
fichero del EA da segundos, guardados como `new Date(sec * 1000)`), así que `new Date(prevTime)` cae en
la misma fila que escribirá el EA. Un test del backend (vitest) cubre el rastreador con una secuencia de
ticks sintética.

## Frontend

### Datos del gráfico (CA 13, 8, 15) — `ChartPage.tsx`, `LightweightChart.tsx`

- **Mensaje `candle`**: en el handler WS de `ChartPage`, un `candle` del broker / símbolo / timeframe
  actual → `setCandles(prev => upsertByTime(prev, parsed))` (sustituye la fila con el mismo time, si no
  añade y conserva el orden) y `liveCandleRef.current = null` cuando coincide su time, así la prop
  `candles` se actualiza como una carga REST. El parseo reutiliza la conversión de `time` de la ruta REST.
- **EMA sobre la vela viva**: `syncEmaSeries` guarda, por id de EMA, el último punto cerrado
  `{ time, value }` tras `setData`. `updateLive` llama a `series.update({ time: liveTime, value: close *
  k + last.value * (1 - k) })` para cada EMA con `k = 2 / (period + 1)`; el `setData` de la siguiente
  vela cerrada lo sustituye. Sin estado extra en la página.
- **Recorte de rollovers**: `drawRollovers` envuelve el bucle de líneas en `ctx.save();
  ctx.beginPath(); ctx.rect(0, 0, chart.timeScale().width(), bottom); ctx.clip(); … ctx.restore()`. Los
  marcadores de alerta se pintan tras el restore, en el borde del panel como hoy.
- **Refresco de marcadores de alerta**: el bucle rAF calcula la firma de alertas también con lista vacía
  (la guarda `length > 0` hacía invisible el último borrado) y los cambios de `alerts` llaman además a
  `drawRolloversRef.current()` desde el efecto existente de `alertsRef`.

### Herramientas de dibujo (CA 9, 10, 11) — `DrawingTools.ts`

- `Handle` gana `'nw' | 'ne' | 'sw' | 'se' | 'n' | 's' | 'e' | 'w' | 'move'`. Para un rectángulo el
  hit-test comprueba, en orden: las cuatro esquinas (radio `r`), los cuatro centros de borde (`r`), la
  cruz central (`r`) y después los bordes (`'line'`, que conserva el arrastre para mover de hoy). Las
  líneas mantienen `start` / `end`.
- El rectángulo se normaliza en `endDrag` (`logical1 < logical2`, `price1 > price2`), así `nw` siempre
  es (logical1, price1), `e` mueve `logical2`, `s` mueve `price2`, etc. `n` / `s` cambian solo el precio,
  `e` / `w` solo el logical; las esquinas ambos; `move` y `line` desplazan los cuatro por el delta del
  arrastre (como la ruta actual de `dragLastLogical`).
- Cursores en escritorio: `nwse-resize` / `nesw-resize` en esquinas, `ns-resize` / `ew-resize` en lados,
  `move` en la cruz y los bordes, desde el hit de hover en `onMouseMove`.
- Pintado: `paintRect` con `selected` dibuja las cuatro esquinas con `paintHandle` (círculos, como hoy) y
  los cuatro centros como cuadrados de 8 px en `HANDLE_ACTIVE_COLOR`, más una cruz de cuatro flechas de
  20 px en el centro; la previsualización mientras se dibuja mantiene solo las dos esquinas.
- `paintMarker(p, direction, selected)` / `paintSymbol(p, variant, selected)`: seleccionado, un
  `strokeRect` de 1 px en `HANDLE_ACTIVE_COLOR` alrededor de la caja del glifo con 4 px de holgura.
- `paintText`: seleccionado → `fillStyle = HANDLE_ACTIVE_COLOR`, sin marco punteado.
- Táctil: `HIT_RADIUS_TOUCH` sigue en 22 (objetivo de 44 px); las anclas nuevas lo comparten.

### Etiquetas del rectángulo (CA 16, 17) — `DrawingTools.ts`, Settings

`paintRectPrices` escribe, a 9 px en `--text` con contorno negro de 3 px, el precio superior sobre la
esquina superior derecha, el inferior bajo la inferior derecha y la altura en pips (`(máx − mín) /
pipSize`, un decimal) bajo la inferior izquierda, apartados de las anclas; los precios usan los decimales
de `pipSize` + 1. Se pinta en todo rectángulo y en la previsualización al dibujar. El flag `rectLabels`
viaja en el `TrendlineAppearance` que el gráfico ya recibe de `/settings` (`false` omite las etiquetas).
Datos: la migración `20261026000000_rect_labels` añade `settings_display.rectLabels BOOLEAN NOT NULL
DEFAULT true`; `PUT /settings` acepta un `display.rectLabels` opcional y ambos verbos lo devuelven; la
pestaña Display gana una fila con toggle.

### Barra (CA 1–7) — `ChartToolbar.tsx` + `.module.css`

- Marcado reagrupado: `.tools` conserva el select de timeframe y los cinco botones diarios (posiciones,
  alertas, filtros, indicadores, pantalla completa) más un botón **Draw** (`.drawToggle`, texto "Draw",
  `aria-expanded`); los ocho botones de dibujo pasan a `.drawTools`. En escritorio `.drawToggle` es
  `display: none` y `.drawTools` se pinta en línea en la misma fila (orden conservado: tras alertas, antes
  de filtros, vía `order` CSS), así la fila es idéntica a la de hoy (CA 6).
- Móvil (`max-width: 768px`): `.toolbar` pasa a `flex-wrap: wrap; height: auto; padding: 4px 8px`;
  `.tools` es la primera fila (`flex-basis: 100%`), `.drawTools` la segunda (`flex-basis: 100%`, oculta
  salvo con `drawOpen`); botones de 44 × 44 con 4 px de hueco, el select `flex: 1; min-width: 70px;
  height: 44px`.
- `drawOpen` es estado local de `ChartToolbar` (inicial `false`); no lo reinicia `onDrawDone` (CA 3) y
  sobrevive a un cambio de tamaño (el estado es independiente del breakpoint, CA 7). El área del gráfico
  ya es `flex: 1`, así que una segunda fila la reduce (CA 4); la pantalla completa usa el mismo
  componente (CA 5).

### Panel de alertas (CA 12) — `AlertsPanel.module.css`

`.addBtn` reestilado al estándar de envío de los paneles: `height: 48px; border: none; background:
var(--orange); color: #000; font: var(--text-md) var(--font-sans); letter-spacing:
var(--tracking-wide); text-transform: uppercase; border-radius: 0`; `:hover opacity .85`,
`:disabled opacity .4`. En móvil mantiene `--text-xl` como el resto de paneles.

### Ficheros

```
backend/src/services/candle-close.ts (+ test)          nuevo
backend/src/services/candles.ts, src/index.ts, src/ws/ws.ts, docs/architecture.md, .claude/CLAUDE.md   edit
frontend/src/features/chart/ChartPage.tsx, LightweightChart.tsx   edit
frontend/src/features/chart/DrawingTools.ts                        edit
frontend/src/features/chart/ChartToolbar.tsx (+ .module.css)       edit
frontend/src/features/chart/AlertsPanel.module.css                 edit
```

## Maqueta

Artefacto Design aprobado por el usuario el 24-10-2026: https://claude.ai/artifact/66KKArTpvxsXetAAZsYpY1.
Mesas: Rectangle selected (ocho anclas y la cruz central), Chart · mobile toolbar (una fila), Chart · Draw
row open (segunda fila con las ocho herramientas), Markers selected (los cuatro marcadores y una etiqueta
de texto, sin seleccionar y seleccionados), Alerts panel · Add button.

## Riesgos

- El cierre de una vela construida desde ticks es el último bid antes del rollover, que puede diferir en
  fracciones de pip del cierre del EA; el fichero del EA la sobrescribe en el siguiente poll. Aceptado por
  el usuario.
- Un reinicio del backend pierde la instantánea por símbolo, así que el primer cierre tras un reinicio no
  se emite (el fichero del EA lo rellena como hoy).
- La normalización del rectángulo cambia el orden guardado de `logical1/2`, `price1/2` de los dibujos
  existentes solo cuando se vuelven a arrastrar; la forma persistida no cambia.
