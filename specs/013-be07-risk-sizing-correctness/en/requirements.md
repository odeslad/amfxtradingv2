# 013 · BE-07 — Risk % sizing correctness

> Status: **draft**
> Origin: [backend audit 2026-09-30](../../../reports/2026-09-30-backend.md), improvement 7 (diagnosis F)

## Context

When an order is sent with `lotsMode: "risk_pct"`, `POST /commands` turns "risk N % of the balance with this stop loss" into lots through `services/sizing.ts`. Three behaviours produce a wrong size without telling the user:

- The stop distance is always measured from the **current bid**, even for pending orders (`buylimit`, `sellstop`, …) that carry their own entry `price`. A limit order placed away from the market is sized for a stop distance it will never have.
- When the quote currency differs from the account currency and no conversion pair is streaming (`QUOTEACC` or `ACCQUOTE`), the pip value is used **unconverted**. For a JPY-quoted pair on a EUR account that is a pip value ~160 times too large (lots 160 times too small); for other crosses the error can go the other way.
- Anything that is not a 6-letter forex pair (gold, indices, crypto) is sized with a 100 000 contract and a 0.0001 pip, which is meaningless for those instruments.

The pip size is also derived with `symbol.includes('JPY')` instead of the shared `getPipSize` used by the scanner and alerts. Spec 008 added characterisation tests of today's behaviour, including the silent fallback as a "documented limit"; this spec replaces that limit with an explicit refusal.

## Affected layers

- backend

No frontend change: the panel already shows the `error` text of a 400/503 answer from `POST /commands`.

## User stories

- As the user, I want a risk-% pending order sized from its entry price, so that the money at risk is the percentage I asked for.
- As the user, I want the order refused with a clear message when the backend cannot compute a trustworthy size, so that I never send a position sized on a wrong assumption.

## Acceptance criteria

- AC 1. WHEN a risk-% command carries `price` (pending order) THEN the stop distance is `|price − sl|`; WHEN it does not (market order) THEN it is `|bid − sl|` as today.
- AC 2. WHEN the quote currency equals the account currency THEN the result is unchanged from today. WHEN a conversion pair is streaming (direct or inverse) THEN the result is unchanged from today.
- AC 3. WHEN the quote currency differs from the account currency and neither conversion pair has a tick THEN `POST /commands` answers `503 { error: "Cannot size EURJPY on a USD account: no JPYUSD or USDJPY price yet" }` (symbol, account currency and both pair names filled in) and nothing is written to the bridge.
- AC 4. WHEN the symbol is not a pair of two known currencies (first six letters) THEN `POST /commands` answers `400 { error: "Risk % sizing supports forex pairs only (got XAUUSD); use fixed lots" }` and nothing is written.
- AC 5. WHEN the stop distance is zero THEN `POST /commands` answers `400 { error: "SL must differ from the entry price" }` (today it silently sends 0.01 lots).
- AC 6. The pip size comes from the shared `getPipSize`; a symbol with a broker suffix (e.g. `EURUSD.r`) is sized by its first six letters.
- AC 7. Fixed-lots commands (`lotsMode` absent or `fixed`) are untouched.

## Out of scope

- Sizing non-forex instruments (needs contract size and tick value from the EA; candidate EA + backend spec).
- Using the ask for the entry of market buys (the spread is small against the stop distance; unchanged).
- Lot step / min / max per broker (still rounded to 0.01 with a 0.01 floor).
