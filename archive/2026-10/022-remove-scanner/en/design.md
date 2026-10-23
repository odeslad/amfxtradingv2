# 022 — Remove the Scanner section · Design

## Approach

A plain removal: every scanner file goes, the references around it are cut, and the documentation
follows. Nothing is kept as dead code; the requirements record where to find it in git. Two atomic
commits, one per layer, frontend first (the page stops calling the endpoint before the endpoint goes).

Alternatives considered: keeping `services/scanner.ts` without a route for the future section —
rejected (unused code the lint and every reader must step around; git keeps it just as well).

## Frontend

Delete `src/features/scanner/` (`ScannerPage.tsx`, `ScannerPage.module.css`) and `src/lib/useScanner.ts`.
`app/Router.tsx`: drop the `ScannerPage` import and the `/scanner` route; the existing `*` route sends
unknown paths to `/`, so `/scanner` lands on `/journal`. `app/layout/AppLayout.tsx`: drop the Scanner
entry of the nav and its icon import; `shared/ui/icons.tsx`: drop `IconScanner` (its only consumer).
Mobile bottom bar: five entries instead of six, same component, no CSS change needed (the bar lays
out with `flex`).

Untouched: `NewTradePanel` (reads `/setup-levels`), the chart's EMA tools, the EMA alerts.

## Backend

Delete `src/routes/scanner.ts` and `src/services/scanner.ts`; `app.ts` loses the import and the
`app.use('/scanner', …)` line (16 routers). `indicators/ema.ts`, `indicators/ema-cross.ts`,
`indicators/pip-size.ts` and `indicators/timeframe.ts` stay: `routes/setup-levels.ts`, the EMA alerts and
the chart indicators import them. `npm run build` proves nothing else imported the scanner.

## Docs

`backend/docs/architecture.md`: the tree line of `services/scanner.ts`, the `/scanner` row of the
endpoints table and any router count. `.claude/CLAUDE.md`: the routers list (17 → 16).

## Mockup

No screen is added or changed; the nav loses one entry. No mockup.

## Risks

- A bookmark to `/scanner` now opens the Journal: intended.
- None on trading: no command, alert or EA path touches the scanner.
