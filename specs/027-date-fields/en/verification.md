# 027 — One date field · Verification

| Task | Mechanism | Commands | Outcome | Est | Actual |
|---|---|---|---|---|---|
| 1 [frontend] | build + lint + local app on the production API | `npm run build` · `npm run lint` · Vite on 5174 proxied to `api-v2` | ✅ pass | 3 | 2 |
| 2 [frontend] | build + lint + local app | `npm run build` · `npm run lint` · Vite on 5174 proxied to `api-v2` | ✅ pass | 1.5 | 0.5 |

## Evidence

### Task 1

Build and lint clean. Accepted by the user on 2026-10-27 in the local app: digit typing with live
separators in the operation Apertura / Cierre and scheme Inicio / Fin, backspace across separators,
paste, invalid dates in red blocking the save, the app's own calendar (popover right-aligned on the right
column of the side panel, month arrows, Hoy, time field kept when a day is picked, Escape / outside click
close), existing schemes and operations shown in the new format and saved unchanged, the bottom sheet on
the phone. The popover is portalled to `document.body` and placed by measuring it, so the side panels'
`overflow` never clips it.

### Task 2

Build and lint clean. Accepted by the user on 2026-10-27: EMA notification Ends on `DateField`
(datetime, stored as before), Journal and Stats custom-range From / To on `IsoDateField` (the filter
applies once the date is complete, same rows as before, reopened filters show `DD/MM/YYYY`), bottom
sheet on the phone. The native picker's `::-webkit-calendar-picker-indicator` rule was removed from
both filter stylesheets; `.dateInput` stays to drop the select arrow background.
