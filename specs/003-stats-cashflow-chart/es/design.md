# 003 — Stats: rendimiento mensual, flujo de caja y gráfico de balance · Diseño

## Enfoque

Tres capas, cada una con un cambio pequeño, unidas por el camino existente `history.json` → file watcher → servicio:

- **EA**: amplía el filtro de tipo de orden en `WriteHistory()` para que las órdenes de balance/crédito viajen en el mismo array. Sin fichero nuevo ni formato nuevo: el backend ya parsea todos los campos necesarios.
- **Backend**: separa el lote por `type` en el handler de history y guarda las operaciones de balance en su propia tabla. El servicio de stats se reescribe alrededor de una única primitiva, `balanceAt(instante)`, reconstruida hacia atrás desde el último snapshot; el rendimiento del periodo, el mensual y la curva diaria derivan de ella. La búsqueda de snapshot en `balances` desaparece: con los flujos de caja en base de datos la reconstrucción es exacta y funciona para cualquier fecha, no solo desde junio de 2026.
- **Frontend**: añade dos columnas, un tile, un componente `BalanceChart` sobre `lightweight-charts` (ya dependencia) y un layout a dos columnas.

Alternativas descartadas:

- **`balance.json` separado desde el EA**: fichero nuevo, rama nueva del watcher y una segunda semántica de `HISTORY_MAX` sin ganancia. Rechazada.
- **Guardar las operaciones de balance en `trades` con `type = 6`**: todos los consumidores de `trades` (Journal, P&L diario, stats) tendrían que filtrarlas. Una tabla dedicada es más segura.
- **Mantener el snapshot de `balances` como balance inicial cuando exista**: dos caminos de código dando números ligeramente distintos para el mismo periodo según la fecha. La reconstrucción es la única fuente de verdad; los snapshots quedan solo como ancla del "último balance".
- **Construir la curva en cliente desde las operaciones**: exigiría la lista completa en la respuesta. El backend ya tiene todo en memoria para agrupar por día.
- **Rendimiento ponderado por tiempo**: correcto pero más difícil de explicar; el usuario eligió la fórmula simple.

## Archivos afectados

### EA

| Archivo | Cambio |
|---|---|
| `ea/HttpBridgeState.mq4` | `WriteHistory()`: aceptar `OP_BUY`, `OP_SELL`, `OP_BALANCE`, `OP_CREDIT`. |
| `ea/docs/HttpBridgeState.md` | Documentar las entradas de balance/crédito en `history.json`. |

### Backend

| Archivo | Cambio |
|---|---|
| `backend/prisma/schema.prisma` | Añadir modelo `BalanceOperation` → tabla `balance_operations`. |
| `backend/prisma/migrations/20260916000000_add_balance_operations/migration.sql` | `CREATE TABLE balance_operations` + índice. |
| `backend/src/services/balance-operations.ts` | **Nuevo.** `syncBalanceOperations(broker, entries)`: upsert por ticket, `update: {}`. |
| `backend/src/index.ts` | Handler de history: particionar el lote por tipo (`0/1` → `syncTrades`, `6/7` → `syncBalanceOperations`). |
| `backend/src/services/stats.ts` | Reescribir alrededor de `balanceAt`; añadir `cashFlow`, `returnPct`/`cashFlow` por mes, `curve`, `operations`; eliminar la lógica de snapshot `startBalance`/`startBalanceSource`. |

### Frontend

| Archivo | Cambio |
|---|---|
| `frontend/src/features/stats/types.ts` | Actualizar `BrokerStats` y `MonthlyStats`; añadir `CurvePoint`, `BalanceOperation`. |
| `frontend/src/features/stats/MonthlyBreakdown.tsx` + `.module.css` | Columnas / campos de card Return y Cash flow. |
| `frontend/src/features/stats/BalanceChart.tsx` + `.module.css` | **Nuevo.** Gráfico de línea de `curve` con marcadores de operaciones. |
| `frontend/src/features/stats/StatsPage.tsx` + `.module.css` | Tile Cash flow, quitar el aviso de derivado, layout `split` a dos columnas. |

## Modelo de datos / API

### Prisma

```prisma
model BalanceOperation {
  ticket  Int      @id
  broker  String
  type    Int
  amount  Float
  comment String
  time    DateTime

  @@index([broker, time])
  @@map("balance_operations")
}
```

Migración `20260916000000_add_balance_operations`:

```sql
CREATE TABLE "balance_operations" (
  "ticket" INTEGER NOT NULL,
  "broker" TEXT NOT NULL,
  "type" INTEGER NOT NULL,
  "amount" DOUBLE PRECISION NOT NULL,
  "comment" TEXT NOT NULL,
  "time" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "balance_operations_pkey" PRIMARY KEY ("ticket")
);
CREATE INDEX "balance_operations_broker_time_idx" ON "balance_operations"("broker", "time");
```

### Handler de history (`index.ts`)

```ts
watcher?.on('history', async (entries) => {
  const trades = entries.filter(e => e.type === 0 || e.type === 1);
  const ops = entries.filter(e => e.type === 6 || e.type === 7);
  await syncTrades(brokerName, trades);
  await syncBalanceOperations(brokerName, ops);
});
```

`syncBalanceOperations` mapea `{ ticket, type, profit → amount, comment, closeTime → time }`. MT4 rellena `closeTime` en las órdenes de balance con la hora de la operación.

### Respuesta de `GET /stats`

```ts
interface BrokerStats {
  broker: string;
  currency: string;
  period: { from: string | null; to: string | null; months: number };
  trades: number;
  wins: number;
  losses: number;
  netPnl: number;
  cashFlow: number;
  tradesPerMonth: number;
  startBalance: number | null;
  returnPct: number | null;
  monthly: { month: string; trades: number; netPnl: number; cashFlow: number; returnPct: number | null }[];
  curve: { date: string; balance: number }[];          // 'YYYY-MM-DD', uno por día
  operations: { time: string; amount: number; comment: string }[]; // más reciente primero
}
```

Query y validación sin cambios respecto a 002.

### Cálculo (`services/stats.ts`)

Entradas cargadas una vez por petición: `latest` (fila más reciente de `balances` → `balance`, `currency`, `timestamp`), todas las operaciones del broker con `closeTime ≥ periodStart` (neto + closeTime), todas las operaciones de balance con `time ≥ periodStart` (importe + hora). `periodStart = from ?? closeTime más antiguo entre las operaciones del periodo`; `periodEnd = to ?? ahora`.

- `balanceAt(t) = latest.balance − Σ neto(operaciones con closeTime > t) − Σ importe(ops con time > t)`. Implementado con las dos listas ordenadas por tiempo y una suma sufijo, de modo que la curva diaria es O(días + operaciones + ops).
- `startBalance = balanceAt(periodStart)`.
- `netPnl`, `cashFlow`: sumas sobre la ventana `[periodStart, periodEnd]`.
- `returnPct = denom > 0 ? netPnl / denom × 100 : null`, `denom = startBalance + Σ ops positivas − |Σ ops negativas|` = `startBalance + cashFlow`.
- `monthly[m]`: agrupar operaciones y ops por mes UTC; `returnPct` con `balanceAt(inicioDeMes)` y el `cashFlow` de ese mes, misma regla.
- `curve`: para cada día UTC `d` desde `periodStart` hasta `periodEnd`, `{ date, balance: balanceAt(finDeDía(d)) }`. Los días posteriores a `latest.timestamp` se fijan a `latest.balance`.
- `operations`: ops dentro de la ventana, más reciente primero.
- Periodo vacío (sin operaciones y sin `from`): `months = 0`, `monthly = []`, `curve = []`, `startBalance = latest.balance`.

## Componentes

### `BalanceChart`

Props: `curve: CurvePoint[]`, `operations: BalanceOperation[]`, `currency: string`.

- Crea un gráfico `lightweight-charts` al montar con las mismas opciones de layout/crosshair/escala que `LightweightChart` (fondo `#0d0d0d`, texto `--muted`, sin grid, crosshair discontinuo con etiquetas `--orange`), una `LineSeries` en `--blue`, `lineWidth: 2`, `priceFormat: { type: 'price', precision: 2, minMove: 0.01 }`.
- `time` es la cadena `YYYY-MM-DD` (aceptada de forma nativa por la librería como día hábil), así que no se parsea con `Date` en iOS.
- Marcadores con `createSeriesMarkers` (API v5): uno por operación en su día, `position: 'aboveBar'` para depósitos (`--green`, flecha arriba) y `'belowBar'` para retiros (`--red`, flecha abajo), texto = importe con signo y símbolo de divisa.
- `chart.timeScale().fitContent()` tras `setData`; `ResizeObserver` en el contenedor mantiene el ancho; `chart.remove()` al desmontar.
- Altura 280px; contenedor `width: 100%`.

### `MonthlyBreakdown`

Añade dos columnas / campos de card. Return usa `fmtPct` (movido de `StatsPage` a un pequeño `format.ts` en `features/stats/` para que ambos lo usen); Cash flow usa `fmtPnl` y renderiza `—` para `0`.

### `StatsPage`

- Tiles: Trades / month · Return · Net P&L · Cash flow · Trades · Win rate (6 tiles; grid `repeat(6, 1fr)` escritorio, 3 tablet, 2 móvil).
- Debajo: `<div className={styles.split}>` con `MonthlyBreakdown` y `BalanceChart`, `grid-template-columns: 1fr 1fr; gap: 24px`; por debajo de 768px `grid-template-columns: 1fr` con el gráfico primero (`order: -1`).
- Eliminados el aviso de derivado y el uso de `startBalanceSource`.

## Riesgos

- **Cambio de tipo de orden en el EA.** `history.json` crece en el número de operaciones de balance, normalmente un puñado. `HttpBridgeCommands.mq4` no se toca. Un backend que reciba las entradas nuevas antes de su propio deploy intentaría hacer upsert de filas tipo 6 en `trades` con símbolo vacío — inofensivo pero sucio, así que **desplegar el backend antes que el EA**.
- **La reconstrucción depende de que el historial esté completo.** Si MT4 no muestra un depósito (rango de Account History), el balance reconstruido anterior a él se desvía en ese importe. El aviso de la spec 002 desaparece; la mitigación es la exportación de historial completo del EA ya entregada.
- **Retraso del snapshot `latest`.** `balances` se escribe como mucho una vez por ciclo del file watcher; las operaciones cerradas después del último snapshot en el mismo día ya están contabilizadas porque solo entran en las sumas "después de t" cuando `t < closeTime`. Los días posteriores a `latest.timestamp` se fijan para que la curva no derive más allá del ancla.
- **Migración en el deploy.** `CREATE TABLE` aditivo; `prisma migrate deploy` la aplica sin intervención. Sin movimiento de datos.
- **Bundle del gráfico.** `lightweight-charts` ya está en su propio chunk (`manualChunks`); la página Stats no añade chunk nuevo.
- **Zonas horarias.** Todo el agrupado es UTC, consistente con 002 y con los snapshots del backend.
