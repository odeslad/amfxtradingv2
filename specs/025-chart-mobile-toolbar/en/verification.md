# 025 — Chart fixes · Verification

| Task | Mechanism | Commands | Outcome | Est | Actual |
|---|---|---|---|---|---|
| 1 [backend] | build + vitest + local backend | `npm run build` · `npm test` (103 tests, 4 new in `candle-close.test.ts`) · `npm run lint` · local backend on 3001, bridges off, production DB through the tunnel → `/health` 200 | ✅ pass | 1 | 0.75 |
| 2 [frontend] | build + lint + local app on the production API | `npm run build` · `npm run lint` · Vite on 5174 proxied to `api-v2` (real ticks) | ✅ pass | 1.5 | 1.5 |

## Evidence

### Task 1

`tsc` and `eslint` clean; the whole suite passes. The new tests cover the tracker: the first tick only
seeds, same-time ticks report nothing, an advanced `m5_time` closes the M5 bar with the previous tick's
open / high / low and its bid as close, an hour rollover closes M5 / M15 / H1 at once without touching
another symbol or broker, and a tick with a missing candle time is skipped. The rollover path itself
(upsert + `candle` broadcast) needs a live pipe, so it is checked on production in task 5.

### Task 2

Build and lint clean. Checked by the user in the local app against the production API on 2026-10-24:
EMA lines reach the live candle and move with the ticks, rollover lines stop at the candle pane when
the chart is scrolled right, alert markers update at once on create / toggle / delete (the last one
included). The `candle` message cannot be seen until the backend deploys (task 5). Side fix found while
testing: the dev proxy now rewrites the session cookie to host-only (`cookieDomainRewrite`), since
Chrome dropped the production `Domain=.amfxtrading.com` cookie arriving through the proxy and every
request bounced to the login; logout also clears the host-only scope on the backend.
