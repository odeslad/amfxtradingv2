# 033 — Mirror presets

> Status: **draft**

## Context
Today there is a single mirror configuration (Settings › Mirror, table `settings_mirror`): for each broker, whether it takes part, the lots mode (fixed lots or % risk) and the value. New Trade in mirror mode sends one order per enabled broker with that configuration. To trade with a different risk the operator has to edit Settings every time. This spec replaces the single configuration with named presets ("operaciones 0.5%", "operaciones 1%"…) that the operator picks in the New Trade form.

## Affected layers
- db · backend · frontend

## User stories
- As an operator, I want to keep several named mirror configurations, so that I can trade with different risk levels without editing Settings.
- As an operator, I want to choose the preset in the New Trade form, so that the order goes out with that configuration.
- As an operator, I want my current mirror configuration kept as the first preset, so that nothing changes until I create others.
- As an operator, I want New Trade to list only the symbols I keep visible, so that hidden symbols do not clutter the form.

## Acceptance criteria
- AC 1. WHEN I open Settings › Mirror THEN I see the list of presets, each with its name and its per-broker configuration (enabled, lots mode, value).
- AC 2. WHEN I create, rename, edit or delete a preset and save THEN the change is stored and shows on desktop and mobile.
- AC 3. WHEN the spec is deployed THEN the current mirror configuration exists as one preset (named "Default", renameable) and no configuration is lost.
- AC 4. WHEN I open New Trade in mirror mode THEN I can choose a preset, and the panel lists the brokers and lots of that preset.
- AC 5. WHEN I send a mirror order THEN one order goes to each broker enabled in the chosen preset, with that preset's lots mode and value; Settings does not change.
- AC 6. WHEN I open New Trade again THEN the last preset I used is preselected (on that device).
- AC 7. WHEN only one preset exists THEN New Trade works as today with it selected.
- AC 8. WHEN a preset has no enabled broker THEN mirror mode cannot send it and the form says so, as today's "No brokers enabled for mirror".
- AC 9. The last remaining preset cannot be deleted.
- AC 10. WHEN I open New Trade THEN the symbol list shows only visible symbols (Settings › Visibility, spec 024): in manual mode the symbols visible for the chosen broker; in mirror mode the symbols common to the preset's enabled brokers and visible in every one of them.
- AC 11. WHEN New Trade opens or its symbol list changes THEN the symbol preselected is the chart's symbol when opened from the chart and in the list, otherwise EURUSD when in the list, otherwise none; in both modes.

## Out of scope
- Presets for manual mode.
- Choosing a preset from places other than New Trade (chart, alerts).
- Changes to the commands sent to the EA or to the EA.
