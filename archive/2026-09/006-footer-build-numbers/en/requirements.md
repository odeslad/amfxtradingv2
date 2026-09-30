# 006 — Footer build numbers

> Status: **closed**

## Context

The app footer shows `AMFX Trading Terminal v2.0 · © 2026` and nothing identifies which build of each layer is running. Deploys are per layer (frontend, backend, EA) from `master`, so the user wants a build stamp `frontend.backend.ea` where each number increases only when its own layer changes. The number of commits on `master` that touch each layer's directory (`git rev-list --count HEAD -- <dir>`) has exactly that property, needs no manual bump and is available on the VPS because both builds run from the git checkout. Today the counts are `157.155.28`.

## Affected layers

- backend
- frontend

## User stories

- As the user, I want to see `build: F.B.E` in the footer, so that I know at a glance which frontend, backend and EA revisions are deployed.
- As the user, I want a number to change only when its layer changes, so that a frontend-only deploy is visible as such.

## Acceptance criteria

- AC 1. WHEN the frontend is built THEN its build number is the count of commits touching `frontend/` at build time, embedded as a compile-time constant (no runtime git call in the browser).
- AC 2. WHEN `GET /version` is called THEN the backend answers `200 { "backend": <n>, "ea": <n> }` where each number is the count of commits touching `backend/` and `ea/` in the checkout the process runs from, computed once at startup; the route needs no authentication (like `/health`).
- AC 3. WHEN git is unavailable or the command fails THEN the affected number is `0` and startup/build continue with a logged warning.
- AC 4. WHEN the footer renders THEN it shows `AMFX Trading Terminal v2.0 · © <year> · build: F.B.E` using the frontend constant and the `/version` response; while `/version` has not answered (or fails) the backend and EA parts show `?` (`build: 157.?.?`).
- AC 5. WHEN a commit touches only `frontend/` THEN after deploying only the first number changes; the same holds for `backend/` and `ea/`.
- AC 6. WHEN the footer is rendered on mobile (≤ 768 px) THEN it stays hidden as today.

## Out of scope

- Reporting the EA build actually loaded in MT4 (would require the EA to send its version through `account.json`); the EA number reflects the checkout on the VPS.
- Showing the git SHA or a deploy timestamp.
- Any change to the EA layer.
