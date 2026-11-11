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
