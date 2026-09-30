# 006 — Footer build numbers · Design

> Status: **closed**

## Approach

Three small pieces, no new dependencies:

1. **Frontend constant** — `vite.config.ts` runs `git rev-list --count HEAD -- frontend` (via `child_process.execSync`, cwd = repo root) and exposes it as `__BUILD_FRONTEND__` through `define`. A `src/vite-env.d.ts` declaration types it as `number`. Failure → `0` + `console.warn`.
2. **Backend `/version`** — `src/version.ts` computes `{ backend, ea }` once at import with the same command for `backend` and `ea`, cwd = `path.resolve(__dirname, '..', '..')` (repo root from `dist/` or `src/`). Failure → `0` + `console.warn('[VERSION] …')`. `app.ts` mounts `app.get('/version', …)` next to `/health`, before `requireAuth` routers.
3. **Footer** — `AppLayout` gains a `useBuildInfo()` hook (`src/lib/useBuildInfo.ts`) that fetches `/version` once on mount and returns `{ frontend, backend, ea }` with `backend`/`ea` as `number | null`; the footer renders `build: {frontend}.{backend ?? '?'}.{ea ?? '?'}` in `--font-mono` inside the existing `.footer`.

Alternatives considered:

| Option | Pros | Cons | Decision |
|---|---|---|---|
| **Git commit count per directory** | automatic, per-layer, already available on the VPS | EA number = checkout, not what MT4 loaded | **chosen** (out of scope noted) |
| GitHub Actions run number | trivially available in CI | one counter per workflow, not per layer; not available to the VPS build for the backend | rejected |
| Manual `version.json` per layer | explicit | forgets to bump; contradicts "autoincremental" | rejected |
| Backend computes all three (frontend too) | one source | the frontend must show what it *is*, not what the checkout says; a stale cached bundle would lie | rejected |

## Frontend

```ts
// vite.config.ts
import { execSync } from 'child_process';

function gitCount(dir: string): number {
  try { return Number(execSync(`git rev-list --count HEAD -- ${dir}`, { cwd: '..', stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim()) || 0; }
  catch { console.warn(`[build] git count for ${dir} unavailable, using 0`); return 0; }
}

export default defineConfig(({ command }) => ({
  define: { __BUILD_FRONTEND__: JSON.stringify(gitCount('frontend')) },
  ...
```

`cwd: '..'` because Vite runs from `frontend/`; the count must include commits anywhere under `frontend/` (the deploy script runs `npm run build` in `frontend/`, same layout).

```ts
// src/lib/useBuildInfo.ts
interface BuildInfo { frontend: number; backend: number | null; ea: number | null }
export function useBuildInfo(): BuildInfo  // fetch(apiUrl('/version')) on mount, credentials not needed
```

Footer markup (`AppLayout.tsx`):

```tsx
<footer className={styles.footer}>
  AMFX Trading Terminal v2.0 &nbsp;·&nbsp; © {new Date().getFullYear()} &nbsp;·&nbsp;
  <span className={styles.build}>build: {build.frontend}.{build.backend ?? '?'}.{build.ea ?? '?'}</span>
</footer>
```

`.build { font-family: var(--font-mono); margin-left: 4px; }` — same size/colour as the footer. Mobile rule unchanged (footer hidden).

## Backend

```ts
// src/version.ts
import { execSync } from 'child_process';
import path from 'path';

const REPO_ROOT = path.resolve(__dirname, '..', '..');

function gitCount(dir: string): number { /* same as above, cwd: REPO_ROOT, warn prefix [VERSION] */ }

export const version = { backend: gitCount('backend'), ea: gitCount('ea') };
```

`app.ts`: `app.get('/version', (_req, res) => res.json(version));` right after `/health`. Computed at module load, so a deploy (process restart) refreshes it; no per-request git call.

Dev note: the local backend runs from `src/` with `tsx`, and `dist/` in production — both are two levels below the repo root, so `REPO_ROOT` resolves identically.

## Data flow

Browser → `GET /version` (no cookie needed) → `{ backend, ea }`. No EA or WS change.

## Files to touch

- `frontend/vite.config.ts`, `frontend/src/vite-env.d.ts` (declare `__BUILD_FRONTEND__`), `frontend/src/lib/useBuildInfo.ts` (new), `frontend/src/app/layout/AppLayout.tsx`, `AppLayout.module.css`
- `backend/src/version.ts` (new), `backend/src/app.ts`

## Risks

- **Shallow clone on the VPS** would undercount. The VPS pulls into a full clone (`git pull origin master` on an existing checkout), verified by the existing counts being reachable; CI does not build the frontend. If a shallow clone ever appears, numbers drop — visible immediately in the footer.
- **`/version` unauthenticated** exposes two integers; acceptable (same as `/health`).
- **`define` typing**: `__BUILD_FRONTEND__` must be declared or `tsc` fails the frontend build — covered by `vite-env.d.ts`.
