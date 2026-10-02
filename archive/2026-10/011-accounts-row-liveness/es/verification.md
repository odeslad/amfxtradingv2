# 011 — Vitalidad de la fila de Cuentas · Verificación

| Tarea | Mecanismo | Comandos | Resultado | Evidencia | Est | Real | Nota |
|---|---|---|---|---|---|---|---|
| 1 | lint + typecheck + vitest + build | `npm run lint`; `npm run typecheck`; `npx vitest run`; `npm run build` | ✅ | `isPipeLive` (connected/disabled → true, listening/error → false) y `pipeStateOf` (null si no está registrado) en `store/liveness.ts`; `daily-pnl` salta un broker cuando `!isPipeLive(pipeStateOf(broker) ?? 'connected')`. Un caso de test nuevo; **61/61** en verde; lint 0; typecheck 0; build ok (AC 1–4 por construcción; AC 1–2 observados en la tarea 2). | 0,25 | 0,25 | — |
| 2 | manual (validación del usuario en producción) | push `890f437..9be20ab` (backend 177) y `b15655f` (backend 178); `/health`, log de pm2 | ✅ | Backend 177: la fila de Darwinex se puso gris **con su EA funcionando** — `/health` decía `listening` con `tickAgeS 0`: el EA tenía dos sockets al pipe (al reponerlo) y cerrar uno marcaba el pipe como `listening`. Fix `b15655f`: `PipeReader` cuenta los sockets abiertos, `listening` solo cuando se cierra el último; test de integración ampliado (un segundo cliente cierra → sigue `connected`). Backend 178: 12/12 `connected`, Darwinex `connected (sockets: 1)`; el usuario confirmó que la fila vuelve a blanco y que quitar/reponer el EA la pone gris y la recupera en segundos (AC 1, 2, 4). | 0,25 | 0,5 | El caso del doble socket era un bug de la spec 010 que esta validación sacó a la luz; corregido aquí. |
| 3 | manual | `Status: closed`; `git mv` a `archive/2026-10/` | ✅ | — | 0,1 | 0,1 | — |
| **Total** | | | | | **0,6** | **0,85** | 0,25 SP por encima: el fix del recuento de sockets en `PipeReader`. |

## Desviaciones acordadas durante la implementación

- `PipeReader` lleva la cuenta de sockets abiertos del EA (corrección al comportamiento de la spec 010), commiteada bajo esta spec.

## Pendiente del usuario

Nada. Comprueba si el EA de Darwinex está en dos gráficos en MT4 (ya inocuo, pero duplica el tráfico del pipe).
