# 006 — Footer build numbers · Tasks

Each task is one conventional commit. The project must build after every task. Backend and frontend tasks never share a commit. Deploy order: backend (`/version` must exist before the footer asks for it) → frontend.

- [ ] 1. [backend] Add `src/version.ts` (git commit counts for `backend` and `ea`, `0` + `[VERSION]` warning on failure) and mount `GET /version` in `app.ts` next to `/health` (AC 2, 3). · **Verify:** `npm run build`; local backend → `curl /version` returns `{ "backend": 155, "ea": 28 }` (current counts) · **Est:** 0.5 SP
- [ ] 2. [frontend] `vite.config.ts` `define` for `__BUILD_FRONTEND__` from `git rev-list --count HEAD -- frontend`, declared in `src/vite-env.d.ts` (AC 1, 3). · **Verify:** `npm run build`; grep the built bundle for the current count (157 + this commit) · **Est:** 0.5 SP
- [ ] 3. [frontend] `src/lib/useBuildInfo.ts` hook + footer `build: F.B.E` in `AppLayout.tsx` with `.build` style (mono) in `AppLayout.module.css` (AC 4, 6). · **Verify:** `npm run build`; local frontend against local backend shows `build: <F>.<B>.<E>`; with the backend stopped shows `build: <F>.?.?`; footer hidden at ≤ 768 px · **Est:** 1 SP
- [ ] 4. [infra] Push `master` → backend deploy; then ask the user to trigger the frontend deploy (push already includes it; the frontend workflow runs on the same push since `frontend/**` changed — verify both runs). **Validate on production**: footer shows `build: F.B.E` with the three counts matching `git rev-list --count` on `master` for each directory; `curl https://api-v2.amfxtrading.com/version` matches (AC 5, 11 of the pattern) · **Verify:** manual (user validation) · **Est:** 0.5 SP
- [ ] 5. [specs] Record Est vs Actual in `verification.md` (both languages), mark the spec closed and archive it under `archive/2026-09/` (or the closing month) · **Verify:** manual · **Est:** 0.25 SP

**Total estimate**: 2.75 SP

Note on deploys: this push touches `backend/**` and `frontend/**` in separate commits but one push, so both workflows fire concurrently — the known concurrent-pull failure of the backend deploy may occur (memory: relaunch `deploy.ps1` over SSH if so). Alternative: push the backend commit first, wait for its deploy, then push the frontend commits.
