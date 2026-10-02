# 007 · BE-04 — Sync serialization and daily balance uniqueness · Design

> Status: **approved**

## Approach

Four independent, behaviour-preserving changes on the write path, in the order they are safest to ship:

1. **DB**: `balances.day` + unique `(broker, day)` (migration with backfill and dedupe).
2. **`saveDailyBalances`** → single `upsert` on the new key, `timestamp` refreshed.
3. **`FileWatcher`** → handlers registered as awaited callbacks (like `onCandles` today) so the `polling` guard covers everything; per-file `mtime`/`size` memo to skip unchanged candle files.
4. **`syncTrades` / `syncBalanceOperations`** → chunked `createMany({ skipDuplicates })`.

No API, WS or EA change. `GET /balances` returns the row as Prisma reads it, so `day` **would** appear in the response unless excluded; the route gets an explicit `select` (AC 4).

## 1. Schema and migration (`[db]`)

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

`prisma/migrations/20261001000000_balances_day_unique/migration.sql` (hand-written, same style as the others):

```sql
ALTER TABLE "balances" ADD COLUMN "day" DATE NOT NULL DEFAULT CURRENT_DATE;
UPDATE "balances" SET "day" = ("timestamp" AT TIME ZONE 'UTC')::date;
-- keep the newest row per (broker, day); production has 0 duplicates on 2026-10-01, this is a guard
DELETE FROM "balances" b
  USING "balances" newer
  WHERE newer."broker" = b."broker" AND newer."day" = b."day" AND newer."id" > b."id";
CREATE UNIQUE INDEX "balances_broker_day_key" ON "balances"("broker", "day");
```

`timestamp` is `TIMESTAMP(3)` without time zone holding UTC instants (DB and Node run in UTC on the VPS), so `AT TIME ZONE 'UTC'` is a no-op cast made explicit. Backfill of 359 rows is instantaneous. `prisma migrate deploy` runs it during the deploy (before the build, as today).

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

Prisma's `upsert` on a unique key is a single `INSERT … ON CONFLICT DO UPDATE` in PostgreSQL for simple cases — two concurrent calls serialize on the index, neither throws (AC 3). `timestamp` is written on both branches (AC 2), fixing the stale anchor read by `stats.ts:127` without changing its code.

## 3. `bridge/file-watcher.ts`

Replace the `EventEmitter` side for `account`/`history` with awaited callbacks, mirroring `onCandles`:

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
    await this.readCandles();            // already per-file awaited; readCandles wraps each file in runStep too
  } finally { this.polling = false; }
}

private async runStep(label: string, fn: () => Promise<void>) {
  try { await fn(); }
  catch (err) { console.error(`[FILE-WATCHER: ${this.brokerName}] ${label} failed`, err); }
}
```

`index.ts` moves its three `watcher.on(...)` registrations to `watcher.onAccount(...)` / `watcher.onHistory(...)`; the handler bodies (WS broadcast + persist) are unchanged, their own `try/catch` can go since `runStep` logs with the same prefix (AC 8). `FileWatcher` stops extending `EventEmitter` (no other listener exists — verified by grep: only `index.ts` subscribes).

Unchanged-file skip (AC 7):

```ts
private readonly seen = new Map<string, { mtimeMs: number; size: number }>();   // filename → stat

for (const file of files) {
  …
  const stat = fs.statSync(filepath);
  const prev = this.seen.get(file);
  if (prev && prev.mtimeMs === stat.mtimeMs && prev.size === stat.size) continue;
  const data = this.readJson<BridgeCandles>(file);
  if (!data) continue;                                   // read/parse failed: do not memo, retry next poll
  await this.runStep(file, () => this.candlesHandler!({ symbol, timeframe, ...data }));
  this.seen.set(file, { mtimeMs: stat.mtimeMs, size: stat.size });   // memo only after a successful handler
}
```

Memo after success so a failed DB write is retried on the next poll. The memo is per `FileWatcher` instance (per broker). `account.json`/`history.json` are not memoised: they are small and the EA rewrites them every 60 s anyway; the cost that matters is candles.

## 4. `services/trades.ts`, `services/balance-operations.ts`

```ts
const CHUNK_SIZE = 5_000;   // shared constant → move to a tiny `services/chunk.ts` used by candles too

export async function syncTrades(broker: string, trades: BridgeTrade[]) {
  for (const batch of chunks(trades, CHUNK_SIZE)) {
    await db.trade.createMany({ data: batch.map(t => ({ …same mapping… })), skipDuplicates: true });
  }
}
```

Identical semantics to today's `upsert` with `update: {}` (existing tickets untouched), one statement per 5 000 rows instead of one per row (AC 6). `services/candles.ts` imports the same `chunks` helper instead of its inline loop (pure refactor, output identical).

## 5. `routes/balances.ts` and `routes/trades.ts` (`day` not exposed)

`GET /balances` → add `select` listing today's fields (everything except `day`). `routes/trades.ts` already selects `broker, currency` only. `stats` selects explicitly. So one route changes, byte-identical output (AC 4) — verified with the spec-004 smoke script's `diff` mode (baseline re-captured on current `master` first, since `/balances` is volatile there anyway; the check is on the key set).

## Data flow

Unchanged: EA files → watcher → DB. Only timing (serialized) and statement count change.

## Files to touch

- `backend/prisma/schema.prisma`, `backend/prisma/migrations/20261001000000_balances_day_unique/migration.sql`
- `backend/src/services/account.ts`, `trades.ts`, `balance-operations.ts`, `candles.ts`, new `services/chunk.ts`
- `backend/src/bridge/file-watcher.ts`, `backend/src/index.ts`
- `backend/src/routes/balances.ts`

## Measurement (AC 9)

Locally, with `new PrismaClient({ log: ['query'] })` enabled through an env flag read only when set (`PRISMA_LOG=query`, added to `db/client.ts`, off by default), run the backend against a copy of one broker's bridge files (`account.json`, `history.json`, 5 `candles_*.json` for one symbol) placed in a scratch `bridge/` dir referenced by a local `brokers.json`; count `INSERT` lines over three consecutive polls before and after. Expected: before ≈ 5 inserts/candle-file + 1/trade per poll every poll; after: same on the first poll, then 0 candle inserts and 1 trades statement per poll while files are unchanged.

## Risks

- **Migration on a live table**: `ALTER … ADD COLUMN` + backfill + unique index on 359 rows is sub-second; the deploy already stops the app before migrating.
- **A duplicate appearing between the dedupe `DELETE` and the `CREATE UNIQUE INDEX`**: impossible — the app is stopped during `migrate deploy`.
- **`createMany` and a trade whose `ticket` already exists with different values**: skipped, exactly as the old `update: {}` did.
- **Memo keeps a file skipped after the EA rewrote it with identical mtime and size**: NTFS mtime has 100 ns resolution and the EA rewrites every 60 s; same mtime *and* size would need a rewrite within the same tick with identical length — negligible, and the next rewrite catches up.
- **`FileWatcher` no longer an `EventEmitter`**: the only subscriber is `index.ts` (grep), updated in the same commit.

## Amendment (approved with the tasks)

`day` is created `NOT NULL DEFAULT CURRENT_DATE` (and declared `@default(dbgenerated("CURRENT_DATE"))` in Prisma) so the migration can be applied over the tunnel **before** the new code is deployed: the running backend's `create` without `day` keeps working (the DB fills the UTC date), and the new code always writes `day` explicitly. No window where daily balances fail to save.
