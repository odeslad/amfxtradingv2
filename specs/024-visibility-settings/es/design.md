# 024 — Ocultar brokers y símbolos desde Settings · Diseño

## Enfoque

Dos listas guardadas con los ajustes globales de visualización y un almacén en el frontend que
consulta todo componente que pinta listas. Sin endpoint nuevo: `GET /settings` / `PUT /settings` ganan
un objeto `visibility`. El almacén es externo (`useSyncExternalStore`, el patrón del flujo de posiciones
en vivo), se carga una vez por sesión y se refresca cuando Settings guarda, así que un cambio se propaga
a las páginas abiertas sin recargar. El filtrado ocurre en los bordes (las listas y filas que pinta un
componente), nunca en los flujos, así que los brokers ocultos siguen con sus posiciones, alertas y
notificaciones en marcha.

Alternativa considerada: `localStorage` por dispositivo — descartada por el usuario (debe seguirle
entre PC y móvil).

## Datos (db)

Migración `20261025000000_visibility`: `settings_display` + `hiddenBrokers TEXT[] NOT NULL DEFAULT '{}'`
y `hiddenSymbols JSONB NOT NULL DEFAULT '{}'`. Prisma: `hiddenBrokers String[] @default([])`,
`hiddenSymbols Json @default("{}")`. `prisma migrate diff` contra producción debe imprimir exactamente esto.

## Backend

`routes/settings.ts`: `parseVisibility(value)` → `{ hiddenBrokers: string[], hiddenSymbols:
Record<string, string[]> }` (arrays de cadenas no vacías, recortadas, sin duplicados, símbolos en
mayúsculas; las claves del objeto son brokers); `PUT` acepta un `visibility` opcional y lo guarda con la
fila de display; `GET` y `PUT` responden `visibility` junto a `display` (por defecto `[]` / `{}`). Los
brokers / símbolos desconocidos se conservan tal cual (CA 2). Documentación: línea de la tabla de settings
en `architecture.md` y nota de modelos en `.claude/CLAUDE.md`.

## Frontend

### `lib/visibility.ts` (almacén externo)

```ts
interface Visibility { hiddenBrokers: string[]; hiddenSymbols: Record<string, string[]> }
loadVisibility()                     // GET /settings → almacén (una vez desde AppLayout)
setVisibility(v)                     // tras guardar Settings
useVisibility(): Visibility          // useSyncExternalStore
isBrokerVisible(v, broker)           // helpers puros, usables fuera de React
isSymbolVisible(v, broker, symbol)
visibleBrokers(v, brokers)           // conserva el orden
visibleSymbols(v, broker, symbols)
```

Brokers comparados tal como los da la API (mismas cadenas en todas partes); símbolos en mayúsculas.

### Settings: pestaña Visibility

`features/settings/VisibilityTab.tsx`: tabla (Broker, toggle Visible, Account, recuento de Symbols, botón
Symbols) en escritorio, filas apiladas con el botón debajo en móvil (patrones de
`SettingsPage.module.css`). El estado vive en `SettingsPage` junto a mirror / display (estado de
formulario `visibility`, `dirty`, un Save → `PUT /settings { mirror, display, visibility }` →
`setVisibility(guardado)`). Los recuentos de símbolos necesitan la lista de cada broker: se carga de forma
perezosa por broker la primera vez que se pinta su fila (`/symbols?broker=`), cacheada en la pestaña.

`features/settings/SymbolsPanel.tsx` (+ `.module.css`): panel lateral derecho sobre el armazón de
`BulkEditPanel.module.css`: título "Symbols · BROKER", buscador, "N symbols · M hidden", Show all / Hide
all, una fila por símbolo (casilla, nombre tachado si oculto, etiqueta de estado) con 16 px de margen antes
del scroll; filas de 44 px en móvil. Alternar actualiza el estado del formulario al momento (dirty); nada
se envía hasta Save.

### Aplicar la visibilidad

| Sitio | Cambio |
|---|---|
| `AppLayout` | `loadVisibility()` al montar |
| `journal/Accounts` | saldos filtrados por `isBrokerVisible` antes de ordenar / pintar |
| `journal/OpenPositions`, `PendingOrders` | la lista suscrita filtrada por broker + símbolo antes de filtros / opciones / grupo |
| `journal/ClosedPositions` | trades filtrados por broker + símbolo; opciones de filtro del conjunto visible |
| `chart/ChartPage` | `brokers` / `symbols` pasados a la barra y al panel de filtros pasan por `visibleBrokers` / `visibleSymbols`, más la selección actual añadida con una marca `hidden` cuando está oculta (CA 5); la elección automática de broker / símbolo salta los ocultos |
| `chart/ChartToolbar`, `ChartFiltersPanel` | etiqueta de opción "EURGBP · hidden" para la entrada marcada |
| `journal/NewTradePanel` | lista de brokers y de símbolos (del broker elegido) filtradas; destinos del mirror sin tocar |
| `stats/StatsPage` | selector de broker filtrado |
| `settings/NotificationPanel` | select de broker y chips de símbolos filtrados |
| `settings/MirrorTab`, `DevicesPanel` | sin tocar (CA 3) |

Las filas de `useEmaNotifications`, las alertas, el flujo en vivo y los toasts WS no se filtran (CA 6).

### Ficheros

```
backend/prisma/migrations/20261025000000_visibility/migration.sql   nuevo
backend/prisma/schema.prisma, src/routes/settings.ts                 edit
backend/docs/architecture.md, .claude/CLAUDE.md                     edit
frontend/src/lib/visibility.ts                                      nuevo
frontend/src/features/settings/VisibilityTab.tsx, SymbolsPanel.tsx (+ .module.css)  nuevos
frontend/src/features/settings/SettingsPage.tsx (+ .module.css)     edit
frontend/src/app/layout/AppLayout.tsx                               edit
frontend/src/features/journal/Accounts.tsx, OpenPositions.tsx, PendingOrders.tsx, ClosedPositions.tsx, NewTradePanel.tsx  edit
frontend/src/features/chart/ChartPage.tsx, ChartToolbar.tsx, ChartFiltersPanel.tsx  edit
frontend/src/features/stats/StatsPage.tsx                           edit
frontend/src/features/settings/NotificationPanel.tsx                edit
```

## Maqueta

Artefacto Design aprobado por el usuario el 23-10-2026: https://claude.ai/artifact/A2QMEiAjP25c2ySHxcRth3.
Mesas: Settings · Visibility escritorio (tabla con toggle Visible, cuenta, recuentos, botón Symbols),
Settings · Visibility móvil (filas apiladas con el botón Symbols), panel de símbolos escritorio (derecha,
flotante: buscador, Show all / Hide all, filas con casilla, scroll fino oscuro), panel de símbolos móvil
(ancho completo, filas de 44 px), selectores del gráfico con una selección oculta marcada "· hidden".

## Riesgos

- Una página que liste un broker desde otra fuente distinta de `/balances` se saltaría el filtro: todas
  las fuentes de listas están enumeradas en la tabla de arriba (comprobadas con `git grep` de `/balances`
  y `/symbols`).
- La selección guardada del gráfico puede apuntar a un par oculto tras guardar en otro dispositivo: CA 5
  la mantiene visible y marcada hasta que el operador la cambie.
- Los botones de grupo de Positions / Orders cuentan solo filas visibles, así que las posiciones de un
  broker oculto nunca entran en un cierre masivo por accidente.
