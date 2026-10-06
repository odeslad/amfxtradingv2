# 014 · BE-09 — Query indexes and legacy names · Verification

| # | Mechanism | Commands / steps | Outcome | Evidence | Est | Actual | Note |
|---|---|---|---|---|---|---|---|
| 1 | lint + typecheck + vitest + build | `npm run lint && npm run typecheck && npm test` · `npm run build` · `grep -rn emas backend/src` | ✅ | eslint clean; tsc clean (src and tests); 12 files / 80 tests pass; build ok; grep hits only `routes/chart-indicators.ts` (user EMA list) and the EMA alert / scanner code — no `/emas` route left | 0.25 | 0.25 | — |
