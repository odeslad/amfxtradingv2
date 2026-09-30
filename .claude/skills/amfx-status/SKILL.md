---
name: amfx-status
description: Show the status of AMFX specs — active ones under specs/ (and the archive on request), with phase, task progress, verification state and the layers each spec touches.
---

# amfx-status

Report the state of specs in this repo. Default to the **active** specs (every folder directly under `specs/`); `all` or a month (`2026-09`) adds the matching `archive/` folders.

For each spec folder, determine:

- **Phase**: which of `en/requirements.md` / `en/design.md` / `en/tasks.md` exist (missing tasks.md → still in planning); `> Status:` line of `requirements.md` (draft / approved / implementing / closed).
- **Progress**: checked vs total tasks in `en/tasks.md` (flag any en/es mismatch — the mirrors must be in sync).
- **Layers**: from "Affected layers" and the `[layer]` task prefixes.
- **Verification**: from `en/verification.md` — count ✅/❌/🕐; flag checked tasks with no verification entry (pre-`verification.md` specs record effort in an `Outcome`/`Actual effort` section of `tasks.md` — accept that for archived specs).

Output a compact table:

| Spec | Phase | Tasks | Verification | Layers |
|---|---|---|---|---|
| 004-example | implementing | 3/7 | 3 ✅ · 1 🕐 | backend, frontend |

End with a one-line "next step" (the spec closest to completion, specs stuck in planning, specs whose only open task is the production validation / close). Active specs with every task checked should be closed and archived (see amfx-implement).
