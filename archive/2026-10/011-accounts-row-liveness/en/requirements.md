# 011 — Accounts row greys out when the EA is disconnected

> Status: **closed**
> Follow-up of [010 · BE-08 — Broker liveness](../../../archive/2026-10/010-be08-broker-liveness/en/requirements.md) (no audit code: found during its production validation).

## Context

In the Journal's Accounts table a broker row turns grey (`inactiveRow`, Day P&L `—`) when `GET /balances/daily-pnl` has no entry for it. That endpoint iterates the in-memory positions store, which keeps the last entry of every broker that ever sent positions since the backend started. So "grey" really means "never seen since start": an EA that stops afterwards keeps its white row and a Day P&L that no longer moves. Spec 010 validated this in production: Darwinex's EA was removed for a minute, `/health` reported it `listening`, the row stayed white.

## Affected layers

- backend (the frontend already renders the grey state; no change there)

## User stories

- As the user, I want a broker whose EA is not connected to show as inactive in the Accounts table within seconds, so that a dead terminal is visible where I look every day.

## Acceptance criteria

- AC 1. WHEN a broker's pipe state is not `connected` THEN `GET /balances/daily-pnl` omits that broker, and the Accounts row turns grey on the next poll (≤ 5 s).
- AC 2. WHEN the EA reconnects THEN the broker reappears in `daily-pnl` on the next poll and the row returns to normal.
- AC 3. WHEN the pipe is `disabled` (local development, `FEATURE_PIPE=false`) THEN the broker is treated as connected for this purpose (behaviour unchanged for local work).
- AC 4. Brokers that are connected keep exactly today's Day P&L values.

## Out of scope

- Reading `/health` from the frontend (dot + tick age per broker) — candidate for the frontend audit.
- Treating a stale tick (> 5 min, market closed) as inactive: a connected EA over the weekend keeps its row white.
