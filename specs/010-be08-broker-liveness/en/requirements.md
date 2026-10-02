# 010 · BE-08 — Broker liveness

> Status: **draft**
> Origin: [backend audit 2026-09-30](../../../reports/2026-09-30-backend.md), improvement 8 (diagnoses A, E)

## Context

Each broker has a `PipeReader` (named pipe, ticks/positions/account from the EA) and a `FileWatcher` (bridge files every 30 s). If `server.listen` on the pipe fails (name in use, a previous backend instance still holding it, a transient Windows error), the error is logged once and never retried: that broker is dead until the backend restarts, while `GET /health` keeps answering `{ status: "ok" }` — the only signal the deploy script, the startup task and the operator look at. Nothing records when a broker last sent anything: the web shows the last known price even if it is hours old and nobody can tell, from the backend, which of the twelve EAs has stopped. Two failures are swallowed on top of that: `syncColors(...).catch(() => {})` in `index.ts` and the watcher's `readdir` error (logged, but with the whole error object instead of a message, every 30 s).

## Affected layers

- backend

No frontend change in this spec: `/health` is consumed by `infra/scripts/startup.ps1`, `backend/scripts/deploy.ps1` and the operator with `curl`. A later frontend spec may show the per-broker state in the Accounts page.

## User stories

- As the operator, I want `GET /health` to list every configured broker with its pipe state and the age of its last tick and last file sync, so that I can see in one request which EA is down without opening MT4 on the VPS.
- As the operator, I want a pipe whose `listen` failed to be retried with growing delays, so that a transient error at startup does not silence a broker until the next deploy.
- As the operator, I want silent failures (`syncColors`, bridge directory listing) to appear in the pm2 log with the broker name and the error message, so that a broken bridge path is visible the day it breaks.

## Acceptance criteria

- AC 1. WHEN `GET /health` is called THEN it answers `200` with `{ status, uptimeS, brokers: [...] }` where each broker entry has `name`, `pipe` (`"listening" | "connected" | "error"`), `lastTickAt` (ISO string or `null`), `lastSyncAt` (ISO string or `null`) and `tickAgeS` / `syncAgeS` (seconds, or `null`). The route stays unauthenticated.
- AC 2. WHEN every broker has a connected pipe with a tick in the last 5 min THEN `status` is `"ok"`; WHEN at least one broker is not THEN `status` is `"degraded"`. The HTTP code is `200` in both cases (the deploy and startup scripts only check for 200).
- AC 3. WHEN a tick batch, positions or account message arrives on a broker's pipe THEN that broker's `lastTickAt` is updated; WHEN the file watcher completes a poll (regardless of per-step failures) THEN `lastSyncAt` is updated.
- AC 4. WHEN the EA connects to / disconnects from the pipe THEN `pipe` reads `"connected"` / `"listening"`; WHEN `listen` fails THEN `pipe` reads `"error"` and the server retries `listen` after 1 s, doubling up to 30 s, until it succeeds (then `"listening"`), logging each attempt with the broker name and the error message.
- AC 5. WHEN `syncColors` rejects THEN the error is logged once per rejection with `[COLORS:<broker>]` and the message; the positions broadcast is not affected.
- AC 6. WHEN the watcher cannot list the bridge directory THEN the log line carries the broker name, the path and the error message (not the serialised error object) and is emitted at most once per minute per broker while the condition persists.
- AC 7. WHEN `FEATURE_PIPE=false` or `FEATURE_WATCHER=false` (local development) THEN `/health` still lists the brokers, with `pipe: "disabled"` / `lastSyncAt: null`, and `status` is `"ok"` for the disabled parts (a disabled feature is not a failure).
- AC 8. WHEN the backend is deployed THEN `deploy.ps1`'s `Wait-Health` and `startup.ps1`'s `Test-BackendHealth` behave exactly as before (200 within the same time) and the web app is unchanged.

## Out of scope

- Showing the per-broker state in the frontend (candidate follow-up spec, frontend layer).
- Alerting (push/email) when a broker goes stale — `/health` is the hook; the VPS watchdog could poll it later.
- Reconnection logic on the EA side (the EA already reconnects to the pipe on its own).
- Changing the 30 s watcher interval or the pipe message format.
