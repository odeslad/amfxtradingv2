# 040 — Estado de las herramientas del chart recordado por chart · Diseño

## Enfoque

Un hook, `useChartToolState(side)`, es dueño de los tres conmutadores por lado de la toolbar (candado, EMA cross trades, modo Positions) sobre el `useLocalStorage` existente, con las claves de almacenamiento que el candado y el overlay ya usan y un par nuevo para Positions. `ChartSlot` sustituye sus dos llamadas a `useLocalStorage` y el `useState` de `positionsMode` por ese hook; todo lo que hay aguas abajo (props de la toolbar, posiciones filtradas, `showNewTrade`) sigue igual. Sin cambio visual, sin backend.

## Alternativas

- **Un objeto JSON por lado** (`chart.tools.left = { locked, emaTrades, positions }`): claves más ordenadas, pero exige migrar las cuatro claves ya guardadas en los navegadores de los usuarios o perderlas. Descartado: el AC 4 pide conservar las claves actuales.
- **Seguir añadiendo llamadas a `useLocalStorage` en `ChartSlot`**: funciona, pero la cuarta copia del mismo cableado `KEY[side]` es justo lo que la spec quiere evitar. Descartado.

## Cambios por capa

### frontend

**`features/chart/useChartToolState.ts`** (nuevo)
- `export type ChartSide = 'left' | 'right'` se mueve aquí desde `ChartSlot` (reexportado allí para que `ChartPage` lo siga importando de `./ChartSlot`).
- `const TOOL_KEYS: Record<ToolKey, Record<ChartSide, string>>` → `locked`: `chart.locked` / `chart.locked.right`; `emaTrades`: `chart.emaTrades` / `chart.emaTrades.right`; `positions`: `chart.positions` / `chart.positions.right`.
- `useChartToolState(side)` devuelve `{ locked, setLocked, emaTradesOn, setEmaTradesOn, positionsMode, setPositionsMode }`, cada par desde `useLocalStorage(TOOL_KEYS[tool][side], default)`.
- Validación del modo Positions (AC 5): `useLocalStorage` ya cae al valor por defecto con JSON ausente o corrupto, pero una cadena guardada fuera de `none | all | buys | sells` pasaría el parseo; el hook devuelve `'none'` ante cualquier valor desconocido al leer (`isPositionsMode(value) ? value : 'none'`).

**`features/chart/ChartSlot.tsx`**
- Sustituir `useLocalStorage(LOCK_KEY[side], false)`, `useLocalStorage(EMA_TRADES_KEY[side], false)` y `useState<PositionsMode>('none')` por el hook; eliminar `LOCK_KEY` y `EMA_TRADES_KEY`.
- `cyclePositions` conserva `POSITIONS_MODE_CYCLE`, ahora a través del `setPositionsMode(prev => …)` del hook. La toolbar, `chartPositions` y `showNewTrade` leen `positionsMode` como hoy.
- `toggleDrawMode` sigue desbloqueando (`setLocked(false)`), que también se persiste, como hoy.

**`features/chart/ChartToolbar.tsx`, `ChartPage.tsx`** · sin cambios: las props son los mismos valores.

## Flujo de datos

Solo navegador: `localStorage` ⇄ `useChartToolState` ⇄ props de `ChartSlot`. Nada sale del navegador.

## Riesgos

- **Cambio de selección** (AC 3): el estado se indexa por lado, no por selección, así que sobrevive a cambios de broker / símbolo / timeframe; es el comportamiento buscado y coincide con el candado actual.
- **Posiciones restauradas al cargar**: `chartPositions` filtra la lista de posiciones del WS; en el primer render la lista puede estar vacía hasta que llega la petición, así que el chart muestra las posiciones un instante después, como hoy cuando el usuario cicla el botón.

## Maqueta

Sin pantalla ni estado nuevos: la toolbar, el botón y las posiciones pintadas se ven exactamente como hoy; el único cambio es que el modo Positions vuelve tras recargar. Acordado con el usuario el 2026-11-09 que no hace falta canvas (referencia: la toolbar actual del chart y el ciclo del botón Positions).
