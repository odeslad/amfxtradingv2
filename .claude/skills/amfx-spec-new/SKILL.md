---
name: amfx-spec-new
description: Create a new AMFX spec (requirements + design + tasks) under specs/NNN-<slug>/, declaring which layers of the monorepo it touches (backend, frontend, ea, db, infra). Use when the user wants to plan a new feature, fix or refactor before writing code.
---

# amfx-spec-new

Create a spec under `specs/NNN-<kebab-slug>/` in this repo. `NNN` is the next sequential number across `specs/` **and** `archive/` (zero-padded, 3 digits). A follow-up of a closed spec is a new spec with its own number that links to the archived parent — closed specs are never reopened.

Work in three phases. **Approval gates are strict**: after drafting each document (requirements, design, tasks), present it to the user and explicitly ask for approval or discussion. Do NOT start drafting the next document until the current one is approved.

**Language mirror**: documents live in `<spec>/en/` (English, working source) with a Spanish mirror in `<spec>/es/` (same filenames). Any edit to one language must immediately update the other.

**Layers** (the monorepo has no separate repos; each task names its layer in brackets):

| Layer | Path | Verification baseline |
|---|---|---|
| `[backend]` | `backend/` | `npm run build` (tsc) |
| `[frontend]` | `frontend/` | `npm run build` — never just `tsc --noEmit` |
| `[ea]` | `ea/` | MetaEditor compile (manual, user) |
| `[db]` | `backend/prisma/` | `prisma generate` + migration file compiles |
| `[infra]` | `infra/`, `.github/` | manual |

## 1. requirements.md

```markdown
# NNN — <Feature name>

> Status: **draft**

## Context
<one paragraph: why this spec exists, what exists today>

## Affected layers
- backend · frontend · ea · db · infra (only the ones touched)

## User stories
- As a <role>, I want <capability>, so that <benefit>.

## Acceptance criteria
- AC 1. WHEN <condition> THEN <expected behavior>

## Out of scope
```

## 2. design.md

Explore the affected layers (structure, conventions, relevant code, `.claude/CLAUDE.md` design system and backend architecture sections) before writing. Include: approach, per-layer changes, data flow between layers (EA ↔ bridge ↔ backend ↔ WS/API ↔ frontend) when the spec spans several, files to touch, DB schema/migration changes, and risks. Propose alternatives with pros/cons when relevant. If a change breaks the EA ↔ backend contract, say so explicitly.

## 3. tasks.md

```markdown
# NNN — <Feature name> · Tasks

Each task is one conventional commit. The project must build after every task. Tasks of different layers never share a commit. Deploy order: <backend → frontend → ea, adapted to the spec>.

- [ ] 1. [backend] <task> · **Verify:** <build | vitest | manual — what proves it works> · **Est:** <N> SP
- [ ] 2. [frontend] <task> · **Verify:** <mechanism> · **Est:** <N> SP
- [ ] N-1. [infra] Push `master` (backend deploy first; frontend deploy only when the user asks; EA deployed manually) and **validate on production against the spec** — list the exact pages/data to check · **Verify:** manual (user validation) · **Est:** <N> SP
- [ ] N. [specs] Record Est vs Actual in `verification.md` (both languages), mark the spec closed and archive it under `archive/YYYY-MM/` · **Verify:** manual · **Est:** 0.25 SP

**Total estimate**: <N> SP
```

**Estimation**: 1 SP = 1 hour of senior developer work. Calibrate against the `Actual effort` / Est vs Actual sections of archived specs. On completion the actual effort is recorded per task in `verification.md`.

Every task MUST declare its verification mechanism; a task without a feasible verification is not a valid task.

Rules: tasks are atomic (one logical commit each); order respects dependencies and the deploy order (a backend change that the frontend consumes ships first; an EA change that produces data the backend must store ships last); commit scope follows the layer (`feat(backend):`, `fix(frontend):`, `feat(db):`, `feat(ea):`, `chore(infra):`). No feature branches: work goes to `master` in atomic commits (the push triggers the deploy pipeline — see the memory on deploy order). Never add dependencies unless `design.md` lists and justifies them.

After approval, commit the spec: `docs(specs): add spec NNN-<slug>`. Ask before staging — the user reviews first.
