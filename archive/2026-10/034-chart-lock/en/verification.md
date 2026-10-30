# 034 — Chart lock · Verification

| Task | Mechanism | Commands | Outcome | Evidence | Est | Actual |
|------|-----------|----------|---------|----------|-----|--------|
| 1 | build + local check | `npm run build`, `npx eslint` on the touched files | ✅ build, lint and local check (user) | Build and lint clean. Uses the existing `useLocalStorage` hook (key `chart.locked`) instead of a hand-written read/write | 0.75 | 0.25 |
| 2 | build + local check | `npm run build`, `npx eslint src/features/chart`, local Vite against production API | ✅ | User checked locally: lock toggles and survives reload; drag / wheel over drawings, SL/TP lines, position labels and alerts moves the chart; picking Trendline unlocks; unlocked behaviour unchanged | 1.5 | 0.5 |
| 3 | manual (user, production) | push `master` → frontend deploy | ✅ | User validated on production, desktop and mobile: lock blocks drawings, SL/TP, position labels and alerts; reload keeps it; Trendline unlocks. Mobile toolbar overflow found and fixed in `2829401` (Indicators moved into the Draw row) | 0.25 | 0.25 |
| 4 | manual | final `npm run build`, archive | ✅ | Spec closed and archived | 0.25 | 0.1 |

## Est vs Actual

**Total**: 2.75 SP estimated · 1.1 SP actual.

Calibration: frontend-only chart toggles reuse existing hooks and guards and come in well under estimate; the one surprise was mobile toolbar width — check the mobile row budget whenever a toolbar button is added.
