# 002 — Broker stats · Design

## Approach

One new backend endpoint computes everything server-side from `trades` and `balances`; the frontend page is a thin consumer that renders tiles and the monthly table. Aggregation lives in the backend because `/trades` is capped at 1000 rows and paginated, so the client cannot reliably count a whole period, and because the start-balance lookup needs the `balances` table anyway.

The period logic reuses the Journal's `dateRangeBounds` helper, extended with three presets (`this_month`, `this_year`, `last_3_months`). The `FiltersPanel` slide-over is not reused: Stats needs only two controls, so they are rendered inline at the top of the page.

Discarded alternatives:

- **Compute in the frontend from `/trades`**: breaks on the 1000-row cap and would need a second call for balances. Rejected.
- **Materialise monthly stats in a table**: premature; the query is a single indexed aggregate over at most a few thousand rows per broker. Rejected.
- **Extend `/trades` with an `aggregate=1` flag**: mixes two response shapes in one route. A dedicated route is clearer.

## Affected files

### Backend

| File | Change |
|---|---|
| `backend/src/routes/stats.ts` | **New.** `GET /stats?broker=&from=&to=` returning the payload below. |
| `backend/src/services/stats.ts` | **New.** Pure aggregation: `computeBrokerStats(broker, from?, to?)`. Holds the start-balance resolution and the month bucketing. |
| `backend/src/app.ts` | Mount `statsRouter` under `/stats` with `requireAuth`. |

### Frontend

| File | Change |
|---|---|
| `frontend/src/features/journal/utils/dateRange.ts` | Add `this_month`, `this_year`, `last_3_months` to `DateRange` and `dateRangeBounds`. |
| `frontend/src/features/journal/FiltersPanel.tsx` | Move `DATE_RANGE_OPTIONS` to `dateRange.ts` and import it, so the Journal history filter and Stats share one list (Journal gains the three new presets for free). |
| `frontend/src/features/stats/StatsPage.tsx` | **New.** Page: filters, fetch, tiles, monthly breakdown, empty/loading/error states. |
| `frontend/src/features/stats/StatsFilters.tsx` | **New.** Broker select + period select (+ custom from/to). |
| `frontend/src/features/stats/StatTile.tsx` | **New.** One headline figure with label, value, optional hint and sign colouring. |
| `frontend/src/features/stats/MonthlyBreakdown.tsx` | **New.** Table on desktop, cards on mobile. |
| `frontend/src/features/stats/*.module.css` | Styles for the four components, using only design-system tokens. |
| `frontend/src/features/stats/types.ts` | **New.** `BrokerStats` response type. |
| `frontend/src/shared/ui/icons.tsx` | Add `IconStats` (bar-chart glyph, 14px, same style as the others). |
| `frontend/src/app/Router.tsx` | Add `/stats` route. |
| `frontend/src/app/layout/AppLayout.tsx` | Add `Stats` nav entry between Scanner and Settings. |

## Data model / API

No Prisma changes.

### `GET /stats`

Query: `broker` (required), `from` and `to` (optional ISO instants, same semantics as `/trades`).

Validation: missing `broker`, or a broker with no row in `balances`, → `400 { error: 'unknown broker' }`.

Response:

```ts
interface BrokerStats {
  broker: string;
  currency: string;
  period: { from: string | null; to: string | null; months: number };
  trades: number;
  wins: number;
  losses: number;
  netPnl: number;
  tradesPerMonth: number;
  startBalance: number | null;
  startBalanceSource: 'snapshot' | 'derived' | 'none';
  returnPct: number | null;
  monthly: { month: string; trades: number; netPnl: number }[]; // month = 'YYYY-MM'
}
```

### Computation (`services/stats.ts`)

1. `trades = db.trade.findMany({ where: { broker, closeTime: { gte: from, lte: to } }, select: { profit, swap, commission, closeTime } })`. Per-trade net = `profit + swap + commission`.
2. `wins` = net > 0, `losses` = net < 0. Zero-net trades count in `trades` only.
3. **Period bounds for month bucketing.** `periodStart = from ?? earliest closeTime among the trades`; `periodEnd = to ?? now`. If there are no trades and no `from`, `months = 0` and `monthly = []`.
4. `months` = number of calendar months from `periodStart` to `periodEnd` inclusive (`(endY − startY) × 12 + (endM − startM) + 1`). Months are computed in UTC; the `balances` snapshot and the Journal date bounds are also UTC-based, so this is consistent with the rest of the app.
5. `monthly` = one entry per month in that range, in ascending order, with zeros where no trade closed.
6. `tradesPerMonth = months > 0 ? trades / months : 0`.
7. **Start balance.**
   - `snapshot = db.balance.findFirst({ where: { broker, timestamp: { lte: periodStart } }, orderBy: { timestamp: 'desc' } })`. Only attempted when `from` is given. If found → `startBalance = snapshot.balance`, source `snapshot`.
   - Otherwise `latest = db.balance.findFirst({ where: { broker }, orderBy: { timestamp: 'desc' } })` and `sinceNet = sum of net of trades with closeTime ≥ periodStart` (this is `netPnl` when `to` is empty; when `to` is set it is a second aggregate without the upper bound). `startBalance = latest.balance − sinceNet`, source `derived`.
   - If `latest` is missing (cannot happen after validation) → source `none`.
8. `returnPct = startBalance && startBalance !== 0 ? netPnl / startBalance × 100 : null`.
9. `currency` comes from the latest `balances` row.

The route is a thin wrapper: parse query, call the service, `res.json`.

## Components

### `StatsPage`

- State: `{ broker, dateRange, dateFrom, dateTo }` in `useLocalStorage('stats.filters', …)`.
- Loads the broker list from `/balances` once (same call the Journal `Accounts` tab makes); defaults `broker` to the first one if the stored value is empty or no longer exists.
- Derives `{ from, to }` with `dateRangeBounds`, fetches `/stats` whenever `broker`, `from` or `to` change, with loading / error / empty states styled like the Journal.
- Renders `StatsFilters`, a tile row (`StatTile` × 5) and `MonthlyBreakdown`.
- When `startBalanceSource === 'derived'`, the return tile gets the hint "Assumes no deposits or withdrawals in the period". When `returnPct === null` the tile shows `—`.

### `StatsFilters`

Props: `brokers: string[]`, `values: StatsFilterValues`, `onChange`. Two `<select>`s and, when `dateRange === 'custom'`, the two date inputs. Same input styling tokens as `FiltersPanel`. Stacks vertically under 768px.

### `StatTile`

Props: `label: string`, `value: string`, `tone?: 'positive' | 'negative' | 'neutral'`, `hint?: string`. Panel with `--surface` background, 3px `--orange` top border, `--font-mono` value at `--text-2xl`, label at `--text-xs` uppercase `--tracking-wide`.

### `MonthlyBreakdown`

Props: `rows: BrokerStats['monthly']`, `currency: string`. Desktop: table with Month · Trades · Net P&L, wrapped in `overflow-x: auto`. Mobile (`max-width: 768px`): one card per month. Month label formatted as `MMM YYYY` from the `YYYY-MM` string without `Date` parsing (iOS gotcha). Reuses `fmtPnl` and `currencySymbol` from `journal/utils/position`.

## Risks

- **`dateRangeBounds` is shared with the Journal.** Adding presets is additive; the existing cases are untouched. Moving `DATE_RANGE_OPTIONS` changes an import path only. Verify the Journal History filter after the change.
- **Derived start balance is an approximation.** Any deposit or withdrawal inside the period skews `returnPct`. The hint makes this explicit; it is a known limitation accepted in requirements.
- **Trade history completeness.** The EA exports the last 50 closed trades per sync, so a burst of more than 50 closes between syncs would leave gaps. Pre-existing behaviour, not introduced here.
- **Broker names with spaces** (`solidary isa`) travel as query params; `URLSearchParams` encodes them, and Express decodes them. Same as `/trades` today.
- **`balances` cleanup.** A broker deleted from the database disappears from the selector; a stored `broker` that no longer exists falls back to the first available.
