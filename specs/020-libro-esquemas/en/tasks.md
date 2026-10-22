# 020 — Libro de esquemas EURUSD · Tasks

Each task is one conventional commit. The project must build after every task. Tasks of different layers never share a commit. Deploy order: db + backend first (one push, the pipeline applies the migration), frontend when the user asks for it; no EA change.

- [x] 1. [db] Migration `20261023000000_book` + Prisma models `BookScheme` / `BookTrade` · **Verify:** `prisma generate` + `npm run build`; `prisma migrate diff --from-url <production> --to-schema-datamodel --script` prints exactly the migration · **Est:** 0.5 SP
- [x] 2. [backend] `src/book/calc.ts` (`pips`, `lotsFor`, `figuresFor`, `chain`, `summaryOf`, `deriveResult`, `totalsOf`) + `calc.test.ts` on the document's first operations · **Verify:** `npm test` + `npm run build` · **Est:** 1 SP
- [x] 3. [backend] `src/book/repository.ts` (list by year, scheme and trade CRUD, next ticket, `recomputeFrom`) + `scripts/import-book.ts` (regex extraction, upserts, comparison report) · **Verify:** `npm run build`; import of the real document through the tunnel → 454 schemes, 878 trades, zero differences above rounding; second run changes nothing · **Est:** 1.25 SP
- [ ] 4. [backend] `src/routes/book.ts` (schemes, trades, preview) mounted in `app.ts`; `architecture.md` + `.claude/CLAUDE.md` · **Verify:** `npm run build`; local backend: list 2026, create scheme (409 duplicate), create trade → figures match a hand calculation, edit an old trade → later balances recomputed, delete → chain recomputed, preview · **Est:** 1 SP
- [ ] 5. [infra] Push `master` (db + backend deploy) and validate: `/health`, migration diff empty, import run on production data (same counts), `GET /book/schemes?year=2026` · **Verify:** manual · **Est:** 0.5 SP
- [ ] 6. [frontend] `src/lib/book.ts`, `useBook.ts`, route `/schemas`, nav **Schemas** with `IconBook`, `BookPage` (totals header, year filter), `SchemesTable` with expandable `TradeRows` (table / cards) · **Verify:** `npm run build` + `npm run lint`; local app shows the document's figures (totals row, schemes 2026, operations of one scheme) · **Est:** 1.5 SP
- [ ] 7. [frontend] `SchemePanel` and `TradePanel` (create / edit with preview, deletes through `ConfirmPanel`), wired to the table · **Verify:** `npm run build` + `npm run lint`; local app: create scheme 455 with two operations typing only prices and dates → lots / € / R / balance as the preview said, edit one → later balances change, delete both → table back · **Est:** 1.5 SP
- [ ] 8. [infra] Push `master` (frontend deploy, when the user asks) and **validate on production**: Schemas shows the imported book with the document's totals; create, edit and delete a scheme and an operation · **Verify:** manual (user validation) · **Est:** 0.5 SP
- [ ] 9. [specs] Record Est vs Actual in `verification.md` (both languages), mark the spec closed and archive it under `archive/2026-10/` · **Verify:** manual · **Est:** 0.25 SP

**Total estimate**: 8 SP
