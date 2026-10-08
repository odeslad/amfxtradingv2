# 014 · BE-09 — Índices de consulta y nombres heredados · Diseño

> Status: **approved**

## Enfoque

Dos cambios independientes que no alteran el comportamiento:

1. **`[backend]`** borrar el handler de `GET /candles/emas`.
2. **`[db]`** una migración escrita a mano que añade el índice de trades, elimina el índice duplicado de drawings y renombra los cuatro objetos heredados, más la edición correspondiente de `schema.prisma`.

La migración se ejecuta durante el deploy (`deploy.ps1` → `prisma migrate deploy`, antes del build y del reinicio) mientras el backend **antiguo** sigue sirviendo. Nada en ella cambia una columna, una fila o un nombre al que se refiera el código de la aplicación, así que el proceso antiguo sigue funcionando durante todo el deploy y el rollback de `dist` del deploy nunca tiene que deshacerla.

## 1. `routes/candles.ts` (`[backend]`)

Eliminar el handler de `/emas`, su comentario y el import de `calculateEma`, que queda sin uso. `GET /candles` y `MAX_LIMIT` se quedan como están. Express responde 404 para la ruta eliminada por el fallthrough existente (AC 1).

`calculateEma` conserva sus tres consumidores (`services/scanner.ts`, `routes/setup-levels.ts`, `alerts/ema-alert-evaluator.ts`) y sus tests (AC 2). `backend/docs/architecture.md` no menciona el endpoint; la tabla desactualizada que hay allí es asunto de BE-10.

## 2. Esquema (`[db]`)

```prisma
model Trade {
  …
  @@index([broker, symbol])
  @@index([broker, closeTime])   // nuevo
  @@index([closeTime])           // se mantiene — ver abajo
  @@map("trades")
}

model Drawing {
  …
  @@unique([userId, broker, symbol, timeframe])
  // @@index([userId, broker, symbol, timeframe]) eliminado
  @@map("drawings")
}
```

### Qué consulta de trades usa qué índice

| Consulta | Filtro | Orden | Índice tras esta spec |
|---|---|---|---|
| `GET /trades` (Journal, por defecto) | `broker`, `symbol` opcional, rango de `closeTime` opcional | `closeTime desc` | `(broker, closeTime)` — el rango y el orden salen del mismo índice; `symbol` se filtra sobre los pocos cientos de filas que devuelve |
| `GET /trades` sin broker | rango de `closeTime` opcional | `closeTime desc` | `(closeTime)` — por eso se mantiene el índice suelto |
| `GET /balances/daily-pnl` | `broker`, `closeTime >= medianoche` | — | `(broker, closeTime)` |
| `services/stats.ts` | `broker`, rango de `closeTime` opcional | `closeTime asc` | `(broker, closeTime)` |

`(broker, symbol)` no tiene hoy ningún lector (`GET /trades?broker&symbol` se sirve bien con `(broker, closeTime)` + filtro al tamaño de esta tabla), pero eliminarlo no está en el alcance de BE-09 y no cuesta nada medible; se queda.

### Migración `prisma/migrations/20261006000000_query_indexes_legacy_names/migration.sql`

```sql
-- Spec 014 · BE-09. Index the way trades are queried, drop the index that duplicated
-- the drawings unique constraint, and give the objects renamed with the
-- account_snapshots → balances and trendlines → drawings table renames the names
-- Prisma derives from schema.prisma. Every statement is a no-op when the object
-- already has its final name, so the migration is safe on any copy of the database.

CREATE INDEX IF NOT EXISTS "trades_broker_closeTime_idx" ON "trades"("broker", "closeTime");

DROP INDEX IF EXISTS "drawings_userId_broker_symbol_timeframe_idx";

ALTER INDEX IF EXISTS "account_snapshots_broker_timestamp_idx" RENAME TO "balances_broker_timestamp_idx";
ALTER SEQUENCE IF EXISTS "account_snapshots_id_seq" RENAME TO "balances_id_seq";
ALTER SEQUENCE IF EXISTS "trendlines_id_seq" RENAME TO "drawings_id_seq";

-- Drift found by `prisma migrate diff` on 2026-10-07 (design amendment, see below)
ALTER TABLE "settings_mirror" ALTER COLUMN "updatedAt" DROP DEFAULT;
ALTER TABLE "settings_display" ALTER COLUMN "updatedAt" DROP DEFAULT;
ALTER TABLE "users" ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMP(3);

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'account_snapshots_pkey') THEN
    ALTER TABLE "balances" RENAME CONSTRAINT "account_snapshots_pkey" TO "balances_pkey";
  END IF;
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'trendlines_pkey') THEN
    ALTER TABLE "drawings" RENAME CONSTRAINT "trendlines_pkey" TO "drawings_pkey";
  END IF;
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'trendlines_userId_fkey') THEN
    ALTER TABLE "drawings" RENAME CONSTRAINT "trendlines_userId_fkey" TO "drawings_userId_fkey";
  END IF;
END $$;
```

Notas:

- Las claves primarias se renombran con `RENAME CONSTRAINT`, que renombra también el índice que las respalda. `ALTER TABLE … RENAME CONSTRAINT` no admite `IF EXISTS`, de ahí el bloque `DO` (AC 6).
- Las secuencias se renombran por coherencia con la tabla; los defaults de las columnas las referencian por OID, así que el renombrado no puede romper los inserts. `prisma migrate diff` no compara nombres de secuencias, así que esas dos líneas son cosméticas.
- Los nombres heredados esperados salen del historial de migraciones: `20260617171733_init` creó `account_snapshots_pkey` y `account_snapshots_broker_timestamp_idx`, `20260623000000_add_trendlines` creó `trendlines_pkey` y `trendlines_userId_fkey`, y los dos renombrados de tabla solo renombraron la tabla (más los dos índices `trendlines_*` único/no único). **La tarea 2 confirma los nombres reales en producción por el túnel de BD antes de commitear la migración**; si producción tuviera un nombre que esta lista no recoge, la migración recibe una sentencia protegida más.
- `CREATE INDEX` sin `CONCURRENTLY` (Prisma envuelve la migración en una transacción) toma un bloqueo `SHARE` sobre `trades` durante la construcción. La tabla tiene unos miles de filas, así que el bloqueo dura milisegundos; el `createMany` de 30 s del watcher o lo precede o lo sigue (AC 6). Los renombrados toman un bloqueo `ACCESS EXCLUSIVE` para una actualización de catálogo: instantáneo.
- Ningún `UPDATE`/`DELETE` en ninguna parte (AC 8).

**Enmienda (2026-10-07, tarea 2).** Los nombres de producción coincidían exactamente con la lista de arriba, pero el `migrate diff` reveló además tres desviaciones fuera del punto de la auditoría, dejadas por migraciones escritas a mano: `settings_mirror.updatedAt` y `settings_display.updatedAt` tienen un `DEFAULT CURRENT_TIMESTAMP` que el schema no declara (Prisma rellena `@updatedAt` en cada escritura, tanto en el backend antiguo como en el nuevo, así que el default no se usa), y `users.createdAt` es `TIMESTAMPTZ(6)` donde el schema dice `TIMESTAMP(3)` (1 fila; el VPS corre en UTC, así que el instante guardado no cambia). El usuario decidió alinearlas en la misma migración para que el AC 7 se cumpla literalmente. Las tres sentencias también son inofensivas sobre una base de datos ya alineada. Se añade `prisma/migrations/migration_lock.toml` (archivo estándar de Prisma que faltaba en el repo) para que `migrate diff --from-migrations` pueda reproducir el historial en una shadow database.

### Verificación del estado del esquema

Antes y después de la migración, por el túnel (`DATABASE_URL` en el puerto local 5434):

```bash
npx prisma migrate diff --from-url "$DATABASE_URL" --to-schema-datamodel prisma/schema.prisma --script
```

Antes: la salida debe contener exactamente los renombrados y cambios de índice que hace esta migración (esa es la evidencia de que los nombres heredados son los que el diseño espera). Después: `-- This is an empty migration.` (AC 7).

Uso del índice (AC 3), tras el deploy, con un broker real:

```sql
EXPLAIN SELECT * FROM "trades" WHERE "broker" = 'FTMO' AND "closeTime" >= now() - interval '30 days'
ORDER BY "closeTime" DESC LIMIT 200;
```

El plan debe mostrar `Index Scan Backward using trades_broker_closeTime_idx`.

## Archivos

| Archivo | Cambio |
|---|---|
| `backend/src/routes/candles.ts` | quitar `/emas`, su comentario y el import de `calculateEma` |
| `backend/prisma/schema.prisma` | índice añadido en `Trade`, índice eliminado en `Drawing` |
| `backend/prisma/migrations/20261006000000_query_indexes_legacy_names/migration.sql` | nuevo |
| `backend/prisma/migrations/migration_lock.toml` | nuevo (enmienda) |
| `reports/2026-09-30-backend.md` | columna `Spec` de BE-09 → `014` (al crear la spec), `014 ✅` al cerrar |

## Riesgos

- **Producción tiene un nombre heredado que este diseño no lista** → `migrate diff` sigue mostrando un renombrado tras el deploy. Mitigado por la comprobación previa de la tarea 2; el arreglo sería una sentencia protegida más en la misma migración antes de enviarla.
- **Un cliente que aún llame a `/candles/emas`** → 404. Verificado que no existe ninguno (grep del frontend, historial git: el único consumidor se fue con la página de backtest en la spec 001).
- **La migración falla a medias** → Prisma revierte la transacción y el deploy se detiene antes de tocar `dist`; el backend antiguo sigue funcionando (comportamiento de la spec 005).

## Alternativas consideradas

- **`CREATE INDEX CONCURRENTLY`** — evita el bloqueo de escritura pero no puede ejecutarse dentro de la transacción de migración de Prisma; no compensa un paso manual para una tabla de este tamaño.
- **Renombrar solo las claves primarias y dejar la fk/el índice** — `migrate diff` seguiría sucio; el sentido del punto es un diff limpio.
- **Eliminar también `(broker, symbol)` y `(closeTime)`** — `(closeTime)` tiene un lector; `(broker, symbol)` queda fuera del alcance de la auditoría.
