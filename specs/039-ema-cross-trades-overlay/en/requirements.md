# 039 — EMA cross trades overlay

> Status: **implementing**

## Context
The trader works EMA-cross setups: the candle where the fast EMA crosses the slow one activates an entry; the entry sits a few pips beyond that candle's close and the stop sits at the previous extreme of the fast EMA (the EVL that the New Trade panel already lists). Today those levels exist only for the latest setup (`GET /setup-levels`, spec 035) and are read as numbers; nothing shows them on the chart, and nothing shows how the previous setups would have looked. The trader wants a toolbar button that draws the last N of those trades on the chart, with the entry and the SL projected over the life of each setup, using parameters chosen once in Settings.

## Affected layers
- frontend · backend · db

## User stories
- As a trader, I want one toolbar button that draws the last EMA-cross trades on the chart I am looking at, so that I can see at a glance where the entries and stops of this strategy fell.
- As a trader, I want each trade to show its entry level and its SL level for as long as the setup was alive, so that I can judge how the price behaved against them.
- As a trader, I want the EMA periods, the entry offset, the maximum duration and the number of trades to live in Settings, so that every chart uses the same rules without re-entering them.

## Acceptance criteria
- AC 1. WHEN the user presses the "EMA cross trades" toolbar button THEN the chart draws the last N EMA-cross trades (N from Settings, default 3) of the chart's broker, symbol and timeframe, both directions, newest included; pressing again hides them. The button is highlighted while the overlay is on. Each chart of the split view has its own button and overlay.
- AC 2. WHEN a trade is drawn THEN it has: a faint vertical dashed line at the cross candle (the candle where the fast EMA crosses the slow one); a solid gold **entry** line at the cross candle's close plus the configured pips for a buy (minus for a sell); a dashed red **SL** line at the previous EVL of the fast EMA (the fast EMA's extreme since the previous opposite cross, as `detectEmaCrossSetups` computes it); a faint fill between entry and SL; a tag `#n BUY|SELL · <cross date time>` at the top of the vertical line; and labels at the right end of the lines: `BUY|SELL <entry price>` on the entry and `SL <risk in pips> p` on the SL.
- AC 3. WHEN a trade is drawn THEN its entry and SL lines start at the cross candle and end at the next opposite cross or after the configured maximum hours, whichever comes first; a trade still alive ends at the configured hours even past the last candle.
- AC 4. WHEN the EVL does not exist for a cross (no previous opposite cross in the loaded history) THEN that trade is drawn without SL line, fill or SL label.
- AC 5. WHEN the overlay is on and the user changes symbol, timeframe or broker, or a new candle closes THEN the overlay is recomputed for the new data; WHEN the chart scrolls or zooms THEN the overlay follows the candles like the drawings do.
- AC 6. The overlay is not a drawing: it is never sent to `/drawings`, it is not selectable, Delete / Clear all and the lock ignore it, and it does not count toward the delete / clear-all buttons. Its on/off state is remembered per browser (left and right chart separately) like the chart lock.
- AC 7. WHEN the trader opens Settings > Display THEN an "EMA cross trades" group offers: fast EMA (default 24), slow EMA (default 48), entry offset in pips (default 5, 0 allowed), maximum duration in hours (default 24), trades shown (default 3, 1–10). WHEN the trader saves THEN every chart with the overlay on redraws with the new values.
- AC 8. WHEN the chart has fewer candles than the slow EMA needs, or no cross exists THEN the overlay draws nothing and the button stays highlighted (no error).

## Out of scope
- Take-profit levels, R multiples or outcome statistics of the drawn trades (the Book and Stats pages cover results).
- Per-chart or per-symbol parameters: the group in Settings is global, like the rest of Display.
- Alerts or notifications from this overlay (spec 023's EMA notifications already exist).
- Mobile-specific layout changes beyond the button appearing in the Draw row.
