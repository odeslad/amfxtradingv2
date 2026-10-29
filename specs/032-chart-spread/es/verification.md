# 032 — Spread en el gráfico · Verificación

| Tarea | Mecanismo | Comandos | Resultado | Evidencia | Est | Real |
|---|---|---|---|---|---|---|
| 1. [db] Columna `showSpread` + migración | prisma generate + build | `npx prisma generate`, `npm run build` (backend) | ✅ pasa | Cliente generado, `tsc` sin errores. La migración `20261029000000_show_spread` añade `"showSpread" BOOLEAN NOT NULL DEFAULT false` | 0.25 | 0.1 |
| 2. [backend] `/settings` lee y escribe `showSpread` | vitest + build | `npx vitest run src/routes/settings.test.ts`, `npm run build` | ✅ pasa | 3/3 tests: ausente → undefined (se conserva el valor guardado), booleano aceptado, no booleano → `BadRequest` (400). El GET devuelve `showSpread ?? false`; el PUT lo escribe solo si viene. Desviación: no había fichero de test de rutas, así que el test cubre `parseDisplay` (ahora exportada) en lugar de un GET/PUT completo contra la BD | 0.5 | 0.25 |
