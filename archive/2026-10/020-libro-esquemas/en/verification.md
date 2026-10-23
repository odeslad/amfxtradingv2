# 020 — Libro de esquemas EURUSD · Verification

| Task | Mechanism | Outcome | Est | Actual |
|---|---|---|---|---|
| 1 | `prisma generate` + `npm run build` + `prisma migrate diff` | ✅ | 0.5 | 0.25 |
| 2 | `npm test` + `npm run build` | ✅ | 1 | 0.5 |
| 3 | `npm run build` + import of the real document | ✅ | 1.25 | 1.5 |
| 4 | `npm run build` + local backend | ✅ | 1 | 0.75 |
| 5 | manual (deploy evidence) | ✅ | 0.5 | 0.25 |
| 6 | `npm run build` + `npm run lint` + local app (user) | ✅ | 1.5 | 1 |
| 7 | `npm run build` + `npm run lint` + local app (user) | ✅ | 1.5 | 1.75 |
| 8 | manual (user validation on production) | ✅ | 0.5 | 0.5 |
| 9 | manual | ✅ | 0.25 | 0.25 |
| **Total** | | | **8** | **6.75** |

Calibration: the arithmetic and the CRUD came in under the estimate because the document's rules were proven by the import before any UI existed; the only overrun was task 7, where the R rule changed on the user's check (classic R instead of the document's).

## Task 1 — Migration and models (db)

- `prisma/migrations/20261023000000_book/migration.sql`: `book_schemes` (number unique, start / end as DATE, `result` text defaulting to `auto`, note) and `book_trades` (ticket unique, scheme FK with cascade, slot, direction, lots, entry, SL, open time, nullable close time / close price / profit / R / balance after for open operations, note), indexes on `start` and `schemeId`. Prisma models `BookScheme` / `BookTrade` appended to `schema.prisma`.
- `npx prisma generate` and `npm run build` clean; `prisma migrate diff --from-url <production> --to-schema-datamodel --script` lists exactly the seven statements of the migration (two tables, two unique indexes, two indexes, one foreign key).
- Est vs Actual: 0.5 vs 0.25 SP.

## Task 2 — Pure calculations (backend)

- `src/book/calc.ts`: constants of the document (10 000 start, 1 % risk, pip 0.0001, 10 per pip and lot), `pips` (signed by direction, 1 decimal), `lotsFor` (1 % of the balance before ÷ SL pips × 10, to 0.01), `figuresFor` (profit, R, balance after; an open operation gets its lots only), `chain` (ticket order from the start balance, open operations leave the balance untouched), `summaryOf` (the "T1 -1.0 · T2 +3.7" line with "…" for an open one, tickets, net € and R, open count), `deriveResult` (Pendiente without end / operations / with an open one; draw inside ±0.5 R; else the last operation with R ≥ 1.5; else Pierde), `effectiveResult` (`auto` → derived, else the stored one), `totalsOf` (won / draws / lost / pending, win % over the decided ones, net € and R).
- `npx vitest run src/book` → 10 passed, on the document's first two operations (0.14 lots / −102.2 / −1.02 / 9 897.8 and 0.24 / 369.6 / 3.73 / 10 267.4), the chain, the summary line, the four result rules, the pending cases, the manual override and the totals. `npm run build` and `npx eslint src/book` clean.
- Est vs Actual: 1 vs 0.5 SP.

## Task 3 — Repository and importer (backend)

- `src/book/repository.ts`: `listSchemes(year, page, pageSize)` (page + count + totals over the whole selection + years), `getScheme`, `nextSchemeNumber`, `createScheme` / `updateScheme` (409 on a taken number) / `deleteScheme`, `nextTicket`, `createTrade` (lots given or proposed), `updateTrade` (lots null → re-proposed), `deleteTrade`, `recomputeAll` (every row's €, R and balance from its own lots through `chain`, writing only the rows that change, in one transaction), `previewTrade`. `middleware/errors.ts` gains `HttpError` with `NotFound` (404) and `Conflict` (409). `scripts/import-book.ts`: extracts `const D = {…}`, upserts schemes by number and trades by ticket (the document's own lots, €, R and balance kept), then replays the chain on the document's rows and reports the differences.
- The import of the real document (migration applied to production through the tunnel first) → 454 schemes, 878 trades; a second run changes nothing. The comparison corrected the arithmetic twice: the balance chains in **close order**, not ticket order (overlapping operations), and R is measured against 1 % of the balance before the close (0 mismatches of R with that rule, where "balance after the previous ticket" left 154 and "balance at the open" 128). With the document's own lots the € and R of 871 rows match to the cent; 7 rows carry a hand-adjusted € in the document itself (e.g. ticket 574: −1 876.6 stored, −1 876.8 from its lots and pips), and the balances after them inherit that offset (351 rows within a few euros): the first recompute will realign them to the arithmetic. 492 of 878 rows use lots different from the 1 % proposal, which is why lots stay the operator's and editable. `npx vitest run src/book` → 12 passed (two chain tests on the close-order rule); build and lint clean.
- Est vs Actual: 1.25 vs 1.5 SP (the two arithmetic corrections).

## Task 4 — Routes and docs (backend)

- `src/routes/book.ts` mounted at `/book` behind `requireAuth` (17 routers): `GET /schemes?year=YYYY|all&page&pageSize` (default year = the latest; returns the page, `total`, the totals of the whole selection, `years`, `year`, `nextNumber`), `POST /schemes` (number optional → next; `result` `auto` by default), `GET|PUT|DELETE /schemes/:id`, `POST /trades` (lots optional → proposed; close time and price go together or are both absent), `PUT|DELETE /trades/:id`, `POST /preview`. Dates accept the document's `YYYY-MM-DD HH:MM` or ISO, read as UTC. `deriveResult` gained one rule found while testing: a positive net with no operation at its target is won by the best operation (the document has no such case). Docs: `architecture.md` (`book/` in the tree, `/book` route row, "Libro de esquemas (book)" section), `.claude/CLAUDE.md` (17 routers, models).
- `npm run build`, `npx eslint src/book src/routes/book.ts src/app.ts` clean; `npx vitest run src/book` → 12 passed (the new rule is covered inside the existing result test).
- Local backend on 3001 against production data (DB through the tunnel): list without `year` → 2026, 25 schemes, totals 18 / 1 / 6 / 72 % / 150 740.76 / +23.26 R, first scheme 454 with its summary; `year=all` → 454 schemes, totals 346 / 7 / 101 / 76 % / 745 026.05 / +449.12 R (the document's header); create scheme without number → 455 `Pendiente`; create 455 again → 409; preview of an open trade → ticket 950, risk base 755 026.05, lots 25.17; create the closed trade → lots 25.17, 60 pips, 15 102 €, 2 R, balance 770 132.90; edit the close price → 40 pips, 10 068 €, 1.33 R; scheme summary follows (`T1 +1.3`); set the end → result derived; delete trade and scheme → 204 / 204 / 404. Side effect noted: the first write ran `recomputeAll`, which realigned the 7 hand-adjusted rows of the document and the balances after them (ticket 949 now 14 839.20 € / 755 030.90 instead of 14 837.51 / 755 026.05).
- Est vs Actual: 1 vs 0.75 SP.

## Task 5 — Backend deploy (infra)

- Pushed `master` (`cb4dce1` … `cdd4e62`) on 2026-10-23; the backend pipeline deployed build 191 at 00:27 (`/version` `{ backend: 191 }`, `/health` with the pipes connected). The migration had been applied through the tunnel in task 3, so the pipeline's `migrate deploy` found nothing pending; `prisma migrate diff --from-url <production> --to-schema-datamodel` after the deploy → "No difference detected". The book is in production (454 schemes, 878 trades, imported in task 3 and read by the task 4 checks against the same database: 2026 → 25 schemes, totals 18 / 1 / 6 / 72 % / 150 740.76 € / +23.26 R; all → 454, 346 / 7 / 101 / 76 % / 745 026.05 € / +449.12 R, the document's header).
- Est vs Actual: 0.5 vs 0.25 SP.

## Task 6 — Schemas page: totals, year filter, table and pagination (frontend)

- `src/lib/book.ts` (types, the nine API calls, `fmtEur` / `fmtR` / `fmtR1` / `fmtPrice` / `fmtPips` / `fmtDateTime` / `fmtShort` on the book's untimed clock, `resultLabel` / `resultTone`), `features/book/useBook.ts` (year / page / page size state, one fetch under an `AbortController`, mutations that refetch), `BookPage.tsx` + `.module.css` (top bar with year select and **Nuevo esquema**, seven totals tiles with "n en curso" when pending schemes exist, pagination bar 25 / 50 / 100 with "Esquemas 1–25 de 454"), `SchemesTable.tsx` + `.module.css` (the document's columns, result badges in green / red / gold / muted, a row expands to its operations table with ticket, slot, direction, lots, entry, SL, open, close or "en curso", price, pips, €, R, balance, note and per-row actions; cards under 768 px). Route `/schemas`, nav entry **Schemas** with `IconBook`. The create / edit / delete handlers show a toast until the panels of task 7.
- `npm run build` and `npm run lint` clean.
- Local app (backend 3001 against the production database through the tunnel, Vite 5174): the page showed 2026 by default with 25 schemes, totals 18 / 1 / 6 / 72 % / 150 744.60 / +23.26 R and the table from 454 downwards with the document's trades lines, tickets, results and nets; confirmed by the user from a screenshot. (The € differ from the document's header by 3.84 € because the test write of task 4 realigned its seven hand-adjusted rows.)
- Est vs Actual: 1.5 vs 1 SP.

## Task 7 — Scheme and operation panels (frontend)

- `features/book/panels.module.css`, `SchemePanel.tsx` (number, result with **Automático** first, start, end, note; the help explains how the automatic result reads the operations), `TradePanel.tsx` (slot proposed from the operations already there, direction, entry, SL, open, close or "en curso", close price, lots empty = the 1 % proposal, note; `/book/preview` debounced 300 ms shows ticket, risk base, lots, pips, €, R and the proposed lots), `BookPage.tsx` with one `Panel` state (scheme / trade / deleteScheme / deleteTrade; each opening carries a `nonce` so the form restarts), deletes through `ConfirmPanel` (gained an optional `confirmingLabel`).
- Fixed on the way: `POST /book/schemes` rejected `note: null` (the panel sends null for an empty note). And, on the user's check of ticket 951 (sell 1.1203, SL 1.1247 = 44 pips, closed 1.1116 = +87 pips), R was the document's € ÷ 1 % of the balance (+2.51) instead of the classic pips ÷ SL pips (+1.98): `calc.figuresFor` now divides pips gained by the SL distance, `calc.test.ts` expects −1 / 3.67 on the document's first two operations, `recomputeAll` rewrote 684 rows of production, requirements updated in both languages.
- `npm run build` + `npm run lint` clean on the frontend; backend `npm run build`, `npx eslint src/book` and `npx vitest run src/book` (12 passed).
- Local app: scheme 455 created (pending, "Nueva operación" on its row), two operations typed with prices and dates only → lots / € / R / balance as the preview, second form opened empty, edit and deletes back to the table; ticket 951 at +1.98 R after the R change. Confirmed by the user.
- Est vs Actual: 1.5 vs 1.75 SP (the R rule change).

## Task 8 — Frontend deploy and production validation (infra)

- Pushed `master` (`420eced` … `0df1dcb`) on 2026-10-23: backend build 193 (`/version`, `/health` with the pipes connected; "degraded" only because one terminal was not connected to its pipe) and the frontend bundle with the panels served from v2.amfxtrading.com. On the user's first look the dates had to be dd/mm/yyyy hh:mm in 24 h: the native `datetime-local` follows the browser locale (AM/PM), so `0993f56` replaced it with text inputs in that format (`parseBookInput` / `toBookInput`) and gave the operations table the year; pushed and deployed the same morning.
- The user validated on production: the imported book with its totals, year filter and pagination; the R as pips ÷ SL pips (ticket 951 at +1.98 R); scheme 455 created with an operation typed as prices and dates, preview equal to the saved row, edited, and both deleted.
- Est vs Actual: 0.5 vs 0.5 SP.

## Task 9 — Close (specs)

- Builds of backend and frontend clean once more; Est vs Actual recorded; `Status: closed`; folder moved to `archive/2026-10/`.
- Left pending on the user: nothing. The document's seven hand-adjusted € rows now follow the arithmetic (3.84 € drift in the 2026 totals), as agreed.
- Est vs Actual: 0.25 vs 0.25 SP.
