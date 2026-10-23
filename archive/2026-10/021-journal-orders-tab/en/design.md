# 021 — Orders tab in the Journal · Design

## Approach

Pending orders already arrive with the positions (REST `/positions/live` and the WebSocket `positions`
message, each item with `type` 2–5, `currentBid` / `currentAsk` and its colour). Nothing changes in the
data: the frontend splits the same stream into two tabs, each with its own component, filter state and
group actions, and the EA learns to move the price of a pending order on `modify`. The backend keeps
its contract (it already validates and forwards `price` on `modify`); only its docs mention the new
meaning.

Alternatives considered:

- *A second REST endpoint `/orders/live` and a WS `orders` message.* Cleaner on paper, but it would
  duplicate the EA → backend → WS path for data that is already in every `positions` message. Rejected.
- *One component with a `mode` prop for both tabs.* Fewer files, but Positions and Orders differ in
  columns, actions, group rules and panels; a mode switch would fill both with conditionals. Rejected in
  favour of a sibling component that shares the hooks and helpers.

## Frontend

### Shared live feed: `useLivePositions`

`OpenPositions` holds today the REST snapshot + WS merge + colour map. Both tabs need the same stream,
and two subscribers would double the REST call and keep two colour maps. The feed moves to a hook
`features/journal/useLivePositions.ts` that returns `{ positions, colors, setColor }` and is called once
in `JournalPage`, which passes `positions.filter(!isPending)` to `OpenPositions` and
`positions.filter(isPending)` to `PendingOrders`. `OpenPositions` loses its fetch / WS / colour code and
its "Pending Orders" section (JSX and the `.pending*` rules of `JournalPage.module.css`).

### `PendingOrders.tsx` (+ `OrderCard.tsx`, `OrderCard.module.css`)

Props: `orders`, `colors`, `onColorChange`, `filters: OrderFilterValues`, `onOptionsChange`,
`onGroupChange(orders | null)`.

- Table columns: Broker · Symbol (ColorBadge + symbol coloured by side) · Type (`TYPE_LABEL`) · Lots ·
  Price · Distance · SL · TP · Placed · actions Edit / Cancel. Row double-click → `/chart?broker&symbol&timeframe=H1`.
- **Distance** = `(orderPrice − quote) / pipSize(symbol)` where the quote is the ask for buy-side orders
  and the bid for sell-side (the price the order fills at), signed as the order sees it: positive when
  the market still has to move towards the order, negative when it has crossed it. `pipSize(symbol)` is a
  new helper in `utils/position.ts`: `0.01` when the pair contains `JPY`, else `0.0001` (the backend's
  `getPipSize` rule). Shown with one decimal, muted when no quote.
- Cards under 768 px: `OrderCard` copies `PositionCard`'s swipe / tap / double-tap mechanics (the
  touch handlers move to a small `useSwipeActions` hook in `utils/` so both cards share them) with the
  summary Symbol · Price · Distance and the details Type, Lots, SL, TP, Broker, Placed.
- Filtering: broker, symbol, `orderType` (2–5), `side` (buy / sell), colour. Options reported through
  `onOptionsChange` as today (brokers, symbols, colours in use).
- Group: `onGroupChange(filteredOrders)` when the filtered list has at least one order and every order
  shares symbol and type, else `null` — the same rule as the Positions group.
- Empty states: "No pending orders" / "No orders match the selected filters".

### `OrderFiltersPanel.tsx`

A sibling of `FiltersPanel` with its own `OrderFilterValues = { broker, symbol, orderType, side, color }`
and the same look (`FiltersPanel.module.css` reused). Stored in `localStorage` under `journal.orderFilters`.

### `EditOrderPanel.tsx` (+ `.module.css` copied from `BulkEditPanel`)

Props: `open`, `orders: Position[]`, `onClose`. Header "Edit order · ticket" for one, "Edit N orders"
for a group. Meta line: type, symbol, broker(s). Fields Price, SL, TP, each empty = keep (a group is
always same-symbol, same-type, so Price applies to all). Submit
sends one `modifyCommand(p, sl ?? p.sl, tp ?? p.tp, price ?? undefined)` per order through
`sendCommands`; `lib/commands.ts` gains the optional fourth argument (`price` is only added to the
command when given, so position edits do not change).

Client-side sanity check before sending: for a limit order the price must be on the right side of the
market (buy limit below the ask, sell limit above the bid) and for a stop the opposite; otherwise the
panel blocks with a message instead of letting the EA reject it.

### `JournalPage.tsx`

- `Tab = 'accounts' | 'open' | 'orders' | 'closed'`; tab bar Accounts · Positions · Orders · History.
- Deep link: `?tab=orders&broker=…&symbol=…` lands on Orders and seeds `journal.orderFilters`; the
  existing `?broker=` without `tab` keeps landing on Positions.
- State: `orderFilters` (useLocalStorage), `orderGroup`, `editOrders: Position[] | null`,
  `cancelConfirm`. The tab bar right side shows, on Orders, the group **Edit** / **Cancel** (same
  classes as the Positions group buttons) when `orderGroup` is set, then Filters, then `+ New Trade`.
- Group Cancel: `ConfirmPanel` "Cancel N orders?" listing symbols and total count, `sendCommands(orders.map(closeCommand))`.
- `hasActiveFilters` and the Filters panel switch by tab (`OrderFiltersPanel` on Orders).

### Files

```
frontend/src/features/journal/
  useLivePositions.ts          new   REST snapshot + WS merge + colours (from OpenPositions)
  PendingOrders.tsx            new   the tab: table, cards, filtering, group reporting
  OrderCard.tsx + .module.css  new   mobile card
  OrderFiltersPanel.tsx        new   broker / symbol / type / side / colour
  EditOrderPanel.tsx + .module.css  new   price / SL / TP for one or many orders
  utils/useSwipeActions.ts     new   touch handlers shared by PositionCard and OrderCard
  utils/position.ts            edit  pipSize(symbol), orderDistancePips(p)
  OpenPositions.tsx            edit  takes positions as a prop; pending section removed
  PositionCard.tsx             edit  uses useSwipeActions
  JournalPage.tsx + .module.css edit  Orders tab, state, group actions; .pending* rules removed
frontend/src/lib/commands.ts   edit  modifyCommand(p, sl, tp, price?)
```

## Mockup

Design artifact approved by the user on 2026-10-23: https://claude.ai/artifact/HDv59YWXvKNAxbVC4inY1q. Artboards: Orders desktop (mixed list, no group buttons, table with Distance), Orders mobile (list filtered to EURUSD Buy Limit, group Edit / Cancel in the button row under the tabs, cards with Positions sizes: Distance in the P&L slot at 28 px, kind "· Limit / · Stop" in the label row, swipe actions overlaying the row), empty states, filters panel (broker, symbol, type, direction, colour), edit one order (type + symbol 16 px, Lots 20 px and Distance 28 px row, Price then SL / TP, then current price and new distance row), edit a same-type group (one row per order: price, lots, distance; common Price / SL / TP), cancel confirmation (same header and rows, Cancel all / Keep orders). Panels at mobile sizes (44 px inputs, 16 px mono), desktop keeps 34 px / 11 px as New Trade.

## EA

`HttpBridgeCommands.mq4`, `modify` branch: `price` is already extracted (line 65). After `OrderSelect`,
`double newPrice = (price > 0 && OrderType() >= OP_BUYLIMIT) ? price : OrderOpenPrice();` and
`OrderModify(ticket, newPrice, sl, tp, 0, clrNONE)`. Market positions and modifies without a price are
untouched. Error codes come back through the existing `ResultError` (130 invalid stops, 4107 invalid
price). Version bump to 2.22. The push runs the EA pipeline: the `.mq4` goes to the VPS over the
tunnel, `compile-ea.ps1` compiles it with MetaEditor there and `distribute-ea.ps1` copies the `.ex4`
into every terminal's `MQL4\Experts`. **Correction after the deploy (2026-10-23):** MT4 does *not*
reload a running EA when its `.ex4` changes on disk, so a final workflow step runs
`restart-mt4.ps1`, rewritten to close each terminal and let the `AMFX-Watchdog` task start it again in
the interactive session, one terminal at a time (never `Start-Process` from SSH: session 0). Today a compile error only prints a warning and the pipeline stays green
while the previous `.ex4` is distributed: `compile-ea.ps1` will exit 1 on a non-zero MetaEditor exit
code or when the `.ex4` is older than the `.mq4` after the run, so the workflow fails before distributing.

## Backend

No code change. `docs/architecture.md` (commands section) and `.claude/CLAUDE.md` state that `modify`
takes an optional `price` that the EA applies to pending orders only.

## Data flow

Edit → `POST /commands {action: modify, ticket, sl, tp, price}` → `command.json` → EA `OrderModify` →
`result.json` → WS `command_result` (toast) → next EA positions snapshot (1 s) → WS `positions` → the
hook updates → Orders re-renders. Cancel is the existing `close` path.

## Risks

- A `price` sent for a market position would be ignored by the EA by design; the frontend never sends
  one for types 0 / 1.
- `OrderModify` with the same price and stops returns error 1 (no change); the panel only sends when at
  least one field was typed, as today.
- Moving the feed into a hook touches `OpenPositions`: the Positions tab must be re-checked (live
  updates, colours, group Edit / Close) in the task that does it.
