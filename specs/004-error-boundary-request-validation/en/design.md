# 004 — Error boundary and request validation · Design

> Status: **approved**

## Approach

Two independent layers, both inside `backend/src`, no new dependencies:

1. **Error boundary** — three small pieces that make a failing request end in a `500` instead of killing the process: an `asyncRoute` wrapper that forwards a rejected handler promise to `next(err)`, a final Express error middleware, and `process.on('unhandledRejection')` as the last net.
2. **Request validation** — a `middleware/parse.ts` module with typed parsers (`intParam`, `dateParam`, `epochParam`, `oneOf`, `singleQuery`) that return `null` on invalid input, plus a `BadRequest` error class the routes throw; the error middleware maps it to `400 { error }`. Routes that already validate (`alerts`, `ema-alerts`, `setup-levels`, `scanner`, `drawings`, `push`, `stats`) keep their existing shape and only gain the wrapper; the six unvalidated routes get explicit checks.

Alternatives considered:

| Option | Pros | Cons | Decision |
|---|---|---|---|
| `express-async-errors` (monkey-patches Router) | zero code per route | new dependency; implicit; patches Express internals | rejected |
| Express 5 | native async error handling | major upgrade without tests; separate spec | later (audit "not now") |
| zod/valibot schemas | declarative, reusable types | new dependency for ~25 checks; `.claude/CLAUDE.md` forbids adding deps without need | rejected |
| **Hand-written wrapper + parsers** | no deps, explicit, removable when Express 5 lands | ~80 lines of helpers to maintain | **chosen** |

## Error boundary

### `middleware/asyncRoute.ts`

```ts
import type { Request, Response, NextFunction, RequestHandler } from 'express';

type AsyncHandler<Req extends Request = Request> =
  (req: Req, res: Response, next: NextFunction) => Promise<void>;

export const asyncRoute = <Req extends Request = Request>(fn: AsyncHandler<Req>): RequestHandler =>
  (req, res, next) => { fn(req as Req, res, next).catch(next); };
```

The generic keeps `AuthRequest` handlers typed (`asyncRoute<AuthRequest>(async (req, res) => { req.userId ... })`).

### `middleware/errors.ts`

```ts
export class BadRequest extends Error {
  readonly status = 400;
  constructor(message: string) { super(message); }
}

export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction): void {
  if (err instanceof BadRequest) { res.status(400).json({ error: err.message, message: err.message }); return; }
  console.error(`[HTTP] ${req.method} ${req.originalUrl}`, err);
  if (res.headersSent) return;
  res.status(500).json({ error: 'Internal error' });
}
```

Mounted last in `app.ts` (after every router). The CORS callback's `new Error('Not allowed by CORS')` also lands here and becomes a `500` with a log line instead of Express's HTML default — acceptable; a `403` mapping is a one-line follow-up if wanted.

Response key: existing routes answer `{ error }` (`commands`, `candles`, `settings`, `stats`, `symbols`) or `{ message }` (`auth`, `alerts`, `ema-alerts`, `drawings`, `push`, `scanner`, `setup-levels`), and the frontend reads one or the other per call (`body.error` in `NewTradePanel.tsx:187`, `message` in `AuthContext.tsx:38`). To stay compatible with every consumer without renaming anything, `BadRequest` responses carry **both keys** with the same text. Existing hand-written `400`s are left untouched (AC 13).

### `index.ts`

```ts
process.on('unhandledRejection', (reason) => console.error('[UNHANDLED] rejection', reason));
process.on('uncaughtException', (err) => { console.error('[UNCAUGHT] exception', err); process.exit(1); });
```

`unhandledRejection` logs and continues — a rejected promise nobody awaited (e.g. `syncColors` before its `.catch`) has already been contained by its caller's design. `uncaughtException` still exits: a synchronous throw outside any handler means unknown state, and pm2 restarts cleanly. The log prefix makes both greppable.

## Validation

### `middleware/parse.ts`

```ts
import { BadRequest } from './errors';

type Query = Record<string, unknown>;

// Query values may be string | string[] | undefined (qs). A repeated key is a 400 (AC 11).
export function singleQuery(q: Query, key: string): string | undefined {
  const v = q[key];
  if (v === undefined) return undefined;
  if (typeof v !== 'string') throw new BadRequest(`${key} must be a single value`);
  return v;
}

export function intParam(raw: string | undefined, key: string, opts: { min?: number; max?: number; default?: number }): number | undefined
// undefined → opts.default; non-integer or out of [min, max] → BadRequest; max clamps only when opts.clamp (used by limit).

export function epochParam(raw: string | undefined, key: string): Date | undefined
// positive integer seconds → Date; else BadRequest.

export function dateParam(raw: string | undefined, key: string): Date | undefined
// new Date(raw) with NaN check → BadRequest.

export function oneOf<T extends string>(value: unknown, key: string, allowed: readonly T[]): T
export function optionalOneOf<T extends string>(value: unknown, key: string, allowed: readonly T[]): T | undefined
export function finiteNumber(value: unknown, key: string, opts?: { positive?: boolean }): number
export function optionalFiniteNumber(...)
export function integer(value: unknown, key: string): number
export function optionalInteger(...)
export function optionalString(value: unknown, key: string): string | undefined
export function optionalBoolean(value: unknown, key: string): boolean | undefined
```

All throw `BadRequest` with the parameter name in the message ("limit must be an integer between 0 and 1000"). Throwing inside an `asyncRoute` handler reaches `errorHandler` through `next(err)`, so routes stay linear (no `if (error) { res.status(400)...; return; }` ladders).

`limit` keeps today's clamp semantics (`Math.min(x, max)`) rather than rejecting values above the cap, to preserve AC 13 for a frontend that may send large limits: `intParam(raw, 'limit', { min: 1, max: 5000, default: 500, clamp: true })`.

### Per-route changes

| Route | Today | Change |
|---|---|---|
| `GET /trades` | `parseInt` unchecked, `new Date` unchecked | `limit` int [0..1000] clamp default 200 · `offset` int ≥ 0 default 0 · `from`/`to` `dateParam` · `broker`/`symbol` `singleQuery` |
| `GET /candles` | `Math.min(parseInt)`, epoch unchecked | `limit` int clamp 5000 default 500 · `before`/`after` `epochParam` · `broker`/`symbol`/`tf` `singleQuery` (required check unchanged) |
| `GET /candles/emas` | `parseInt` unchecked | `emaFast`/`emaSlow` int ≥ 1 · `from`/`to` `epochParam` · `singleQuery` on strings |
| `PATCH /positions/color` | `ticket == null` only | `ticket` `integer` · `color` `optionalString` (default `''`) · `broker` non-empty string |
| `PUT /settings` | `Array.isArray(mirror)` only | each mirror item: `broker` non-empty string, `enabled` boolean, `lotsMode` `oneOf(['fixed','risk_pct'])`, `lots` finite > 0 · `display`: `pnlMode` `oneOf(['net','gross','pips','pct'])`, `trendlineStyle` `optionalOneOf(['solid','dashed','dotted'])`, `trendlineColor` `optionalString`, `trendlineWidth` `optionalInteger` ≥ 1. Validation runs **before** building `ops`, so a bad item writes nothing (AC 7) |
| `PUT /chart-indicators` | none | `Array.isArray(emas)` else 400 |
| `PUT /alerts/:id` | none on body | `validatePartial(body)`: same rules as `validate` for each field present (`price` finite, `direction` oneOf, `enabled` boolean, `note` string\|null, `broker`/`symbol` non-empty) |
| `PUT /ema-alerts/:id` | none on body | idem: `emaFast`/`emaSlow` int > 0 (and differ, checked against `existing` when only one is sent), `direction`, `thresholdPips` > 0, `timeframe` |
| `POST /commands` | presence of 4 fields | `action` `oneOf(ACTIONS)` · `id` regex `^[A-Za-z0-9_-]{1,64}$` · `broker`/`symbol` non-empty · `lotsMode` `optionalOneOf(['fixed','risk_pct'])` · `lots`: required finite > 0 unless `lotsMode === 'risk_pct'` (then it is the risk % — finite > 0) or `action ∈ {close, modify}` (then optional) · `sl`/`tp`/`price` `optionalFiniteNumber` ≥ 0 · `ticket` `optionalInteger`, required when `action ∈ {close, modify}`. All checks happen before `res.status(202)` and before `enqueue` (AC 10) |
| `GET /stats` | already validates | `singleQuery` only |
| `GET /symbols` | `String(broker)` | `singleQuery` |
| others | already validate | wrap with `asyncRoute`, no logic change |

`ACTIONS` is exported from `routes/commands.ts` as `['buy','sell','buylimit','selllimit','buystop','sellstop','close','modify'] as const` — the same list `.claude/CLAUDE.md` documents.

### `alerts` / `ema-alerts` partial validation

Extract the field rules of the existing `validate(body)` into per-field predicates and add `validatePartial(body)` that applies each predicate only when the field is `!== undefined`. `POST` keeps calling `validate` (required fields), `PUT` calls `validatePartial`. For `ema-alerts`, the `emaFast !== emaSlow` rule in `PUT` compares the merged value (`body.emaFast ?? existing.emaFast`).

## Data flow

Unchanged. No EA ↔ backend contract change: `command.json` fields and shapes are identical for valid input; invalid input no longer reaches the file.

## Files to touch

- new `backend/src/middleware/asyncRoute.ts`, `errors.ts`, `parse.ts`
- `backend/src/app.ts` (mount `errorHandler` last)
- `backend/src/index.ts` (process handlers)
- `backend/src/routes/trades.ts`, `candles.ts`, `positions.ts`, `settings.ts`, `chart-indicators.ts`, `alerts.ts`, `ema-alerts.ts`, `commands.ts`, `stats.ts`, `symbols.ts`, `balances.ts`, `drawings.ts`, `push.ts`, `scanner.ts`, `setup-levels.ts`, `auth.ts` (wrapper only where no logic changes)

## Verification strategy

No test runner exists yet (audit improvement 11). This spec verifies with:

- `npm run build` per task.
- A disposable script `specs/004-error-boundary-request-validation/tooling/smoke.mjs` (Node ≥ 18, `fetch`, no deps) that logs in with `EMAIL`/`PASSWORD` env vars, replays a fixed list of invalid requests asserting `400`, a list of valid requests asserting `200` and comparing bodies against a `baseline.json` captured before the change (AC 13), and prints a table. Run against the local backend (port 3001) during implementation and against production for the closing task, followed by `pm2 list`.
- The tooling folder is disposable (kept in the spec for reproducibility, never deployed).

## Risks

- **A valid request the frontend sends today that the new checks reject.** Mitigated by AC 13's baseline replay; the smoke list is built from the frontend's actual calls (grep of `apiUrl(`). Clamp semantics are preserved for `limit`.
- **`errorHandler` swallowing a response already started.** Guarded by `res.headersSent`.
- **`unhandledRejection` hiding real bugs.** It logs with a distinctive prefix; the audit's improvement 8 (health/liveness) will surface counts. Not exiting is the point of this spec.
- **CORS rejection now returns JSON `500`** instead of the Express HTML page. Behaviour for allowed origins unchanged.
