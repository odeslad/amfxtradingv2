# 032 — Spread en el gráfico · Verificación

| Tarea | Mecanismo | Comandos | Resultado | Evidencia | Est | Real |
|---|---|---|---|---|---|---|
| 1. [db] Columna `showSpread` + migración | prisma generate + build | `npx prisma generate`, `npm run build` (backend) | ✅ pasa | Cliente generado, `tsc` sin errores. La migración `20261029000000_show_spread` añade `"showSpread" BOOLEAN NOT NULL DEFAULT false` | 0.25 | 0.1 |
