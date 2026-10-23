# 020 — Libro de esquemas EURUSD · Design

## Approach

A self-contained **book** module on each layer, with no link to the live trading code:

- `[db]` two tables, `book_schemes` and `book_trades`, mirroring the document's rows.
- `[backend]` `src/book/calc.ts` (pure arithmetic of the document), `src/book/repository.ts` (Prisma access
  and the recompute of the balance chain), `src/routes/book.ts` (`/book/*`), and `scripts/import-book.ts`
  (reads the `const D = {...}` object embedded in the HTML and loads it).
- `[frontend]` `src/features/book/` (page, tables, two side panels, data hook) and `src/lib/book.ts` (types
  and API calls); nav item **Schemas**.

Every derived figure lives in the database (lots, pips, €, R, balance after) so the list reads are plain
selects, and `recomputeFrom(ticket)` rewrites the chain whenever an operation changes. Scheme summaries and
header totals are computed on read from the operations.

## Data flow

```
data/esquemas y operaciones EURUSD.html ──▶ scripts/import-book.ts ──▶ book_schemes + book_trades
GET /book/schemes?year ──▶ repository.listSchemes ──▶ calc.summaryOf / calc.totalsOf ──▶ BookPage
POST|PUT|DELETE /book/schemes/:id ──▶ repository ──▶ page refetch
POST|PUT|DELETE /book/trades/:id ──▶ calc.figuresFor + repository.recomputeFrom(ticket) ──▶ page refetch
```

## Database (`[db]`)

Migration `20261023000000_book`:

| `book_schemes` | | `book_trades` | |
|---|---|---|---|
| `id` serial PK | | `id` serial PK | |
| `number` int unique | | `ticket` int unique | the document's running number |
| `start` date | | `schemeId` int FK → `book_schemes` ON DELETE CASCADE | |
| `end` date null | | `slot` text (`T1`, `T2`, `T3`, `RE`) | |
| `result` text (`auto` by default, or a hand-typed `T1` / `T2` / `T3` / `RE` / `Pierde` / `Empate`; the API returns the effective one, `Pendiente` while `auto` and no `end`) | | `direction` text (`buy`, `sell`) | |
| `note` text null | | `lots`, `entry`, `sl` float, `closePrice` float null | |
| `createdAt`, `updatedAt` | | `openTime` timestamp, `closeTime` timestamp null | open while null |
| | | `profit`, `r`, `balanceAfter` float null | computed; null while open |
| | | `note` text null | |
| | | index `(schemeId)`, index `(ticket)` | |

Prisma models `BookScheme` / `BookTrade`; `prisma migrate diff` against production must be empty after deploy.

## Backend (`[backend]`)

### `src/book/calc.ts` (pure)

Constants of the document: `START_BALANCE = 10_000`, `RISK = 0.01`, `PIP = 0.0001`, `PIP_VALUE = 10` (€ per
pip per lot). Functions:

- `pips(direction, from, to)` = `(to − from) / PIP` signed by direction, 1 decimal.
- `lotsFor(balanceBefore, entry, sl)` = `round2(balanceBefore × RISK / (|entry − sl| / PIP × PIP_VALUE))`.
- `figuresFor(balanceBefore, input)` → `{ lots, pips, profit, r, balanceAfter }` with `profit = round2(lots ×
  pips × PIP_VALUE)`, `r = round2(profit / (balanceBefore × RISK))`, `balanceAfter = round2(balanceBefore +
  profit)`.
- `chain(trades)` → the same list with the figures recomputed in ticket order from `START_BALANCE`; an open
  operation (no close) gets its lots from the running balance and leaves it unchanged.
- `summaryOf(scheme, trades)` → `{ trades: 'T1 -1.0 · T2 +3.7', tickets: '1 2', netEur, netR }`.
- `deriveResult(trades)` → `Empate` when |net R| < 0.5; else the slot of the last operation with R ≥ 1.5;
  else `Pierde`. (Matches the document in 449 of 454 schemes; the other five are the operator's own calls,
  which is why a stored result is never overwritten.)
- `totalsOf(schemes)` → `{ schemes, won, draws, lost, winPct, netEur, netR }` where won = result in slots.

Unit tests on the first operations of the document (`[1, 1, "T1", "sell", 0.14, 1.1292, 1.1365, …, −102.2,
−1.02, 9897.8]` and `[2, 1, "T2", "buy", 0.24, …, 369.6, 3.73, 10267.4]`), the chain, the summary line, the
result rules and the totals.

### `src/book/repository.ts`

`listSchemes(year | 'all', page, pageSize)` (one page of schemes with their trades, newest first, plus the count; the totals come from a second query over the whole selection), `createScheme`, `updateScheme`,
`deleteScheme`, `createTrade` (next ticket = max + 1; figures from the previous trade's `balanceAfter`),
`updateTrade`, `deleteTrade`, and `recomputeFrom(ticket)`: loads every trade with `ticket ≥ t` ordered by
ticket, takes the `balanceAfter` of the one before, rewrites the figures in one transaction.

### `src/routes/book.ts`

| Method | Path | Body / query | Result |
|---|---|---|---|
| GET | `/book/schemes` | `year=YYYY\|all` (default: the latest year), `page` (1), `pageSize` (25 \| 50 \| 100) | `{ schemes: [...that page, with trades and summary], total, totals (of the whole selection), years: [...] }` |
| POST | `/book/schemes` | `{ number, start, end?, result?, note? }` | 201 `{ scheme }`; 409 duplicate number; result defaults to `deriveResult` (so `Pierde` with no trades) |
| PUT | `/book/schemes/:id` | same fields, all optional | `{ scheme }` |
| DELETE | `/book/schemes/:id` | | 204 (trades cascade; the later balance chain is recomputed) |
| POST | `/book/trades` | `{ schemeId, slot, direction, entry, sl, openTime, closeTime, closePrice, note? }` | 201 `{ trade }` |
| PUT | `/book/trades/:id` | same, optional | `{ trade }` (chain recomputed from its ticket) |
| DELETE | `/book/trades/:id` | | 204 (chain recomputed) |
| POST | `/book/preview` | a trade body + optional `tradeId` | `{ lots, pips, profit, r, balanceAfter }` without saving (the panel's preview) |

Validation with `middleware/parse` (prices > 0, SL ≠ entry, closeTime ≥ openTime, slot / direction / result
enums); `requireAuth` as every router; mounted in `app.ts` (18 routers).

### `scripts/import-book.ts`

`npx tsx --env-file=.env scripts/import-book.ts "<path to the html>"`: extracts `const D = {...}` with a
regex, `JSON.parse`, upserts schemes by `number` and trades by `ticket` (stored figures taken from the file),
then recomputes nothing — instead it compares the file's lots / € / R / balance with `calc.figuresFor` and
prints the counts and the first difference above 0.011 (rounding), so the arithmetic is proven on the real
data before the CRUD relies on it. Idempotent by the upserts.

### Docs

`architecture.md`: `book/` in the structure, `/book` router row, a "Libro de esquemas" paragraph;
`.claude/CLAUDE.md`: router count and list.

## Frontend (`[frontend]`)

- `src/lib/book.ts`: `BookScheme`, `BookTrade`, `BookTotals` types, `fetchBook(year)`, `createScheme`,
  `updateScheme`, `deleteScheme`, `createTrade`, `updateTrade`, `deleteTrade`, `previewTrade`; `fmtEur`,
  `fmtR`, `fmtDate`.
- `src/features/book/useBook.ts`: year, data, loading / error, `refresh`, the mutations (each refetches).
- `BookPage.tsx` + `.module.css`: totals header (seven tiles, as the document's top row), year select
  (`years` from the API + "todos"), **Nuevo esquema** button, `SchemesTable`, and the pagination bar under the
  table (range "1–25 de 454", page size 25 / 50 / 100, previous / next; the year change resets to page 1).
- `SchemesTable.tsx`: the document's columns (esq., inicio, fin, trades, tickets, resultado with the same
  colours — green slot wins, red Pierde, gold Empate — neto €, neto R); row click expands the operations
  (`TradeRows`: ticket, posición, dirección, lotes, entrada, SL, apertura, cierre, precio, €, R, saldo, nota)
  with **Nueva operación** and per-row **Editar** / **Eliminar**; cards under 768 px.
- `SchemePanel.tsx` / `TradePanel.tsx`: side panels (320 px) with the fields of the API; the trade panel
  calls `/book/preview` on change (debounced 300 ms) and shows lots, pips, €, R and balance before saving;
  deletes go through `ConfirmPanel` (journal) with the scheme number / ticket in the text.
- Nav: `{ label: 'Schemas', to: '/schemas', icon: <IconBook /> }` after Stats; route `/schemas`.

## Alternatives considered

- **Reading the HTML on every request**: no import step, but no CRUD and no place for new operations.
- **Computing lots / € / R on read instead of storing them**: one truth less to keep, but every list would
  replay the whole chain from 2015 and the import could not prove the stored figures; storing + `recomputeFrom`
  keeps reads cheap and the figures auditable.
- **Deriving the scheme result always**: five schemes of the document would change; the operator's call
  stays authoritative.

## Risks

- **Rounding**: the document rounds lots to 0.01 (nearest) and € / R to 2 decimals; the import's comparison
  will surface any row where another convention was used, before the CRUD inherits it.
- **Chain edits**: changing an old operation rewrites hundreds of balances; done in one transaction, and the
  page refetches the year. Acceptable for a hand-kept book.
- **Dates**: the document's times have no timezone; stored as given (UTC) and shown as given.
