# 019 · FE-04 — Render por tick · Diseño

## Enfoque

Mantener los datos de alta frecuencia fuera del estado React donde nada se renderiza a partir de ellos, y hacer que toda actualización de estado que quede dependa de un cambio real. Herramientas: refs, `useImperativeHandle` (React 19 pasa `ref` como prop normal, sin `forwardRef`), `React.memo` con handlers estables, firmas comparadas antes de `setState` y agrupación por `requestAnimationFrame`. Sin store, sin librería, sin más abstracción que un tipo `ChartHandle`.

Medida: React DevTools Profiler con "Record why each component rendered", 10 s en reposo en cada página con ticks fluyendo, antes y después. Objetivos: `ChartPage` 0 renders/s (panel de alertas cerrado), `JournalPage` 0 renders/s, `ScannerPage` ≤ 60 renders/s solo mientras cambian los bids.

## Gráfico: vela viva sin estado de página

**`LightweightChart.tsx`.** Exportar `interface ChartHandle { updateLive(candle: Candle | null): void }`. El componente acepta `ref?: Ref<ChartHandle>` y lo expone con `useImperativeHandle(ref, () => ({ updateLive }), [updateLive])`. `updateLive` es el cuerpo del efecto actual de la vela viva (`:736-766`) como `useCallback` sin deps (lee `seriesRef`, `candlesRef`, `liveCandleTimeRef`); `null` limpia `liveCandleTimeRef`. Se eliminan la prop `liveCandle` y su efecto.

**`ChartPage.tsx`.** `const [liveCandle, setLiveCandle]` se sustituye por `chartRef = useRef<ChartHandle>(null)` y `liveCandleRef = useRef<Candle | null>(null)`. El handler del WS construye la vela, la guarda en `liveCandleRef` y llama a `chartRef.current?.updateLive(candle)`. El reset de selección en render **no** llama al gráfico; el efecto de velas (que ya corre en cada cambio de selección) resetea el ref antes de cargar. `<LightweightChart ref={chartRef} …>` pierde la prop `liveCandle`.

**Precio del panel de alertas (AC 2).** `const [panelPrice, setPanelPrice] = useState<number | null>(null)`. En el handler del WS: `if (alertsOpen) setPanelPrice(last.bid)` (`alertsOpen` entra en las deps del handler; `useWs` lee el último handler por ref, así que no hay resuscripción). El toggle de alertas siembra `setPanelPrice(liveCandleRef.current?.close ?? null)` al abrir, para que el panel no espere al siguiente tick. `AlertsPanel` recibe `currentPrice={panelPrice}`. Con el panel cerrado ningún tick toca el estado.

## Gráfico: posiciones solo cuando cambian

**Handler del WS en `ChartPage.tsx`.** `if (m.type === 'positions')`: retorno temprano cuando `positionsMode === 'none'` (`positionsMode` entra en las deps del handler). Si no, normalizar como hoy, calcular

```ts
const positionsSignature = (list: Position[]) =>
  list.map(p => `${p.ticket}|${p.type}|${p.lots}|${p.openPrice}|${p.sl}|${p.tp}|${p.profit}`).join(';');
```

y hacer `setPositions` solo cuando difiere de `positionsSigRef.current` (actualizado en cada set aceptado y limpiado por el reset `positionsKey` existente). El efecto del snapshot REST pasa por la misma puerta. Con posiciones abiertas la firma cambia aproximadamente una vez por segundo (se mueve el profit); sin ellas, o con el mercado cerrado, nunca.

**Efecto de posiciones de `LightweightChart.tsx` (`:768-865`).** Reconciliar en lugar de reconstruir:

- `addLine(id, price, color, text)` pasa a ser un upsert: `const opts = { price, color, lineWidth, lineStyle, axisLabelVisible: false }; const existing = priceLinesRef.current.get(id); if (existing) existing.applyOptions(opts); else priceLinesRef.current.set(id, series.createPriceLine(opts)); seen.add(id);`. Tras el bucle, todo id de `priceLinesRef` que no esté en `seen` se elimina con `series.removePriceLine` y se borra del mapa. Desaparecen las dos líneas `removePriceLine` / `new Map()` del inicio del efecto.
- Markers: construir el array como hoy y después `const key = markers.map(m => `${m.time}|${m.shape}`).join(',')`; desconectar y recrear el plugin solo cuando `key !== markersKeyRef.current`. El load-more puede desplazar la vela de un marker (la clave cambia y el plugin se reconstruye una vez).
- `levels`, `draggable`, `positionLevelsRef` y `repositionLabels()` siguen corriendo cada vez: las etiquetas llevan el texto del P&L y son baratas.
- Arrastre (AC 6): el código de arrastre ya trabaja sobre `priceLinesRef.current.get(drag.level.id)`; como el objeto de línea persiste ahora entre actualizaciones, los `applyOptions` del arrastre y del efecto caen sobre el mismo objeto. La lógica de `resolve()` no cambia.

## Gráfico: paneles memoizados y handlers estables (AC 7)

Envolver en `memo`: `AlertsPanel`, `IndicatorsPanel`, `ChartFiltersPanel`, `ChartToolbar`, `NewTradePanel`, `BulkEditPanel`, `ClosePositionPanel`, como `export const X = memo(function X(props) { … })` para conservar el nombre. `LightweightChart` no se memoiza: cuando la página deja de re-renderizarse por tick, solo se renderiza en cambios reales, y sus props incluyen arrays que cambian legítimamente.

En `ChartPage`, las arrows inline pasan a `useCallback`: `openIndicators`, `closeIndicators`, `openFilters`, `closeFilters`, `toggleAlerts` (también resetea el flash y siembra `panelPrice`), `closeAlerts`, `toggleDrawMode`, `clearDrawMode`, `cyclePositions`, `openNewTrade`, `closeNewTrade`, `clearEdit`, `clearClose`. `editPositions = useMemo(() => editPosition ? [editPosition] : [], [editPosition])` alimenta `BulkEditPanel`. `setBroker`/`setSymbol`/`setTimeframe`/`setEmas` son setters y ya son estables; `alerts`, `emaAlerts`, `brokers`, `symbols`, `emas` son arrays de estado y solo cambian en actualizaciones reales.

## Scanner: bids por frame (AC 8)

`ScannerPage`:

```ts
const bidsRef = useRef<Record<string, number>>({});
const rafRef = useRef<number | null>(null);
const [prevBroker, setPrevBroker] = useState(broker);
if (broker !== prevBroker) { setPrevBroker(broker); setBids({}); }   // reset en render, mismo patrón que la spec 016

useEffect(() => {
  bidsRef.current = {};
  const unsubscribe = subscribe(data => {
    const m = data as { type?: string; broker?: string; ticks?: { symbol: string; bid: number }[] };
    if (m.type !== 'ticks' || m.broker !== broker || !m.ticks) return;
    let changed = false;
    for (const t of m.ticks) if (bidsRef.current[t.symbol] !== t.bid) { bidsRef.current[t.symbol] = t.bid; changed = true; }
    if (!changed || rafRef.current !== null) return;
    rafRef.current = requestAnimationFrame(() => { rafRef.current = null; setBids({ ...bidsRef.current }); });
  });
  return () => { unsubscribe(); if (rafRef.current !== null) cancelAnimationFrame(rafRef.current); rafRef.current = null; };
}, [broker]);
```

`SituationTable` se envuelve en `memo` para que las dos tablas se re-rendericen solo cuando cambian `bids` o `rows`.

## Journal: tiempos precalculados y callbacks con puerta de cambio (AC 9)

**`OpenPositions.tsx`.** Tipo local `type LivePosition = Position & { openedAt: number }`; un helper `normalize(p, source)` (usado por el snapshot REST y el handler del WS, sustituyendo los dos spreads inline) añade `openedAt: openTimeMs(p.openTime)`. El estado pasa a `LivePosition[]`; `byBrokerThenTime` compara `openedAt`. Los consumidores tipados sobre `Position` aceptan el supertipo estructural sin cambios.

Opciones: `brokers`, `symbols`, `activeColors` pasan a un único `useMemo` sobre `[positions, colors]` que también devuelve `key = brokers.join(',') + '|' + symbols.join(',') + '|' + activeColors.join(',')`. El efecto llama a `onOptionsChange` solo cuando `key !== optionsKeyRef.current` (deps `[options, onOptionsChange]`, comparación por ref dentro, sin excepción de eslint).

Grupo bulk: `bulkGroup` ya está memoizado, pero `openPositions` es un array nuevo cada segundo, así que `onBulkChange` se disparaba cada segundo. Añadir `bulkKey = group ? `${group.symbol}|${group.type}|${group.positions.map(p => `${p.ticket}:${p.sl}:${p.tp}`).join(',')}` : ''` y condicionar `onBulkChange` a `bulkKey !== bulkKeyRef.current`. El grupo que guarda `JournalPage` se refresca por tanto cuando un ticket entra o sale, o cuando cambia un SL/TP (los fallbacks de BulkEditPanel siguen al día), y no cuando se mueve el profit.

**`JournalPage.tsx`.** Sin cambios: con ambos callbacks condicionados, su estado solo cambia en eventos reales. `handleOptionsChange`/`handleBulkChange` ya son `useCallback`.

**`Accounts.tsx`.** El handler del WS ya es por broker y el componente posee su estado; su re-render por mensaje `account` (1/s/broker) se queda dentro de `Accounts`. El sondeo de P&L diario (AC 10):

```ts
useEffect(() => {
  let id: number | null = null;
  const stop = () => { if (id !== null) { clearInterval(id); id = null; } };
  const start = () => { stop(); fetchDayPnl(); id = window.setInterval(fetchDayPnl, DAY_PNL_POLL_MS); };
  const onVisibility = () => (document.hidden ? stop() : start());
  if (!document.hidden) start();
  document.addEventListener('visibilitychange', onVisibility);
  return () => { stop(); document.removeEventListener('visibilitychange', onVisibility); };
}, []);
```

## Flujo de datos

Solo frontend. Sin cambios en mensajes WS, endpoints ni bridge del EA.

## Riesgos

- **Orden de efectos con el handle imperativo.** `updateLive` corre desde un callback del WS y puede dispararse antes de que exista la serie del gráfico o de que carguen las velas; ya se protege con `seriesRef` y `candlesRef.length < 2`, como hacía el efecto antiguo. Tras un cambio de selección, el primer tick vuelve a aplicar la vela viva cuando llegan las velas, como hoy.
- **Líneas reconciliadas y estilo de `selectedLevelId`.** `applyOptions` debe incluir `lineWidth`/`lineStyle` para que el resaltado de selección se actualice en una línea existente; el `applyOptions` del handler de arrastre ya lo hace. Se verifica seleccionando un nivel, esperando una actualización de posiciones y comprobando que el resaltado se mantiene.
- **Paneles memoizados que oculten una prop que debería cambiar.** Cada `memo` depende de que el padre pase referencias nuevas solo en cambios reales. Los arrays `brokers`/`symbols` son estado; los de `alerts` vienen de `useRemoteList`; los handlers son `useCallback`. Una dependencia olvidada se vería como un panel desactualizado en la pasada de producción (abrir cada panel tras cambiar broker/símbolo).
- **Coste de la firma.** Construir una cadena por mensaje `positions` (≤ docenas de posiciones, 1/s) es despreciable frente al render que evita.
- **Reset en render del scanner.** `setBids({})` durante el render sigue el patrón ya usado para `prevBroker`/`prevSelectionKey`; el efecto limpia `bidsRef` en el mismo cambio de broker.

## Verificación

- `npx eslint .` · `npm run build` tras cada tarea.
- Profiler en `/chart` en reposo, panel cerrado: `ChartPage` 0 renders/s (antes ~10); abrir el panel de alertas: el precio se actualiza, `ChartPage` renderiza ≤ ritmo de ticks mientras está abierto, 0 tras cerrarlo. Con posiciones visibles: las líneas de precio conservan su identidad entre actualizaciones (DevTools: tamaño de `priceLinesRef` estable; sin parpadeo), arrastrar un SL durante los ticks.
- Profiler en `/journal` en reposo con posiciones abiertas: `JournalPage` 0 renders/s (antes ~12), `OpenPositions` ≤ 1/s/broker; los filtros siguen rellenándose; el badge de bulk aparece/desaparece con la selección y los tickets.
- Profiler en `/scanner`: `ScannerPage` ≤ 60/s mientras se mueven los bids, 0 con el mercado quieto; cambiar de broker: las distancias se vacían y se rellenan.
- Accounts de `/journal`: ocultar la pestaña 15 s, Network no muestra `daily-pnl`; mostrarla: una petición inmediata y después cada 5 s.
