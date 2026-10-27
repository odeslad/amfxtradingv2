# 029 — Rediseño de Stats y filtro por activo · Diseño

## Enfoque

Primero el backend (un `symbol` opcional y la lista de activos operados en `GET /stats`), luego la lista de periodos compartida y después el diseño de la página de Stats. Sin migración de BD, sin cambios en el EA, sin dependencias nuevas.

## Backend

### `GET /stats?broker&from&to&symbol`
- `routes/stats.ts`: lee un `symbol` opcional (`singleQuery`) y lo pasa.
- `services/stats.ts`:
  - `loadMovements(broker, since, symbol?)`: con un símbolo, la consulta de trades añade `symbol` y **no se cargan operaciones de balance** (no pertenecen a ningún activo).
  - `computeBrokerStats` devuelve también `symbols: string[]` — `DISTINCT trade.symbol` del broker, de siempre, ordenado (`db.trade.findMany({ distinct: ['symbol'] })`). Una consulta indexada más; evita un endpoint nuevo.
- `services/stats-core.ts` (puro, con tests):
  - `StatsInput` gana `mode: 'account' | 'asset'`.
  - `MonthlyStats` gana `wins` (win % mensual).
  - Modo activo: `cashFlow = 0`; `startBalance` y `returnPct` (global y mensual) salen del balance y el cash flow de toda la cuenta, pasados como `accountTrades` / `accountOperations` (el servicio también los carga), así que el return es la contribución del activo; y `curve` es el **P&L acumulado de las operaciones del periodo por día** empezando en 0 (misma forma `CurvePoint`, `balance` = P&L acumulado). El modo cuenta no cambia.
  - `BrokerStats` gana `symbol: string | null` y `symbols: string[]`.
- Tests: ampliar `stats-core.test.ts` con el modo activo (curva acumulada, return nulo, wins mensuales).
- Contrato: solo añade (parámetro opcional nuevo, campos nuevos). El frontend actual sigue funcionando.

## Frontend

### Lista de periodos — `features/journal/utils/dateRange.ts` (compartida con el Journal)
- `DateRange` = `'' | 'today' | 'yesterday' | 'last_7_days' | 'last_30_days' | 'last_90_days' | 'last_365_days' | 'custom'`.
- Etiquetas de `DATE_RANGE_OPTIONS`: Hoy, Ayer, Esta semana, Este mes, Este trimestre, Este año, Todo (`''`), Custom.
- Límites móviles: `from = inicioDeHoy − (N − 1) días`, sin `to` (AC 4).
- `normalizeDateRange(value)`: un valor guardado que no esté en la lista → `''` (Todo). Se usa donde el Journal y Stats leen sus filtros de `localStorage` (AC 4a).
- Custom: la fecha Hasta se limita a hoy al cambiarla (`IsoDateField` no tiene `max`; limitarla es lo más simple).
- El panel de filtros del Journal mantiene su select y simplemente muestra la lista nueva.

### Página de Stats — `features/stats/`
- `PeriodTabs.tsx` (nuevo): pestañas Hoy · Ayer · Esta semana · Este mes (móvil: Hoy · Ayer · Semana · Mes) + una pestaña "Más ▾" con el menú propio de la app (Este trimestre, Este año, Todo, Custom). La pestaña mantiene "Más ▾" y se activa cuando una de sus opciones está elegida. Comportamiento del menú copiado de `book/OlderYearsTab.tsx` (cierra con clic fuera / Esc, scrollbar oscura fina); queda como componente de stats — sin abstracción compartida prematura.
- `StatsFilters.tsx`: pestañas de periodo a la izquierda; selects Broker y **Activo** a la derecha (móvil: Broker/Activo lado a lado encima de las pestañas). Activo = "Todos" + `stats.symbols` filtrados con `isSymbolVisible`. Custom muestra Desde/Hasta bajo la barra.
- `StatsFilterValues` gana `symbol` (`''` = Todos); se guarda en `stats.filters` como hoy. Si los `symbols` cargados no incluyen el símbolo guardado → se trata como `''` (AC 8).
- `StatsPage.tsx`: envía `symbol` cuando hay; sustituye los seis `StatTile` por una **franja de totales** (`StatsTotals.tsx`, nuevo) como en Esquemas: franja en desktop (Trades, Win rate, Trades/mes, Cash flow | Return, Net P&L en grande); bloque en móvil (Net P&L + Return en grande, luego una fila de 4 columnas). Con un activo, Cash flow y Return muestran "—".
- Diseño (desktop): la página pasa a ser una columna flex de alto completo; bajo la franja, un grid `2fr 1fr` que ocupa el alto restante de la ventana: `BalanceChart` llena su celda (alto 100 %), `MonthlyBreakdown` hace scroll dentro de la suya. Móvil: gráfico (alto fijo) y después los meses como tarjetas.
- `BalanceChart`: título "Balance" o "P&L acumulado · <SÍMBOLO>"; debe ajustarse al alto de su contenedor (hoy tiene alto fijo — pasar a un alto con `ResizeObserver` o `autoSize`).
- `MonthlyBreakdown`: columnas Mes, Trades, Win %, Net P&L (las columnas Cash flow / Return % salen de la tabla — van en la franja); tarjetas en móvil (mes + trades, win %, net).
- `StatTile.tsx` se elimina si nada más lo usa.

## Flujo de datos

Filtros (localStorage) → `GET /stats?broker&from&to[&symbol]` → `computeBrokerStats` (modo activo con `symbol`) → `{ …stats, symbol, symbols }` → franja de totales, gráfico, tabla mensual; `symbols` alimenta el select Activo.

## Archivos

- backend: `src/routes/stats.ts`, `src/services/stats.ts`, `src/services/stats-core.ts`, `src/services/stats-core.test.ts`
- frontend: `features/journal/utils/dateRange.ts`, `features/journal/JournalPage.tsx` (normalizar periodo guardado), `features/stats/StatsPage.tsx` + `.module.css`, `StatsFilters.tsx` + css, `PeriodTabs.tsx` (nuevo), `StatsTotals.tsx` + css (nuevo), `MonthlyBreakdown.tsx` + css, `BalanceChart.tsx` + css, `types.ts`

## Alternativas consideradas

- **Calcular las stats por activo en el frontend** desde `/trades`: sin cambio de backend, pero duplica los cálculos y carga todas las operaciones. Descartada.
- **Un endpoint `/stats/symbols`**: separa mejor, una petición más por cambio de broker. Descartada a favor del campo en la respuesta de stats.
- **Lista de periodos separada para Stats**: descartada — el usuario quiere la misma lista en el Journal.

## Riesgos

- Filtros guardados con periodos eliminados (`last_week`, `this_month`, …): resuelto con `normalizeDateRange`.
- Las etiquetas pasan a español también en el select de periodo del Journal (el resto del Journal sigue en inglés).
- Orden de despliegue: backend primero (solo añade), luego frontend.
