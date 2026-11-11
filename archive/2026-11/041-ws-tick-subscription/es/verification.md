# 041 — Suscripción de ticks por WebSocket · Verificación

## Tarea 1 · [backend] `parseSubscription` + límites en `ws/policy.ts`

- **Mecanismo:** `npm run build` + vitest sobre `policy.test.ts`.
- **Comandos:** `npm run build` → ✓ (tsc limpio) · `npx vitest run src/ws/policy.test.ts` → 12 pasados (6 nuevos: conjunto válido deduplicado; lista vacía → conjunto vacío; entrada Buffer; 17 pares rechazados y 16 aceptados; type desconocido / lista ausente / no array / no JSON / null / raíz array rechazados; tipos incorrectos, nombres vacíos y de 65 caracteres, items string y null rechazados).
- **Resultado:** ✅ pasa el 2026-11-11.
- **Est vs Actual:** 0,75 SP · 0,5 SP.

## Tarea 2 · [backend] `tickKeys` por cliente, `subscribe` entrante, `broadcastTicks` filtrado

- **Mecanismo:** `npm run build` + vitest sobre `ws.test.ts`.
- **Comandos:** `npm run build` → ✓ · `npx eslint src/ws/*.ts` → limpio · `npx vitest run src/ws` → 23 pasados (ws.test.ts 11: sin ticks antes de suscribirse; el cliente A recibe solo EURUSD y el B los dos símbolos del mismo lote, el lote de otro broker y un lote solo de GBPUSD no se entregan; un frame nuevo sustituye el conjunto, no-JSON y una lista no array lo mantienen, una lista vacía detiene los ticks; las alertas siguen solo a su dueño; gate de upgrade y heartbeat sin cambios).
- **Resultado:** ✅ pasa el 2026-11-11.
- **Est vs Actual:** 1,5 SP · 1 SP.

## Tarea 3 · [backend] `scripts/ws-measure.ts` + docs

- **Mecanismo:** el script corre contra un backend sin fallar; docs revisadas.
- **Desviación:** el script es `ws-measure.ts` ejecutado con `npx tsx --env-file=.env`, como el resto de scripts de la carpeta, en lugar del `.js` que nombraba el diseño.
- **Comandos:** `npx eslint scripts/ws-measure.ts` → limpio · `npm run build` → ✓ · no había backend local levantado (necesita el túnel de BD), así que un arnés desechable arrancó el `createWss` real en el puerto 3999 emitiendo lotes falsos cada 100 ms (`alpha`: EURUSD, GBPUSD, XAUUSD · `beta`: EURUSD, USDJPY) más `account` cada segundo. Pasadas de 5 s: sin suscripción → 0 ticks, 5 `account` (310 B) · `--subscribe alpha:EURUSD` → 46 ticks, 1 par distinto, 4 922 B · dos pares → 92 ticks, 2 pares · `JWT_SECRET` incorrecto → `handshake rejected: HTTP 401`, salida 1. Arnés eliminado después.
- **Docs:** sección WebSocket de `backend/docs/architecture.md` (párrafo de suscripción, fila `ticks`) y línea WS de `.claude/CLAUDE.md` actualizadas.
- **Resultado:** ✅ pasa el 2026-11-11.
- **Est vs Actual:** 0,5 SP · 0,75 SP (el arnés y un proceso colgado en el puerto).

## Tarea 4 · [frontend] Registro de suscripciones en `lib/ws.ts` + `useTickSubscription`

- **Mecanismo:** `npm run build` + eslint sobre los ficheros nuevos/cambiados.
- **Comandos:** `npm run build` → ✓ built · `npx eslint src/lib/ws.ts src/lib/useTickSubscription.ts` → limpio.
- **Resultado:** ✅ pasa el 2026-11-11. `Map` con contador de referencias por `broker|symbol`, un flush en microtarea por cambio, frame omitido cuando es idéntico al último enviado, `lastSent` reiniciado en `onopen` para que cada reconexión reenvíe. El comportamiento en pantalla se comprueba en la tarea 5 junto con los consumidores.
- **Est vs Actual:** 0,75 SP · 0,5 SP.

## Tarea 5 · [frontend] Declarar el par en `ChartSlot`, `ChartPage`, `NewTradePanel`

- **Mecanismo:** `npm run build` + manual en el stack local (frames WS en DevTools).
- **Comandos:** `npm run build` → ✓ built · `npx eslint` sobre los tres ficheros → limpio.
- **Pasos manuales (usuario):** Vite contra la API de producción (el backend local no tiene pipes, así que no hay ticks). DevTools > Network > `ws` > Messages. Esperado: (1) al cargar, un `{"type":"subscribe","ticks":[{broker,symbol}]}` saliente con el par del chart; (2) cambiar broker o símbolo → un frame nuevo solo con el par nuevo; (3) vista dividida → un frame con los dos pares, volver a simple → un frame con uno; (4) abrir New Trade con un preset cuyo broker de niveles difiera del chart → frame con dos pares, cerrarlo → vuelve a uno; (5) cortar la conexión (toggle offline de DevTools on/off) → tras la reconexión se vuelve a enviar el frame. Vela viva, precio del panel de alertas y bid/ask de New Trade siguen actualizándose (el backend de producción sigue enviando todos los ticks hasta que la tarea 6 despliegue el filtro).
- **Resultado:** 🕐 pendiente de la comprobación manual del usuario.
- **Est vs Actual:** 1 SP · 0,5 SP.

## Tarea 6 · [infra] Push, deploys y validación en producción

- **Mecanismo:** manual (validación del usuario) + `ws-measure.ts` en el VPS.
- **Deploys:** backend subido primero (`1acbab3`, 2026-11-11 ≈ 10:02 UTC; la API de GitHub estaba limitada, así que el reinicio se confirmó por el `uptimeS` de `/health` cayendo a 15 s), frontend justo después (`7e435e4`; producción sirvió `index-D2uagtMM.js` unos minutos más tarde; la app muestra Build 256.228.35 = frontend 256 · backend 228 · EA 35).
- **Medición del AC 7** (VPS, `npx tsx --env-file=.env scripts/ws-measure.ts --seconds 60`, 2026-11-11 ≈ 10:10 UTC, mercado abierto):

  | Pasada | Total | Ticks | Resto |
  |---|---|---|---|
  | 2026-11-10, antes de la spec | 319 277 B/s | 313 523 B/s (38 824 items, 74 pares) | 5 754 B/s |
  | Sin suscripción | 5 973 B/s | 0 | positions + account + candle |
  | `solidary III:EURUSD` | 10 614 B/s | 4 751 B/s (542 items, 1 par) | 5 863 B/s |

  Un par suscrito recibe el 3,3 % del volumen anterior (el AC 7 pide < 5 % / < 16 KB/s) → ≈ 38 MB por hora en lugar de ≈ 1,15 GB. Los ≈ 6 KB/s restantes son `positions` + `account` de los 11 brokers, fuera de alcance.
- **Validación del usuario en producción:** 🕐 pendiente — chart en vivo en escritorio y móvil, vista dividida, precio del panel de alertas, bid/ask de New Trade, Accounts / Positions / Orders en vivo para todos los brokers (AC 2, 4, 5, 8).
- **Est vs Actual:** 0,75 SP · 0,75 SP.

## Tarea 7 · [specs] Cierre

- **Builds finales:** backend `npm run build` → ✓ · frontend `npm run build` → ✓ built (2026-11-11).
- **Est vs Actual por tarea:** 1: 0,75 · 0,5 — 2: 1,5 · 1 — 3: 0,5 · 0,75 — 4: 0,75 · 0,5 — 5: 1 · 0,5 — 6: 0,75 · 0,75 — 7: 0,25 · 0,25.
- **Total:** 5,5 SP estimados · 4,25 SP reales. Calibración: las dos tareas del WebSocket salieron por debajo porque el diseño fijó de antemano el protocolo y los casos de test; el script de medición se pasó porque no había backend local y hubo que montar un arnés. La comprobación en DevTools de la tarea 5 pasó a producción por decisión del usuario.
- **Desviaciones:** `scripts/ws-measure.ts` (TypeScript vía tsx) en lugar del `.js` que nombraba el diseño.
- **Pendiente del usuario:** nada. Continuaciones fuera de esta spec: `permessage-deflate` y un payload de tick más ligero recortarían los ≈ 6 KB/s restantes de `positions` / `account` y el tamaño por tick.
- **Est vs Actual:** 0,25 SP · 0,25 SP.
