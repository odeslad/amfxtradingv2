# 020 — Libro de esquemas EURUSD · Diseño

## Enfoque

Un módulo **book** autocontenido en cada capa, sin ningún vínculo con el código de la operativa real:

- `[db]` dos tablas, `book_schemes` y `book_trades`, que reflejan las filas del documento.
- `[backend]` `src/book/calc.ts` (la aritmética pura del documento), `src/book/repository.ts` (acceso Prisma
  y recálculo de la cadena de saldo), `src/routes/book.ts` (`/book/*`) y `scripts/import-book.ts` (lee el
  objeto `const D = {...}` embebido en el HTML y lo carga).
- `[frontend]` `src/features/book/` (página, tablas, dos paneles laterales, hook de datos) y `src/lib/book.ts`
  (tipos y llamadas API); entrada de navegación **Schemas**.

Cada cifra derivada vive en la base de datos (lotes, pips, €, R, saldo después) para que las lecturas sean
selects simples, y `recomputeFrom(ticket)` reescribe la cadena cuando cambia una operación. Los resúmenes de
esquema y los totales de cabecera se calculan al leer a partir de las operaciones.

## Flujo de datos

```
data/esquemas y operaciones EURUSD.html ──▶ scripts/import-book.ts ──▶ book_schemes + book_trades
GET /book/schemes?year ──▶ repository.listSchemes ──▶ calc.summaryOf / calc.totalsOf ──▶ BookPage
POST|PUT|DELETE /book/schemes/:id ──▶ repositorio ──▶ recarga de la página
POST|PUT|DELETE /book/trades/:id ──▶ calc.figuresFor + repository.recomputeFrom(ticket) ──▶ recarga de la página
```

## Base de datos (`[db]`)

Migración `20261023000000_book`:

| `book_schemes` | | `book_trades` | |
|---|---|---|---|
| `id` serial PK | | `id` serial PK | |
| `number` int único | | `ticket` int único | el número correlativo del documento |
| `start` date | | `schemeId` int FK → `book_schemes` ON DELETE CASCADE | |
| `end` date null | | `slot` text (`T1`, `T2`, `T3`, `RE`) | |
| `result` text (`auto` por defecto, o uno tecleado `T1` / `T2` / `T3` / `RE` / `Pierde` / `Empate`; la API devuelve el efectivo, `Pendiente` mientras sea `auto` sin `end`) | | `direction` text (`buy`, `sell`) | |
| `note` text null | | `lots`, `entry`, `sl` float, `closePrice` float null | |
| `createdAt`, `updatedAt` | | `openTime` timestamp, `closeTime` timestamp null | en curso mientras sea null |
| | | `profit`, `r`, `balanceAfter` float null | calculados; null mientras esté en curso |
| | | `note` text null | |
| | | índice `(schemeId)`, índice `(ticket)` | |

Modelos Prisma `BookScheme` / `BookTrade`; `prisma migrate diff` contra producción debe salir vacío tras el
despliegue.

## Backend (`[backend]`)

### `src/book/calc.ts` (puro)

Constantes del documento: `START_BALANCE = 10_000`, `RISK = 0.01`, `PIP = 0.0001`, `PIP_VALUE = 10` (€ por pip
y lote). Funciones:

- `pips(direction, from, to)` = `(to − from) / PIP` con signo según dirección, 1 decimal.
- `lotsFor(balanceBefore, entry, sl)` = `round2(balanceBefore × RISK / (|entry − sl| / PIP × PIP_VALUE))`.
- `figuresFor(balanceBefore, input)` → `{ lots, pips, profit, r, balanceAfter }` con `profit = round2(lots ×
  pips × PIP_VALUE)`, `r = round2(profit / (balanceBefore × RISK))`, `balanceAfter = round2(balanceBefore +
  profit)`.
- `chain(trades)` → la misma lista con las cifras recalculadas en orden de ticket desde `START_BALANCE`; una
  operación en curso (sin cierre) toma sus lotes del saldo acumulado y lo deja sin cambios.
- `summaryOf(scheme, trades)` → `{ trades: 'T1 -1.0 · T2 +3.7', tickets: '1 2', netEur, netR }`.
- `deriveResult(trades)` → `Empate` si |R neta| < 0,5; si no, la posición de la última operación con R ≥ 1,5;
  si no, `Pierde`. (Coincide con el documento en 449 de 454 esquemas; los otros cinco son decisiones del
  operador, por eso un resultado guardado nunca se sobrescribe.)
- `totalsOf(schemes)` → `{ schemes, won, draws, lost, winPct, netEur, netR }` donde ganados = resultado en
  una posición.

Tests unitarios sobre las primeras operaciones del documento (`[1, 1, "T1", "sell", 0.14, 1.1292, 1.1365, …,
−102.2, −1.02, 9897.8]` y `[2, 1, "T2", "buy", 0.24, …, 369.6, 3.73, 10267.4]`), la cadena, la línea de
resumen, las reglas de resultado y los totales.

### `src/book/repository.ts`

`listSchemes(year | 'all', page, pageSize)` (una página de esquemas con sus operaciones, del más nuevo al más antiguo, más el recuento; los totales salen de una segunda consulta sobre toda la selección), `createScheme`,
`updateScheme`, `deleteScheme`, `createTrade` (siguiente ticket = máximo + 1; cifras desde el `balanceAfter` de
la operación anterior), `updateTrade`, `deleteTrade`, y `recomputeFrom(ticket)`: carga todas las operaciones
con `ticket ≥ t` ordenadas por ticket, toma el `balanceAfter` de la anterior y reescribe las cifras en una
transacción.

### `src/routes/book.ts`

| Método | Ruta | Cuerpo / query | Resultado |
|---|---|---|---|
| GET | `/book/schemes` | `year=YYYY\|all` (por defecto: el último año), `page` (1), `pageSize` (25 \| 50 \| 100) | `{ schemes: [...esa página, con operaciones y resumen], total, totals (de toda la selección), years: [...] }` |
| POST | `/book/schemes` | `{ number, start, end?, result?, note? }` | 201 `{ scheme }`; 409 número duplicado; el resultado por defecto es `deriveResult` (así `Pierde` sin operaciones) |
| PUT | `/book/schemes/:id` | mismos campos, todos opcionales | `{ scheme }` |
| DELETE | `/book/schemes/:id` | | 204 (operaciones en cascada; la cadena de saldo posterior se recalcula) |
| POST | `/book/trades` | `{ schemeId, slot, direction, entry, sl, openTime, closeTime, closePrice, note? }` | 201 `{ trade }` |
| PUT | `/book/trades/:id` | mismos, opcionales | `{ trade }` (cadena recalculada desde su ticket) |
| DELETE | `/book/trades/:id` | | 204 (cadena recalculada) |
| POST | `/book/preview` | un cuerpo de operación + `tradeId` opcional | `{ lots, pips, profit, r, balanceAfter }` sin guardar (la previsualización del panel) |

Validación con `middleware/parse` (precios > 0, SL ≠ entrada, closeTime ≥ openTime, enumerados de posición /
dirección / resultado); `requireAuth` como todo router; montado en `app.ts` (18 routers).

### `scripts/import-book.ts`

`npx tsx --env-file=.env scripts/import-book.ts "<ruta al html>"`: extrae `const D = {...}` con una expresión
regular, `JSON.parse`, hace upsert de esquemas por `number` y de operaciones por `ticket` (cifras guardadas
tomadas del fichero) y después no recalcula nada: compara los lotes / € / R / saldo del fichero con
`calc.figuresFor` e imprime los recuentos y la primera diferencia mayor de 0,011 (redondeo), de modo que la
aritmética queda probada sobre los datos reales antes de que el CRUD dependa de ella. Idempotente por los
upserts.

### Documentación

`architecture.md`: `book/` en la estructura, fila del router `/book`, párrafo "Libro de esquemas";
`.claude/CLAUDE.md`: recuento y lista de routers.

## Frontend (`[frontend]`)

- `src/lib/book.ts`: tipos `BookScheme`, `BookTrade`, `BookTotals`, `fetchBook(year)`, `createScheme`,
  `updateScheme`, `deleteScheme`, `createTrade`, `updateTrade`, `deleteTrade`, `previewTrade`; `fmtEur`,
  `fmtR`, `fmtDate`.
- `src/features/book/useBook.ts`: año, datos, carga / error, `refresh`, las mutaciones (cada una recarga).
- `BookPage.tsx` + `.module.css`: cabecera de totales (siete tiles, como la fila superior del documento),
  selector de año (`years` de la API + "todos"), botón **Nuevo esquema**, `SchemesTable` y la barra de paginación
  bajo la tabla (rango "1–25 de 454", tamaño 25 / 50 / 100, anterior / siguiente; cambiar el año vuelve a la
  página 1).
- `SchemesTable.tsx`: las columnas del documento (esq., inicio, fin, trades, tickets, resultado con los mismos
  colores: verde gana una posición, rojo Pierde, dorado Empate; neto €, neto R); el clic en la fila expande las
  operaciones (`TradeRows`: ticket, posición, dirección, lotes, entrada, SL, apertura, cierre, precio, €, R,
  saldo, nota) con **Nueva operación** y **Editar** / **Eliminar** por fila; tarjetas bajo 768 px.
- `SchemePanel.tsx` / `TradePanel.tsx`: paneles laterales (320 px) con los campos de la API; el panel de
  operación llama a `/book/preview` al cambiar (con retardo de 300 ms) y muestra lotes, pips, €, R y saldo antes
  de guardar; los borrados pasan por `ConfirmPanel` (journal) con el número de esquema / ticket en el texto.
- Navegación: `{ label: 'Schemas', to: '/schemas', icon: <IconBook /> }` tras Stats; ruta `/schemas`.

## Alternativas consideradas

- **Leer el HTML en cada petición**: sin paso de importación, pero sin CRUD y sin sitio para operaciones
  nuevas.
- **Calcular lotes / € / R al leer en vez de guardarlos**: una verdad menos que mantener, pero cada listado
  repetiría toda la cadena desde 2015 y la importación no podría probar las cifras guardadas; guardar +
  `recomputeFrom` mantiene las lecturas baratas y las cifras auditables.
- **Derivar siempre el resultado del esquema**: cinco esquemas del documento cambiarían; la decisión del
  operador manda.

## Riesgos

- **Redondeo**: el documento redondea los lotes a 0,01 (al más cercano) y € / R a 2 decimales; la comparación
  de la importación sacará a la luz cualquier fila con otra convención antes de que el CRUD la herede.
- **Ediciones en cadena**: cambiar una operación antigua reescribe cientos de saldos; se hace en una
  transacción y la página recarga el año. Aceptable para un libro llevado a mano.
- **Fechas**: las horas del documento no llevan zona horaria; se guardan tal cual (UTC) y se muestran tal
  cual.
