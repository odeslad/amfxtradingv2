# 007 · BE-04 — Serialización del sync y unicidad del balance diario · Diseño

> Estado: **aprobada**

## Enfoque

Cuatro cambios independientes que preservan el comportamiento en la ruta de escritura, en el orden en que es más seguro desplegarlos:

1. **BD**: `balances.day` + unique `(broker, day)` (migración con relleno y desduplicación).
2. **`saveDailyBalances`** → un único `upsert` sobre la nueva clave, `timestamp` refrescado.
3. **`FileWatcher`** → handlers registrados como callbacks esperados (como `onCandles` hoy) para que el guard `polling` lo cubra todo; memo de `mtime`/`size` por fichero para saltar ficheros de velas sin cambios.
4. **`syncTrades` / `syncBalanceOperations`** → `createMany({ skipDuplicates })` en trozos.

Sin cambios de API, WS ni EA. `GET /balances` devuelve la fila tal como la lee Prisma, así que `day` **aparecería** en la respuesta salvo que se excluya; la ruta recibe un `select` explícito (AC 4).

## 1. Esquema y migración (`[db]`)

```prisma
model Balance {
  id         Int      @id @default(autoincrement())
  broker     String
  day        DateTime @db.Date @default(dbgenerated("CURRENT_DATE"))
  …
  timestamp  DateTime @default(now())

  @@unique([broker, day])
  @@index([broker, timestamp])
  @@map("balances")
}
```

`prisma/migrations/20261001000000_balances_day_unique/migration.sql` (escrita a mano, mismo estilo que las demás):

```sql
ALTER TABLE "balances" ADD COLUMN "day" DATE NOT NULL DEFAULT CURRENT_DATE;
UPDATE "balances" SET "day" = ("timestamp" AT TIME ZONE 'UTC')::date;
-- conserva la fila más reciente por (broker, day); producción tiene 0 duplicados el 2026-10-01, esto es una guarda
DELETE FROM "balances" b
  USING "balances" newer
  WHERE newer."broker" = b."broker" AND newer."day" = b."day" AND newer."id" > b."id";
CREATE UNIQUE INDEX "balances_broker_day_key" ON "balances"("broker", "day");
```

`timestamp` es `TIMESTAMP(3)` sin zona horaria con instantes UTC (BD y Node corren en UTC en el VPS), así que `AT TIME ZONE 'UTC'` es un cast nulo hecho explícito. El relleno de 359 filas es instantáneo. `prisma migrate deploy` lo ejecuta durante el deploy (antes del build, como hoy).

## 2. `services/account.ts`

```ts
const utcDay = (d: Date): Date => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));

export async function saveDailyBalances(broker: string, account: BridgeAccount) {
  const now = new Date();
  const data = { balance: …, equity: …, …, timestamp: now };
  await db.balance.upsert({
    where: { broker_day: { broker, day: utcDay(now) } },
    create: { broker, day: utcDay(now), ...data },
    update: data,
  });
}
```

El `upsert` de Prisma sobre una clave única es un único `INSERT … ON CONFLICT DO UPDATE` en PostgreSQL para casos simples — dos llamadas concurrentes se serializan en el índice, ninguna lanza (AC 3). `timestamp` se escribe en ambas ramas (AC 2), lo que arregla el ancla obsoleta que lee `stats.ts:127` sin tocar su código.

## 3. `bridge/file-watcher.ts`

Sustituir el lado `EventEmitter` de `account`/`history` por callbacks esperados, igual que `onCandles`:

```ts
export type AccountHandler = (account: BridgeAccount) => Promise<void>;
export type HistoryHandler = (entries: BridgeTrade[]) => Promise<void>;

onAccount(handler: AccountHandler) / onHistory(handler: HistoryHandler)

private async poll() {
  if (this.polling) return;
  this.polling = true;
  try {
    await this.runStep('account', () => this.handleAccount());
    await this.runStep('history', () => this.handleHistory());
    await this.readCandles();            // ya espera por fichero; readCandles envuelve cada fichero en runStep también
  } finally { this.polling = false; }
}

private async runStep(label: string, fn: () => Promise<void>) {
  try { await fn(); }
  catch (err) { console.error(`[FILE-WATCHER: ${this.brokerName}] ${label} failed`, err); }
}
```

`index.ts` mueve sus tres registros `watcher.on(...)` a `watcher.onAccount(...)` / `watcher.onHistory(...)`; los cuerpos de los handlers (broadcast WS + persistir) no cambian, su propio `try/catch` puede irse porque `runStep` registra con el mismo prefijo (AC 8). `FileWatcher` deja de extender `EventEmitter` (no existe otro listener — verificado con grep: solo `index.ts` se suscribe).

Salto de ficheros sin cambios (AC 7):

```ts
private readonly seen = new Map<string, { mtimeMs: number; size: number }>();   // nombre → stat

for (const file of files) {
  …
  const stat = fs.statSync(filepath);
  const prev = this.seen.get(file);
  if (prev && prev.mtimeMs === stat.mtimeMs && prev.size === stat.size) continue;
  const data = this.readJson<BridgeCandles>(file);
  if (!data) continue;                                   // lectura/parseo fallido: no memorizar, reintentar en el siguiente poll
  await this.runStep(file, () => this.candlesHandler!({ symbol, timeframe, ...data }));
  this.seen.set(file, { mtimeMs: stat.mtimeMs, size: stat.size });   // memorizar solo tras un handler con éxito
}
```

Memo tras el éxito para que una escritura fallida en BD se reintente en el siguiente poll. El memo es por instancia de `FileWatcher` (por broker). `account.json`/`history.json` no se memorizan: son pequeños y el EA los reescribe cada 60 s igualmente; el coste que importa es el de las velas.

## 4. `services/trades.ts`, `services/balance-operations.ts`

```ts
const CHUNK_SIZE = 5_000;   // constante compartida → mover a un `services/chunk.ts` mínimo usado también por candles

export async function syncTrades(broker: string, trades: BridgeTrade[]) {
  for (const batch of chunks(trades, CHUNK_SIZE)) {
    await db.trade.createMany({ data: batch.map(t => ({ …mismo mapeo… })), skipDuplicates: true });
  }
}
```

Semántica idéntica al `upsert` con `update: {}` de hoy (tickets existentes intactos), una sentencia por cada 5 000 filas en vez de una por fila (AC 6). `services/candles.ts` importa el mismo helper `chunks` en vez de su bucle inline (refactor puro, salida idéntica).

## 5. `routes/balances.ts` y `routes/trades.ts` (`day` no expuesto)

`GET /balances` → añadir `select` con los campos de hoy (todo menos `day`). `routes/trades.ts` ya selecciona solo `broker, currency`. `stats` selecciona explícitamente. Así que una ruta cambia, salida idéntica byte a byte (AC 4) — verificado con el modo `diff` del script de humo de la spec 004 (baseline recapturado sobre el `master` actual primero; `/balances` es volátil allí de todos modos, la comprobación es sobre el conjunto de claves).

## Flujo de datos

Sin cambios: ficheros del EA → watcher → BD. Solo cambian el ritmo (serializado) y el número de sentencias.

## Archivos a tocar

- `backend/prisma/schema.prisma`, `backend/prisma/migrations/20261001000000_balances_day_unique/migration.sql`
- `backend/src/services/account.ts`, `trades.ts`, `balance-operations.ts`, `candles.ts`, nuevo `services/chunk.ts`
- `backend/src/bridge/file-watcher.ts`, `backend/src/index.ts`
- `backend/src/routes/balances.ts`

## Medición (AC 9)

En local, con `new PrismaClient({ log: ['query'] })` activado mediante una variable de entorno que solo se lee si está definida (`PRISMA_LOG=query`, añadida a `db/client.ts`, apagada por defecto), ejecutar el backend contra una copia de los ficheros bridge de un broker (`account.json`, `history.json`, 5 `candles_*.json` de un símbolo) en un directorio `bridge/` desechable referenciado por un `brokers.json` local; contar líneas `INSERT` en tres polls consecutivos antes y después. Esperado: antes ≈ 5 inserts por fichero de velas + 1 por trade en cada poll; después: lo mismo en el primer poll, luego 0 inserts de velas y 1 sentencia de trades por poll mientras los ficheros no cambien.

## Riesgos

- **Migración sobre una tabla viva**: `ALTER … ADD COLUMN` + relleno + índice único sobre 359 filas es subsegundo; el deploy ya para la app antes de migrar.
- **Un duplicado entre el `DELETE` de desduplicación y el `CREATE UNIQUE INDEX`**: imposible — la app está parada durante `migrate deploy`.
- **`createMany` y un trade cuyo `ticket` ya existe con valores distintos**: se salta, exactamente como hacía el `update: {}` antiguo.
- **El memo mantiene saltado un fichero que el EA reescribió con mtime y tamaño idénticos**: el mtime de NTFS tiene resolución de 100 ns y el EA reescribe cada 60 s; mismo mtime *y* tamaño requeriría una reescritura en el mismo tick con longitud idéntica — despreciable, y la siguiente reescritura lo recupera.
- **`FileWatcher` deja de ser `EventEmitter`**: el único suscriptor es `index.ts` (grep), actualizado en el mismo commit.

## Enmienda (aprobada con las tareas)

`day` se crea `NOT NULL DEFAULT CURRENT_DATE` (y se declara `@default(dbgenerated("CURRENT_DATE"))` en Prisma) para poder aplicar la migración por el túnel **antes** de desplegar el código nuevo: el `create` sin `day` del backend en marcha sigue funcionando (la BD rellena la fecha UTC), y el código nuevo escribe siempre `day` explícito. Sin ventana en la que el balance diario deje de guardarse.
