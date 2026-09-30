# Specs

Active specs only, one flat folder per spec: `specs/NNN-<slug>/` (`NNN` = sequential number across `specs/` and `archive/`). Each spec has `en/` (working source) and `es/` mirrors of `requirements.md`, `design.md`, `tasks.md` and, during implementation, `verification.md`.

An active spec is never moved. When it closes (last task: Est vs Actual recorded, validated in production) it is moved to `archive/YYYY-MM/` under the month it was closed in. Closed specs are never reopened — a follow-up is a new spec that links to the archived one.

Created with `/amfx-spec-new`, implemented with `/amfx-implement`, tracked with `/amfx-status`, reviewed with `/amfx-branch-review`. Ideas that need exploring before they become specs go through `/epic-explore` (global command) into `epics/`.
