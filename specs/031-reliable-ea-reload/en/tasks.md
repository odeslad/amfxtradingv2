# 031 — Reliable EA reload after deploy · Tasks

Each task is one conventional commit. The project must build after every task. Deploy order: the script ships with any push to `ea/**`; validation is a manual `workflow_dispatch` of `Deploy EA to VPS`.

- [x] 1. [infra] Rewrite `ea/scripts/restart-mt4.ps1`: `Wait-WatchdogIdle` (task `State`, 120 s cap) before every `/run`, per-terminal soft wait 90 s → `[WARN]`, final check of every initial exe in session ≠ 0 within `-TimeoutSec` (12 min), exit 1 only listing the missing ones; unchanged no-terminals path and no `Start-Process terminal.exe` · **Verify:** local parse with `[System.Management.Automation.Language.Parser]::ParseFile` (no errors) + review against AC 1–7 · **Est:** 1 SP
- [ ] 2. [infra] Push `master` and **validate on production**: run `Deploy EA to VPS` by `workflow_dispatch` at a quiet moment; in the "Reload the EA on every terminal" step check no `[FAILED]`, `Terminals running: 12/12`, job green, step under ~6 min; `/health` shows every pipe `connected` afterwards · **Verify:** manual (user validation) · **Est:** 0.5 SP
- [ ] 3. [specs] Record Est vs Actual in `verification.md` (both languages), mark the spec closed and archive it under `archive/YYYY-MM/` · **Verify:** manual · **Est:** 0.25 SP

**Total estimate**: 1.75 SP
