---
name: amfx-implement
description: Implement an approved AMFX spec task by task inside this monorepo, verifying and committing each task atomically and tracking progress in the spec's tasks.md and verification.md.
---

# amfx-implement

Implement a spec from `specs/NNN-<slug>/` (active specs live flat under `specs/`; closed ones under `archive/YYYY-MM/` and are never reopened — a follow-up is a new spec). Documents live in `en/` (working source) with a Spanish mirror in `es/` — any update to one must update the other. If the user didn't name one, list specs with unchecked tasks and ask which to work on. If `en/tasks.md` is missing, stop: `/amfx-spec-new` is not finished.

## Before starting

- Work on `master` (no feature branches in this project). Check `git status` is clean; there is an old foreign stash — never use `git stash` to separate work, separate commits with `git add` by path.
- Read `requirements.md` + `design.md` fully once, plus the `.claude/CLAUDE.md` sections relevant to the touched layers.

## Per task loop

1. Read the next unchecked task in `en/tasks.md` and identify its layer (`[backend]`, `[frontend]`, `[ea]`, `[db]`, `[infra]`, `[specs]`).
2. Implement exactly what the task and design describe — no extra scope — following the layer's existing style (functional TS, strict types, CSS Modules with the design-system variables, no `any`).
3. **Mandatory verification** — a task CANNOT be checked off or committed without it:
   - Run the mechanism declared in `tasks.md` plus the layer baseline: `backend` → `npm run build`; `frontend` → `npm run build` (never only `tsc --noEmit`); `db` → `prisma generate`; `ea` → the user compiles in MetaEditor.
   - Record the result in `<spec>/en/verification.md` (mirrored in `es/`): task number, mechanism, commands run, outcome (✅ pass / ❌ fail / 🕐 pending manual validation), evidence, and **Est vs Actual** in SP with a one-line note when they diverge.
   - For `manual` mechanisms: document the exact steps and keep the entry 🕐 until the user confirms.
   - If verification fails, fix before committing — never commit or check off a failing task.
4. Mark the task `[x]` in `en/tasks.md` and mirror it in `es/tasks.md`.
5. **Pause before staging**: show the user the files to stage and wait. Then commit — Conventional Commit with the layer as scope, English, imperative; the spec reference goes in the **body**:

   ```
   feat(backend): store balance operations from the EA

   Spec: 003-stats-cashflow-chart (task 2)
   ```

   Include the `tasks.md`/`verification.md` updates (both languages) in the same commit. Never mix layers in one commit.
6. **Checkpoint — do NOT chain tasks automatically**: summarize what was done (commit, verification) and ask whether to continue. Stop and report if a task is blocked, ambiguous, or the design turns out wrong — propose updating `design.md`/`tasks.md` instead of improvising around the spec.

## Deploy, validation and close

- **Never push without asking.** Pushing `master` triggers the pipelines: backend deploy first; the frontend deploy only when the user asks for it; a mixed push can break the backend `git pull` (relaunch `deploy.ps1` over SSH if so). The EA is deployed manually by the user.
- **The closing gate is production**: the penultimate task is the user's validation on the deployed app against the acceptance criteria. Give the exact pages/data to check; the task is checked off only on the user's confirmation.
- **Close (last `[specs]` task)**: run every touched layer's build once more; complete `verification.md` (both languages) with Est vs Actual per task, the total and a one-line calibration note, plus any deviations agreed and anything left pending on the user; set `> Status: **closed**` in `requirements.md`; then `git mv specs/NNN-<slug> archive/YYYY-MM/` (current month) and commit `docs(specs): close spec NNN-<slug>`.
- Summarize: what changed per layer, commits made, what is pending (push, deploys, EA reload).
