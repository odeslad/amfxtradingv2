# 034 — Chart lock · Verification

| Task | Mechanism | Commands | Outcome | Evidence | Est | Actual |
|------|-----------|----------|---------|----------|-----|--------|
| 1 | build + local check | `npm run build`, `npx eslint` on the touched files | ✅ build, lint and local check (user) | Build and lint clean. Uses the existing `useLocalStorage` hook (key `chart.locked`) instead of a hand-written read/write | 0.75 | 0.25 |
| 2 | build + local check | `npm run build`, `npx eslint src/features/chart`, local Vite against production API | ✅ | User checked locally: lock toggles and survives reload; drag / wheel over drawings, SL/TP lines, position labels and alerts moves the chart; picking Trendline unlocks; unlocked behaviour unchanged | 1.5 | 0.5 |
