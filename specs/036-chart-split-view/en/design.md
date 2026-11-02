# 036 — Chart split view · Design

## Approach

`ChartPage` today owns everything for one chart: selection, candles, live candle, drawings, draw mode, lock, positions mode, alert selection, fullscreen, WS handling and the panels. The split needs two of most of those and one of the rest, so the change is a split of the component along that line:

- **`ChartPage`** keeps what is shared: broker / symbol and their lists, balances, EMAs + Indicators panel, Filters panel, alerts data (`useAlerts`, `useEmaAlerts`) + Alerts panel, positions (one fetch per broker), New Trade / Edit / Close panels, the Ctrl+Arrow shortcuts, the split state and the resizable layout.
- **`ChartSlot`** (new) owns one chart: timeframe, candles + history paging, live candle (own WS handler), drawings, draw mode, lock, positions mode, selected alert + action bar, loading overlay, fullscreen of its own wrapper, its `ChartToolbar` and its `LightweightChart`.

Single mode renders one slot; split mode renders two with a draggable divider. No backend, no EA, no DB change. No new dependencies: the divider is a `mousedown` / `mousemove` / `mouseup` on `document`, as the chart's own drags already do, and `LightweightChart` already follows its container with a `ResizeObserver`.

## Alternatives

- **Duplicate `ChartPage` inside itself (render two `ChartPage`s)**: fastest, but doubles the panels, the positions fetch, the alerts hooks and the keyboard listeners, and the two charts could not share broker / symbol / EMAs. Rejected.
- **One toolbar acting on the "active" chart**: fewer controls on screen, but the user asked for each chart to carry its own controls, and a hidden active-chart concept is a known source of mistakes. Rejected (requirements).
- **CSS `resize` on the left column**: no JS, but only resizes from a corner handle and gives no min-width symmetry. Rejected; a 6 px divider with a document drag is small and matches the other drags on the page.

## Per-layer changes

### frontend

**`features/chart/ChartSlot.tsx`** (new, extracted from `ChartPage`)
- Props: `side: 'left' | 'right'`, `broker`, `symbol`, `brokers`, `symbols`, `brokerHidden`, `symbolHidden`, `onBrokerChange`, `onSymbolChange`, `timeframe`, `onTimeframeChange`, `positions` (broker's live positions), `balance`, `emas`, `trendlineAppearance`, `showSpread`, `pnlMode`, `alerts` (broker + symbol), alert callbacks (`onMoveAlert`, `onEditAlertPrice`, `onToggleAlert`, `onDeleteAlert`), `onOpenAlerts(price, timeframe)`, `onOpenIndicators`, `onOpenFilters`, `onNewTrade(timeframe)`, `onEditPosition`, `onClosePosition`, `onModifyPosition`, `splitActive`, `onToggleSplit`, `splitAvailable` (false on mobile).
- State moved from `ChartPage`: `candles`, `hasMore`, `chartLoading`, `drawings`, `drawMode`, `positionsMode`, `selectedAlertId`, `isFullscreen`, and the refs `chartRef`, `liveCandleRef`, `candlesRef`, `hasMoreRef`, `isLoadingMoreRef`, `loadMoreAcRef`, `saveTimerRef`, `wrapperRef` (replaces `pageRef`).
- Lock: `useLocalStorage('chart.locked', false)` for the left slot (today's key, unchanged for existing users) and `'chart.locked.right'` for the right one.
- Effects moved: history fetch keyed on `broker|symbol|timeframe`, `loadMoreCandles`, drawings GET / debounced PUT, selection-key reset during render, the `useWs` handler (filters `candle` by its own timeframe, reads `TF_KEYS[timeframe]` from the ticks, pushes to its own `chartRef.updateLive`), fullscreen change listener and the iOS fallback body class (now `chartFullscreenActive` is added by whichever slot is fullscreen).
- Renders `ChartToolbar` + a `.slot` wrapper with `ChartErrorBoundary`, `LightweightChart`, loading overlay and `AlertActionBar`, exactly as `ChartPage` renders them today.
- `onNewTrade` / `onOpenAlerts` pass the slot's timeframe and current price so the page can preselect the panels (AC 7).

**`features/chart/ChartPage.tsx`**
- Keeps: selection (`broker`, `symbol`, lists, visibility, `chart.selection` storage with the **left** timeframe, URL params), balances, `/settings` display options, EMAs + `IndicatorsPanel`, `ChartFiltersPanel`, alerts hooks + `AlertsPanel` (`panelPrice` now set by the slot that opened it), positions fetch keyed by broker (fetched whenever `broker` is set; each slot filters by its own `positionsMode`), `NewTradePanel` with `initialTimeframe` = the opening slot's timeframe, `BulkEditPanel`, `ClosePositionPanel`, Ctrl+Arrow shortcuts.
- New split state, `useLocalStorage('chart.split', { on: false, rightTimeframe: 'H4', ratio: 0.5 })`:
  - `toggleSplit()`: on → `on: true`, `rightTimeframe = nextTimeframeUp(leftTimeframe)` (`M5→M15→H1→H4→D1→H1`); off → `on: false` (right timeframe and ratio kept for next time).
  - `isDesktop = useMediaQuery('(min-width: 769px)')` (new tiny hook in `lib/useMediaQuery.ts`, `matchMedia` + change listener). `showSplit = split.on && isDesktop`.
- Layout: `.chartArea` becomes the split container. In split: `display: grid; grid-template-columns: ${ratio}fr 6px ${1 - ratio}fr` set as an inline style (dynamic value), children `ChartSlot left` · `.divider` · `ChartSlot right`. Divider drag: `mousedown` stores the container rect; `mousemove` on `document` sets `ratio = clamp((clientX - left) / width, 0.25, 0.75)`; `mouseup` removes the listeners and persists. While dragging the body gets `user-select: none` and the divider `col-resize` cursor.
- Each slot wraps its toolbar and chart so the toolbar sits above its own chart (AC 2); the page no longer renders a toolbar of its own.

**`features/chart/ChartToolbar.tsx`**
- New props `splitActive?: boolean`, `onSplit?: () => void`, `splitAvailable?: boolean` → a new `IconSplit` button next to Fullscreen (`.desktopOnly`), active state when split is on, hidden when `splitAvailable` is false.
- `shared/ui/icons.tsx`: `IconSplit` (two rectangles side by side, 16 px, same stroke style as `IconRect`).

**`features/chart/ChartPage.module.css` · `ChartSlot.module.css`**
- `.chartArea` keeps `flex: 1; min-height: 0`; `.split` adds `display: grid` (columns from the inline style), `.divider { background: var(--border); cursor: col-resize; }` with a `:hover` / `.dividerActive` in `var(--border-bright)`, 6 px wide (the design system's smallest allowed gap).
- `.slot { display: flex; flex-direction: column; min-width: 0; }`, `.slotChart { flex: 1; position: relative; overflow: hidden; }` (today's `.chartArea` rules), fullscreen rules (`.slot:fullscreen`, `.slotFullscreen`) moved from `.page` to the slot wrapper.
- Toolbar inside a half-width slot: the `.tools` row already wraps on narrow widths via the mobile rules only; a desktop rule for slots under ~720 px hides the draw-tool labels/padding (`.toolbarCompact`, set by the slot when its width is under 720 px via the same `ResizeObserver` value) so both toolbars fit on a 1440 px screen (mockup).

**Persistence (browser only)**
- `chart.selection` → unchanged shape `{ broker, symbol, timeframe }` (left chart).
- `chart.split` → `{ on, rightTimeframe, ratio }`.
- `chart.locked` (left, existing) · `chart.locked.right` (new).

## Data flow

```
WS ticks / candle / positions ──▶ ChartPage useWs (positions, alerts)  ──▶ positions state → both slots
                              └─▶ ChartSlot.left useWs (candle tf=L, ticks → live L) ──▶ chartRef.left.updateLive
                              └─▶ ChartSlot.right useWs (candle tf=R, ticks → live R) ─▶ chartRef.right.updateLive
GET /candles?tf=L · GET /drawings?tf=L  (left slot)      GET /candles?tf=R · GET /drawings?tf=R  (right slot)
GET/PUT /chart-indicators (page, shared EMAs → both slots)
```

`lib/ws.ts` keeps one socket and a listener set, so three `useWs` subscribers cost nothing extra on the wire.

## Risks

- **`DrawingTools` listens on `document`**: Escape cancels a drawing in every instance that is drawing (harmless), Delete only acts on the instance with a selection; selecting a drawing in one chart does not clear the selection in the other. Acceptable; noted for the mockup's "two charts, one selected drawing" state.
- **Two charts, half the width**: 2000-candle histories render fine in lightweight-charts; the toolbars are the tight spot, hence `.toolbarCompact`.
- **Fullscreen per slot** (revised in task 1): the side panels are `position: fixed` children of `.page`, so a slot in native fullscreen would hide them. `requestFullscreen` stays on the page element; in split view the page renders only the slot that asked for fullscreen (`fullscreenSide`) and both again on exit. The iOS fallback and the body class are unchanged.
- **Refactor surface**: extracting `ChartSlot` moves ~300 lines of `ChartPage`; behaviour must stay byte-for-byte in single mode. Task 1 is that extraction alone, verified against today's chart before any split UI exists.

## Mockup

Approved by the user on 2026-11-02: https://claude.ai/artifact/8Wo12it4ynwufCwCLeHo2R

Artboards:
- Desktop · Chart · split 50/50 (H1 | H4) — two slots, each with its timeframe row and full toolbar; split button active; right slot locked.
- Desktop · Chart · single with split button — today's chart with the inactive split button next to Fullscreen.
- Desktop · Chart · dragging the divider (65/35) — highlighted divider with the ratio; narrow slot toolbar in compact mode.
- Mobile · Chart · single, no split button.
