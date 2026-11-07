# 039 — EMA cross trades overlay · Verification

## Task 1 · [db] `emaTrades*` columns + migration

- **Mechanism:** `prisma generate` + `prisma migrate deploy` on the production DB through the local tunnel (port 5434) + `prisma migrate diff`.
- **Commands:** `npx prisma generate` → ✓ (after stopping the local backend that held the query engine) · `npx prisma migrate deploy` → `20261108000000_ema_trades_settings` applied, `migrate status` → "Database schema is up to date!" · `npx prisma migrate diff --from-url <db> --to-schema-datamodel prisma/schema.prisma` → "No difference detected." · `npm run build` → ✓.
- **Outcome:** ✅ pass on 2026-11-07. Delayed about an hour: the Cloudflare edge range serving `amfxtrading.com` was unreachable from the user's ISP (other Cloudflare ranges fine, VPS reachable by RDP); a VPN restored the route. Production row reads `{ fast: 24, slow: 48, entryPips: 5, hours: 24, count: 3 }`.
- **Est vs Actual:** 0.5 SP · 0.5 SP (0.25 of code, the rest waiting for the network).

## Task 2 · [backend] `emaTrades` in `/settings` + `limit` / `setups` in `/setup-levels`

- **Mechanism:** `npm run build` + vitest on `parseDisplay` + `detectEmaCrossSetups` on real candles from the tunnel DB.
- **Commands:** `npm run build` → ✓ · `npx vitest run src/routes/settings.test.ts` → 19 passed (new: valid object and zero pips accepted; equal EMAs, count 11, hours 721, negative pips and a non-integer period → `BadRequest`; absent → undefined) · tsx script over the last 1000 `solidary III` EURUSD H1 candles with EMA 24 / 48 → 12 setups; last three: sell 2026-10-22 15:00 closed 10-29 21:00 (ECC 1.12048, EVL 1.12344), buy 10-29 21:00 closed 11-06 04:00 (ECC 1.1162, EVL 1.11323), sell 11-06 04:00 still open (ECC 1.12059, EVL 1.12431). That is exactly what `setups` returns with `limit=3`.
- **Outcome:** ✅ pass on 2026-11-07.
- **Est vs Actual:** 1 SP · 0.75 SP.
