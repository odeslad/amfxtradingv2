# 011 — Accounts row liveness · Verification

| Task | Mechanism | Commands | Outcome | Evidence | Est | Actual | Note |
|---|---|---|---|---|---|---|---|
| 1 | lint + typecheck + vitest + build | `npm run lint`; `npm run typecheck`; `npx vitest run`; `npm run build` | ✅ | `isPipeLive` (connected/disabled → true, listening/error → false) and `pipeStateOf` (null when unregistered) in `store/liveness.ts`; `daily-pnl` skips a broker when `!isPipeLive(pipeStateOf(broker) ?? 'connected')`. One new test case; **61/61** green; lint 0; typecheck 0; build ok (AC 1–4 by construction; AC 1–2 observed in task 2). | 0.25 | 0.25 | — |
| 2 | manual (user validation on production) | push `890f437..9be20ab` (backend 177) and `b15655f` (backend 178); `/health`, pm2 log | ✅ | Backend 177: Darwinex row went grey **while its EA was running** — `/health` said `listening` with `tickAgeS 0`: the EA held two pipe sockets (re-attach) and closing one marked the pipe `listening`. Fix `b15655f`: `PipeReader` counts open sockets, `listening` only when the last one closes; integration test extended (second client closes → still `connected`). Backend 178: 12/12 `connected`, Darwinex `connected (sockets: 1)`; user confirmed the row is white again and that removing/re-attaching the EA greys and restores it within seconds (AC 1, 2, 4). | 0.25 | 0.5 | The double-socket case was a bug of spec 010 surfaced by this validation; fixed here. |
| 3 | manual | `Status: closed`; `git mv` to `archive/2026-10/` | ✅ | — | 0.1 | 0.1 | — |
| **Total** | | | | | **0.6** | **0.85** | Over by 0.25 SP: the socket-count fix in `PipeReader`. |

## Deviations agreed during implementation

- `PipeReader` tracks the number of open EA sockets (fix to spec 010 behaviour), committed under this spec.

## Pending on the user

Nothing. Check whether the Darwinex EA is attached to two charts in MT4 (harmless now, but it doubles the pipe traffic).
