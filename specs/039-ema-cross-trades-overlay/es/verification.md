# 039 — Overlay de trades por cruce de EMAs · Verificación

## Tarea 1 · [db] Columnas `emaTrades*` + migración

- **Mecanismo:** `prisma generate` + `prisma migrate deploy` sobre la BD de producción por el túnel local (puerto 5434) + `prisma migrate diff`.
- **Comandos:** `npx prisma generate` → ✓ (tras parar el backend local que tenía cargado el motor de consultas) · `npx prisma migrate deploy` → `20261108000000_ema_trades_settings` aplicada, `migrate status` → "Database schema is up to date!" · `npx prisma migrate diff --from-url <db> --to-schema-datamodel prisma/schema.prisma` → "No difference detected." · `npm run build` → ✓.
- **Resultado:** ✅ pass el 2026-11-07. Con una hora de retraso: el rango del edge de Cloudflare que sirve `amfxtrading.com` no era alcanzable desde el ISP del usuario (otros rangos de Cloudflare bien, VPS alcanzable por RDP); una VPN restauró la ruta. La fila de producción devuelve `{ fast: 24, slow: 48, entryPips: 5, hours: 24, count: 3 }`.
- **Est vs Actual:** 0.5 SP · 0.5 SP (0.25 de código, el resto esperando a la red).

## Tarea 2 · [backend] `emaTrades` en `/settings` + `limit` / `setups` en `/setup-levels`

- **Mecanismo:** `npm run build` + vitest sobre `parseDisplay` + `detectEmaCrossSetups` con velas reales de la BD por túnel.
- **Comandos:** `npm run build` → ✓ · `npx vitest run src/routes/settings.test.ts` → 19 passed (nuevos: objeto válido y cero pips aceptados; EMAs iguales, count 11, hours 721, pips negativos y periodo no entero → `BadRequest`; ausente → undefined) · script tsx sobre las últimas 1000 velas EURUSD H1 de `solidary III` con EMA 24 / 48 → 12 setups; los tres últimos: venta 2026-10-22 15:00 cerrada 29-10 21:00 (ECC 1.12048, EVL 1.12344), compra 29-10 21:00 cerrada 06-11 04:00 (ECC 1.1162, EVL 1.11323), venta 06-11 04:00 aún abierta (ECC 1.12059, EVL 1.12431). Es exactamente lo que devuelve `setups` con `limit=3`.
- **Resultado:** ✅ pass el 2026-11-07.
- **Est vs Actual:** 1 SP · 0.75 SP.
