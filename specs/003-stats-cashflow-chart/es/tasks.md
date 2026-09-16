# 003 — Stats: rendimiento mensual, flujo de caja y gráfico de balance · Tareas

Cada tarea es un commit convencional. El proyecto debe compilar y funcionar tras cada tarea. Las tareas de backend, frontend y EA nunca comparten commit. Orden de despliegue: backend (tareas 1–4) → frontend (5–9) → EA (10); el EA va el último para que el backend ya sepa guardar operaciones de balance cuando lleguen.

## Backend

- [x] 1. Añadir el modelo `BalanceOperation` a `schema.prisma`, ejecutar `prisma generate`, añadir la migración `20260916000000_add_balance_operations/migration.sql`. `npm run build` pasa. — Diseño § Prisma. `feat(db): add balance_operations table` [SP: 1]

- [x] 2. Crear `services/balance-operations.ts` (`syncBalanceOperations`, upsert por ticket) y particionar el lote de history por tipo en `index.ts`. `npm run build` pasa. — Diseño § Handler de history. `feat(backend): persist balance operations from history` [SP: 1]

- [x] 3. Reescribir `services/stats.ts` alrededor de `balanceAt`: reconstrucción por suma sufijo sobre operaciones y movimientos, `cashFlow`, `returnPct` del periodo con el denominador de flujo de caja, `returnPct`/`cashFlow` por mes, `curve` diaria fijada tras el último snapshot, `operations`; eliminar la búsqueda de snapshot y `startBalanceSource`. `npm run build` pasa. — Diseño § Cálculo. `feat(backend): cash-flow aware stats with balance curve` [SP: 3]

- [x] 4. Verificar contra la base de datos del VPS por el túnel con un script tsx: para darwinex, `startBalance` en `All time` coincide con lo que devolvía 002 (sin movimientos aún → idéntico), `curve` tiene un punto por día sin huecos y su último valor coincide con el snapshot más reciente, los `returnPct` mensuales son consistentes con el `netPnl` de cada mes, `cashFlow = 0` en todas partes. Insertar una fila de depósito falsa para un broker de prueba, repetir y confirmar que `returnPct` se reduce en la proporción esperada y que la operación aparece en `operations`; borrar la fila falsa. Sin commit; registrar en Outcome. — Requisitos CA 6–11. [SP: 2]

## Frontend

- [x] 5. Actualizar `features/stats/types.ts` y extraer `fmtPct` a `features/stats/format.ts`. `npm run build` pasa. — Diseño § Archivos afectados (frontend). `refactor(frontend): update stats types and share fmtPct` [SP: 1]

- [x] 6. `MonthlyBreakdown`: añadir columnas y campos de card Return y Cash flow, coloreados por signo, `—` para null / cero. `npm run build` pasa. — Diseño § `MonthlyBreakdown`. `feat(frontend): add return and cash flow to monthly breakdown` [SP: 1]

- [x] 7. Crear `features/stats/BalanceChart.tsx` + `.module.css`: serie de línea de lightweight-charts, tiempos de día hábil, marcadores de operaciones, crosshair, resize observer, limpieza. `npm run build` pasa. — Diseño § `BalanceChart`. `feat(frontend): add BalanceChart component` [SP: 3]

- [x] 8. `StatsPage`: tile Cash flow, grid de seis tiles, quitar el aviso de derivado, layout `split` con el gráfico a la derecha (primero en móvil), estado vacío cubriendo ambas mitades. `npm run build` pasa. — Diseño § `StatsPage`. `feat(frontend): show balance chart beside monthly breakdown` [SP: 2]

- [x] 9. Verificar en local en escritorio y ancho de móvil contra el backend local + túnel: dos columnas al 50 %, el gráfico ajusta al periodo, el tooltip muestra fecha y balance, los marcadores aparecen con un depósito falso, columnas de tabla y cards, estado vacío, consola limpia. Sin commit; registrar en Outcome. — Requisitos CA 12–16. [SP: 1]

## EA

- [ ] 10. `WriteHistory()` en `HttpBridgeState.mq4`: aceptar `OP_BALANCE` y `OP_CREDIT`; documentar en `ea/docs/HttpBridgeState.md`. Push solo tras desplegar el backend; el usuario recarga después el EA en cada terminal (Account History en *All History*). Después comprobar en el VPS que `balance_operations` tiene filas y que Stats muestra el flujo de caja. — Diseño § Archivos afectados (EA); § Riesgos. `feat(ea): export balance and credit operations in history` [SP: 1]

## Estimación

Total: 16 SP.

Referencia: spec 002 — su tarea de servicio backend (1) fue de 3 SP y acertada, así que la reescritura aquí con la curva extra se mantiene en 3; su verificación de BD por túnel (tarea 3) se pasó en un punto, así que la tarea 4 aquí son 2 SP de entrada. El trabajo de componente de gráfico de la spec 001 (tarea 5, 3 SP acertados) fija `BalanceChart` en 3. Las tareas pequeñas de cableado son 1 SP como en las dos specs anteriores, donde salieron en o por debajo de la estimación.
