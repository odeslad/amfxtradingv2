# 027 — One date field for the whole app

> Status: **closed**

## Context

The app has nine date inputs in five places and each one behaves differently: the scheme operation panel
(Apertura, Cierre) and the EMA notification panel (Ends) are free text the operator must type with the
slashes and colon by hand; the scheme panel (Inicio, Fin) and the Journal and Stats custom-range filters
(Desde, Hasta) use the browser's native date picker, which looks and formats differently on the iPhone
and on the PC. The operator wants one format everywhere, `DD/MM/YYYY HH:MM` for date and time and
`DD/MM/YYYY` for a date, filled by typing digits only (`121020261400` → `12/10/2026 14:00`), plus a
calendar of the app's own to pick a day.

## Affected layers

- frontend

## User stories

- As an operator, I want to type a date as digits and see it formatted as I go, so that entering times on
  the phone or the PC is fast and identical.
- As an operator, I want a calendar that looks the same on every device, so that I can pick a day without
  remembering it.

## Acceptance criteria

- AC 1. WHEN any of the nine date inputs is shown (scheme operation Apertura / Cierre, scheme Inicio /
  Fin, EMA notification Ends, Journal filters Desde / Hasta, Stats filters Desde / Hasta) THEN it is the
  same shared `DateField`, in `datetime` mode (`DD/MM/YYYY HH:MM`) or `date` mode (`DD/MM/YYYY`), with
  that pattern as placeholder; no native date picker remains.
- AC 2. WHEN the operator types THEN only digits are kept and the separators are inserted as they go:
  `/` after the day and the month, a space after the year and `:` after the hour (`121020261400` →
  `12/10/2026 14:00`; `12102026` → `12/10/2026` in date mode); extra digits are ignored; the phone shows
  the numeric keyboard.
- AC 3. WHEN the operator deletes THEN a deleted separator takes the digit before it, so backspace never
  gets stuck; WHEN the operator pastes a date with or without separators THEN it is reformatted the same
  way.
- AC 4. WHEN the field holds a complete value that is not a real date or time (31/02/2026, 25:00) THEN
  its border turns red and the form does not submit, with the form's current error toast; an incomplete
  value is treated as empty where the field is optional and as an error where it is required.
- AC 5. WHEN the operator clicks or taps the calendar icon at the right of the field THEN the app's own
  calendar opens (desktop: a popover under the field; phone: a bottom sheet with 44 px days): month and
  year with ‹ › arrows, weeks starting on Monday, the selected day in orange, today outlined in blue, a
  **Hoy** button, and in datetime mode a time field `HH:MM` that formats itself like the main field.
  The desktop popover always stays inside the visible area with at least 8 px of margin: it aligns to the
  field's left edge by default, to its right edge when the field sits near the right side of the screen
  or of a side panel, and opens above the field when there is no room below.
- AC 6. WHEN a day is picked THEN the field shows it (keeping the typed time, or `00:00` when none in
  datetime mode); date mode closes the calendar, datetime mode keeps it open for the time (phone:
  **Aceptar** closes it); WHEN a complete date is typed THEN the calendar opens on that month.
- AC 7. WHEN a form submits THEN each field sends exactly what it sends today (the scheme book keeps its
  "as written" times, the EMA notification keeps local time, the filters keep their `YYYY-MM-DD`
  bounds), so the backend and the stored values do not change.
- AC 8. WHEN a field already has a value (editing a scheme, an operation or a notification; reopening a
  filter) THEN it shows that value in the new format.

## Out of scope

- How dates are displayed outside inputs (tables, cards, toasts); a later spec can unify them.
- Time zones and how each field interprets its value.
- Date ranges in one control (Desde / Hasta stay two fields).
