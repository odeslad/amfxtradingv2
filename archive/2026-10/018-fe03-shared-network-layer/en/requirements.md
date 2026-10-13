# 018 · FE-03 — Shared network layer

> Status: **closed**
> Origin: [frontend audit 2026-10-08](../../../reports/2026-10-08-frontend.md), improvement 3 (diagnoses B, E)

## Context

Every API call in the frontend is a hand-written `fetch`: about 50 calls in 20 files, each repeating `apiUrl(...)`, `credentials: 'include'`, the JSON header, the `res.ok` check and the error extraction. Spec 016 made those call sites honest (they now check `res.ok` and toast on failure) and spec 017 gave the loading effects an `AbortSignal`, but the boilerplate itself is still copied everywhere, so each new call starts from scratch and small differences keep creeping in.

Three concrete consequences today. (1) A `401` is invisible: when the JWT cookie expires, every call fails with a generic error and the user stays on a page that no longer works until they reload; `AuthContext` only learns about the session on mount (`/auth/me`). (2) The seven `POST /commands` call sites (`ChartPage` modify, `BulkEditPanel`, `ClosePositionPanel`, `JournalPage` bulk close, `NewTradePanel` manual + mirror, `OpenPositions` close) each build the payload and generate the command `id` by hand: `generateId` is defined five times plus one inline template in `ChartPage`, and the three close paths send three different payloads (`ClosePositionPanel` sends `ticket, lots`; `OpenPositions` and `JournalPage` add `sl: 0, tp: 0`). (3) `useAlerts` and `useEmaAlerts` are the same hook twice (load list, `refresh`, three mutations that throw on `!res.ok` and refresh in `finally`) with only the endpoint and the types changed. Separately, `ProtectedRoute` redirects to `/login` without remembering where the user was, so a deep link (for example from a push notification) always lands on `/` after login.

This spec adds a single `apiFetch<T>()` that owns credentials, JSON, error extraction and the `401` hook; a `lib/commands.ts` module that owns command ids and payloads; a generic `useRemoteList` that both alert hooks are built on; and the return to the deep link after login. All existing `fetch` calls migrate to `apiFetch` so the `401` handling is universal. The `AbortSignal`s added by spec 017 are preserved.

## Affected layers

- frontend

No backend, db, EA or infra change. The `POST /commands` payload sent by the frontend becomes uniform but stays inside what the backend already accepts (`sl`/`tp` are optional for `close`). No new dependencies.

## User stories

- As a trader, I want to be sent to the login page as soon as my session expires, so that I do not keep clicking on a page whose calls silently fail.
- As a trader, I want to land on the page I was opening (a chart deep link, a journal filter) after logging in, so that notifications and shared links work in one step.
- As a trader, I want every way of closing a position (chart, journal row, journal bulk) to send the same command, so that behaviour does not depend on which button I used.
- As a developer, I want one place that knows how to call the API and one place that knows how to build a command, so that a new call or a new command cannot forget credentials, the JSON header, the error check or the id format.

## Acceptance criteria

- AC 1. WHEN any API call made through `apiFetch` returns `401` THEN the auth context clears the user, `ProtectedRoute` redirects to `/login`, and the failed call rejects with an `ApiError` of status 401.
- AC 2. WHEN an API call returns a non-OK status other than 401 THEN `apiFetch` rejects with an `ApiError` carrying the status and the backend's `error`/`message` text (or `Error <status>` when the body has none), and the caller's existing toast/error path shows that text.
- AC 3. WHEN an API call returns `204` or an empty body THEN `apiFetch` resolves to `undefined` without trying to parse JSON.
- AC 4. WHEN `apiFetch` is called with a `signal` THEN the signal is passed to `fetch` and an abort rejects with the browser's `AbortError`, unchanged, so the cancellation of spec 017 keeps working and `isAbortError` still recognises it.
- AC 5. WHEN a position is closed from the chart panel, the journal row or the journal bulk action THEN the three paths send a `POST /commands` with an identical payload shape (`id`, `action: 'close'`, `broker`, `symbol`, `ticket`, `lots`) built by `lib/commands.ts`.
- AC 6. WHEN any of the seven command call sites sends a command THEN the `id` comes from `newCommandId()` in `lib/commands.ts`, and no `generateId` function or inline id template remains in `src/`.
- AC 7. WHEN `sendCommand` is called THEN it returns the command `id` and rejects with the backend's error text on failure, so the callers that track pending ids (`NewTradePanel`) keep working.
- AC 8. WHEN `useAlerts` and `useEmaAlerts` are rewritten on top of `useRemoteList` THEN their public shape (`alerts`/`emaAlerts`, `refresh`, `create`, `toggle`, `remove` and the exported types) is unchanged and the panels compile without edits beyond imports; a failed load still reads as an empty list and each mutation still refreshes in `finally`.
- AC 9. WHEN an unauthenticated user opens a protected URL THEN after a successful login they are redirected to that URL (path + query); a direct visit to `/login` still lands on `/` after login.
- AC 10. WHEN the migration is complete THEN no direct `fetch(` call remains in `src/` except inside `apiFetch` itself, and `AuthContext`'s `/auth/me` and `/auth/login` go through `apiFetch` too (a 401 there resolves to "no user" / "wrong credentials" with no redirect loop, since the user is already null).
- AC 11. WHEN the implementation is complete THEN `npx eslint .` and `npm run build` pass in `frontend/`, and the production app behaves as before on `/chart`, `/journal`, `/settings`, `/scanner`, `/stats` and the alerts panel.

## Out of scope

- Shared data provider / caches for balances, settings and symbols, and WebSocket connect/disconnect tied to auth (FE-05).
- Per-tick render work (FE-04) and the shared `SidePanel` (FE-07).
- Retries, request de-duplication or a data-fetching library.
- Changing the backend's `POST /commands` contract.
- Token refresh: an expired session goes to the login page; it is not silently renewed.
