# 020 — Libro de esquemas EURUSD · Verification

| Task | Mechanism | Outcome | Est | Actual |
|---|---|---|---|---|
| 1 | `prisma generate` + `npm run build` + `prisma migrate diff` | ✅ | 0.5 | 0.25 |
| 2 | `npm test` + `npm run build` | ✅ | 1 | 0.5 |

## Task 1 — Migration and models (db)

- `prisma/migrations/20261023000000_book/migration.sql`: `book_schemes` (number unique, start / end as DATE, `result` text defaulting to `auto`, note) and `book_trades` (ticket unique, scheme FK with cascade, slot, direction, lots, entry, SL, open time, nullable close time / close price / profit / R / balance after for open operations, note), indexes on `start` and `schemeId`. Prisma models `BookScheme` / `BookTrade` appended to `schema.prisma`.
- `npx prisma generate` and `npm run build` clean; `prisma migrate diff --from-url <production> --to-schema-datamodel --script` lists exactly the seven statements of the migration (two tables, two unique indexes, two indexes, one foreign key).
- Est vs Actual: 0.5 vs 0.25 SP.

## Task 2 — Pure calculations (backend)

- `src/book/calc.ts`: constants of the document (10 000 start, 1 % risk, pip 0.0001, 10 per pip and lot), `pips` (signed by direction, 1 decimal), `lotsFor` (1 % of the balance before ÷ SL pips × 10, to 0.01), `figuresFor` (profit, R, balance after; an open operation gets its lots only), `chain` (ticket order from the start balance, open operations leave the balance untouched), `summaryOf` (the "T1 -1.0 · T2 +3.7" line with "…" for an open one, tickets, net € and R, open count), `deriveResult` (Pendiente without end / operations / with an open one; draw inside ±0.5 R; else the last operation with R ≥ 1.5; else Pierde), `effectiveResult` (`auto` → derived, else the stored one), `totalsOf` (won / draws / lost / pending, win % over the decided ones, net € and R).
- `npx vitest run src/book` → 10 passed, on the document's first two operations (0.14 lots / −102.2 / −1.02 / 9 897.8 and 0.24 / 369.6 / 3.73 / 10 267.4), the chain, the summary line, the four result rules, the pending cases, the manual override and the totals. `npm run build` and `npx eslint src/book` clean.
- Est vs Actual: 1 vs 0.5 SP.
