# 012 · BE-06 — Command result robustness

> Status: **draft**
> Origin: [backend audit 2026-09-30](../../../reports/2026-09-30-backend.md), improvement 6 (diagnosis F)

## Context

An order travels web → `POST /commands` → `bridge/command.json` → EA (polls every second) → MT4 → `bridge/result.json` → backend → WS `command_result` → web. Spec 004 already added the input validation the audit asked for (action whitelist, finite positive lots, numeric ticket, `id` charset), so the 400s are in place. What remains is the second half of the audit item, the only place in the system where a failure costs money:

- `command.json` is written in place: the EA can read a half-written file.
- The backend waits a fixed 10 s for `result.json` and then reports `timeout` ("No response from EA") and stops listening. The EA writes `pending.json` the moment it starts executing, and a close can retry up to five times — a result at 12 s is written, nobody reads it, and the user sees "no response" for an order that did execute. The next command finds a stale `result.json` with another id and ignores it, which hides the late result for good.
- The EA's error `message` (e.g. `ticket not found`) is dropped; the web only gets `EA error (code 130)` or `EA error`.

## Affected layers

- backend

No frontend change: `command_result` keeps `{ id, status, ticket?, error? }`; a late result reuses the real status (`ok`/`error`) with an extra `late: true` flag the current UI ignores (it shows "Order executed — ticket #" / the error toast, which is the right outcome). No EA change: the formats of `command.json`, `pending.json` and `result.json` stay as documented in `ea/docs/HttpBridgeCommands.md`.

## User stories

- As the user, I want "No response from EA" to mean the EA really did not answer, so that I never repeat an order that was actually executed.
- As the user, I want the EA's error message in the toast, so that I know *why* an order was rejected without opening MT4.
- As the operator, I want a late result logged with its id, so that a timeout can be reconciled with what MT4 did.

## Acceptance criteria

- AC 1. WHEN a command is written THEN it is written to `command.tmp` and renamed to `command.json` in one step; the EA never sees a partial file.
- AC 2. WHEN `result.json` with the command's `id` appears within 10 s THEN the result is broadcast as today (`ok` with ticket, or `error`).
- AC 3. WHEN the 10 s expire but `pending.json` exists with the same `id` THEN the wait is extended, up to 30 s in total from the write, as long as that `pending.json` is present.
- AC 4. WHEN the wait expires without a result THEN `command_result` `{ status: "timeout", error: "No response from EA" }` is broadcast as today, **and** the backend keeps watching `result.json` for that `id` for 60 more seconds in the background without blocking the broker's queue.
- AC 5. WHEN the result for that `id` appears during the background window THEN it is broadcast as `command_result` with its real `status`, `ticket` and `error`, plus `late: true`, and logged as `[CMD:<broker>] late result id=… status=…`. The file is removed as usual.
- AC 6. WHEN `result.json` carries `message` THEN the broadcast `error` is `EA error: <message>` (with `(code N)` appended when `code` is present); WHEN it carries only `code` THEN `EA error (code N)` as today.
- AC 7. WHEN the next command in the same broker queue starts THEN a stale `result.json` with a different `id` is removed and logged once (`[CMD:<broker>] discarding stale result id=…`) instead of being silently polled over.
- AC 8. The 202 response, the per-broker queue (one command at a time per broker) and all existing 400/404/503 answers are unchanged.
- AC 9. WHEN the wait expires and `command.json` is still in the bridge folder (the EA never picked it up) THEN the backend removes it and broadcasts `{ status: "cancelled", error: "EA not running — order cancelled" }` instead of `timeout`, so the order cannot execute later when the EA comes back; the late watch of AC 4–5 stays active in both cases. *(Added during production validation: an order sent with the EA stopped executed two minutes later, after the late window.)*

## Out of scope

- Changing the EA (formats, retry counts, the 1 s poll).
- A frontend "late result" UI (the current toasts already read correctly); persisting command history in the DB.
- Sizing changes (BE-07, separate spec).
