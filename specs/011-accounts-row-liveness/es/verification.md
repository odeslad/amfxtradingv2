# 011 — Vitalidad de la fila de Cuentas · Verificación

| Tarea | Mecanismo | Comandos | Resultado | Evidencia | Est | Real | Nota |
|---|---|---|---|---|---|---|---|
| 1 | lint + typecheck + vitest + build | `npm run lint`; `npm run typecheck`; `npx vitest run`; `npm run build` | ✅ | `isPipeLive` (connected/disabled → true, listening/error → false) y `pipeStateOf` (null si no está registrado) en `store/liveness.ts`; `daily-pnl` salta un broker cuando `!isPipeLive(pipeStateOf(broker) ?? 'connected')`. Un caso de test nuevo; **61/61** en verde; lint 0; typecheck 0; build ok (AC 1–4 por construcción; AC 1–2 observados en la tarea 2). | 0,25 | 0,25 | — |
