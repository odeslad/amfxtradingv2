# 031 — Reliable EA reload after deploy · Verification

| Task | Mechanism | Commands | Outcome | Evidence | Est | Actual |
|---|---|---|---|---|---|---|
| 1. [infra] Rewrite `restart-mt4.ps1` | local parse + review against AC 1–7 | `[System.Management.Automation.Language.Parser]::ParseFile(...)` | ✅ pass | 0 parse errors. AC 1: every `/run` goes through `Run-Watchdog` → `Wait-WatchdogIdle` (task `State`, 120 s cap). AC 2/3: exit code from the final check only (each initial exe running with `SessionId ≠ 0`, deadline 720 s), missing ones listed as `[FAILED]`. AC 4: slow terminal → `[WARN]` after 90 s. AC 6: no `Start-Process`. AC 7: no-terminals path unchanged. AC 5 (duration) is measured in task 2 | 1 | 0.5 |
| 2. [infra] Validate on production | manual (user validation) | push `320ccb8..78efba0` → `Deploy EA to VPS` | ✅ pass | Job green in 5 min 1 s total (AC 5). Every one of the 12 terminals logged `Started:` right after its stop, with no `[WARN]` or `[FAILED]` (AC 1–4). The run #41 problem, 6 false `[FAILED]` and about 15 min, is gone | 0.5 | 0.25 |
| 3. [specs] Close the spec | manual | `git mv` to `archive/2026-10/` | ✅ pass | Est vs Actual recorded, status closed | 0.25 | 0.25 |

## Est vs Actual

**Total: 1.75 SP estimated · 1 SP actual.** Calibration: a small infra script change with a clear root cause took about half the estimate. Most of the real cost was waiting for the pipeline.
