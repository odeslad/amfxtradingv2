# 016 · FE-01 — CI gate and visible errors

> Status: **approved**
> Origin: [frontend audit 2026-10-08](../../../reports/2026-10-08-frontend.md), improvement 1 (diagnoses A, B)

## Context

Nothing checks the frontend before it reaches production: `deploy-frontend.yml` has no check job (the backend workflow runs lint, typecheck and tests before its deploy), so the only gate is the `tsc -b` inside `npm run build` on the VPS. `npx eslint .` fails today with 29 errors and 4 warnings (`react-hooks/set-state-in-effect` ×18, `react-hooks/refs` ×5, `exhaustive-deps` ×4, `no-useless-escape` ×4, `no-empty` ×1, `react-refresh/only-export-components` ×1) because nobody runs it.

Inside the app, failures are reported as successes or not at all: closing a position from the chart toasts "Close sent" whatever the HTTP status (`ClosePositionPanel.tsx:28-41`); closing from the journal gives no feedback (`OpenPositions.tsx:127-150`); bulk edit and the journal close path toast success without checking `res.ok` (`BulkEditPanel.tsx:31-48`, `JournalPage.tsx:82-99`); Settings marks "Saved" after a failed PUT (`SettingsPage.tsx:56-65`); alert create/toggle/remove, `ColorBadge`, `saveEmas` and `logout` have no `catch` or no `res.ok` check; a failed New Trade shows two error toasts (`AppLayout.tsx:30-33` and `NewTradePanel.tsx:72-73`). There is no app-wide error boundary (a render error outside the chart blanks the screen) and `ChartErrorBoundary` resets on the next frame, so a persistent chart error becomes a mount/crash loop. Two small visible defects: the pending-order cards use `styles.label`, a class that does not exist in `JournalPage.module.css` (`OpenPositions.tsx:319-323`), and `.btnDesktop` / `.filtersBtnDesktop` / `.newTradeBtnDesktop` are used in `JournalPage.tsx:139-162` but not defined.

This spec does not introduce the shared `apiFetch` / `sendCommand` layer (FE-03) nor request cancellation (FE-02): it makes the existing call sites honest and puts a gate in front of the deploy.

## Affected layers

- frontend
- infra (`.github/workflows/deploy-frontend.yml`)

No backend, db or EA change. No new dependencies: Vitest and the `test` step of the gate belong to FE-10; the gate runs lint and the build now and gains `test` when FE-10 lands.

## User stories

- As the user, I want a change with a lint or type error to never reach production, so that the frontend has the same safety net as the backend.
- As the user, I want every action that talks to the backend to tell me when it failed, so that I never believe an order was sent or a setting saved when it was not.
- As the user, I want an unexpected error to show a message instead of a blank screen, so that I can recover without guessing.

## Acceptance criteria

- AC 1. WHEN `master` is pushed with changes under `frontend/**` THEN a `check` job runs `npm ci`, `npm run lint` and `npm run build` on GitHub Actions, and the `deploy` job runs only if `check` succeeds. WHEN the check fails THEN nothing is deployed.
- AC 2. `npm run lint` exits 0 on `master`: the 29 errors and 4 warnings are fixed in the code, not silenced (no new `eslint-disable`, no rule removed from `eslint.config.js`; an existing disable may be removed, never added).
- AC 3. WHEN `POST /commands` answers a non-2xx status from any of the five close/bulk/new-trade paths THEN the user sees one error toast with the backend's `error` text and no success toast; WHEN it answers 202 THEN the behaviour is unchanged.
- AC 4. WHEN `PUT /settings` fails THEN the page shows an error and does not mark "Saved"; WHEN a price alert or EMA alert create/toggle/delete fails THEN an error toast appears and the list is not left in a wrong state; WHEN `PATCH /positions/color` fails THEN the badge reverts and an error toast appears; WHEN `PUT /chart-indicators` fails THEN an error toast appears. WHEN `POST /auth/logout` fails THEN the user is still logged out locally.
- AC 5. A failed New Trade produces exactly one error toast.
- AC 6. WHEN a React render error occurs anywhere under the router THEN an app-level boundary shows a message with a "Reload" action instead of a blank screen; WHEN an unhandled promise rejection occurs THEN a single error toast appears (and the rejection is logged to the console).
- AC 7. WHEN `LightweightChart` throws repeatedly THEN `ChartErrorBoundary` stops retrying after a bounded number of attempts and shows its fallback with a manual retry, instead of remounting every frame.
- AC 8. The pending-order cards show styled labels (class defined), and the three `*Desktop` classes are either defined with the intended styles or removed from the JSX; the Journal toolbar looks the same as today on desktop and mobile.
- AC 9. `npm run build` succeeds and the deployed app behaves as before for every successful path (no visual change except AC 8).

## Out of scope

- Shared `apiFetch` / `sendCommand` and 401 → login (FE-03).
- Cancelling stale responses (FE-02).
- Vitest and the `test` step of the gate (FE-10).
- Atomic frontend deploy and nginx config (FE-06).
- Fixing the broker-switch symbol selection behind the `eslint-disable` at `ChartPage.tsx:211` (FE-02); that disable stays.
