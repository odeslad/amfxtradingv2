# 006 — Footer build numbers · Verification

| Task | Mechanism | Commands | Outcome | Evidence | Est | Actual | Note |
|---|---|---|---|---|---|---|---|
| 1 | build + curl | `npm run build`; `require('dist/version.js')` from `C:\` and `tsx -e import './src/version'`; local backend on 3001 → `curl /version` | ✅ | `tsc` clean; both entry points give `{"backend":155,"ea":28}` regardless of cwd (matches `git rev-list --count HEAD -- backend` / `-- ea` on `master`); `GET /version` → `200` without a cookie. | 0.5 | 0.5 | — |
| 2 | build | `npm run build` (`tsc -b && vite build`); `npm run lint` | ✅ | Build clean with `define` + `vite-env.d.ts`. The constant is not referenced yet, so the bundle grep moves to task 3. `npm run lint` reports 33 pre-existing problems in 15 unrelated files (none in the touched ones) — noted for the frontend audit, not fixed here. Current count: 157 (this commit makes it 158). | 0.5 | 0.5 | — |
