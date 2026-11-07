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

## Tarea 3 · [frontend] Tipo de dibujo `fib` en `DrawingTools.ts`

- **Mecanismo:** `npm run build` + manual en el stack local (Vite 5174 → backend 3001 → BD de producción por túnel).
- **Comandos:** `npx tsc --noEmit` → ✓ · `npm run build` → ✓ built.
- **Resultado:** ✅ pass el 2026-11-07. El usuario dibujó un Fibonacci en el chart local: niveles entre las anclas con etiquetas `pct  precio`, segmento discontinuo entre anclas, handles naranjas al seleccionar, estilo/color de la línea de tendencia de Ajustes aplicado. Dos cambios visuales acordados sobre la marcha y registrados en requirements/design: sin estilo sólido para 50 / 61.8 (todos los niveles con el estilo de la línea de tendencia) y todas las etiquetas en el color de texto brillante. Arrastre, duplicar, ciclo de color, borrar, bloqueo, cambio de timeframe y recarga se recomprueban en producción (tarea 6).
- **Est vs Actual:** 2.5 SP · 1.5 SP.

## Tarea 4 · [frontend] Herramienta Fibonacci expuesta en la toolbar

- **Mecanismo:** `npm run build` + manual en el stack local.
- **Comandos:** `npm run build` → ✓ built.
- **Resultado:** ✅ pass el 2026-11-07. `IconFib` tras el rectángulo, estado activo mientras se dibuja; el usuario creó un Fibonacci desde él. Fila Draw en móvil y split view se recomprueban en producción (tarea 6).
- **Est vs Actual:** 0.75 SP · 0.25 SP.

## Tarea 5 · [frontend] Niveles de Fibonacci en Ajustes > Display

- **Mecanismo:** `npm run build` + manual en el stack local.
- **Comandos:** `npm run build` → ✓ built.
- **Resultado:** ✅ pass el 2026-11-07. El usuario cambió niveles en Ajustes > Display (0 y 100 fijos), guardó y el chart redibujó el Fibonacci existente con el nuevo conjunto; el conjunto sobrevive a una recarga. Maquetación: seis tarjetas por fila en escritorio, dos en móvil (la rejilla de la maqueta).
- **Est vs Actual:** 1 SP · 0.5 SP.
