# 002 — Estadísticas por broker · Diseño

## Enfoque

Un único endpoint nuevo en el backend calcula todo en servidor a partir de `trades` y `balances`; la página del frontend es un consumidor ligero que renderiza tiles y la tabla mensual. La agregación vive en el backend porque `/trades` está limitado a 1000 filas y paginado, de modo que el cliente no puede contar un periodo completo con fiabilidad, y porque la búsqueda del balance inicial necesita la tabla `balances` de todos modos.

La lógica de periodo reutiliza el helper `dateRangeBounds` del Journal, ampliado con tres presets (`this_month`, `this_year`, `last_3_months`). No se reutiliza el panel deslizante `FiltersPanel`: Stats solo necesita dos controles, así que se renderizan inline en la parte superior de la página.

Alternativas descartadas:

- **Calcular en el frontend desde `/trades`**: se rompe con el límite de 1000 filas y necesitaría una segunda llamada para balances. Rechazada.
- **Materializar estadísticas mensuales en una tabla**: prematuro; la consulta es un único agregado indexado sobre como mucho unos miles de filas por broker. Rechazada.
- **Extender `/trades` con un flag `aggregate=1`**: mezcla dos formas de respuesta en una ruta. Una ruta dedicada es más clara.

## Archivos afectados

### Backend

| Archivo | Cambio |
|---|---|
| `backend/src/routes/stats.ts` | **Nuevo.** `GET /stats?broker=&from=&to=` devolviendo el payload de abajo. |
| `backend/src/services/stats.ts` | **Nuevo.** Agregación pura: `computeBrokerStats(broker, from?, to?)`. Contiene la resolución del balance inicial y el agrupado por mes. |
| `backend/src/app.ts` | Montar `statsRouter` en `/stats` con `requireAuth`. |

### Frontend

| Archivo | Cambio |
|---|---|
| `frontend/src/features/journal/utils/dateRange.ts` | Añadir `this_month`, `this_year`, `last_3_months` a `DateRange` y `dateRangeBounds`. |
| `frontend/src/features/journal/FiltersPanel.tsx` | Mover `DATE_RANGE_OPTIONS` a `dateRange.ts` e importarlo, para que el filtro de histórico del Journal y Stats compartan una única lista (el Journal gana los tres presets nuevos gratis). |
| `frontend/src/features/stats/StatsPage.tsx` | **Nuevo.** Página: filtros, fetch, tiles, desglose mensual, estados vacío/cargando/error. |
| `frontend/src/features/stats/StatsFilters.tsx` | **Nuevo.** Select de broker + select de periodo (+ desde/hasta en custom). |
| `frontend/src/features/stats/StatTile.tsx` | **Nuevo.** Una cifra principal con etiqueta, valor, aviso opcional y color según signo. |
| `frontend/src/features/stats/MonthlyBreakdown.tsx` | **Nuevo.** Tabla en escritorio, cards en móvil. |
| `frontend/src/features/stats/*.module.css` | Estilos de los cuatro componentes, usando solo tokens del sistema de diseño. |
| `frontend/src/features/stats/types.ts` | **Nuevo.** Tipo de respuesta `BrokerStats`. |
| `frontend/src/shared/ui/icons.tsx` | Añadir `IconStats` (glifo de barras, 14px, mismo estilo que los demás). |
| `frontend/src/app/Router.tsx` | Añadir ruta `/stats`. |
| `frontend/src/app/layout/AppLayout.tsx` | Añadir entrada `Stats` en la navegación entre Scanner y Settings. |

## Modelo de datos / API

Sin cambios en Prisma.

### `GET /stats`

Query: `broker` (obligatorio), `from` y `to` (instantes ISO opcionales, misma semántica que `/trades`).

Validación: `broker` ausente, o broker sin fila en `balances`, → `400 { error: 'unknown broker' }`.

Respuesta:

```ts
interface BrokerStats {
  broker: string;
  currency: string;
  period: { from: string | null; to: string | null; months: number };
  trades: number;
  wins: number;
  losses: number;
  netPnl: number;
  tradesPerMonth: number;
  startBalance: number | null;
  startBalanceSource: 'snapshot' | 'derived' | 'none';
  returnPct: number | null;
  monthly: { month: string; trades: number; netPnl: number }[]; // month = 'YYYY-MM'
}
```

### Cálculo (`services/stats.ts`)

1. `trades = db.trade.findMany({ where: { broker, closeTime: { gte: from, lte: to } }, select: { profit, swap, commission, closeTime } })`. Neto por operación = `profit + swap + commission`.
2. `wins` = neto > 0, `losses` = neto < 0. Las operaciones con neto cero solo cuentan en `trades`.
3. **Límites del periodo para el agrupado mensual.** `periodStart = from ?? closeTime más antiguo entre las operaciones`; `periodEnd = to ?? ahora`. Si no hay operaciones ni `from`, `months = 0` y `monthly = []`.
4. `months` = número de meses naturales desde `periodStart` hasta `periodEnd` inclusive (`(endY − startY) × 12 + (endM − startM) + 1`). Los meses se calculan en UTC; el snapshot de `balances` y los límites de fecha del Journal también se basan en UTC, así que es consistente con el resto de la app.
5. `monthly` = una entrada por mes en ese rango, en orden ascendente, con ceros donde no cerró ninguna operación.
6. `tradesPerMonth = months > 0 ? trades / months : 0`.
7. **Balance inicial.**
   - `snapshot = db.balance.findFirst({ where: { broker, timestamp: { lte: periodStart } }, orderBy: { timestamp: 'desc' } })`. Solo se intenta cuando hay `from`. Si existe → `startBalance = snapshot.balance`, origen `snapshot`.
   - Si no, `latest = db.balance.findFirst({ where: { broker }, orderBy: { timestamp: 'desc' } })` y `sinceNet = suma del neto de las operaciones con closeTime ≥ periodStart` (coincide con `netPnl` cuando `to` está vacío; cuando hay `to` es un segundo agregado sin límite superior). `startBalance = latest.balance − sinceNet`, origen `derived`.
   - Si falta `latest` (no puede ocurrir tras la validación) → origen `none`.
8. `returnPct = startBalance && startBalance !== 0 ? netPnl / startBalance × 100 : null`.
9. `currency` sale de la última fila de `balances`.

La ruta es un envoltorio fino: parsear query, llamar al servicio, `res.json`.

## Componentes

### `StatsPage`

- Estado: `{ broker, dateRange, dateFrom, dateTo }` en `useLocalStorage('stats.filters', …)`.
- Carga la lista de brokers desde `/balances` una vez (la misma llamada que hace la pestaña `Accounts` del Journal); por defecto `broker` es el primero si el valor guardado está vacío o ya no existe.
- Deriva `{ from, to }` con `dateRangeBounds`, hace fetch a `/stats` cada vez que cambian `broker`, `from` o `to`, con estados cargando / error / vacío al estilo del Journal.
- Renderiza `StatsFilters`, una fila de tiles (`StatTile` × 5) y `MonthlyBreakdown`.
- Cuando `startBalanceSource === 'derived'`, el tile de rendimiento muestra el aviso "Assumes no deposits or withdrawals in the period". Cuando `returnPct === null` el tile muestra `—`.

### `StatsFilters`

Props: `brokers: string[]`, `values: StatsFilterValues`, `onChange`. Dos `<select>` y, cuando `dateRange === 'custom'`, los dos inputs de fecha. Mismos tokens de estilo de input que `FiltersPanel`. Se apila en vertical por debajo de 768px.

### `StatTile`

Props: `label: string`, `value: string`, `tone?: 'positive' | 'negative' | 'neutral'`, `hint?: string`. Panel con fondo `--surface`, borde superior de 3px `--orange`, valor en `--font-mono` a `--text-2xl`, etiqueta a `--text-xs` en mayúsculas con `--tracking-wide`.

### `MonthlyBreakdown`

Props: `rows: BrokerStats['monthly']`, `currency: string`. Escritorio: tabla con Month · Trades · Net P&L, envuelta en `overflow-x: auto`. Móvil (`max-width: 768px`): una card por mes. Etiqueta del mes formateada como `MMM YYYY` desde la cadena `YYYY-MM` sin parsear con `Date` (gotcha de iOS). Reutiliza `fmtPnl` y `currencySymbol` de `journal/utils/position`.

## Riesgos

- **`dateRangeBounds` se comparte con el Journal.** Añadir presets es aditivo; los casos existentes no se tocan. Mover `DATE_RANGE_OPTIONS` solo cambia una ruta de import. Verificar el filtro de histórico del Journal tras el cambio.
- **El balance inicial derivado es una aproximación.** Cualquier depósito o retirada dentro del periodo desvía `returnPct`. El aviso lo hace explícito; es una limitación conocida aceptada en los requisitos.
- **Completitud del histórico de operaciones.** El EA exporta las últimas 50 operaciones cerradas por sincronización, así que una ráfaga de más de 50 cierres entre sincronizaciones dejaría huecos. Comportamiento preexistente, no introducido aquí.
- **Nombres de broker con espacios** (`solidary isa`) viajan como query params; `URLSearchParams` los codifica y Express los decodifica. Igual que `/trades` hoy.
- **Limpieza de `balances`.** Un broker eliminado de la base de datos desaparece del selector; un `broker` guardado que ya no existe cae al primero disponible.
