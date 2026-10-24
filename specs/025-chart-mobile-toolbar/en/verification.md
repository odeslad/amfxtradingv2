# 025 — Chart fixes · Verification

| Task | Mechanism | Commands | Outcome | Est | Actual |
|---|---|---|---|---|---|
| 1 [backend] | build + vitest + local backend | `npm run build` · `npm test` (103 tests, 4 new in `candle-close.test.ts`) · `npm run lint` · local backend on 3001, bridges off, production DB through the tunnel → `/health` 200 | ✅ pass | 1 | 0.75 |

## Evidence

### Task 1

`tsc` and `eslint` clean; the whole suite passes. The new tests cover the tracker: the first tick only
seeds, same-time ticks report nothing, an advanced `m5_time` closes the M5 bar with the previous tick's
open / high / low and its bid as close, an hour rollover closes M5 / M15 / H1 at once without touching
another symbol or broker, and a tick with a missing candle time is skipped. The rollover path itself
(upsert + `candle` broadcast) needs a live pipe, so it is checked on production in task 5.
