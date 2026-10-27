# 028 — Edit price alerts · Verification

## Task 1 — Alerts panel: inline price edit and Positions-style buttons

- **Mechanism:** `npm run build` + local check in Vite (`https://local.amfxtrading.com:5174/chart`, against the production API).
- **Commands:** `cd frontend && npm run build` → ✓ built.
- **Outcome:** ✅ pass — confirmed by the user locally.
- **Evidence:** the whole row (except the buttons) opens the edit; Save/Cancel, Enter/Esc; invalid value → red border; saving re-arms the alert (`PUT { price, enabled: true }`); On/Off and Delete outlined orange/red and sliding in from the right like Positions (hover on desktop, swipe on touch, `AlertRow`, also used by the EMA tab); Off/triggered rows dim only symbol and price.
- **Deviations agreed with the user:** whole-row edit instead of the price only; buttons hidden and slid in like Positions; the current price moved out of the Price placeholder into its own row under the form.
- **Est vs Actual:** 2 SP vs 2.5 SP — the three agreed tweaks.
