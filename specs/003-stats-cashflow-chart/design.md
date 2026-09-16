# 003 — Stats: monthly return, cash flow and balance chart · Design

## Approach

Three layers, each with one small change, glued by the existing `history.json` → file watcher → service path:

- **EA** widens the order-type filter in `WriteHistory()` so balance/credit orders travel in the same array. No new file, no new format: the backend already parses every field it needs.
- **Backend** splits the batch by `type` in the history handler and keeps balance operations in their own table. The stats service is rewritten around a single primitive, `balanceAt(instant)`, reconstructed backwards from the latest snapshot; period return, monthly return and the daily curve are all derived from it. The `balances` snapshot lookup goes away: with cash flows in the database the reconstruction is exact and it works for any date, not only since June 2026.
- **Frontend** adds two columns, one tile, a `BalanceChart` component built on `lightweight-charts` (already a dependency) and a two-column layout.

Discarded alternatives:

- **Separate `balance.json` from the EA**: a new file, a new watcher branch and a second `HISTORY_MAX` semantics for no gain. Rejected.
- **Store balance operations in `trades` with `type = 6`**: every consumer of `trades` (Journal, daily P&L, stats) would have to filter them out. A dedicated table is safer.
- **Keep the `balances` snapshot as start balance when available**: two code paths producing slightly different numbers for the same period depending on the date. The reconstruction is the single source of truth; snapshots remain only as the "latest balance" anchor.
- **Build the curve client-side from raw trades**: would need the full trade list in the response. The backend already has everything in memory to bucket by day.
- **Time-weighted return**: correct but harder to explain; the user chose the simple formula.

## Affected files

### EA

| File | Change |
|---|---|
| `ea/HttpBridgeState.mq4` | `WriteHistory()`: accept `OP_BUY`, `OP_SELL`, `OP_BALANCE`, `OP_CREDIT`. |
| `ea/docs/HttpBridgeState.md` | Document the balance/credit entries in `history.json`. |

### Backend

| File | Change |
|---|---|
| `backend/prisma/schema.prisma` | Add model `BalanceOperation` → table `balance_operations`. |
| `backend/prisma/migrations/20260916000000_add_balance_operations/migration.sql` | `CREATE TABLE balance_operations` + index. |
| `backend/src/services/balance-operations.ts` | **New.** `syncBalanceOperations(broker, entries)`: upsert by ticket, `update: {}`. |
| `backend/src/index.ts` | History handler: partition the batch by type (`0/1` → `syncTrades`, `6/7` → `syncBalanceOperations`). |
| `backend/src/services/stats.ts` | Rewrite around `balanceAt`; add `cashFlow`, per-month `returnPct`/`cashFlow`, `curve`, `operations`; drop `startBalance`/`startBalanceSource` snapshot logic. |

### Frontend

| File | Change |
|---|---|
| `frontend/src/features/stats/types.ts` | Update `BrokerStats` and `MonthlyStats`; add `CurvePoint`, `BalanceOperation`. |
| `frontend/src/features/stats/MonthlyBreakdown.tsx` + `.module.css` | Return and Cash flow columns / card fields. |
| `frontend/src/features/stats/BalanceChart.tsx` + `.module.css` | **New.** Line chart of `curve` with operation markers. |
| `frontend/src/features/stats/StatsPage.tsx` + `.module.css` | Cash flow tile, drop the derived hint, two-column `split` layout. |

## Data model / API

### Prisma

```prisma
model BalanceOperation {
  ticket  Int      @id
  broker  String
  type    Int
  amount  Float
  comment String
  time    DateTime

  @@index([broker, time])
  @@map("balance_operations")
}
```

Migration `20260916000000_add_balance_operations`:

```sql
CREATE TABLE "balance_operations" (
  "ticket" INTEGER NOT NULL,
  "broker" TEXT NOT NULL,
  "type" INTEGER NOT NULL,
  "amount" DOUBLE PRECISION NOT NULL,
  "comment" TEXT NOT NULL,
  "time" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "balance_operations_pkey" PRIMARY KEY ("ticket")
);
CREATE INDEX "balance_operations_broker_time_idx" ON "balance_operations"("broker", "time");
```

### History handler (`index.ts`)

```ts
watcher?.on('history', async (entries) => {
  const trades = entries.filter(e => e.type === 0 || e.type === 1);
  const ops = entries.filter(e => e.type === 6 || e.type === 7);
  await syncTrades(brokerName, trades);
  await syncBalanceOperations(brokerName, ops);
});
```

`syncBalanceOperations` maps `{ ticket, type, profit → amount, comment, closeTime → time }`. MT4 fills `closeTime` for balance orders with the operation time.

### `GET /stats` response

```ts
interface BrokerStats {
  broker: string;
  currency: string;
  period: { from: string | null; to: string | null; months: number };
  trades: number;
  wins: number;
  losses: number;
  netPnl: number;
  cashFlow: number;
  tradesPerMonth: number;
  startBalance: number | null;
  returnPct: number | null;
  monthly: { month: string; trades: number; netPnl: number; cashFlow: number; returnPct: number | null }[];
  curve: { date: string; balance: number }[];          // 'YYYY-MM-DD', one per day
  operations: { time: string; amount: number; comment: string }[]; // newest first
}
```

Query and validation unchanged from 002.

### Computation (`services/stats.ts`)

Inputs loaded once per request: `latest` (most recent `balances` row → `balance`, `currency`, `timestamp`), all trades of the broker with `closeTime ≥ periodStart` (net + closeTime), all balance operations with `time ≥ periodStart` (amount + time). `periodStart = from ?? earliest closeTime among the period's trades`; `periodEnd = to ?? now`.

- `balanceAt(t) = latest.balance − Σ net(trades with closeTime > t) − Σ amount(ops with time > t)`. Implemented with the two lists sorted by time and a suffix sum, so the daily curve is O(days + trades + ops).
- `startBalance = balanceAt(periodStart)`.
- `netPnl`, `cashFlow`: sums over the period window `[periodStart, periodEnd]`.
- `returnPct = denom > 0 ? netPnl / denom × 100 : null`, `denom = startBalance + Σ positive ops − |Σ negative ops|` = `startBalance + cashFlow`.
- `monthly[m]`: bucket trades and ops by UTC month; `returnPct` with `balanceAt(monthStart)` and that month's `cashFlow`, same rule.
- `curve`: for each UTC day `d` from `periodStart` to `periodEnd`, `{ date, balance: balanceAt(endOfDay(d)) }`. Days after `latest.timestamp` are clamped to `latest.balance`.
- `operations`: ops inside the window, newest first.
- Empty period (no trades, no `from`): `months = 0`, `monthly = []`, `curve = []`, `startBalance = latest.balance`.

## Components

### `BalanceChart`

Props: `curve: CurvePoint[]`, `operations: BalanceOperation[]`, `currency: string`.

- Creates a `lightweight-charts` chart on mount with the same layout/crosshair/scale options as `LightweightChart` (background `#0d0d0d`, text `--muted`, no grid, dashed crosshair with `--orange` labels), one `LineSeries` in `--blue`, `lineWidth: 2`, `priceFormat: { type: 'price', precision: 2, minMove: 0.01 }`.
- `time` is the `YYYY-MM-DD` string (accepted natively by the library as a business day), so no `Date` parsing on iOS.
- Markers via `createSeriesMarkers` (v5 API): one per operation at its day, `position: 'aboveBar'` for deposits (`--green`, arrow up) and `'belowBar'` for withdrawals (`--red`, arrow down), text = signed amount with currency symbol.
- `chart.timeScale().fitContent()` after `setData`; `ResizeObserver` on the container keeps width in sync; `chart.remove()` on unmount.
- Height 280px; container `width: 100%`.

### `MonthlyBreakdown`

Adds two columns / card fields. Return uses `fmtPct` (moved from `StatsPage` to a small `format.ts` in `features/stats/` so both use it); Cash flow uses `fmtPnl` and renders `—` for `0`.

### `StatsPage`

- Tiles: Trades / month · Return · Net P&L · Cash flow · Trades · Win rate (6 tiles; grid `repeat(6, 1fr)` desktop, 3 tablet, 2 mobile).
- Below: `<div className={styles.split}>` with `MonthlyBreakdown` and `BalanceChart`, `grid-template-columns: 1fr 1fr; gap: 24px`; under 768px `grid-template-columns: 1fr` with the chart first (`order: -1`).
- Derived hint and `startBalanceSource` usage removed.

## Risks

- **EA order-type change.** `history.json` grows by the number of balance operations, usually a handful. `HttpBridgeCommands.mq4` is untouched. Existing backends that receive the new entries before their own deploy would try to upsert type 6 rows into `trades` with empty symbol — harmless but untidy, so **deploy the backend before the EA**.
- **Reconstruction depends on history completeness.** If MT4 does not show a deposit (Account History range), the reconstructed balance before it is off by that amount. Spec 002's hint goes away; the mitigation is the full-history export from the EA change already shipped.
- **`latest` snapshot lag.** `balances` is written at most once per file-watcher cycle; trades closed after the last snapshot in the same day are already accounted for because they are in the "after t" sums only when `t < closeTime`. Days after `latest.timestamp` are clamped so the curve cannot drift past the anchor.
- **Migration on deploy.** Additive `CREATE TABLE`; `prisma migrate deploy` applies it unattended. No data movement.
- **Chart bundle.** `lightweight-charts` is already in its own chunk (`manualChunks`); the Stats page adds no new chunk.
- **Time zones.** All bucketing is UTC, consistent with 002 and with the backend snapshots.
