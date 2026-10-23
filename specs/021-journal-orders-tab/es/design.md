# 021 — Pestaña Orders en el Journal · Diseño

## Enfoque

Las órdenes pendientes ya llegan con las posiciones (REST `/positions/live` y el mensaje `positions` del
WebSocket, cada elemento con `type` 2–5, `currentBid` / `currentAsk` y su color). Nada cambia en los
datos: el frontend separa el mismo flujo en dos pestañas, cada una con su componente, su estado de filtro
y sus acciones de grupo, y el EA aprende a mover el precio de una orden pendiente en el `modify`. El
backend mantiene su contrato (ya valida y reenvía `price` en el `modify`); solo su documentación recoge
el nuevo significado.

Alternativas consideradas:

- *Un segundo endpoint REST `/orders/live` y un mensaje WS `orders`.* Más limpio sobre el papel, pero
  duplicaría el camino EA → backend → WS para datos que ya van en cada mensaje `positions`. Descartada.
- *Un único componente con una prop `mode` para ambas pestañas.* Menos ficheros, pero Positions y Orders
  difieren en columnas, acciones, reglas de grupo y paneles; un modo llenaría ambos de condicionales.
  Descartada en favor de un componente hermano que comparte hooks y helpers.

## Frontend

### Flujo en vivo compartido: `useLivePositions`

`OpenPositions` contiene hoy la instantánea REST + la fusión WS + el mapa de colores. Ambas pestañas
necesitan el mismo flujo, y dos suscriptores duplicarían la llamada REST y mantendrían dos mapas de
colores. El flujo pasa a un hook `features/journal/useLivePositions.ts` que devuelve `{ positions,
colors, setColor }` y se llama una vez en `JournalPage`, que pasa `positions.filter(!isPending)` a
`OpenPositions` y `positions.filter(isPending)` a `PendingOrders`. `OpenPositions` pierde su código de
fetch / WS / colores y su sección "Pending Orders" (JSX y las reglas `.pending*` de
`JournalPage.module.css`).

### `PendingOrders.tsx` (+ `OrderCard.tsx`, `OrderCard.module.css`)

Props: `orders`, `colors`, `onColorChange`, `filters: OrderFilterValues`, `onOptionsChange`,
`onGroupChange(orders | null)`.

- Columnas de la tabla: Broker · Symbol (ColorBadge + símbolo coloreado por lado) · Type (`TYPE_LABEL`)
  · Lots · Price · Distance · SL · TP · Placed · acciones Edit / Cancel. Doble clic en la fila →
  `/chart?broker&symbol&timeframe=H1`.
- **Distance** = `(precioOrden − cotización) / pipSize(símbolo)`, donde la cotización es el ask para
  órdenes de compra y el bid para las de venta (el precio al que se ejecuta la orden), con el signo tal
  como lo ve la orden: positivo cuando el mercado aún tiene que moverse hacia la orden, negativo cuando ya
  la ha cruzado. `pipSize(símbolo)` es un helper nuevo en `utils/position.ts`: `0.01` si el par contiene
  `JPY`, si no `0.0001` (la regla de `getPipSize` del backend). Con un decimal, apagado si no hay cotización.
- Tarjetas por debajo de 768 px: `OrderCard` copia la mecánica de deslizar / tocar / doble toque de
  `PositionCard` (los manejadores táctiles pasan a un pequeño hook `useSwipeActions` en `utils/` para que
  ambas tarjetas los compartan) con el resumen Symbol · Price · Distance y el detalle Type, Lots, SL, TP,
  Broker, Placed.
- Filtrado: broker, símbolo, `orderType` (2–5), `side` (buy / sell), color. Opciones comunicadas por
  `onOptionsChange` como hoy (brokers, símbolos, colores en uso).
- Grupo: `onGroupChange(órdenesFiltradas)` cuando la lista filtrada tiene al menos una orden y todas
  comparten símbolo y tipo, si no `null`: la misma regla que el grupo de Positions.
- Estados vacíos: "No pending orders" / "No orders match the selected filters".

### `OrderFiltersPanel.tsx`

Hermano de `FiltersPanel` con sus propios `OrderFilterValues = { broker, symbol, orderType, side, color }`
y el mismo aspecto (`FiltersPanel.module.css` reutilizado). Guardado en `localStorage` como
`journal.orderFilters`.

### `EditOrderPanel.tsx` (+ `.module.css` copiado de `BulkEditPanel`)

Props: `open`, `orders: Position[]`, `onClose`. Cabecera "Edit order · ticket" para una, "Edit N orders"
para un grupo. Línea meta: tipo, símbolo, broker(s). Campos Price, SL, TP, cada uno vacío = conservar (un
grupo es siempre del mismo símbolo y tipo, así que Price aplica a todas). El envío manda un `modifyCommand(p, sl ?? p.sl, tp ?? p.tp, price ?? undefined)` por orden mediante
`sendCommands`; `lib/commands.ts` gana el cuarto argumento opcional (`price` solo se añade al comando
cuando se da, así las ediciones de posiciones no cambian).

Comprobación en cliente antes de enviar: en una limit el precio debe quedar al lado correcto del mercado
(buy limit por debajo del ask, sell limit por encima del bid) y en una stop al contrario; si no, el panel
bloquea con un mensaje en vez de dejar que lo rechace el EA.

### `JournalPage.tsx`

- `Tab = 'accounts' | 'open' | 'orders' | 'closed'`; barra Accounts · Positions · Orders · History.
- Enlace profundo: `?tab=orders&broker=…&symbol=…` aterriza en Orders y siembra `journal.orderFilters`;
  el `?broker=` actual sin `tab` sigue aterrizando en Positions.
- Estado: `orderFilters` (useLocalStorage), `orderGroup`, `editOrders: Position[] | null`,
  `cancelConfirm`. El lado derecho de la barra muestra, en Orders, los **Edit** / **Cancel** de grupo
  (mismas clases que los botones de grupo de Positions) cuando `orderGroup` está definido, luego Filters,
  luego `+ New Trade`.
- Cancel de grupo: `ConfirmPanel` "Cancel N orders?" con los símbolos y el recuento total,
  `sendCommands(orders.map(closeCommand))`.
- `hasActiveFilters` y el panel de filtros cambian según la pestaña (`OrderFiltersPanel` en Orders).

### Ficheros

```
frontend/src/features/journal/
  useLivePositions.ts          nuevo  instantánea REST + fusión WS + colores (desde OpenPositions)
  PendingOrders.tsx            nuevo  la pestaña: tabla, tarjetas, filtrado, grupo
  OrderCard.tsx + .module.css  nuevo  tarjeta móvil
  OrderFiltersPanel.tsx        nuevo  broker / símbolo / tipo / lado / color
  EditOrderPanel.tsx + .module.css  nuevo  precio / SL / TP para una o varias órdenes
  utils/useSwipeActions.ts     nuevo  manejadores táctiles compartidos por PositionCard y OrderCard
  utils/position.ts            edit   pipSize(símbolo), orderDistancePips(p)
  OpenPositions.tsx            edit   recibe las posiciones por prop; sección pendientes eliminada
  PositionCard.tsx             edit   usa useSwipeActions
  JournalPage.tsx + .module.css edit  pestaña Orders, estado, acciones de grupo; reglas .pending* fuera
frontend/src/lib/commands.ts   edit   modifyCommand(p, sl, tp, price?)
```

## Maqueta

Artefacto Design aprobado por el usuario el 23-10-2026: https://claude.ai/artifact/HDv59YWXvKNAxbVC4inY1q. Mesas: Orders escritorio (lista mixta, sin botones de grupo, tabla con Distance), Orders móvil (lista filtrada a EURUSD Buy Limit, Edit / Cancel de grupo en la fila de botones bajo las pestañas, tarjetas con los tamaños de Positions: Distance en el hueco del P&L a 28 px, tipo "· Limit / · Stop" en la línea de etiquetas, acciones de deslizar superpuestas a la fila), estados vacíos, panel de filtros (broker, símbolo, tipo, dirección, color), editar una orden (tipo + símbolo a 16 px, fila de Lotes a 20 px y Distance a 28 px, Price y luego SL / TP, después fila de precio actual y nueva distancia), editar un grupo del mismo tipo (una fila por orden: precio, lotes, distancia; Price / SL / TP comunes), confirmación de cancelación (misma cabecera y filas, Cancel all / Keep orders). Paneles a tamaños móviles (inputs de 44 px, mono 16 px); en escritorio se mantienen 34 px / 11 px como New Trade.

## EA

`HttpBridgeCommands.mq4`, rama `modify`: `price` ya se extrae (línea 65). Tras `OrderSelect`,
`double newPrice = (price > 0 && OrderType() >= OP_BUYLIMIT) ? price : OrderOpenPrice();` y
`OrderModify(ticket, newPrice, sl, tp, 0, clrNONE)`. Las posiciones de mercado y los modify sin precio no
cambian. Los códigos de error vuelven por el `ResultError` existente (130 stops inválidos, 4107 precio
inválido). Versión a 2.22. El push lanza el pipeline del EA: el `.mq4` va al VPS por el túnel,
`compile-ea.ps1` lo compila allí con MetaEditor y `distribute-ea.ps1` copia el `.ex4` al `MQL4\Experts`
de cada terminal; MT4 reinicializa el EA en marcha cuando cambia su `.ex4`, así que no hay compilación ni
recarga manual. Hoy un error de compilación solo imprime un aviso y el pipeline queda en verde mientras se
distribuye el `.ex4` anterior: `compile-ea.ps1` saldrá con 1 si MetaEditor devuelve un código distinto de
cero o si tras la ejecución el `.ex4` es más antiguo que el `.mq4`, de modo que el workflow falle antes de
distribuir.

## Backend

Sin cambios de código. `docs/architecture.md` (sección de comandos) y `.claude/CLAUDE.md` indican que
`modify` admite un `price` opcional que el EA aplica solo a órdenes pendientes.

## Flujo de datos

Edit → `POST /commands {action: modify, ticket, sl, tp, price}` → `command.json` → EA `OrderModify` →
`result.json` → WS `command_result` (toast) → siguiente instantánea de posiciones del EA (1 s) → WS
`positions` → el hook actualiza → Orders se vuelve a pintar. Cancel es el camino `close` existente.

## Riesgos

- Un `price` enviado para una posición de mercado lo ignoraría el EA por diseño; el frontend nunca lo
  envía para los tipos 0 / 1.
- `OrderModify` con el mismo precio y stops devuelve el error 1 (sin cambios); el panel solo envía cuando
  se ha tecleado al menos un campo, como hoy.
- Mover el flujo a un hook toca `OpenPositions`: la pestaña Positions debe revisarse (actualización en
  vivo, colores, Edit / Close de grupo) en la tarea que lo haga.
