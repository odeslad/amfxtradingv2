# 035 — Setup levels in mirror mode, level visibility and TP ratio shortcuts

> Status: **closed**

## Context

New Trade shows a Setup levels panel (ECC / EMA / EVL / MHL, from `GET /setup-levels`) only in manual mode: the panel, its timeframe select and the level fetch are all gated on `mode === 'manual'`, so an operator sending a mirror order (spec 033) loses the levels exactly when placing the most important orders. The panel always lists the four levels, with no way to hide the ones the operator does not use. SL and TP are plain inputs: clicking a level fills the SL, but the TP must be typed by hand in New Trade and in Edit group, even though the operator almost always places it at a fixed risk/reward ratio.

## Affected layers

- db · backend · frontend

## User stories

- As an operator, I want the Setup levels panel in mirror mode too, so that I can place a mirror order on the current setup without switching to manual to read the levels.
- As an operator, I want to choose in Settings › Display which setup levels are listed, so that the panel only shows the levels I trade.
- As an operator, I want 2:1 and 3:1 buttons next to the TP field, so that the TP is computed from the entry and the SL without a calculator.

## Acceptance criteria

### Setup levels in mirror mode

- AC 1. WHEN New Trade is in mirror mode with a symbol selected THEN the Setup timeframe select and the Setup levels panel are shown exactly as in manual mode (same rows, live bid, distances in pips, click on a level fills the SL).
- AC 2. WHEN the levels are fetched in mirror mode THEN they are computed for the chart's broker if it is enabled in the selected preset, otherwise for the first enabled broker of the preset; changing the preset or the symbol refetches.
- AC 3. WHEN the selected preset has no enabled broker THEN the panel is not shown (the existing warning stays).

### Level visibility in Settings › Display

- AC 4. WHEN the operator opens Settings › Display THEN a "Setup levels" group lists ECC, EMA, EVL and MHL, each with a toggle, all on by default.
- AC 5. WHEN a level is toggled off THEN it disappears from the Setup levels panel in New Trade (manual and mirror) on every device, persisted with the rest of the display settings (`PUT /settings`, `SettingsDisplay`).
- AC 6. WHEN every level is toggled off THEN the Setup levels panel and its timeframe select are hidden in New Trade.

### TP ratio shortcuts

- AC 7. WHEN the TP field of New Trade is in price mode (today's input) THEN two buttons `2:1` and `3:1` next to it switch the field to **ratio mode**: the field shows the chosen ratio and the resulting price, `TP = entry ± R × ratio`, with `R = |entry − SL|`, `+` for the buy side and `−` for the sell side, rounded to the symbol's precision.
- AC 8. WHEN the order is a market order THEN the entry is the current price for that side (ask for buy, bid for sell); WHEN it is a pending order THEN the entry is the price typed in the Price field.
- AC 9. WHEN the field is in ratio mode and the SL is empty or invalid, or a pending order has no price THEN the field shows the ratio with no price and the order cannot be sent until an SL (and price) exists.
- AC 10. WHEN the field is in ratio mode and the operator edits the SL, the Price, the side or the symbol, or a new tick arrives THEN the resulting price shown updates and the order sends the TP computed at submit time; WHEN the operator presses the field's ✕ THEN it returns to price mode, empty.
- AC 11. WHEN the Edit group panel is open THEN its TP field has the same two modes: in ratio mode the TP is computed per position from that position's open price and its effective SL (the SL typed in the panel if any, otherwise the position's current SL); positions whose effective SL is missing keep their TP.
- AC 12. WHEN Edit group is in ratio mode THEN the field shows the ratio and the resulting price if every position gets the same TP, otherwise the ratio alone, with a per-position preview list; the submit sends one `modify` per position with its own TP.
- AC 13. WHEN the operator presses ✕ in Edit group THEN the field returns to price mode, empty, and a typed value applies to every position, as today.

## Out of scope

- Other ratios or a custom ratio input (only 2:1 and 3:1).
- Ratio shortcuts in the pending-order editor or on the chart drag.
- Changing how the levels are computed (`indicators/ema-cross.ts`), the EMA periods or the EA.
- Level visibility per broker, per symbol or per device (one global setting, like the other display settings).
