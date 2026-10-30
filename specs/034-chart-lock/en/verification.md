# 034 — Chart lock · Verification

| Task | Mechanism | Commands | Outcome | Evidence | Est | Actual |
|------|-----------|----------|---------|----------|-----|--------|
| 1 | build + local check | `npm run build`, `npx eslint` on the touched files | 🕐 build ✅, local check pending (toggle + reload) together with task 2 | Build and lint clean. Uses the existing `useLocalStorage` hook (key `chart.locked`) instead of a hand-written read/write | 0.75 | 0.25 |
