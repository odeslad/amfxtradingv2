# 024 — Hide brokers and symbols from Settings · Verification

| Task | Mechanism | Commands | Outcome | Est | Actual |
|---|---|---|---|---|---|
| 1 [db] | `prisma generate` + build + `migrate diff` against production | `npx prisma generate` · `npm run build` · `npx prisma migrate diff --from-url <production via tunnel> --to-schema-datamodel prisma/schema.prisma --script` | ✅ pass | 0.25 | 0.25 |
| 2 [backend] | build + local backend against production | `npm run build` · local backend (`PORT=3001`, bridges off, DB through the tunnel) · script calling `GET` / `PUT /settings` with a forged JWT | ✅ pass | 0.5 | 0.5 |
| 3 [frontend] | build + lint + local app | `npm run build` · `npm run lint` · Vite on 5174 proxied to the local backend (3001, production DB through the tunnel) | ✅ pass | 2 | 1.5 |
| 4 [frontend] | build + lint + local app | `npm run build` · `npm run lint` · same local stack as task 3 | ✅ pass | 1.5 | 1 |

## Evidence

### Task 1

`prisma generate` and `tsc` clean. The diff against the production database prints exactly the two
columns of `20261025000000_visibility`:

```
ALTER TABLE "settings_display" ADD COLUMN "hiddenBrokers" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN "hiddenSymbols" JSONB NOT NULL DEFAULT '{}';
```

### Task 2

The migration was applied to production through the tunnel (`prisma migrate deploy`, additive columns
with defaults) so the local backend could run against it; the deploy's `migrate deploy` is now a no-op.

```
GET before             200 {"hiddenBrokers":[],"hiddenSymbols":{}}
PUT bad shape          400 {"error":"visibility.hiddenBrokers must be an array"}
PUT set                200 {"hiddenBrokers":["GhostBroker"],"hiddenSymbols":{"GhostBroker":["EURUSD","GBPUSD"]}}
GET after              200 (same)
PUT without visibility 200 (same, untouched)
restored               200 {"hiddenBrokers":[],"hiddenSymbols":{}}
```

Duplicates removed, symbols upper-cased, an empty symbol list dropped, an unknown broker kept (AC 2).

### Task 3

Build and lint clean (one lint fix: the search box resets on close instead of in an effect). Checked by
the user in the local app on 2026-10-23: Visibility tab table and toggles, Symbols panel with search,
Show all / Hide all and checkbox rows, Save followed by a reload keeping the hidden set, mobile rows in a
narrow window. Mobile layout adjusted on the user's feedback: the Symbols button sits on the same row as
the toggle instead of a full-width row under it. The iPhone check is left for the production validation
(task 5). Dev gotcha recorded: Vite must be started from PowerShell, Git Bash rewrites
`VITE_API_BASE=/__api` into a Windows path and the app loads blank.

### Task 4

Build and lint clean. Validated by the user in the local app on 2026-10-23 with a hidden broker and
hidden symbols: Accounts / Positions / Orders / History rows and filter options, chart selectors and
filters panel with the current hidden selection marked "· hidden", New Trade manual lists (mirror
untouched), Stats broker selector, notification panel broker select and symbol chips; Mirror, Devices,
alerts and toasts unchanged; showing the broker again brings the rows back without a reload. The chart's
fetch effects read the visibility through a ref so a save never refetches the lists.
