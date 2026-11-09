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

## Task 3 · [frontend] "EMA cross trades" group in Settings > Display + `useEmaTradesSettings`

- **Mechanism:** `npm run build` + eslint on the new files + manual on the local stack.
- **Commands:** `npm run build` → ✓ built · `npx eslint` on `DisplayTab.tsx`, `useEmaTradesSettings.ts`, `emaTrades.ts` → clean.
- **Outcome:** ✅ pass on 2026-11-07. The user saw the group with the five numeric inputs (no spinners), saved and reloaded with the values kept, and the equal-EMA case rejected. Two layout notes applied during the check: the group blocks (Fibonacci levels, EMA cross trades, Setup levels) now end with the same separator as the plain rows. `ChartPage` wiring of the hook moved to task 4, where it is consumed.
- **Est vs Actual:** 1 SP · 0.75 SP.

## Task 4 · [frontend] Toolbar toggle, per-side state and `useEmaCrossTrades`

- **Mechanism:** `npm run build` + eslint + manual on the local stack.
- **Commands:** `npm run build` → ✓ built · `npx eslint` on the touched chart files → clean (the hook keeps the request key next to its result instead of clearing state inside the effect, which the `react-hooks/set-state-in-effect` rule flags).
- **Outcome:** ✅ pass on 2026-11-07: build and lint, then checked together with task 5 on the local chart (button highlighted, overlay fetched and drawn for EURUSD H1).
- **Est vs Actual:** 1.25 SP · 0.75 SP.

## Task 5 · [frontend] Overlay painting in `LightweightChart`

- **Mechanism:** `npm run build` + eslint + manual on the local stack against the mockup.
- **Commands:** `npm run build` → ✓ built · `npx eslint src/features/chart/LightweightChart.tsx` → clean.
- **Outcome:** ✅ pass on 2026-11-07. On EURUSD H1 (solidary III) the user saw the live sell trade of 06 Nov 04:00: vertical dashed line at the cross candle, gold entry line, red dashed SL line with `SL 47.2 p`, faint fill, `SELL <price>` end label, projection past the last candle. One doubt resolved on the spot: the entry sat 10 pips under the close because Settings held `entryPips = 10` from the task 3 test; the rule (close ± offset in the trade direction) is confirmed as intended.
- **Est vs Actual:** 1.5 SP · 1 SP.

## Task 6 · [infra] Push + production validation

- **Mechanism:** manual (user validation).
- **Commands:** `git push origin 0680563:master` (038 closure, spec, db, backend; "Deploy Backend to VPS" success, `/health` ok, migration already applied) → `git push origin master` (`0680563..76bb164`, frontend; bundle changed).
- **Outcome:** ✅ pass (user validated on 2026-11-09 at https://v2.amfxtrading.com: Settings group and persistence, overlay on EURUSD H1 with the three trades, reload, symbol / timeframe change, Delete / Clear all / lock, split view, mobile Draw row).
- **Side fix during validation (out of spec, VPS only):** a hard reload on `/settings` returned the API JSON because the `v2` nginx still proxied an old list of API paths to the backend; the block was removed on 2026-11-09 (backup `nginx.conf.bak-20261109`, service restarted). Not a change of this spec; recorded here because it was found while validating it.
- **Est vs Actual:** 0.5 SP · 0.75 SP (the nginx detour).

## Task 7 · [specs] Close

- **Mechanism:** manual. `npm run build` (backend) → ✓ · `npm run build` (frontend) → ✓ built.
- **Outcome:** ✅ closed on 2026-11-09, archived under `archive/2026-11/`.
- **Est vs Actual:** 0.25 SP · 0.25 SP.

## Est vs Actual

| Task | Est | Actual |
|---|---|---|
| 1 emaTrades columns + migration | 0.5 | 0.5 |
| 2 /settings + /setup-levels limit | 1 | 0.75 |
| 3 Settings group + hook | 1 | 0.75 |
| 4 Toolbar toggle + fetch hook | 1.25 | 0.75 |
| 5 Overlay painting | 1.5 | 1 |
| 6 Push + production validation | 0.5 | 0.75 |
| 7 Close | 0.25 | 0.25 |
| **Total** | **6** | **4.75** |

Calibration: reusing `detectEmaCrossSetups` and the overlay canvas kept the code small; the time went to the environment (Cloudflare route outage from the user's ISP, Prisma engine locked by the local backend, nginx detour). Deviations agreed: the `ChartPage` hook wiring moved from task 3 to task 4; the entry offset rule confirmed after a doubt caused by a test value left in Settings. Nothing pending on the user. Follow-up idea noted, not scheduled: document the nginx layout in `infra/README.md`.
