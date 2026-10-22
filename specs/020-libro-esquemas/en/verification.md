# 020 — Libro de esquemas EURUSD · Verification

| Task | Mechanism | Outcome | Est | Actual |
|---|---|---|---|---|
| 1 | `prisma generate` + `npm run build` + `prisma migrate diff` | ✅ | 0.5 | 0.25 |

## Task 1 — Migration and models (db)

- `prisma/migrations/20261023000000_book/migration.sql`: `book_schemes` (number unique, start / end as DATE, `result` text defaulting to `auto`, note) and `book_trades` (ticket unique, scheme FK with cascade, slot, direction, lots, entry, SL, open time, nullable close time / close price / profit / R / balance after for open operations, note), indexes on `start` and `schemeId`. Prisma models `BookScheme` / `BookTrade` appended to `schema.prisma`.
- `npx prisma generate` and `npm run build` clean; `prisma migrate diff --from-url <production> --to-schema-datamodel --script` lists exactly the seven statements of the migration (two tables, two unique indexes, two indexes, one foreign key).
- Est vs Actual: 0.5 vs 0.25 SP.
