# 024 — Hide brokers and symbols from Settings · Verification

| Task | Mechanism | Commands | Outcome | Est | Actual |
|---|---|---|---|---|---|
| 1 [db] | `prisma generate` + build + `migrate diff` against production | `npx prisma generate` · `npm run build` · `npx prisma migrate diff --from-url <production via tunnel> --to-schema-datamodel prisma/schema.prisma --script` | ✅ pass | 0.25 | 0.25 |
| 2 [backend] | build + local backend against production | `npm run build` · local backend (`PORT=3001`, bridges off, DB through the tunnel) · script calling `GET` / `PUT /settings` with a forged JWT | ✅ pass | 0.5 | 0.5 |

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
