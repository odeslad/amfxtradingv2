# 020 — Libro de esquemas EURUSD

> Status: **closed**

## Context

The operator keeps a hand-made backtest of his EURUSD H1 scheme system in `data/esquemas y operaciones
EURUSD.html`: a static page with the data embedded (878 operations and 454 schemes from 2015-02 to 2026-09)
and a table of schemes with totals on top. It is **informational**: it tells him where the system stands on
EURUSD and it has nothing to do with the live trading of the app. He wants that book inside the web, with the
same reading (totals, schemes, their operations) and the ability to keep it up to date by hand: create, edit
and delete schemes and operations. The book does not touch brokers, positions or trades of the app.

Every figure of an operation derives from its prices and the running balance, exactly as the document does:
the account starts at 10 000; the balance is chained in **close order** (an operation that closes later
takes the balance left by the one that closed before it, whatever their tickets); result in € = lots × pips
gained × 10; R = pips gained ÷ pips from the entry to the SL (the classic R, not the document's € ÷ 1 % of
the balance); balance after = balance before + result.
The lots the app proposes are 1 % of the current balance ÷ (SL distance in pips × 10), rounded to 0.01, but
the lots are the operator's (the document keeps the ones really used, which differ from that proposal in
more than half of the rows), so they are editable. A scheme's summary (trades line, tickets, net € and net R) and the totals of
the header come from its operations.

## Affected layers

- db
- backend
- frontend

No EA change, no new dependencies.

## User stories

- As a trader, I want the book of schemes in the web with the same table and totals as my document, so that I
  see where the system stands without opening the file.
- As a trader, I want to add the operations of a new scheme by typing only prices, dates and the note, so
  that lots, €, R and balance are computed for me the same way the backtest does.
- As a trader, I want to correct or delete any scheme or operation, so that the book stays mine.
- As a trader, I want the document imported once so I do not retype eleven years of operations.

## Acceptance criteria

- AC 1. WHEN the import script runs with the document path THEN `book_schemes` and `book_trades` hold every
  scheme and operation of the file (number, start, end, result; ticket, scheme, slot, direction, lots, entry,
  SL, open time, close time, close price, result €, R, balance after, note), the run is idempotent (a second
  run changes nothing) and it reports the counts and the first mismatch between the stored figures of the
  file and the recomputed ones, if any.
- AC 2. WHEN `GET /book/schemes?year=YYYY|all&page=N&pageSize=25|50|100` is called THEN it returns that page of
  the schemes newest first (plus `total` and `years`) with, per scheme, the computed summary (`trades` line like `T1 -1.0 · T2 +3.7`, `tickets`, `netEur`, `netR`) and its
  operations, plus the totals of the selection (schemes, won, draws, lost, win %, net €, net R).
- AC 3. WHEN `POST /book/schemes` is called with `{ number, start, end?, result?, note? }` THEN the scheme is
  created (409 on a duplicate number) with `result` `auto` by default; `PUT /book/schemes/:id` edits those fields; `DELETE /book/schemes/:id`
  removes the scheme and its operations.
- AC 4. WHEN `POST /book/trades` is called with `{ schemeId, slot, direction, entry, sl, openTime, closeTime?,
  closePrice?, note? }` THEN the operation gets the next ticket number and its lots (given, or proposed from the current balance);
  WHEN it has a close time and price THEN pips, result €, R and balance after are computed too and the whole
  chain is recomputed (the balance threads in close order); WHEN it has neither THEN it is **open** (`en curso`): no pips, € or R,
  and it does not move the balance chain until it closes; `PUT /book/trades/:id` edits
  those inputs (lots sent as null ask for the proposal again) and recomputes the chain; `DELETE
  /book/trades/:id` removes it and recomputes the chain.
- AC 5. WHEN a scheme's result is `auto` (the default) THEN the operations define it: `Pendiente` while the
  scheme has no end date, no operations or an open operation (in progress, counted apart in the totals, never as won or lost);
  once it has an end date, the slot of the operation that reached its target (`T1` / `T2` / `T3` / `RE`),
  `Pierde` when every operation lost, `Empate` when the net R is within ±0.5. A result typed by hand (the
  document's five exceptions) replaces the automatic one.
- AC 6. WHEN the user opens **Schemas** (nav item, route `/schemas`) THEN the page shows the totals header (esquemas, ganados,
  empates, perdidos, % ganados, neto €, neto R), a year filter and the schemes table with the columns of the
  document (esq., inicio, fin, trades, tickets, resultado, neto €, neto R), **paginated** (25 / 50 / 100 per
  page, previous / next, "1–25 de 454"); a scheme expands to its operations
  (ticket, posición, dirección, lotes, entrada, SL, apertura, cierre, precio de cierre, €, R, saldo, nota; an open
  operation shows "en curso" in place of its close figures);
  table on desktop, cards on mobile.
- AC 7. WHEN the user clicks **Nuevo esquema** or **Editar** / **Eliminar** on a scheme, or **Nueva
  operación** inside a scheme or **Editar** / **Eliminar** on an operation THEN a side panel with the fields
  of AC 3 / AC 4 drives the call, the computed figures are previewed before saving, and the table updates
  without a reload; deletes ask for confirmation.
- AC 8. WHEN the implementation is complete THEN `npm run build` and `npm test` pass in `backend/` (vitest on
  the pure calculations: lots, pips, €, R, balance chain, scheme result and summary) and `npm run build` +
  `npm run lint` pass in `frontend/`; the import of the real document matches its stored figures.

## Out of scope

- Any link between the book and the live trading (brokers, positions, orders, alerts).
- Charts, statistics beyond the header totals, and exports.
- Other symbols (the book is EURUSD only).
