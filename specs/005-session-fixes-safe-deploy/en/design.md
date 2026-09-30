# 005 — Session fixes and safe deploy · Design

> Status: **approved**

## Part A — Session (`backend/src/routes/auth.ts`)

### A.1 Logout

```ts
const COOKIE_OPTIONS = { httpOnly: true, secure: true, sameSite: 'none' as const, domain: config.cookieDomain, path: '/', maxAge: 7 * 24 * 60 * 60 * 1000 };
const { maxAge: _maxAge, ...CLEAR_COOKIE_OPTIONS } = COOKIE_OPTIONS;

router.post('/logout', (_req, res) => {
  res.clearCookie('token', CLEAR_COOKIE_OPTIONS);
  res.json({ ok: true });
});
```

`path: '/'` is Express's default for `res.cookie`, made explicit so both calls agree. With `COOKIE_DOMAIN=none` (local) `domain` is `undefined` in both, unchanged.

### A.2 Timing-neutral login

```ts
// bcrypt hash of a random string, cost 12 — same work as a real comparison.
const DUMMY_HASH = '$2b$12$…';   // generated once with bcrypt.hash(randomBytes(32).toString('hex'), 12)

const user = await db.user.findUnique({ where: { email } });
const valid = await bcrypt.compare(password, user?.passwordHash ?? DUMMY_HASH);
if (!user || !valid) { … 401 'Invalid credentials' }
```

One compare in both branches. The dummy hash is a constant in the file (it is not a secret: it hashes a throwaway string nobody knows).

### A.3 Login rate limit — `backend/src/middleware/loginLimiter.ts`

In-memory, no dependency:

```ts
const WINDOW_MS = 15 * 60_000;
const MAX_FAILURES = 10;
const failures = new Map<string, { count: number; first: number }>();   // key = `${ip}|${email}`

export function loginKey(req: Request, email: string): string   // ip from req.ip (trust proxy set, see below)
export function isBlocked(key: string): boolean                 // count >= MAX and within window → true; expired → delete, false
export function recordFailure(key: string): void
export function clearFailures(key: string): void
```

Used inside the `/login` handler (not as a router-level middleware, because the key needs the parsed `email`): `if (isBlocked(key)) → 429 { error, message: 'Too many attempts, try again later' }`; after a 401 → `recordFailure`; after success → `clearFailures`. A `setInterval` (unref'd) sweeps expired entries every 5 min so the map cannot grow unbounded.

**`req.ip` behind Cloudflare + nginx**: today `app` has no `trust proxy`, so `req.ip` is nginx's address for every client — the limiter would key everything on one IP. Add `app.set('trust proxy', 1)` in `app.ts` so `req.ip` reads `X-Forwarded-For`'s last hop (nginx sets it from Cloudflare, which in turn carries the real client). Effect elsewhere: none (nothing else reads `req.ip`; `secure` cookies are set unconditionally).

### A.4 Response keys

`429` carries both `error` and `message`, like the `BadRequest` responses of spec 004, so `AuthContext` (reads `message`) shows the text.

## Part B — Deploy

### B.1 CI gate — `.github/workflows/deploy-backend.yml`

```yaml
jobs:
  check:
    runs-on: ubuntu-latest
    defaults: { run: { working-directory: backend } }
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20, cache: npm, cache-dependency-path: backend/package-lock.json }
      - run: npm ci
      - run: npx prisma generate
      - run: npx tsc --noEmit
  deploy:
    needs: check
    runs-on: ubuntu-latest
    steps: (unchanged: cloudflared, ssh, scp deploy.ps1, run it)
```

`prisma generate` on the runner needs no database (`DATABASE_URL` is only read at runtime); the schema declares `debian-openssl-3.0.x` as a binary target already. `workflow_dispatch` keeps working (`check` runs first).

### B.2 `tsconfig.json`

`"noEmitOnError": true`. `outDir` stays `dist`; the deploy overrides it per build (B.3).

### B.3 `backend/ecosystem.config.js`

```js
module.exports = {
  apps: [{
    name: 'amfxtrading-backend',
    script: 'C:/amfxtradingv2/backend/dist/index.js',
    node_args: '--expose-gc --max-old-space-size=1024',
    max_memory_restart: '1200M',
  }],
};
```

`deploy.ps1` → `pm2 start C:\amfxtradingv2\backend\ecosystem.config.js`; `startup.ps1` → same, replacing its inline flags (`infra/scripts/startup.ps1:56-58`). `pm2 delete amfxtrading-backend` stays by name.

### B.4 `backend/scripts/deploy.ps1` — order and rollback

```
git reset/clean/pull                              (as today)
pm2 delete (tolerant) · free port 3000            (as today — must precede npm install: Prisma DLL lock)
$rollbackReady = Test-Path dist\index.js          (previous build present?)
try {
  npm install
  prisma generate
  prisma migrate deploy
  Remove-Item dist.next -Recurse -Force -EA SilentlyContinue
  npx tsc --outDir dist.next                      (noEmitOnError → nothing on failure)
  if (Test-Path dist.prev) Remove-Item dist.prev -Recurse -Force
  if (Test-Path dist)      Rename-Item dist dist.prev
  Rename-Item dist.next dist
  pm2 start ecosystem.config.js
  Wait-Health 30s  → throw "health check failed" if never 200
  pm2 save
  "[OK] Backend deployed and running"
} catch {
  Write-Host "[FAILED] step: $step — $_"
  if (-not (Test-Path dist\index.js) -and (Test-Path dist.prev)) { swap dist.prev back to dist }
  if ($rollbackReady) {
    pm2 delete (tolerant); pm2 start ecosystem.config.js
    if (Wait-Health 30s) { "[ROLLBACK] previous build is running" } else { "[ROLLBACK FAILED] backend is DOWN" }
  }
  exit 1
}
```

`Invoke-Step` keeps setting `$step` before each command so the failure message names it (AC 8). `Wait-Health` polls `http://localhost:3000/health` every 2 s (AC 9). `dist.prev` is kept until the next deploy (one rollback generation). Because `prisma migrate deploy` runs before the build, a rollback runs the previous build against the migrated schema — acceptable per the requirements (additive migrations; identical to re-running today's script).

What does **not** move: `pm2 delete` before `npm install` — the Prisma query-engine DLL lock is real on Windows (documented in the script). The window of downtime therefore still exists (install + generate + migrate + build ≈ 1–2 min), but it can no longer end in an outage: either the new build is healthy or the previous one is back.

### B.5 `infra/scripts/startup.ps1`

Replace the inline `pm2 start … --node-args … --max-memory-restart` with `pm2 start C:\amfxtradingv2\backend\ecosystem.config.js`. `$BackendEntry` becomes unused → removed.

## Files to touch

- backend: `src/routes/auth.ts`, `src/middleware/loginLimiter.ts` (new), `src/app.ts` (`trust proxy`), `tsconfig.json`, `ecosystem.config.js` (new), `scripts/deploy.ps1`
- infra: `.github/workflows/deploy-backend.yml`, `infra/scripts/startup.ps1`

## Verification strategy

- A: `curl` sequence local (login → `/me` 200 → logout → `/me` 401 with the same cookie jar); 11 wrong passwords → 429; timing spot check with `curl -w %{time_total}` on an unknown vs a known email (same order of magnitude).
- B: the CI gate is exercised by a deliberate type error on a throwaway branch pushed with `workflow_dispatch`? — no: workflows run on `master` only. Instead: run the `check` job locally-equivalent (`npm ci && npx prisma generate && npx tsc --noEmit` in a clean clone) and, for the real gate, verify the first real push shows `check` → `deploy` in the Actions UI. Rollback path: tested **on the VPS with `workflow_dispatch` after** injecting a failing step via an env var the script honours only when set (`AMFX_DEPLOY_FAIL_AT=build`), then a normal dispatch; both outcomes checked with `pm2 jlist` and `/health`.

## Risks

- `trust proxy` mis-set would make `req.ip` the client-supplied header → limiter bypassable; keyed also by email, so the worst case is today's behaviour (no limit per IP). Verified on production by logging `req.ip` once on login (removed after check).
- Rollback itself failing (e.g. `dist.prev` missing on the very first run): the script says so explicitly (`[ROLLBACK FAILED]`), the watchdog keeps trying `pm2 resurrect` as today.
- `dist.prev` doubles disk usage of `dist` (~few MB): negligible.
- `AMFX_DEPLOY_FAIL_AT` hook must be impossible to trigger by accident: only read from the environment of the SSH session, never set in the workflow.
