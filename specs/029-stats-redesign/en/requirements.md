# 029 — Stats redesign and asset filter

> Status: **draft**
> Mockup: [Stats rediseño](https://claude.ai/artifact/VDb9ZAGrZJw5TcxNwtzCrU) (approved)

## Context

The Stats page (`frontend/src/features/stats/`) filters by broker and period (the Journal's `DATE_RANGE_OPTIONS` in a select) and shows six KPI tiles, the monthly table and the balance curve. It cannot filter by asset, the period list does not match how the operator reads results (rolling windows), and the layout differs from the rest of the app (Schemes totals strip, tabs + "Más" menu).

## Affected layers

- backend (optional `symbol` filter on `GET /stats`, traded symbols per broker)
- frontend (Stats and the Journal period list)

## User stories

- As a trader, I want to filter the stats by asset, so that I can see how each pair performs.
- As a trader, I want rolling periods (today, yesterday, 7/30/90/365 days, all, custom), so that the numbers match how I review results.
- As a trader, I want the Stats page to look like the rest of the app on desktop and phone.

## Acceptance criteria

**Period filter (Stats and Journal)**
- AC 1. Tabs **Hoy**, **Ayer**, **Esta semana** (last 7 days), **Este mes** (last 30 days), then **Más ▾** opening the app's own menu with **Este trimestre** (last 90 days), **Este año** (last 365 days), **Todo** and **Custom**. On the phone the tabs read Hoy · Ayer · Semana · Mes · Más ▾.
- AC 2. WHEN a "Más" option is active THEN the tab keeps the label "Más ▾" and is marked active (blue).
- AC 3. WHEN Custom is chosen THEN From/To date fields appear; the To date cannot be later than today.
- AC 4a. The Journal uses the same period list and bounds in its Filters panel select (Hoy, Ayer, Esta semana, Este mes, Este trimestre, Este año, Todo, Custom); a stored Journal/Stats period that no longer exists falls back to Todo.
- AC 4. Rolling windows end now and start N days back from the start of today (7 days = today and the 6 previous days).

**Asset filter**
- AC 5. An **Activo** select next to Broker lists "Todos" plus the symbols traded on that broker, minus hidden symbols (spec 024 visibility).
- AC 6. WHEN an asset is selected THEN trades, wins, win rate, trades/month, Net P&L and the monthly rows count only that asset's trades.
- AC 7. WHEN an asset is selected THEN Cash flow shows "—", Return (overall and monthly) is that asset's contribution to the account return (asset P&L over the account's start balance + account cash flow, the same denominator as the account return) and the chart shows that asset's cumulative P&L; with "Todos" the chart is the balance curve as today.
- AC 8. WHEN the broker changes and the selected asset was not traded there THEN the asset falls back to "Todos".

**Layout**
- AC 9. Desktop: a filters bar (period tabs left, Broker and Activo right); a totals strip like Schemes (Trades, Win rate, Trades/mes, Cash flow left; Return and Net P&L large on the right); below, the chart (2/3 width) and the monthly table (1/3) with columns Mes, Trades, Win %, Net P&L. The chart fills the full remaining height of the viewport down to the bottom of the page; the monthly table scrolls inside its column when it is taller.
- AC 10. Phone: Broker and Activo selects side by side; the period tabs; a totals block (Net P&L and Return large, then Trades, Win rate, T/mes, Cash flow); the chart; months as cards (month + trades, win %, net).
- AC 11. Filters (including the asset) persist per device as today (`localStorage`).

## Out of scope

- Tabs + "Más" layout in the Journal (it keeps its select inside the Filters panel).
- Several assets at once.
- New metrics beyond the monthly win %.
