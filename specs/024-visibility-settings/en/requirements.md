# 024 — Hide brokers and symbols from Settings

> Status: **approved**

## Context

Twelve brokers feed the app and each trades dozens of symbols. The operator works with a handful of
them and wants the rest out of sight: brokers hidden everywhere the app lists accounts, positions,
orders, history or offers a broker to pick, and symbols hidden per broker everywhere a symbol list
appears. It is a **visual** preference: the EA, the backend feeds, positions, alerts and notifications
keep working for hidden brokers and symbols; only the frontend stops showing them. The preference is
saved with the other display settings on the server, so the PC and the phone show the same.

## Affected layers

- db · backend · frontend

## User stories

- As the operator, I want to hide brokers I am not working with, so that the Journal, the chart and
  the panels only list the accounts I use.
- As the operator, I want to hide symbols inside a broker, so that its pair lists are short and only
  show what I trade there.
- As the operator, I want the hidden set to follow me between the PC and the phone, so that I set it once.

## Acceptance criteria

- AC 1. WHEN Settings opens THEN it has a fourth tab, **Visibility**, listing every broker known to the
  app (from `/balances`) with a **Visible** toggle, its account name, a hidden-symbols count ("3 symbols
  hidden · 42 visible") and a **Symbols** button that opens a side panel (right, full width on the
  phone, as the other panels) with a search box, **Show all / Hide all** and one checkbox per symbol of
  the broker (from `/symbols?broker=`) in alphabetical order, hidden ones struck through; a hidden
  broker shows "Hidden everywhere" with its Symbols button disabled. Changes apply to the table at
  once and are saved with the same **Save** button as Mirror and Display.
- AC 2. WHEN the settings are saved THEN `PUT /settings` stores `visibility: { hiddenBrokers: string[],
  hiddenSymbols: { [broker]: string[] } }` in the global display settings and `GET /settings` returns it;
  unknown brokers or symbols in the lists are kept (a broker that comes back later is still hidden).
- AC 3. WHEN a broker is hidden THEN it does not appear in: Journal Accounts, Positions, Orders and
  History (its rows and its filter options), the chart's broker selector and filters panel, the New
  Trade broker list, the Stats broker selector, the notification panel's broker list, and the Devices
  / Mirror tabs are **not** affected (Mirror still lists every broker so its lots stay editable).
- AC 4. WHEN a symbol is hidden for a broker THEN it does not appear for that broker in: Positions and
  Orders rows and filter options, History rows, the chart's symbol selector and filters, the New Trade
  symbol list (for that broker), the notification panel's symbol chips; it keeps appearing for brokers
  where it is not hidden.
- AC 5. WHEN the chart's current selection becomes hidden (its broker or its symbol) THEN the chart
  keeps showing it until the operator picks another one; the selectors list the hidden one marked as
  hidden while it is selected, so nothing disappears under the operator's feet.
- AC 6. WHEN a hidden broker or symbol has open positions, pending orders, alerts or notifications THEN
  they keep running and firing; the Orders / Positions **group** buttons count only the visible rows;
  command results and notification toasts still show.
- AC 7. WHEN the Visibility tab is used on the phone THEN the broker rows stack name, count and toggle
  with the Symbols button under them, and the symbols panel uses the New Trade sizes (44 px rows).
- AC 8. WHEN nothing is hidden THEN every page behaves exactly as today.

## Out of scope

- Hiding brokers from the backend feeds, the EA or the Day P&L endpoint.
- Per-user visibility (the display settings are global, as the rest of Settings).
- Ordering or renaming brokers and symbols.
