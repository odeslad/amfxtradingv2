# 027 — One date field · Design

## Approach

One shared input in `src/shared/ui/` with its own calendar, plus pure helpers in `src/lib/dateField.ts`.
Every consumer keeps the value shape it has today and converts at its edge, so nothing sent to the
backend changes (AC 7). No dependency: the calendar is a month grid built with React and CSS Modules.

## Pure helpers — `lib/dateField.ts`

```ts
type DateMode = 'date' | 'datetime';
interface DateParts { year: number; month: number; day: number; hour: number; minute: number } // month 0-11

formatDigits(raw: string, mode, prev?: string): string // keeps digits, inserts "/", " ", ":"; a deleted
                                                        // separator also drops the digit before it (AC 2, AC 3)
isComplete(text, mode): boolean                         // 10 or 16 characters
parseDisplay(text, mode): DateParts | null              // null when incomplete or not a real date / time (AC 4)
toDisplay(parts, mode): string                          // "DD/MM/YYYY" or "DD/MM/YYYY HH:MM"
isoDateToDisplay('2026-10-14') → '14/10/2026'           // filters, scheme start / end
displayToIsoDate('14/10/2026') → '2026-10-14' | null
```

`formatDigits` caps at 8 / 12 digits and works on pasted text the same way.

## Components — `shared/ui/DateField.tsx` (+ `.module.css`), `shared/ui/Calendar.tsx` (+ `.module.css`)

- **`DateField`** (controlled by display text): props `mode`, `value` (display text), `onChange(text)`,
  `id`, `required`, `invalid?` (forced red), `className` for the consumer's input style. Renders an
  `<input type="text" inputMode="numeric" placeholder="DD/MM/YYYY[ HH:MM]">`, the calendar icon button
  inside the field on the right, and the red border when `isComplete && !parseDisplay`. Typing goes
  through `formatDigits(e.target.value, mode, value)`.
- **`IsoDateField`**: a thin wrapper for fields whose value is `YYYY-MM-DD` (scheme Inicio / Fin, Journal
  and Stats filters). It keeps the display text in local state, emits the ISO date when the text is a
  valid complete date and `''` when cleared, and resyncs its text when the outside value changes (AC 8).
- **`Calendar`**: month grid, Monday first (`(getDay() + 6) % 7` offset), ‹ › month arrows, selected day
  orange, today outlined blue, **Hoy**; in datetime mode a time input formatted `HH:MM` with the same
  digit rule. Picking a day keeps the typed time (or `00:00`); date mode closes, datetime mode stays
  open; on the phone an **Aceptar** button closes (AC 6). The calendar's visible month follows the field
  when a complete valid date is typed.
- **Desktop popover**: rendered with `createPortal` to `document.body`, `position: fixed`, z-index 60
  (above the 50 of side panels), so the panels' `overflow` never clips it. Position computed in
  `useLayoutEffect` from the field's `getBoundingClientRect()` and the popover's size: left-aligned by
  default, right-aligned to the field when that would cross `innerWidth − 8`, above the field when it
  would cross `innerHeight − 8`, clamped to 8 px on every side (AC 5). Recomputed on scroll / resize
  while open; closes on outside click, Escape and field blur outside it.
- **Phone (≤ 768 px)**: the same `Calendar` as a bottom sheet (portal, fixed, full width, backdrop,
  44 px days); `matchMedia('(max-width: 768px)')` decides which one opens.

## Consumers

| Place | Field(s) | Value today | Change |
|---|---|---|---|
| `book/TradePanel` | Apertura, Cierre | display text, `parseBookInput` | `DateField mode="datetime"`; `parseBookInput` unchanged |
| `book/SchemePanel` | Inicio, Fin | `YYYY-MM-DD` | `IsoDateField` |
| `settings/NotificationPanel` | Ends | display text, local `parseLocalInput` | `DateField mode="datetime"` |
| `journal/FiltersPanel` | From, To | `YYYY-MM-DD` | `IsoDateField` (min / max dropped: validated on apply as today by the range bounds) |
| `stats/StatsFilters` | From, To | `YYYY-MM-DD` | `IsoDateField` |

The error toasts of each form stay as they are; `required` keeps its meaning (AC 4).

## Files

```
frontend/src/lib/dateField.ts                                   new
frontend/src/shared/ui/DateField.tsx (+ .module.css)            new
frontend/src/shared/ui/Calendar.tsx (+ .module.css)             new
frontend/src/features/book/TradePanel.tsx, SchemePanel.tsx      edit
frontend/src/features/settings/NotificationPanel.tsx            edit
frontend/src/features/journal/FiltersPanel.tsx                  edit
frontend/src/features/stats/StatsFilters.tsx                    edit
```

## Mockup

Design artifact approved by the user on 2026-10-27: https://claude.ai/artifact/7rBJBwxgMhLUsRc3h2bh8b.
Artboards: DateField · escritorio (interactive: two fields, live digit formatting, validation, the
calendar popover open with month arrows, selected / today days, Hoy and the time field), DateField ·
móvil (bottom sheet over the trade panel with 44 px days, time field, Hoy and Aceptar).

## Risks

- The Journal / Stats filters lose the native `min` / `max` between From and To; a reversed range already
  yields no rows, and the filter code keeps working on the ISO strings.
- iOS Safari zooms into inputs under 16 px: the phone font of the field stays at `--text-xl` like the
  other panel inputs.
