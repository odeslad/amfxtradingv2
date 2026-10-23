# 022 — Remove the Scanner section · Verification

| Task | Mechanism | Outcome | Est | Actual |
|---|---|---|---|---|
| 1 | `npm run build` + `npm run lint` + `git grep` + local app (user) | ✅ | 0.5 | 0.25 |
| 2 | `npm run build` + `git grep` + local backend probes | ✅ | 0.5 | 0.5 |

## Task 1 — Scanner page, hook, route, nav entry and icon removed (frontend)

- Deleted `src/features/scanner/` (page + CSS module) and `src/lib/useScanner.ts`; `app/Router.tsx` without the import and the `/scanner` route (the `*` route sends it to `/` → `/journal`); `app/layout/AppLayout.tsx` without the Scanner nav entry; `shared/ui/icons.tsx` without `IconScanner`.
- `npm run build` and `npx eslint src` clean; `git grep -i scanner -- frontend/src` empty.
- Local app (Vite 5174 against the production API), checked by the user on 2026-10-23: nav without Scanner, `/scanner` lands on the Journal, New Trade still shows the setup levels.
- Est vs Actual: 0.5 vs 0.25 SP.

## Task 2 — Scanner route and service removed, docs updated (backend)

- Deleted `src/routes/scanner.ts` and `src/services/scanner.ts`; `app.ts` without the import and the `/scanner` mount (16 routers). `docs/architecture.md`: the tree line and the endpoints row gone; `.claude/CLAUDE.md`: routers list 17 → 16. `indicators/*` untouched.
- `npm run build` clean; `grep -ri scanner backend/src backend/docs .claude/CLAUDE.md` empty.
- Local backend (3001, bridges off, production database through the 5433 tunnel): `GET /scanner?…` → 404 (no router at all, same as `/nonexistent`), `GET /setup-levels?…` → 401 without a cookie, i.e. still mounted behind `requireAuth`; `/health` 200.
- Est vs Actual: 0.5 vs 0.5 SP.
