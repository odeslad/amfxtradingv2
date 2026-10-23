# 022 — Remove the Scanner section · Tasks

Each task is one conventional commit. The project must build after every task. Tasks of different layers never share a commit. Deploy order: frontend → backend (the page stops calling the endpoint before it goes).

- [x] 1. [frontend] Delete `features/scanner/`, `lib/useScanner.ts`, the `/scanner` route, the nav entry and `IconScanner` · **Verify:** `npm run build` + `npm run lint`; `git grep -i scanner frontend/src` empty; local app: nav without Scanner on desktop and mobile, `/scanner` lands on the Journal, New Trade still shows the setup levels · **Est:** 0.5 SP
- [x] 2. [backend] Delete `routes/scanner.ts` and `services/scanner.ts`, unmount in `app.ts`; `docs/architecture.md` and `.claude/CLAUDE.md` updated (16 routers) · **Verify:** `npm run build`; `git grep -i scanner backend/src` empty; local backend: `GET /scanner` → 404, `GET /setup-levels?…` unchanged · **Est:** 0.5 SP
- [ ] 3. [infra] Push `master` (frontend and backend deploys) and **validate on production**: no Scanner in the nav, `/scanner` → Journal, New Trade levels, an EMA alert still listed and evaluating, `GET /scanner` → 404 · **Verify:** manual (user validation) · **Est:** 0.25 SP
- [ ] 4. [specs] Record Est vs Actual in `verification.md` (both languages), mark the spec closed and archive it under `archive/2026-10/` · **Verify:** manual · **Est:** 0.25 SP

**Total estimate**: 1.5 SP
