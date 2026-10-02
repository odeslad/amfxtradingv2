# 011 — Accounts row liveness · Verification

| Task | Mechanism | Commands | Outcome | Evidence | Est | Actual | Note |
|---|---|---|---|---|---|---|---|
| 1 | lint + typecheck + vitest + build | `npm run lint`; `npm run typecheck`; `npx vitest run`; `npm run build` | ✅ | `isPipeLive` (connected/disabled → true, listening/error → false) and `pipeStateOf` (null when unregistered) in `store/liveness.ts`; `daily-pnl` skips a broker when `!isPipeLive(pipeStateOf(broker) ?? 'connected')`. One new test case; **61/61** green; lint 0; typecheck 0; build ok (AC 1–4 by construction; AC 1–2 observed in task 2). | 0.25 | 0.25 | — |
