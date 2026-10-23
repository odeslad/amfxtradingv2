# 024 — Hide brokers and symbols from Settings · Tasks

Each task is one conventional commit. The project must build after every task. Tasks of different layers never share a commit. Deploy order: db → backend → frontend.

- [x] 1. [db] Migration `20261025000000_visibility` (`settings_display.hiddenBrokers`, `hiddenSymbols`) + Prisma fields · **Verify:** `prisma generate` + `npm run build`; `prisma migrate diff --from-url <production> --to-schema-datamodel --script` prints exactly the migration · **Est:** 0.25 SP
- [x] 2. [backend] `routes/settings.ts`: `visibility` parsed, saved and returned by `GET` / `PUT`; `architecture.md` + `.claude/CLAUDE.md` · **Verify:** `npm run build`; local backend against the production database: `PUT` with a visibility (400 on a bad shape), `GET` returns it, `PUT` without it leaves it untouched · **Est:** 0.5 SP
- [x] 3. [frontend] `lib/visibility.ts` store, `VisibilityTab` (table / stacked rows, counts, toggles), `SymbolsPanel` (search, Show all / Hide all, checkbox rows), Save wired in `SettingsPage`, `loadVisibility` in `AppLayout` · **Verify:** `npm run build` + `npm run lint`; local app: hide a broker and two symbols, save, reload keeps them; mobile rows and panel · **Est:** 2 SP
- [ ] 4. [frontend] Apply the visibility: Accounts, Positions, Orders, History, chart selectors (with the "· hidden" marker for the current selection), New Trade, Stats, notification panel · **Verify:** `npm run build` + `npm run lint`; local app: with a hidden broker and symbol each page lists only the visible ones, the chart keeps a hidden selection marked, the group buttons count visible rows, positions of the hidden broker keep updating in the store (toggle visible → rows are there) · **Est:** 1.5 SP
- [ ] 5. [infra] Push `master` in two steps (db + backend, then frontend) and **validate on production**: Visibility tab on desktop and iPhone, hide a broker and symbols, every page listed in the design, chart with a hidden selection, mirror / devices untouched, notifications of a hidden symbol still firing · **Verify:** manual (user validation) · **Est:** 0.5 SP
- [ ] 6. [specs] Record Est vs Actual in `verification.md` (both languages), mark the spec closed and archive it under `archive/2026-10/` · **Verify:** manual · **Est:** 0.25 SP

**Total estimate**: 5 SP
