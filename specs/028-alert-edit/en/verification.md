# 028 — Edit price alerts · Verification

## Task 1 — Alerts panel: inline price edit and Positions-style buttons

- **Mechanism:** `npm run build` + local check in Vite (`https://local.amfxtrading.com:5174/chart`, against the production API).
- **Commands:** `cd frontend && npm run build` → ✓ built.
- **Outcome:** ✅ pass — confirmed by the user locally.
- **Evidence:** the whole row (except the buttons) opens the edit; Save/Cancel, Enter/Esc; invalid value → red border; saving re-arms the alert (`PUT { price, enabled: true }`); On/Off and Delete outlined orange/red and sliding in from the right like Positions (hover on desktop, swipe on touch, `AlertRow`, also used by the EMA tab); Off/triggered rows dim only symbol and price.
- **Deviations agreed with the user:** whole-row edit instead of the price only; buttons hidden and slid in like Positions; the current price moved out of the Price placeholder into its own row under the form.
- **Est vs Actual:** 2 SP vs 2.5 SP — the three agreed tweaks.

## Task 2 — Chart: drag alerts like SL/TP

- **Mechanism:** `npm run build` + `eslint src/features/chart/` + local check in Vite.
- **Commands:** `cd frontend && npm run build` → ✓ built; eslint → clean.
- **Outcome:** ✅ pass — confirmed by the user locally.
- **Evidence:** alerts join the SL/TP drag (`DraggableLevel` union); an unselected alert is grabbed only near its marker, a selected one across the pane; selected = dashed orange line that stops short of the price label; dragging shows a faint line at the start price and a label centred on the line (`▲ price · ±pips` desktop, `▲ price` phone); release saves rounded to the symbol precision (optimistic override, dropped on failure with a toast); Esc restores and saves nothing (SL/TP too). An unchanged SL/TP release no longer sends a modify.
- **Deviation:** the selection line originally crossed the price label (looked like a struck-out old price); fixed to stop before it.
- **Est vs Actual:** 3 SP vs 3 SP.

## Task 3 — Mobile alert action bar

- **Mechanism:** `npm run build` + `eslint src/features/chart/` + check on the iPhone in production.
- **Commands:** `cd frontend && npm run build` → ✓ built; eslint → clean.
- **Outcome:** 🕐 pending — the user tests it on the iPhone after the deploy (task 4).
- **Evidence:** selecting an alert on the chart shows `AlertActionBar` at the bottom of the chart (phone width only): Edit price (opens the Alerts panel editing that alert), On/Off, Delete; the bar goes when the alert is deselected, deleted or the symbol changes. Touch hit tolerance raised to 18 px (mouse stays 6 px) so a finger can grab alert and SL/TP lines.
- **Est vs Actual:** 1.5 SP vs 1.5 SP.
