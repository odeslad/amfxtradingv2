# 014 · BE-09 — Índices de consulta y nombres heredados

> Status: **closed**
> Origin: [auditoría de backend 2026-09-30](../../../reports/2026-09-30-backend.md), mejora 9 (diagnóstico E)

## Contexto

La auditoría agrupó en BE-09 cuatro puntos pequeños de consultas y esquema:

- `GET /candles/emas` carga el histórico completo de velas de un símbolo (~10⁵ filas en M5) para devolver una serie de EMAs. Después de escribir la auditoría hemos visto que **no lo llama nadie**: su único consumidor era la página de backtest eliminada en la spec 001, y el gráfico calcula sus EMAs en el frontend (`calcEma` en `LightweightChart.tsx`). El usuario ha decidido eliminar el endpoint en lugar de acotar su calentamiento.
- Todas las consultas de trades filtran por `broker` y filtran u ordenan por `closeTime` (`routes/trades.ts`, P&L diario en `routes/balances.ts`, `services/stats.ts`), pero `trades` solo tiene los índices `(broker, symbol)` y `(closeTime)`.
- `drawings` declara `@@unique([userId, broker, symbol, timeframe])` y un `@@index` sobre las mismas cuatro columnas. El índice único ya sirve todas las búsquedas; el segundo solo añade coste de escritura.
- Dos tablas se renombraron con `ALTER TABLE … RENAME` (`account_snapshots` → `balances`, `trendlines` → `drawings`) y conservaron los nombres de su clave primaria, índice y clave foránea antiguos (`account_snapshots_pkey`, `account_snapshots_broker_timestamp_idx`, `trendlines_pkey`, `trendlines_userId_fkey`). La base de datos funciona, pero ya no coincide con los nombres que Prisma deriva de `schema.prisma`, así que `prisma migrate diff` no sale limpio y un futuro `migrate dev` propondría renombrados espurios.

## Capas afectadas

- backend
- db

Sin cambios en el frontend: el endpoint eliminado no tiene consumidor. El contrato EA ↔ backend no se toca.

## Historias de usuario

- Como usuario, quiero que la lista de trades, el P&L diario y las estadísticas se sirvan con un índice que coincida con cómo se consultan, para que sigan siendo rápidos cuando crezca el histórico.
- Como desarrollador, quiero que los nombres de los objetos de la base de datos coincidan con `schema.prisma`, para que la siguiente migración contenga solo el cambio que pretendo.
- Como desarrollador, quiero eliminar un endpoint que nadie usa, para no mantenerlo, auditarlo ni exponerlo.

## Criterios de aceptación

- AC 1. CUANDO se pide `GET /candles/emas` ENTONCES el backend responde 404 como cualquier ruta desconocida; `GET /candles` no cambia.
- AC 2. Ningún código ni comentario de `backend/src` hace referencia al endpoint eliminado; `calculateEma` se mantiene (lo usan el scanner, los niveles de setup y las alertas de EMA).
- AC 3. `trades` tiene un índice sobre `(broker, closeTime)`. CUANDO se ejecuta la consulta de la lista de trades, del P&L diario o de las estadísticas para un broker ENTONCES PostgreSQL puede resolver el filtro de broker y el rango/orden de `closeTime` con ese índice (comprobado con `EXPLAIN` sobre datos de producción).
- AC 4. `drawings` conserva su restricción única sobre `(userId, broker, symbol, timeframe)` y ya no tiene el índice no único duplicado. Cargar y guardar dibujos se comporta como hoy.
- AC 5. La clave primaria, el índice y la clave foránea de `balances` y `drawings` llevan los nombres que Prisma espera (`balances_pkey`, `balances_broker_timestamp_idx`, `drawings_pkey`, `drawings_userId_fkey`).
- AC 6. La migración se puede aplicar sin riesgo en una base de datos donde alguno de esos objetos ya tenga el nombre nuevo (renombra solo lo que aún tiene el nombre heredado) y no reescribe ni bloquea ninguna tabla más tiempo que la construcción del índice de `trades`.
- AC 7. Tras la migración, `prisma migrate diff` entre la base de datos de producción y `schema.prisma` no reporta diferencias.
- AC 8. No se modifica ni se borra ninguna fila de `trades`, `balances` o `drawings`.

## Fuera de alcance

- Mover el cálculo de EMAs del gráfico al backend (la razón por la que existió el endpoint).
- La zona horaria de `trades.openTime/closeTime` (tabla de contratos de la auditoría; spec candidata aparte).
- Eliminar el índice suelto `(closeTime)` de `trades`: se decide en el diseño tras comprobar qué consultas lo usan.
- Resto de código muerto y documentación (BE-10).
