# 024 — Hide brokers and symbols from Settings · Verification

| Task | Mechanism | Commands | Outcome | Est | Actual |
|---|---|---|---|---|---|
| 1 [db] | `prisma generate` + build + `migrate diff` against production | `npx prisma generate` · `npm run build` · `npx prisma migrate diff --from-url <production via tunnel> --to-schema-datamodel prisma/schema.prisma --script` | ✅ pass | 0.25 | 0.25 |

## Evidence

### Task 1

`prisma generate` and `tsc` clean. The diff against the production database prints exactly the two
columns of `20261025000000_visibility`:

```
ALTER TABLE "settings_display" ADD COLUMN "hiddenBrokers" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN "hiddenSymbols" JSONB NOT NULL DEFAULT '{}';
```
