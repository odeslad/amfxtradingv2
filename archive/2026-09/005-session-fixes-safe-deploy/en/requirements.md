# 005 — Session fixes and safe deploy

> Status: **closed**
> Origin: [backend audit 2026-09-30](../../../reports/2026-09-30-backend.md), improvements 2 and 3 (diagnoses C and D)

## Context

Two independent findings of the audit, both small and both confirmed. **Session:** `POST /auth/logout` calls `res.clearCookie('token')` without the `domain`/`secure`/`sameSite` attributes the cookie was set with, so in production the `.amfxtrading.com` cookie survives and a page reload logs the user back in (confirmed by the user); `POST /auth/login` accepts unlimited attempts and returns faster when the email does not exist (it skips `bcrypt.compare`), which lets an attacker enumerate accounts. **Deploy:** `deploy-backend.yml` runs no check on the CI runner and goes straight to SSH; on the VPS `deploy.ps1` stops the app (`pm2 delete`) before installing, migrating and compiling, `tsc` emits files even on type errors, `dist/` is never cleaned, nothing verifies `/health` after `pm2 start`, and the `pm2 start` flags are duplicated in `infra/scripts/startup.ps1`. A build failure therefore means an outage until someone intervenes, with migrations already applied. A constraint shapes the fix: on Windows, `prisma generate` rewrites the query-engine DLL that the running process holds locked, so the full compile with a regenerated client cannot happen before the app stops — the pre-stop gate must live in CI, and the VPS side must recover on failure.

## Affected layers

- backend (auth route, tsconfig, deploy script, pm2 config)
- infra (GitHub Actions workflow, startup script)

## User stories

- As the user, I want "Sign out" to end my session, so that reloading the page asks for credentials again.
- As the operator, I want login attempts limited and timing-neutral, so that the login form cannot be used to brute-force or enumerate accounts.
- As the operator, I want a push with code that does not compile to be rejected before touching the server, so that a mistake never causes an outage.
- As the operator, I want a deploy that fails on the VPS to leave the previous version running and report the failure, so that production stays up while I fix it.
- As the operator, I want a single pm2 configuration used by both the deploy and the watchdog, so that flags cannot drift.

## Acceptance criteria

### Session

- AC 1. WHEN `POST /auth/logout` is called THEN the response clears the `token` cookie with the same `domain`, `path`, `secure` and `sameSite` attributes used at login, and a subsequent `GET /auth/me` with the old cookie jar answers `401`.
- AC 2. WHEN `POST /auth/login` is called with an email that does not exist THEN the server still performs a bcrypt comparison against a fixed dummy hash before answering `401`, so response time does not reveal whether the email exists.
- AC 3. WHEN more than 10 failed login attempts arrive for the same `(client IP, email)` pair within 15 minutes THEN further attempts answer `429 { "error": "Too many attempts, try again later" }` until the window expires; a successful login resets the counter; the limiter lives in process memory (a restart clears it).
- AC 4. WHEN a login is valid THEN the behaviour is unchanged (cookie, payload, 7-day expiry).

### Deploy

- AC 5. WHEN a push touches `backend/**` THEN a CI job runs `npm ci`, `prisma generate` and `tsc --noEmit` on the runner **before** the deploy job, and the deploy job does not run if that job fails.
- AC 6. WHEN `tsc` reports type errors THEN no JavaScript is emitted (`noEmitOnError`).
- AC 7. WHEN `deploy.ps1` compiles THEN it compiles into a fresh directory (`dist.next`) and only on success swaps it into `dist/` (keeping the previous build as `dist.prev`), so `dist/` never holds a partial build and no stale files from deleted sources remain.
- AC 8. WHEN any step after `pm2 delete` fails (install, generate, migrate, build, start) THEN the script restarts the previous build from `dist.prev` (or `dist/` if the swap had not happened), verifies `/health`, and exits non-zero with a message that names the failed step and states that the previous version is running.
- AC 9. WHEN `pm2 start` succeeds THEN the script polls `http://localhost:3000/health` for up to 30 s and fails (with the rollback of AC 8) if it never answers `200`.
- AC 10. WHEN the backend is started by `deploy.ps1` or by `startup.ps1` THEN both use the same `backend/ecosystem.config.js` (name, script, node args, memory limit); the flags no longer appear inline in either script.
- AC 11. WHEN a deploy succeeds THEN the observable result is the same as today: pm2 process `amfxtrading-backend` online, `pm2 save` done, `/health` 200, EAs reconnected.

## Out of scope

- WebSocket origin check, heartbeat and per-user delivery (audit improvement 5).
- Changing the cookie to `SameSite=Lax` (possible since app and API share the registrable domain; left for the WS spec, which revisits cross-site assumptions).
- Persisting the rate limiter (DB/Redis) — single user, in-memory is enough.
- Frontend deploy pipeline (unchanged; it does not stop any service).
- Rollback of database migrations — migrations stay additive; the previous build is restarted against the migrated schema, as happens today when a deploy is repeated.
- `helmet`, body-size limits, CORS regex tightening (audit improvement 9 / later).
