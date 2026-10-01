# 009 · BE-05 — Endurecimiento del WebSocket · Verificación

| Tarea | Mecanismo | Comandos | Resultado | Evidencia | Est | Real | Nota |
|---|---|---|---|---|---|---|---|
| 1 | lint + typecheck + vitest + build | `npm run lint`; `npm run typecheck`; `npx vitest run`; `npm run build` | ✅ | `ws/policy.ts`: `ALLOWED_ORIGINS` (misma regex que antes, ahora la única copia — `app.ts` la importa), `isAllowedOrigin` (ausente/vacío → false), `tokenFromCookie` (cookie primera/en medio/última, valor crudo con `=` intacto, prefijo `mytoken` no coincide), `HEARTBEAT_MS` 30 s, `sendDecision` (≤1 MB envía, ≤8 MB salta, si no termina). `policy.test.ts` 6 tests → **44/44** en verde; lint 0; typecheck 0; build ok. | 0,75 | 0,5 | — |
