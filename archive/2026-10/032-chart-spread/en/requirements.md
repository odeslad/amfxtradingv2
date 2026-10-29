# 032 — Spread on the chart (ASK and BID lines)

> Status: **closed**

## Context
The chart builds its candles and its current-price line from the bid only. The EA already sends `bid` and `ask` in every tick, and the backend forwards the tick batch to the frontend over WS unchanged, but the chart ignores `ask`. The operator wants to see the spread: an optional display setting that replaces the current-price line with two lines, ASK and BID.

## Affected layers
- db · backend · frontend

## User stories
- As an operator, I want to switch on a "Show spread" option in Settings, so that the chart shows where I would buy (ask) and sell (bid).
- As an operator, I want the option off by default, so that the chart stays as it is until I choose otherwise.

## Acceptance criteria
- AC 1. WHEN the option is off THEN the chart shows the current-price line as today (bid).
- AC 2. WHEN the option is on THEN the chart shows two horizontal lines, ASK and BID, each with its price label on the price scale, and no other current-price line.
- AC 3. WHEN a new tick arrives THEN both lines move to the tick's `ask` and `bid` of the chart's symbol.
- AC 4. WHEN the option is changed in Settings THEN it is saved globally (like the rest of the display settings) and applies on desktop and mobile.
- AC 5. WHEN no tick with `ask` has arrived yet THEN the chart shows only the BID line (from the last candle close) and no ASK line.
- AC 6. Candles keep being built from the bid; the option changes only the lines.

## Out of scope
- Spread value in pips as a separate label or indicator.
- Ask-based candles.
- Spread in Positions, Orders or New Trade.
- Changes to the EA or to the tick contract.
