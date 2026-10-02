# 013 · BE-07 — Risk % sizing correctness · Design

## Approach

`services/sizing.ts` stays a pure module but stops guessing. `calculateLots` takes an options object and returns a discriminated result — the lots, or the reason it refuses — instead of a bare number. `routes/commands.ts` maps the refusal to the HTTP answer (400 or 503) with the same `{ error }` shape the route already uses for its other 400/503 answers, before the 202 and before anything is queued. No middleware change: the route answers directly, as it does today for "SL is required" and "Account data not available yet".

No new dependencies.

## Changes per layer

### backend

**1. `src/services/sizing.ts`**

```ts
export interface SizingInput {
  balance: number;
  riskPct: number;
  entryPrice: number;        // price of a pending order, else the current bid
  slPrice: number;
  symbol: string;
  accountCurrency: string;
  bids: Map<string, number>;
}

export type SizingResult =
  | { ok: true; lots: number }
  | { ok: false; reason: 'not_forex' | 'zero_stop' | 'no_conversion'; error: string };

export function calculateLots(input: SizingInput): SizingResult
```

- `pair = symbol.toUpperCase().slice(0, 6)`; `base = pair.slice(0, 3)`, `quote = pair.slice(3, 6)`. Both must be in `CURRENCIES` (`USD EUR GBP JPY CHF CAD AUD NZD` — the eight currencies behind every pair in `indicators/pip-size.ts`) and the symbol at least 6 characters; otherwise `not_forex` → `Risk % sizing supports forex pairs only (got <SYMBOL>); use fixed lots`.
- `pipSize = getPipSize(pair)` (shared table; unknown pairs fall back to 0.0001 there, and a JPY quote not in the table is covered by adding the rule `quote === 'JPY' → 0.01` inside `getPipSize` so both callers agree).
- `slPips = |entryPrice − slPrice| / pipSize`; `0` → `zero_stop` → `SL must differ from the entry price`.
- Pip value per lot = `pipSize × 100 000` in the quote currency; conversion to the account currency: same currency → as is; `bids.get(quote+account)` → multiply; `bids.get(account+quote)` → divide; neither → `no_conversion` → `Cannot size <SYMBOL> on a <ACC> account: no <QUOTE><ACC> or <ACC><QUOTE> price yet`. The lookup tries the exact 6-letter key first and then any streamed symbol that starts with it, so a broker suffix on the conversion pair (`EURJPY.r`) still resolves.
- `lots = max(0.01, round2(balance × riskPct / 100 / (slPips × pipValue)))` — unchanged formula.

**2. `src/routes/commands.ts`**

```ts
const sized = calculateLots({ balance: account.balance, riskPct: rawLots, entryPrice: price ?? bid, slPrice: sl, symbol, accountCurrency: account.currency, bids: allBids });
if (!sized.ok) {
  res.status(sized.reason === 'no_conversion' ? 503 : 400).json({ error: sized.error });
  return;
}
lots = sized.lots;
```

`bid` is still required for market orders (existing 503 "Tick data not available yet for this symbol"); for a pending order with `price` the bid is no longer needed for the distance, but the check stays (a symbol without ticks is a symbol the EA is not streaming — sending an order on it is suspicious anyway).

**3. `src/indicators/pip-size.ts`**: `getPipSize` returns `0.01` for any symbol whose quote currency (letters 4–6) is `JPY` when the symbol is not in the table, `0.0001` otherwise. Table entries unchanged, so the scanner, alerts and setup levels keep their values.

**4. Tests**

- `services/sizing.test.ts` rewritten for the new signature: the five cases that must not change (same currency 0.5; USDJPY via inverse 0.75; EUR account via inverse 0.5; GBPJPY via direct 0.3; floor and rounding) keep their numbers; the "falls back to an unconverted pip value" case becomes `no_conversion` with its message; zero stop → `zero_stop`; new: pending order sized from `entryPrice` (same inputs as the market case but a different entry → different lots, hand-computed), `XAUUSD` / `US30` / `BTCUSD` → `not_forex`, `EURUSD.r` sized as `EURUSD`, conversion pair found under a suffixed key.
- `indicators/pip-size.test.ts` (new, small): table values, JPY rule for an unlisted pair, default.

## Files to touch

| File | Change |
|---|---|
| `backend/src/services/sizing.ts` | options object, result type, explicit refusals, shared pip size |
| `backend/src/services/sizing.test.ts` | rewritten |
| `backend/src/indicators/pip-size.ts` | JPY rule for unlisted pairs |
| `backend/src/indicators/pip-size.test.ts` | new |
| `backend/src/routes/commands.ts` | call site, 400/503 mapping, `price ?? bid` |

## Risks

- **Behaviour change by design**: orders that today go out with a wrong size are now refused. A user on a EUR account trading a JPY cross with risk % needs `EURJPY` (or `JPYEUR`) streaming on that broker's EA; if it is not in the EA's symbol list the order is refused with the pair names in the message — the fix is to add the symbol to the EA or use fixed lots.
- `getPipSize` change only affects symbols outside the table; every listed pair keeps its value (covered by the new test).
- The 8-currency list refuses exotic forex pairs (e.g. `USDMXN`, `EURTRY`) under risk %; they were sized with a 0.0001 pip and an unconverted value before, i.e. wrongly. Extending the list is a one-line change when needed.
