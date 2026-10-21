# 019 · FE-04 — Per-tick rendering · Design

## Approach

Keep high-frequency data out of React state where nothing renders from it, and make every state update that remains conditional on a real change. Tools: refs, `useImperativeHandle` (React 19 passes `ref` as a regular prop, no `forwardRef`), `React.memo` with stable handlers, signatures compared before `setState`, and `requestAnimationFrame` batching. No store, no library, no new abstraction beyond a `ChartHandle` type.

Measurement: React DevTools Profiler with "Record why each component rendered", 10 s at rest on each page with ticks flowing, before and after. Targets: `ChartPage` 0 renders/s (alerts panel closed), `JournalPage` 0 renders/s, `ScannerPage` ≤ 60 renders/s only while bids change.

## Chart: live candle without page state

**`LightweightChart.tsx`.** Export `interface ChartHandle { updateLive(candle: Candle | null): void }`. The component accepts `ref?: Ref<ChartHandle>` and exposes it with `useImperativeHandle(ref, () => ({ updateLive }), [updateLive])`. `updateLive` is the body of today's live-candle effect (`:736-766`) as a `useCallback` with no deps (it reads `seriesRef`, `candlesRef`, `liveCandleTimeRef`); `null` clears `liveCandleTimeRef`. The `liveCandle` prop and its effect are removed.

**`ChartPage.tsx`.** `const [liveCandle, setLiveCandle]` is replaced by `chartRef = useRef<ChartHandle>(null)` and `liveCandleRef = useRef<Candle | null>(null)`. The WS handler builds the candle, stores it in `liveCandleRef` and calls `chartRef.current?.updateLive(candle)`. The render-time selection reset sets `liveCandleRef.current = null` and calls `chartRef.current?.updateLive(null)` is **not** done during render; instead the candles effect (which already runs on selection change) resets the ref before loading. `<LightweightChart ref={chartRef} …>` loses the `liveCandle` prop.

**Alerts panel price (AC 2).** `const [panelPrice, setPanelPrice] = useState<number | null>(null)`. In the WS handler: `if (alertsOpen) setPanelPrice(last.bid)` (`alertsOpen` joins the handler's deps; `useWs` reads the latest handler through a ref so no resubscription happens). The alerts toggle seeds `setPanelPrice(liveCandleRef.current?.close ?? null)` when opening, so the panel does not wait for the next tick. `AlertsPanel` receives `currentPrice={panelPrice}`. While the panel is closed no tick touches state.

## Chart: positions only when they change

**`ChartPage.tsx` WS handler.** `if (m.type === 'positions')`: return early when `positionsMode === 'none'` (`positionsMode` joins the handler deps). Otherwise normalise as today, compute

```ts
const positionsSignature = (list: Position[]) =>
  list.map(p => `${p.ticket}|${p.type}|${p.lots}|${p.openPrice}|${p.sl}|${p.tp}|${p.profit}`).join(';');
```

and `setPositions` only when it differs from `positionsSigRef.current` (updated on every accepted set, and cleared by the existing `positionsKey` reset). The REST snapshot effect goes through the same gate. With open positions the signature changes about once per second (profit moves); with none, or with the market closed, it never does.

**`LightweightChart.tsx` positions effect (`:768-865`).** Reconcile instead of rebuild:

- `addLine(id, price, color, text)` becomes an upsert: `const opts = { price, color, lineWidth, lineStyle, axisLabelVisible: false }; const existing = priceLinesRef.current.get(id); if (existing) existing.applyOptions(opts); else priceLinesRef.current.set(id, series.createPriceLine(opts)); seen.add(id);`. After the loop, every id in `priceLinesRef` not in `seen` is removed with `series.removePriceLine` and deleted from the map. The two `removePriceLine` / `new Map()` lines at the top of the effect go away.
- Markers: build the array as today, then `const key = markers.map(m => `${m.time}|${m.shape}`).join(',')`; detach and recreate the plugin only when `key !== markersKeyRef.current`. Load-more can shift a marker's candle (the key changes and the plugin is rebuilt once).
- `levels`, `draggable`, `positionLevelsRef`, `repositionLabels()` keep running every time: labels carry the P&L text and are cheap.
- Drag (AC 6): the drag code already works on `priceLinesRef.current.get(drag.level.id)`; since the line object now persists across updates, `applyOptions` from the drag and from the effect hit the same object. The `resolve()` override logic is unchanged.

## Chart: memoised panels and stable handlers (AC 7)

Wrap in `memo`: `AlertsPanel`, `IndicatorsPanel`, `ChartFiltersPanel`, `ChartToolbar`, `NewTradePanel`, `BulkEditPanel`, `ClosePositionPanel`, as `export const X = memo(function X(props) { … })` so the display name survives. `LightweightChart` is not memoised: once the page stops re-rendering per tick it renders only on real changes, and its props include arrays that change legitimately.

In `ChartPage`, the inline arrow props become `useCallback`s: `openIndicators`, `closeIndicators`, `openFilters`, `closeFilters`, `toggleAlerts` (also resets the flash and seeds `panelPrice`), `closeAlerts`, `toggleDrawMode`, `clearDrawMode`, `cyclePositions`, `openNewTrade`, `closeNewTrade`, `clearEdit`, `clearClose`. `editPositions = useMemo(() => editPosition ? [editPosition] : [], [editPosition])` feeds `BulkEditPanel`. `setBroker`/`setSymbol`/`setTimeframe`/`setEmas` are state setters and already stable; `alerts`, `emaAlerts`, `brokers`, `symbols`, `emas` are state arrays and only change on real updates.

## Scanner: bids per frame (AC 8)

`ScannerPage`:

```ts
const bidsRef = useRef<Record<string, number>>({});
const rafRef = useRef<number | null>(null);
const [prevBroker, setPrevBroker] = useState(broker);
if (broker !== prevBroker) { setPrevBroker(broker); setBids({}); }   // render-time reset, same pattern as spec 016

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

`SituationTable` is wrapped in `memo` so the two tables re-render only when `bids` or `rows` change.

## Journal: precomputed times and change-gated callbacks (AC 9)

**`OpenPositions.tsx`.** Local `type LivePosition = Position & { openedAt: number }`; a `normalize(p, source)` helper (used by both the REST snapshot and the WS handler, replacing the two inline spreads) adds `openedAt: openTimeMs(p.openTime)`. State becomes `LivePosition[]`; `byBrokerThenTime` compares `openedAt`. Consumers typed on `Position` accept the structural supertype unchanged.

Options: `brokers`, `symbols`, `activeColors` move into one `useMemo` on `[positions, colors]` that also returns `key = brokers.join(',') + '|' + symbols.join(',') + '|' + activeColors.join(',')`. The effect calls `onOptionsChange` only when `key !== optionsKeyRef.current` (deps `[options, onOptionsChange]`, ref compare inside, no eslint exception).

Bulk group: `bulkGroup` is memoised today but `openPositions` is a new array every second, so `onBulkChange` fired every second. Add `bulkKey = group ? `${group.symbol}|${group.type}|${group.positions.map(p => `${p.ticket}:${p.sl}:${p.tp}`).join(',')}` : ''` and gate `onBulkChange` on `bulkKey !== bulkKeyRef.current`. The group `JournalPage` holds therefore refreshes when a ticket enters or leaves, or when an SL/TP changes (BulkEditPanel's fallbacks stay current), and not when profit moves.

**`JournalPage.tsx`.** No change: with both callbacks gated, its state only changes on real events. `handleOptionsChange`/`handleBulkChange` are already `useCallback`s.

**`Accounts.tsx`.** The WS handler is already per-broker and the component owns its state; its re-render per `account` message (1/s/broker) stays inside `Accounts`. The daily-P&L poll (AC 10):

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

## Data flow

Frontend-only. No WS message, endpoint or EA bridge changes.

## Risks

- **Effect order with the imperative handle.** `updateLive` runs from a WS callback and may fire before the chart's series exists or before candles load; it already guards on `seriesRef` and `candlesRef.length < 2`, as the old effect did. After a selection change the first tick re-applies the live candle once candles arrive, as today.
- **Reconciled price lines and `selectedLevelId` styling.** `applyOptions` must include `lineWidth`/`lineStyle` so selection highlight updates on an existing line; the drag handler's own `applyOptions` already does this. Verified by selecting a level, waiting for a positions update, and checking the highlight stays.
- **Memoised panels hiding a prop that should change.** Each `memo` relies on parents passing new references only on real changes. `brokers`/`symbols` arrays are state; `alerts` arrays come from `useRemoteList`; handlers are `useCallback`. A missed dependency would show as a stale panel in the production pass (open each panel after changing broker/symbol).
- **Signature cost.** Building a string per `positions` message (≤ dozens of positions, 1/s) is negligible next to the render it prevents.
- **Scanner render-time reset.** `setBids({})` during render follows the pattern already used for `prevBroker`/`prevSelectionKey`; the effect clears `bidsRef` on the same broker change.

## Verification

- `npx eslint .` · `npm run build` after each task.
- Profiler on `/chart` at rest, panel closed: `ChartPage` 0 renders/s (was ~10); open the alerts panel: price updates, `ChartPage` renders ≤ tick rate while open, 0 after closing. With positions shown: price lines keep their object identity across updates (DevTools: `priceLinesRef` size stable; no flicker), drag an SL during ticks.
- Profiler on `/journal` at rest with open positions: `JournalPage` 0 renders/s (was ~12), `OpenPositions` ≤ 1/s/broker; filters still populate; bulk badge appears/disappears with selection and tickets.
- Profiler on `/scanner`: `ScannerPage` ≤ 60/s while bids move, 0 when the market is quiet; switch broker: distances clear and refill.
- `/journal` accounts: hide the tab 15 s, Network shows no `daily-pnl`; show it: one immediate request then every 5 s.
