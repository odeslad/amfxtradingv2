# 035 — Setup levels en modo mirror, visibilidad de niveles y atajos de TP por ratio · Verificación

| Tarea | Mecanismo | Comandos | Resultado | Evidencia | Est | Real |
|---|---|---|---|---|---|---|
| 1. [db] Columna `setupLevels` + migración | prisma generate + build | `npx prisma generate`, `npm run build` (backend) | ✅ pass | Cliente generado, `tsc` limpio. La migración `20261101000000_setup_levels` añade `"setupLevels" TEXT[] NOT NULL DEFAULT ARRAY['ECC','EMA','EVL','MHL']` | 0.25 | 0.1 |
| 2. [backend] `/settings` lee y escribe `setupLevels` | vitest + build | `npx vitest run src/routes/settings.test.ts`, `npm run build` | ✅ pass | 12/12 tests (4 nuevos): ausente → undefined, claves conocidas sin duplicados en orden canónico, lista vacía aceptada, clave desconocida / no array → `BadRequest`. GET devuelve `setupLevels ?? las cuatro claves`; PUT lo escribe solo cuando viene | 0.5 | 0.25 |
