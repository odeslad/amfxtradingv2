# 021 — Orders tab in the Journal

> Status: **closed**

## Context

The Journal has three tabs: Accounts, Positions and History. Pending orders (buy / sell limit and stop)
have no place of their own: they live as a "Pending Orders" section at the bottom of Positions, share its
filter (broker, symbol, buy / sell, colour) and its edit panel, which only changes SL and TP. The EA's
`modify` keeps the order's price (`OrderModify(ticket, OrderOpenPrice(), sl, tp)`), so the price of a
placed order cannot be changed from the web; the backend already accepts and forwards a `price` on
`modify`, the EA just ignores it. The group actions of Positions (Edit / Close of a same-symbol,
same-type group) exclude pending orders.

This spec gives orders their own tab, with their own filter, their own edit panel (price, SL, TP) and a
common Edit / Cancel for every listed order.

## Affected layers

- frontend · ea (docs touched in backend only)

## User stories

- As the operator, I want an **Orders** tab next to Positions, so that pending orders stop mixing with
  open positions and I see at a glance what is placed and where.
- As the operator, I want to filter the orders by broker, symbol, order type and direction, so that I
  find the orders of one setup quickly.
- As the operator, I want to edit the price of a placed order as well as its SL and TP, so that I move an
  entry without cancelling and placing it again.
- As the operator, I want one Edit and one Cancel that apply to every order in the list, so that I move or
  withdraw a whole set of orders in one go.

## Acceptance criteria

- AC 1. WHEN the Journal opens THEN its tabs are Accounts, Positions, **Orders**, History; Positions
  shows open market positions only (the "Pending Orders" section is gone) and Orders shows every pending
  order of every broker, live over the same WebSocket `positions` message as today.
- AC 2. WHEN Orders is active THEN the table (desktop) has Broker, Symbol (with the same colour badge as
  positions: the colour is stored per broker and ticket through the existing `PATCH /positions/color`),
  Type, Lots, Price, Distance (pips from the current bid / ask to the order price, signed), SL, TP, Placed
  and the row actions Edit / Cancel; under 768 px the same data as cards with swipe actions, like the
  position cards.
- AC 3. WHEN the Filters button is pressed on Orders THEN the panel offers Broker, Symbol, Type (Buy
  Limit / Sell Limit / Buy Stop / Sell Stop), Direction (Buy / Sell) and Colour (the colours in use, as
  in Positions); the values persist in
  `localStorage` separately from the Positions / History filters, and a deep link `?broker=…&symbol=…`
  lands on Orders when it carries `tab=orders`.
- AC 4. WHEN Edit is pressed on one order THEN a panel shows its type, symbol and broker and lets the
  operator change Price, SL and TP (a field left empty keeps the current value); on submit a `modify`
  command with `ticket`, `price`, `sl`, `tp` is sent and the toast reports the result.
- AC 5. WHEN every listed order (after the filters) shares symbol and type THEN the tab bar shows the
  group **Edit** and **Cancel**, exactly as Positions shows its group Edit / Close for a same-symbol,
  same-type group: Edit opens the same panel for all of them (Price, SL, TP); Cancel asks for
  confirmation naming the count and sends one `close` per order. A mixed list shows no group buttons.
- AC 6. WHEN the EA receives a `modify` with a `price` greater than 0 for a pending order THEN it calls
  `OrderModify` with that price (SL / TP as given); without `price`, or for a market position, it keeps
  the open price as today. A rejected modification (invalid price, too close to the market) comes back as
  the usual `command_result` error.
- AC 7. WHEN an order is edited or cancelled THEN the Orders tab updates from the next WebSocket
  `positions` message with no manual reload, and the Positions tab is not affected.
- AC 8. WHEN there are no orders, or none match the filters THEN the tab says so, as Positions does.
- AC 9. Orders behaves exactly as Positions in everything not stated above: double-click on a row (or
  double-tap on a card) opens the chart of that broker and symbol on H1; a card expands on tap and
  reveals Edit / Cancel on swipe; the colour badge cycles colours on click and clears on the last one;
  the Filters button shows the active dot; the list keeps broker then placement time order; the group
  Edit / Cancel buttons sit where Positions shows its group Edit / Close; the `+ New Trade` button stays
  available on the tab.

## Out of scope

- Changing the lots of a placed order (MT4 cannot: cancel and place again).
- Partial fills, expiration times, OCO or any order type beyond MT4's four pending types.
- Group actions over a subset of the list (selection by row).
- Orders history (filled or cancelled orders): History keeps showing closed trades only.
