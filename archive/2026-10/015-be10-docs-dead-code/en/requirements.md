# 015 · BE-10 — Backend docs and dead code

> Status: **closed**
> Origin: [backend audit 2026-09-30](../../../reports/2026-09-30-backend.md), improvement 10 (diagnosis G)

## Context

The two documents that describe the backend are out of date, and some code survives only because nothing deletes it:

- `.claude/CLAUDE.md` is loaded in every Claude session. Its "Arquitectura del backend" section still describes `positions.json` / `syncPositions`, a `Position` model, a `magic` field and two pipe message types (there are three: ticks, positions, account); the "Trading Engine" and "Diseño del sistema de estrategias" sections (~250 lines) and the "Pendiente backend" table describe an engine removed in spec 001. The user decided to **move** the engine and strategy material to `epics/trading-engine/concept.md` rather than delete it.
- `backend/docs/architecture.md` cites files that do not exist (`ws/ticks.ts`, `services/positions.ts`), env vars that are not read (`BRIDGE_PATH`, `BROKER_NAME`), the single-broker pipe name, a `/ws/ticks` path, a `positions` table and an `account_snapshots` table. Spec 010 and 012 kept its `/health` and `POST /commands` sections current; the rest is from the first week of the project.
- `backend/.env.example` lists four variables; the backend also reads `JWT_SECRET` (required), `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` / `VAPID_SUBJECT`, the `FEATURE_*` flags and `ALLOWED_ORIGINS`-type settings. A fresh checkout cannot be configured from the example alone.
- `indicators/ema-cross.ts` still computes pivots, weak/strong candle classification and carries `WeakConfig` / `StrongConfig` / `PivotPoint` types for the removed engine. Its two callers (`services/scanner.ts`, `routes/setup-levels.ts`) never read those fields, so ~130 lines run on every scanner call and are discarded. The audit also flagged exports without a reader (`store/positionColors.ts` `getColorsByBroker`, `services/push.ts` `isPushEnabled`) and a stale comment at `index.ts:1`.

## Affected layers

- backend (code and `docs/`)
- repo docs (`.claude/CLAUDE.md`, `epics/`) — no layer code

No frontend, db, EA or infra change. The HTTP responses of `/scanner` and `/setup-levels` do not change.

## User stories

- As the user, I want `CLAUDE.md` to describe the backend that exists, so that every session starts from facts and not from a removed design.
- As the user, I want the engine and strategy design kept as an epic, so that it can be split into specs when the time comes without digging through git history.
- As a developer, I want `architecture.md` and `.env.example` to be enough to run the backend from a fresh checkout.
- As the user, I want the scanner to compute only what it returns, so that it is not slower than it needs to be and the file reads like the feature it serves.

## Acceptance criteria

- AC 1. `.claude/CLAUDE.md` has no "Trading Engine", "Diseño del sistema de estrategias" or "Pendiente backend" section; its backend section describes the three pipe message types, the file watcher (account, history, candles — no positions), the WebSocket `/ws` message types, the command bridge (with `pending.json` and late results), the alerts, the stores, multi-broker, `/health`, and the DB models that exist (`Candle`, `Trade`, `Balance`, `BalanceOperation`, settings, users, alerts, drawings, push). Nothing it states contradicts the code.
- AC 2. `epics/trading-engine/concept.md` contains the moved engine and strategy material verbatim (headings, tables, JSON blocks) with a short header saying where it came from, when, and that none of it is implemented.
- AC 3. `backend/docs/architecture.md` matches the code: real file tree of `src/`, env vars actually read (name, required/optional, default), pipe name pattern per broker, `/ws` path and message types, DB tables that exist with their write pattern, the existing `/health` and `POST /commands` sections kept. Every path it names exists.
- AC 4. `backend/.env.example` lists every variable the backend reads, with a comment on each: purpose, required or optional, default. Secrets carry placeholders, never real values.
- AC 5. `indicators/ema-cross.ts` no longer computes pivots or weak/strong candles and no longer exports `WeakConfig`, `StrongConfig`, `PivotPoint`; `EmaCrossSetup` keeps only the fields a caller reads plus the levels. `detectEmaCrossSetups` returns the same setups (direction, indexes, times, prices, levels, MAE/MFE) as before for the same input.
- AC 6. WHEN `/scanner` and `/setup-levels` are called with the same parameters before and after the change THEN their JSON responses are byte-identical (reference captured against production data before the change).
- AC 7. Exports with no reader in `backend/src` are removed (`getColorsByBroker`, `isPushEnabled`, any other the search finds); the stale comment at `index.ts:1` is gone. `npm run lint && npm run typecheck && npm test && npm run build` stay green; the `ema-cross` tests are adapted to the pruned shape and still cover the cross, levels and direction cases.
- AC 8. No behaviour change on the deployed backend: `/health` shape, WebSocket messages and all routes answer as before.

## Out of scope

- Rewriting the EA or frontend docs.
- Changing what `/scanner` or `/setup-levels` return (only what they compute).
- The frontend's own EMA calculation.
- The `.claude/CLAUDE.md` design-system and workflow sections (unchanged).
- The memory files Claude keeps outside the repo (updated by Claude on close, not part of the spec's commits).
