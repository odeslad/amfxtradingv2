# 030 — Fast reflection of closed trades

> Status: **draft**

## Context
A closed position takes up to ~90 s to reach the database and never reaches an open page on its own. The EA writes `history.json` every `STATE_EVERY_S` (60 s), the backend file watcher reads it every 30 s, and the History (journal closed positions) and Stats pages only fetch on mount or filter change — there is no WS signal for closed trades. Open positions, by contrast, arrive through the pipe every second, so a closed position disappears instantly but shows up in History/Stats much later.

## Affected layers
- ea · backend · frontend

## User stories
- As the operator, I want a position I close to appear in History and Stats within a few seconds, so that I can review the result right away.
- As the operator, I want an open History or Stats page to refresh by itself when new closed trades arrive, so that I don't have to reload.

## Acceptance criteria
- AC 1. WHEN the account history of a terminal changes (a trade closes, a balance operation is booked) THEN the EA writes `history.json` without waiting for the 60 s state cycle, at most once every 3 s.
- AC 2. WHEN nothing changes in the account history THEN the EA keeps writing `history.json` only on its regular 60 s cycle.
- AC 3. The backend file watcher polls the bridge files every 5 s; unchanged files are skipped — candles as today, and now also `history.json` and `account.json` (by `mtime`/size and content), so they no longer hit the DB on every poll.
- AC 4. WHEN the watcher processes a changed `history.json` of a broker THEN the backend broadcasts `{ type: "trades_updated", broker }` over `/ws` after the rows are saved.
- AC 5. WHEN an open History or Stats page receives `trades_updated` for a broker it is showing (or for any broker when it shows all) THEN it refetches its data once, debounced, keeping the current filters and without a loading flash.
- AC 6. WHEN a position is closed in production THEN it appears in an open History and Stats page within ~10 s without reloading.
- AC 7. Existing WS messages and the EA ↔ backend file contract are unchanged; `trades_updated` is additive.

## Out of scope
- Streaming individual closed trades over WS (the page refetches the API instead).
- Changing the 60 s cycle for candles or `account.json`.
- Other pages (dashboard, chart) reacting to `trades_updated`.
