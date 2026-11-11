# 041 — Suscripción de ticks por WebSocket · Verificación

## Tarea 1 · [backend] `parseSubscription` + límites en `ws/policy.ts`

- **Mecanismo:** `npm run build` + vitest sobre `policy.test.ts`.
- **Comandos:** `npm run build` → ✓ (tsc limpio) · `npx vitest run src/ws/policy.test.ts` → 12 pasados (6 nuevos: conjunto válido deduplicado; lista vacía → conjunto vacío; entrada Buffer; 17 pares rechazados y 16 aceptados; type desconocido / lista ausente / no array / no JSON / null / raíz array rechazados; tipos incorrectos, nombres vacíos y de 65 caracteres, items string y null rechazados).
- **Resultado:** ✅ pasa el 2026-11-11.
- **Est vs Actual:** 0,75 SP · 0,5 SP.
