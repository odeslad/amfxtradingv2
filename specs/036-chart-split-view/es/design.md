# 036 — Vista dividida del gráfico · Diseño

## Enfoque

Hoy `ChartPage` lo tiene todo para un solo gráfico: selección, velas, vela activa, dibujos, modo de dibujo, bloqueo, modo de posiciones, alerta seleccionada, pantalla completa, manejo del WS y los paneles. El split necesita dos de casi todo eso y uno del resto, así que el cambio es partir el componente por esa línea:

- **`ChartPage`** se queda con lo compartido: broker / símbolo y sus listas, balances, EMAs + panel de indicadores, panel de filtros, datos de alertas (`useAlerts`, `useEmaAlerts`) + panel de alertas, posiciones (un fetch por broker), paneles New Trade / Edit / Close, los atajos Ctrl+Flecha, el estado del split y el layout redimensionable.
- **`ChartSlot`** (nuevo) posee un gráfico: timeframe, velas + paginación de histórico, vela activa (su propio handler de WS), dibujos, modo de dibujo, bloqueo, modo de posiciones, alerta seleccionada + barra de acción, overlay de carga, pantalla completa de su propio contenedor, su `ChartToolbar` y su `LightweightChart`.

El modo simple renderiza un slot; el split renderiza dos con un divisor arrastrable. Sin backend, EA ni BD. Sin dependencias nuevas: el divisor es un `mousedown` / `mousemove` / `mouseup` sobre `document`, como los arrastres del propio gráfico, y `LightweightChart` ya sigue a su contenedor con un `ResizeObserver`.

## Alternativas

- **Duplicar `ChartPage` dentro de sí mismo (renderizar dos `ChartPage`)**: lo más rápido, pero duplica paneles, fetch de posiciones, hooks de alertas y listeners de teclado, y los dos gráficos no podrían compartir broker / símbolo / EMAs. Descartado.
- **Una sola barra que actúa sobre el gráfico "activo"**: menos controles en pantalla, pero el usuario pidió que cada gráfico lleve los suyos y el concepto de gráfico activo oculto es una fuente conocida de errores. Descartado (requisitos).
- **`resize` CSS en la columna izquierda**: sin JS, pero solo redimensiona desde un asa de esquina y no da mínimos simétricos. Descartado; un divisor de 6 px con arrastre sobre `document` es pequeño y encaja con los demás arrastres de la página.

## Cambios por capa

### frontend

**`features/chart/ChartSlot.tsx`** (nuevo, extraído de `ChartPage`)
- Props: `side: 'left' | 'right'`, `broker`, `symbol`, `brokers`, `symbols`, `brokerHidden`, `symbolHidden`, `onBrokerChange`, `onSymbolChange`, `timeframe`, `onTimeframeChange`, `positions` (posiciones en vivo del broker), `balance`, `emas`, `trendlineAppearance`, `showSpread`, `pnlMode`, `alerts` (broker + símbolo), callbacks de alertas (`onMoveAlert`, `onEditAlertPrice`, `onToggleAlert`, `onDeleteAlert`), `onOpenAlerts(price, timeframe)`, `onOpenIndicators`, `onOpenFilters`, `onNewTrade(timeframe)`, `onEditPosition`, `onClosePosition`, `onModifyPosition`, `splitActive`, `onToggleSplit`, `splitAvailable` (false en móvil).
- Estado que se mueve desde `ChartPage`: `candles`, `hasMore`, `chartLoading`, `drawings`, `drawMode`, `positionsMode`, `selectedAlertId`, `isFullscreen`, y las refs `chartRef`, `liveCandleRef`, `candlesRef`, `hasMoreRef`, `isLoadingMoreRef`, `loadMoreAcRef`, `saveTimerRef`, `wrapperRef` (sustituye a `pageRef`).
- Bloqueo: `useLocalStorage('chart.locked', false)` para el slot izquierdo (la clave de hoy, sin cambios para los usuarios actuales) y `'chart.locked.right'` para el derecho.
- Efectos que se mueven: fetch de histórico por `broker|symbol|timeframe`, `loadMoreCandles`, GET / PUT con debounce de dibujos, reset por clave de selección durante el render, el handler de `useWs` (filtra `candle` por su propio timeframe, lee `TF_KEYS[timeframe]` de los ticks, empuja a su propio `chartRef.updateLive`), listener de cambio de pantalla completa y la clase de body del fallback iOS (`chartFullscreenActive` la pone el slot que esté en pantalla completa).
- Renderiza `ChartToolbar` + un contenedor `.slot` con `ChartErrorBoundary`, `LightweightChart`, overlay de carga y `AlertActionBar`, exactamente como hoy los renderiza `ChartPage`.
- `onNewTrade` / `onOpenAlerts` pasan el timeframe y el precio actual del slot para que la página preseleccione los paneles (AC 7).

**`features/chart/ChartPage.tsx`**
- Conserva: selección (`broker`, `symbol`, listas, visibilidad, almacenamiento `chart.selection` con el timeframe **izquierdo**, parámetros de URL), balances, opciones de display de `/settings`, EMAs + `IndicatorsPanel`, `ChartFiltersPanel`, hooks de alertas + `AlertsPanel` (`panelPrice` lo fija ahora el slot que lo abre), fetch de posiciones por broker (siempre que haya `broker`; cada slot filtra por su `positionsMode`), `NewTradePanel` con `initialTimeframe` = timeframe del slot que lo abre, `BulkEditPanel`, `ClosePositionPanel`, atajos Ctrl+Flecha.
- Nuevo estado de split, `useLocalStorage('chart.split', { on: false, rightTimeframe: 'H4', ratio: 0.5 })`:
  - `toggleSplit()`: activar → `on: true`, `rightTimeframe = nextTimeframeUp(leftTimeframe)` (`M5→M15→H1→H4→D1→H1`); desactivar → `on: false` (timeframe derecho y ratio se conservan para la próxima vez).
  - `isDesktop = useMediaQuery('(min-width: 769px)')` (hook pequeño nuevo en `lib/useMediaQuery.ts`, `matchMedia` + listener de cambio). `showSplit = split.on && isDesktop`.
- Layout: `.chartArea` pasa a ser el contenedor del split. En split: `display: grid; grid-template-columns: ${ratio}fr 6px ${1 - ratio}fr` como estilo inline (valor dinámico), hijos `ChartSlot left` · `.divider` · `ChartSlot right`. Arrastre del divisor: `mousedown` guarda el rect del contenedor; `mousemove` sobre `document` fija `ratio = clamp((clientX - left) / width, 0.25, 0.75)`; `mouseup` quita los listeners y persiste. Durante el arrastre el body lleva `user-select: none` y el divisor el cursor `col-resize`.
- Cada slot envuelve su barra y su gráfico para que la barra quede sobre su propio gráfico (AC 2); la página ya no renderiza una barra propia.

**`features/chart/ChartToolbar.tsx`**
- Nuevas props `splitActive?: boolean`, `onSplit?: () => void`, `splitAvailable?: boolean` → un botón nuevo `IconSplit` junto a Pantalla completa (`.desktopOnly`), estado activo cuando el split está encendido, oculto cuando `splitAvailable` es false.
- `shared/ui/icons.tsx`: `IconSplit` (dos rectángulos lado a lado, 16 px, mismo trazo que `IconRect`).

**`features/chart/ChartPage.module.css` · `ChartSlot.module.css`**
- `.chartArea` mantiene `flex: 1; min-height: 0`; `.split` añade `display: grid` (columnas desde el estilo inline), `.divider { background: var(--border); cursor: col-resize; }` con `:hover` / `.dividerActive` en `var(--border-bright)`, 6 px de ancho (el hueco mínimo del sistema de diseño).
- `.slot { display: flex; flex-direction: column; min-width: 0; }`, `.slotChart { flex: 1; position: relative; overflow: hidden; }` (las reglas de hoy de `.chartArea`), reglas de pantalla completa (`.slot:fullscreen`, `.slotFullscreen`) movidas de `.page` al contenedor del slot.
- Barra dentro de un slot a mitad de ancho: la fila `.tools` solo hace wrap con las reglas móviles; una regla de escritorio para slots por debajo de ~720 px quita etiquetas/padding de las herramientas de dibujo (`.toolbarCompact`, puesta por el slot cuando su ancho baja de 720 px con el mismo valor del `ResizeObserver`) para que las dos barras quepan en una pantalla de 1440 px (maqueta).

**Persistencia (solo navegador)**
- `chart.selection` → misma forma `{ broker, symbol, timeframe }` (gráfico izquierdo).
- `chart.split` → `{ on, rightTimeframe, ratio }`.
- `chart.locked` (izquierdo, ya existe) · `chart.locked.right` (nuevo).

## Flujo de datos

```
WS ticks / candle / positions ──▶ ChartPage useWs (posiciones, alertas) ──▶ estado positions → ambos slots
                              └─▶ ChartSlot.left useWs (candle tf=L, ticks → vela L) ──▶ chartRef.left.updateLive
                              └─▶ ChartSlot.right useWs (candle tf=R, ticks → vela R) ─▶ chartRef.right.updateLive
GET /candles?tf=L · GET /drawings?tf=L  (slot izquierdo)   GET /candles?tf=R · GET /drawings?tf=R  (slot derecho)
GET/PUT /chart-indicators (página, EMAs compartidas → ambos slots)
```

`lib/ws.ts` mantiene un único socket y un set de listeners, así que tres suscriptores `useWs` no cuestan nada extra en la red.

## Riesgos

- **`DrawingTools` escucha en `document`**: Escape cancela el dibujo en todas las instancias que estén dibujando (inofensivo), Delete solo actúa en la instancia con selección; seleccionar un dibujo en un gráfico no deselecciona el del otro. Aceptable; anotado para el estado "dos gráficos, un dibujo seleccionado" de la maqueta.
- **Dos gráficos a mitad de ancho**: históricos de 2000 velas se renderizan bien en lightweight-charts; lo justo son las barras, de ahí `.toolbarCompact`.
- **Pantalla completa por slot** (revisado en la tarea 1): los paneles laterales son hijos `position: fixed` de `.page`, así que un slot en fullscreen nativo los ocultaría. `requestFullscreen` sigue sobre la página; en split la página renderiza solo el slot que pidió la pantalla completa (`fullscreenSide`) y los dos de nuevo al salir. El fallback iOS y la clase de body no cambian.
- **Superficie del refactor**: extraer `ChartSlot` mueve ~300 líneas de `ChartPage`; el comportamiento en modo simple debe ser idéntico. La tarea 1 es solo esa extracción, verificada contra el gráfico de hoy antes de que exista UI de split.

## Maqueta

Aprobada por el usuario el 2026-11-02: https://claude.ai/artifact/8Wo12it4ynwufCwCLeHo2R

Artboards:
- Desktop · Chart · split 50/50 (H1 | H4) — dos slots, cada uno con su fila de timeframes y su barra completa; botón de split activo; slot derecho bloqueado.
- Desktop · Chart · single with split button — el gráfico de hoy con el botón de split inactivo junto a Pantalla completa.
- Desktop · Chart · dragging the divider (65/35) — divisor resaltado con la proporción; barra del slot estrecho en modo compacto.
- Mobile · Chart · single, no split button.
