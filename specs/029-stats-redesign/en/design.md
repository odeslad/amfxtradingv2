# 029 — Stats redesign and asset filter · Design

## Approach

Backend first (an optional `symbol` and the list of traded symbols on `GET /stats`), then the shared period list, then the Stats page layout. No DB migration, no EA change, no new dependency.

## Backend

### `GET /stats?broker&from&to&symbol`
- `routes/stats.ts`: read an optional `symbol` (`singleQuery`), pass it on.
- `services/stats.ts`:
  - `loadMovements(broker, since, symbol?)`: with a symbol, the trade query adds `symbol` and **no balance operations are loaded** (they belong to no asset).
  - `computeBrokerStats` also returns `symbols: string[]` — `DISTINCT trade.symbol` for the broker, all time, sorted (`db.trade.findMany({ distinct: ['symbol'] })`). One extra indexed query; avoids a new endpoint.
- `services/stats-core.ts` (pure, unit-tested):
  - `StatsInput` gains `mode: 'account' | 'asset'`.
  - `MonthlyStats` gains `wins` (monthly win %).
  - Asset mode: `cashFlow = 0`, `startBalance = null`, `returnPct = null` (overall and monthly), and `curve` is the **cumulative P&L of the period's trades per day** starting at 0 (same `CurvePoint` shape, `balance` = cumulative P&L). Account mode is unchanged.
  - `BrokerStats` gains `symbol: string | null` and `symbols: string[]`.
- Tests: extend `stats-core.test.ts` with asset mode (cumulative curve, null return, monthly wins).
- Contract: additive only (new optional param, new fields). The current frontend keeps working.

## Frontend

### Period list — `features/journal/utils/dateRange.ts` (shared with the Journal)
- `DateRange` = `'' | 'today' | 'yesterday' | 'last_7_days' | 'last_30_days' | 'last_90_days' | 'last_365_days' | 'custom'`.
- `DATE_RANGE_OPTIONS` labels: Hoy, Ayer, Esta semana, Este mes, Este trimestre, Este año, Todo (`''`), Custom.
- Rolling bounds: `from = startOfToday − (N − 1) days`, no `to` (AC 4).
- `normalizeDateRange(value)`: a stored value not in the list → `''` (Todo). Used where the Journal and Stats read their `localStorage` filters (AC 4a).
- Custom: the To date is clamped to today on change (`IsoDateField` has no `max`; clamping keeps it simple).
- The Journal's Filters panel keeps its select and simply renders the new list.

### Stats page — `features/stats/`
- `PeriodTabs.tsx` (new): tabs Hoy · Ayer · Esta semana · Este mes (phone: Hoy · Ayer · Semana · Mes) + a "Más ▾" tab with the app's own menu (Este trimestre, Este año, Todo, Custom). The tab keeps "Más ▾" and turns active when one of its options is selected. Menu behaviour copied from `book/OlderYearsTab.tsx` (outside pointer / Esc closes, thin dark scrollbar); it stays a stats component — no premature shared abstraction.
- `StatsFilters.tsx`: period tabs on the left; Broker and **Activo** selects on the right (phone: Broker/Activo side by side above the tabs). Activo = "Todos" + `stats.symbols` filtered by `isSymbolVisible`. Custom shows From/To below the bar.
- `StatsFilterValues` gains `symbol` (`''` = Todos); persisted in `stats.filters` as today. When the loaded `symbols` do not include the stored symbol → treat as `''` (AC 8).
- `StatsPage.tsx`: sends `symbol` when set; replaces the six `StatTile`s with a **totals strip** (`StatsTotals.tsx`, new) like Schemes: desktop strip (Trades, Win rate, Trades/mes, Cash flow | Return, Net P&L large); phone block (Net P&L + Return large, then a 4-column row). With an asset, Cash flow and Return render "—".
- Layout (desktop): the page becomes a full-height flex column; below the strip a grid `2fr 1fr` that takes the remaining viewport height: `BalanceChart` fills its cell (height 100 %), `MonthlyBreakdown` scrolls inside its cell. Phone: chart (fixed height) then months as cards.
- `BalanceChart`: chart title "Balance" or "P&L acumulado · <SYMBOL>"; it must resize to its container's height (today it has a fixed height — switch to a `ResizeObserver`-driven height or `autoSize`).
- `MonthlyBreakdown`: columns Mes, Trades, Win %, Net P&L (Cash flow / Return % columns leave the table — they live in the strip); phone cards (month + trades, win %, net).
- `StatTile.tsx` is removed if nothing else uses it.

## Data flow

Filters (localStorage) → `GET /stats?broker&from&to[&symbol]` → `computeBrokerStats` (asset mode when `symbol`) → `{ …stats, symbol, symbols }` → totals strip, chart, monthly table; `symbols` feeds the Activo select.

## Files

- backend: `src/routes/stats.ts`, `src/services/stats.ts`, `src/services/stats-core.ts`, `src/services/stats-core.test.ts`
- frontend: `features/journal/utils/dateRange.ts`, `features/journal/JournalPage.tsx` (normalize stored period), `features/stats/StatsPage.tsx` + `.module.css`, `StatsFilters.tsx` + css, `PeriodTabs.tsx` (new), `StatsTotals.tsx` + css (new), `MonthlyBreakdown.tsx` + css, `BalanceChart.tsx` + css, `types.ts`

## Alternatives considered

- **Compute asset stats on the frontend** from `/trades`: no backend change, but duplicates the stats maths and loads every trade. Rejected.
- **A `/stats/symbols` endpoint**: cleaner separation, one more request per broker change. Rejected for the field on the stats response.
- **Separate period list for Stats**: rejected — the user wants the same list in the Journal.

## Risks

- Stored filters with removed period values (`last_week`, `this_month`, …): handled by `normalizeDateRange`.
- Labels move to Spanish in the Journal's period select as well (rest of the Journal stays English).
- Deploy order: backend first (additive), then frontend.
