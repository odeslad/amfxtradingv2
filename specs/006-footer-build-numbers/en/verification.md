# 006 — Footer build numbers · Verification

| Task | Mechanism | Commands | Outcome | Evidence | Est | Actual | Note |
|---|---|---|---|---|---|---|---|
| 1 | build + curl | `npm run build`; `require('dist/version.js')` from `C:\` and `tsx -e import './src/version'`; local backend on 3001 → `curl /version` | ✅ | `tsc` clean; both entry points give `{"backend":155,"ea":28}` regardless of cwd (matches `git rev-list --count HEAD -- backend` / `-- ea` on `master`); `GET /version` → `200` without a cookie. | 0.5 | 0.5 | — |
