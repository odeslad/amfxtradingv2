# 010 · BE-08 — Broker liveness · Verification

| Task | Mechanism | Commands | Outcome | Evidence | Est | Actual | Note |
|---|---|---|---|---|---|---|---|
| 1 | lint + typecheck + vitest + build + local curl | `npm run lint`; `npm run typecheck`; `npx vitest run`; `npm run build`; backend on 3001 with `FEATURE_PIPE=false FEATURE_WATCHER=false`; `curl /health` | ✅ | `store/liveness.ts` (`register`/`setPipeState`/`touchTick`/`touchSync`/`snapshot` + pure `healthReport`, `STALE_TICK_MS` 5 min); `app.ts` serves `healthReport(now, startedAt, snapshot())`; `index.ts` registers each broker by feature flags. `liveness.test.ts` 7 tests (ok/degraded by pipe state, stale > 300 s, never-ticked → `tickAgeS: null`, disabled ignored, no negative age, uptime, store copies). **58/58** green; lint 0; typecheck 0; build ok. Local: `200 {"status":"ok","uptimeS":3,"brokers":[{"name":"solidary","pipe":"disabled",…},{"name":"ftmo","pipe":"disabled",…}]}` (AC 1, 2, 7). | 1 | 0.5 | — |
