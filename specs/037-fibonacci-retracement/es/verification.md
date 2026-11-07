# 037 — Herramienta de retroceso de Fibonacci · Verificación

## Tarea 1 · [db] Columna `fibLevels` + migración

- **Mecanismo:** `prisma generate` + `prisma migrate deploy` sobre la BD de producción por el túnel local (puerto 5434) + `prisma migrate diff`.
- **Comandos:** `npx prisma generate` → ✓ · `npx prisma migrate deploy` → migración `20261106000000_fib_levels` aplicada, `migrate status` → "Database schema is up to date!" · `npx prisma migrate diff --from-url <db> --to-schema-datamodel prisma/schema.prisma` → "No difference detected." · `npm run build` (backend) → ✓.
- **Resultado:** ✅ pass el 2026-11-06. La columna existe en producción con su valor por defecto; el `migrate deploy` del pipeline no encontrará nada pendiente.
- **Est vs Actual:** 0.5 SP · 0.25 SP.

## Tarea 2 · [backend] `fibLevels` en `/settings`

- **Mecanismo:** `npm run build` + vitest sobre `parseDisplay` (sustituye a los curl de `tasks.md`: mismos casos, repetible) + lectura de la fila de producción con el cliente generado.
- **Comandos:** `npm run build` → ✓ · `npx vitest run src/routes/settings.test.ts` → 16 passed (nuevos: valores del catálogo sin duplicados y ordenados; `[61.8]` → `[0, 61.8, 100]`; `[]` → `[0, 100]`; `[33]`, `['50']` y un no-array → `BadRequest`) · `findFirst` de Prisma sobre `settings_display.global` → `fibLevels: [0, 23.6, 38.2, 50, 61.8, 78.6, 100]`.
- **Resultado:** ✅ pass el 2026-11-06.
- **Est vs Actual:** 0.75 SP · 0.5 SP.
