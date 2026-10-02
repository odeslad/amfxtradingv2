# 013 · BE-07 — Risk % sizing correctness · Tasks

Each task is one conventional commit. The project must build after every task. Deploy order: backend only.

- [ ] 1. [backend] `getPipSize` JPY rule for unlisted pairs + `pip-size.test.ts`; `sizing.ts` with `SizingInput` / `SizingResult` (forex check, entry price, explicit `no_conversion` / `zero_stop` / `not_forex`); `sizing.test.ts` rewritten; `routes/commands.ts` call site with `price ?? bid` and the 400/503 mapping (AC 1–7) · **Verify:** `npm run lint && npm run typecheck && npm test` + `npm run build`; local backend (pipe/watcher off, ticks and account seeded through a scratch script is not possible without the pipe → the route mapping is checked by the unit tests of the pure module plus a typecheck of the call site) · **Est:** 1.25 SP
- [ ] 2. [infra] Push `master` (backend deploy) and **validate on production**, risk % mode, without executing where a refusal is expected: (a) market order EURUSD risk 0.5 % with a SL → lots as before the deploy (user compares with the usual size); (b) pending order (buy limit) away from the market with the same SL distance from its price → same lots as (a), not the lots of the bid distance; (c) a symbol the broker offers that is not forex (e.g. gold) → toast `Risk % sizing supports forex pairs only…`, nothing sent; (d) SL equal to the entry → `SL must differ from the entry price` · **Verify:** manual (user validation) · **Est:** 0.5 SP
- [ ] 3. [specs] Record Est vs Actual, `Spec` column of BE-07 → `013 ✅`, `Status: closed`, archive under `archive/2026-10/` · **Verify:** manual · **Est:** 0.25 SP

**Total estimate**: 2 SP (audit: 2 SP)
