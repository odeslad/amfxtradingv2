# 007 · BE-04 — Serialización del sync y unicidad del balance diario

> Estado: **aprobada**
> Origen: [auditoría del backend 2026-09-30](../../../reports/2026-09-30-backend.md), mejora 4 (diagnóstico E)

## Contexto

Cada 30 s por broker el `FileWatcher` lee `account.json`, `history.json` y todos los `candles_*.json` y los persiste. Se encontraron cuatro debilidades: (1) `saveDailyBalances` es check-then-act (`findFirst` de hoy → `update` o `create`) sin clave única, así que dos llamadas solapadas para el mismo broker en la primera escritura del día crean dos filas — el punto "duplicate balance records" de `.claude/CLAUDE.md`; un recuento en producción el 2026-10-01 muestra **0 duplicados** en 359 filas, así que esto es prevención, no reparación; (2) el guard `polling` del watcher solo cubre las velas — los handlers de `account` e `history` son listeners `async` que nadie espera, así que una BD lenta permite que los syncs se solapen; (3) `syncTrades` y `syncBalanceOperations` emiten un `upsert` secuencial por fila con `update: {}` (semántica insert-only) — ~50 viajes por broker por ciclo, miles al arrancar el EA — cuando un único `createMany({ skipDuplicates })` hace lo mismo; (4) cada `candles_*.json` se parsea y reinserta (`createMany skipDuplicates`, ~7 500 búsquedas de clave por broker por ciclo) aunque el EA solo lo reescribe cada 60 s, así que la mitad de los ciclos repiten trabajo idéntico. Además, `Balance.timestamp` nunca se actualiza en el `update` diario, pero `stats.ts` usa el `timestamp` de la última fila como ancla del balance. El VPS ejecuta Node y PostgreSQL en UTC; el límite del día pasa a ser UTC explícito para que el desarrollo local (Europe/Madrid) se comporte igual.

## Capas afectadas

- db (esquema + migración)
- backend

## Historias de usuario

- Como operador, quiero una fila de balance por broker y día UTC impuesta por la base de datos, para que los duplicados sean imposibles en vez de improbables.
- Como operador, quiero que el sync de 30 s haga solo el trabajo que cambió, para que la carga de BD se mantenga plana aunque crezcan el histórico y los símbolos.
- Como operador, quiero que los syncs nunca se solapen, para que una base de datos lenta no se convierta en escrituras en carrera.

## Criterios de aceptación

- AC 1. CUANDO se migra el esquema ENTONCES `balances` tiene una columna `day DATE NOT NULL` y una restricción única sobre `(broker, day)`; las filas existentes reciben `day = date(timestamp AT TIME ZONE 'UTC')`; si existen duplicados en el momento de migrar se conserva el de mayor `id` por `(broker, day)` y se borran los demás, antes de añadir la restricción.
- AC 2. CUANDO corre `saveDailyBalances` ENTONCES realiza un único `upsert` con clave `(broker, day)` con `day` = fecha UTC actual, y pone `timestamp = now()` tanto al crear como al actualizar.
- AC 3. CUANDO dos llamadas a `saveDailyBalances` para el mismo broker corren concurrentemente en un día nuevo ENTONCES después existe exactamente una fila y ninguna de las dos lanza.
- AC 4. CUANDO se llama a `GET /balances`, `GET /balances/daily-pnl`, `GET /stats` y `GET /trades` ENTONCES sus respuestas no cambian en forma ni valores (`day` no se expone; `timestamp` refleja ahora la última escritura, que es el ancla prevista para stats).
- AC 5. CUANDO el watcher sondea ENTONCES los handlers de `account` e `history` se esperan dentro del poll, de modo que un ciclo no empieza mientras los handlers del anterior siguen corriendo; el intervalo de 30 s sigue saltando ticks mientras un poll está en curso.
- AC 6. CUANDO corren `syncTrades` / `syncBalanceOperations` ENTONCES emiten un `createMany({ skipDuplicates: true })` por llamada (en trozos de 5 000 filas como las velas); las filas ya presentes no se tocan (misma semántica insert-only que hoy).
- AC 7. CUANDO un fichero `candles_*.json` tiene el mismo `mtime` y tamaño que en el poll anterior de ese broker ENTONCES no se lee, ni se parsea, ni se escribe; cuando cambió, el comportamiento es el de hoy. El primer poll tras el arranque procesa todos los ficheros.
- AC 8. CUANDO un handler lanza ENTONCES el error se registra con el prefijo del broker (como hoy) y el poll continúa con el siguiente fichero/handler; el flag `polling` se libera siempre.
- AC 9. CUANDO se despliega el cambio ENTONCES se registra evidencia de la reducción sin `pg_stat_statements`: recuento de sentencias `INSERT` por ciclo desde el log de queries de Prisma (`log: ['query']` activado en local solo para la medición) antes y después.

## Fuera de alcance

- Leer `positions.json` o cualquier cambio en el EA.
- Cambiar la estrategia de escritura de velas más allá de saltar ficheros sin cambios (p. ej. insertar solo las últimas N barras).
- Añadir `(broker, closeTime)` y quitar el índice redundante de `drawings` (mejora 9 de la auditoría).
- Arreglar las convenciones de tiempo (offset del broker en velas/trades).
- Retención/limpieza de velas antiguas.
