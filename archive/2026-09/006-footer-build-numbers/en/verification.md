# 006 — Footer build numbers · Verification

| Task | Mechanism | Commands | Outcome | Evidence | Est | Actual | Note |
|---|---|---|---|---|---|---|---|
| 1 | build + curl | `npm run build`; `require('dist/version.js')` from `C:\` and `tsx -e import './src/version'`; local backend on 3001 → `curl /version` | ✅ | `tsc` clean; both entry points give `{"backend":155,"ea":28}` regardless of cwd (matches `git rev-list --count HEAD -- backend` / `-- ea` on `master`); `GET /version` → `200` without a cookie. | 0.5 | 0.5 | — |
| 2 | build | `npm run build` (`tsc -b && vite build`); `npm run lint` | ✅ | Build clean with `define` + `vite-env.d.ts`. The constant is not referenced yet, so the bundle grep moves to task 3. `npm run lint` reports 33 pre-existing problems in 15 unrelated files (none in the touched ones) — noted for the frontend audit, not fixed here. Current count: 157 (this commit makes it 158). | 0.5 | 0.5 | — |
| 3 | build + manual (user, local frontend via Vite proxy) | `npm run build`; bundle grep; `npm run lint` (touched files clean); local frontend against local backend | ✅ | Bundle contains `frontend:158` and the `build: ` template with `??"?"` fallbacks. User screenshot: footer reads `AMFX Trading Terminal v2.0 · © 2026 · build: 158.155.28` in mono. The `?` state cannot be observed in the UI without a backend (the footer lives inside the authenticated layout); verified by code/bundle only. Mobile rule untouched. | 1 | 0.75 | — |
| 4 | manual (user validation on production) | two pushes: `5075c25..e9e4469` (backend only → backend deploy; prod `/version` → `{"backend":156,"ea":28}`, pm2 online, 0 restarts) then `e9e4469..0a434b6` (frontend only → frontend deploy; VPS at `0a434b6`, served bundle contains `frontend:159`) | ✅ | Counts on `master`: frontend 159, backend 156, ea 28. User confirmed the production footer reads `build: 159.156.28` (AC 5: the frontend push moved only the first number, the backend push only the second). No concurrent-pull incident thanks to the split push. | 0.5 | 0.5 | Production frontend host is behind Cloudflare; verified the bundle on the VPS instead of over HTTP. |
| 5 | manual | `Status: closed`; `git mv` to `archive/2026-09/` | ✅ | — | 0.25 | 0.25 | — |
| **Total** | | | | | **2.75** | **2.5** | Exact; task 3 slightly under (footer already existed). Pre-existing: `npm run lint` in the frontend reports 33 problems in 15 files — input for the frontend audit. |

## Deviations agreed during implementation

- The `?` fallback (AC 4) is verified by code/bundle only: the footer lives inside the authenticated layout, which cannot be reached without a backend.
- Pushed in two steps (backend, then frontend) to avoid the known concurrent-deploy pull failure.

## Pending on the user

Nothing.
