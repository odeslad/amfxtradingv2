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
