# 013 · BE-07 — Risk % sizing correctness · Verification

| Task | Mechanism | Commands | Outcome | Evidence | Est | Actual | Note |
|---|---|---|---|---|---|---|---|
| 1 | lint + typecheck + vitest + build | `npm run lint`; `npm run typecheck`; `npx vitest run`; `npm run build` | ✅ | `getPipSize`: unlisted symbol with a JPY quote → 0.01 (`pip-size.test.ts`, 2 tests; listed pairs unchanged). `sizing.ts`: `calculateLots(SizingInput): SizingResult` — pair = first six letters, both currencies in the 8-currency set else `not_forex`; `slPips` from `entryPrice`; zero → `zero_stop`; conversion direct/inverse (exact key, then suffixed key) else `no_conversion`. `sizing.test.ts` rewritten, 11 tests: the five unchanged sizes (0.5 / 0.75 / 0.5 / 0.3 / floor 0.01 and 0.3), pending order 20 pips from its own price → 0.5 vs 0.07 from the bid, the three refusals with their exact messages, `EURUSD.r` and lower case, conversion under `USDJPY.r`. `commands.ts`: `entryPrice: price \|\| bid`, refusal → 503 (`no_conversion`) or 400. **80/80** green; lint 0; typecheck 0; build ok. Checked that the frontend only sends `price` for pending actions (`NewTradePanel.tsx:203`). The HTTP mapping is not exercised locally (no pipe → no ticks/account in memory); first seen in task 2. | 1.25 | 0.75 | — |
| 2 | manual (operator checks + user validation on production) | push `707ef17..4eb01d9` (backend 182); `/version`, `/health`, `pm2 jlist`; user orders on FTMO (EUR account, balance ≈ 77 492 €) | ✅ (two refusals not exercised) | Deploy ok: VPS at `4eb01d9`, pm2 online, restarts 0. **(a) market, risk 0.1 %**: buy EURUSD, SL 1.11500 from a bid ≈ 1.1251 (≈ 101 pips) → 77.49 € / (101 × 8.89 €) = 0.086 → opened with **0.09 lots**, ticket #49173624 (AC 1, 2: conversion USD→EUR through EURUSD). **(b) pending**: buy limit 1.12200, SL 1.11190 (101 pips from its own price) → **0.09 lots**; the old code, measuring 133 pips from the bid, would have sent 0.07 (AC 1). Fixed lots unchanged: buy 0.8 fixed executed, ticket #49173567 (AC 7). **(c) not forex** and **(d) SL equal to the entry** could not be produced from the UI: the symbol list only offers what the EA streams (forex only) and the route answers `Tick data not available yet` before sizing for any symbol without ticks, so `not_forex` is unreachable with the current EA symbol set; (d) not attempted. Both refusals are covered by the unit tests of task 1; their HTTP mapping (6 lines, type-checked) was **not observed in production**. | 0.5 | 0.5 | I first mis-read the SL of order (a) as 1.12000 from a chart line (expected 0.17 lots); the position row showed 1.11500 and the size was right. |
| 3 | manual | `Status: closed`; `git mv` to `archive/2026-10/`; `Spec` column of BE-07 → `013 ✅` | ✅ | — | 0.25 | 0.25 | — |
| **Total** | | | | | **2** | **1.5** | Under by 0.5 SP: a small pure module with its tests already in place from spec 008. |

## Deviations agreed during implementation

- The `not_forex` and `zero_stop` refusals were not exercised on production (not reachable / not practical from the UI); closed on the user's decision with the unit tests as evidence.

## Incident during this spec (not caused by it)

Two Windows bugchecks `0x1A (0x3F)` on the VPS at 08:42:44 and 08:52:23 UTC, the first ~6 min after this deploy, the second during the simultaneous start of the MT4 terminals. Hardware (page checksum failure reading the pagefile), with memory peaks as the likely trigger. No deploys were made afterwards; the machine was stable for 33 min before validation resumed.

## Pending on the user

- Open on FTMO from the tests: buy 0.8 (#49173567), buy 0.09 (#49173624) and the buy limit 0.09 at 1.12200.
- IONOS ticket with the two bugchecks of 2026-10-02; decide whether to build in CI so the VPS stops compiling on deploy.
