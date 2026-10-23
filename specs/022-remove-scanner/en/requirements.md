# 022 — Remove the Scanner section

> Status: **approved**

## Context

The Scanner page (`/scanner`) lists, for one broker and timeframe, every symbol's EMA-cross situation
(imminent / crossed, gap, convergence, ETA, live distance, last crosses with MFE / MAE). It will be
replaced by a different section, not yet specified, so it goes away now rather than living on as
unused UI. The scanner collects and stores nothing: every request recomputes from the candles already
in the database, so removing it loses no data. What it reads stays: the candles, the EMA / cross
detector in `backend/src/indicators/`, the setup levels used by the New Trade panel and the EMA alerts.
The removed code remains in git history (last touched in `673a569`) for the section that replaces it.

## Affected layers

- frontend · backend

## User stories

- As the operator, I want the Scanner out of the navigation and the app, so that the interface only
  shows sections in use while the replacement is designed.
- As the operator, I want the New Trade levels and the EMA alerts to keep working exactly as today, so
  that removing the page has no side effects on trading.

## Acceptance criteria

- AC 1. WHEN the app loads THEN the navigation has no Scanner entry (Journal, Chart, Stats, Schemas,
  Settings), on desktop and on the mobile bar, and `/scanner` falls into the app's default route.
- AC 2. WHEN `GET /scanner` is called THEN the backend answers 404 like any unknown path; the router
  count in the docs drops to 16.
- AC 3. WHEN the New Trade panel is opened THEN `GET /setup-levels` still returns the latest setup's
  levels and the panel shows them with their distances, as before.
- AC 4. WHEN an EMA-cross alert is configured THEN it keeps evaluating and firing as before.
- AC 5. WHEN the frontend and backend are built THEN nothing references the removed files: no
  `ScannerPage`, `useScanner`, `routes/scanner`, `services/scanner`, `IconScanner`; lint clean.
- AC 6. WHEN `backend/docs/architecture.md` and `.claude/CLAUDE.md` are read THEN the scanner no longer
  appears in the routers list, the tree or the endpoints table.

## Where to find the removed code later

Last commit holding the scanner before this spec: the parent of the removal commit (`git show <removal>^:backend/src/services/scanner.ts`). Files: `backend/src/services/scanner.ts` (per symbol and direction: state imminent / crossed / na from the EMA gap and its convergence per candle, ETA in candles and ms, candles since the last cross, activation close for the live distance, last 10 crosses with MFE / MAE in pips via `detectEmaCrossSetups`), `backend/src/routes/scanner.ts` (`GET /scanner?broker&tf&emaFast&emaSlow`), `frontend/src/lib/useScanner.ts`, `frontend/src/features/scanner/ScannerPage.tsx` + `.module.css` (two tables BUYS / SELLS, RR colouring red < 1 / orange 1–2 / green > 2, cross circles sized by MFE, live distance from the `ticks` WS message). The building blocks it used stay in the repo: `indicators/ema.ts`, `indicators/ema-cross.ts`, `indicators/pip-size.ts`, `indicators/timeframe.ts`.

## Out of scope

- The section that replaces the scanner (its own spec).
- Any change to `indicators/`, `/setup-levels`, the EMA alerts or the candles tables.
- Removing `getPipSize` or the chart's EMA tools.
