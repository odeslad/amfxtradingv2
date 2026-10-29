# 031 — Reliable EA reload after deploy · Verification

| Task | Mechanism | Commands | Outcome | Evidence | Est | Actual |
|---|---|---|---|---|---|---|
| 1. [infra] Rewrite `restart-mt4.ps1` | local parse + review against AC 1–7 | `[System.Management.Automation.Language.Parser]::ParseFile(...)` | ✅ pass | 0 parse errors. AC 1: every `/run` goes through `Run-Watchdog` → `Wait-WatchdogIdle` (task `State`, 120 s cap). AC 2/3: exit code from the final check only (each initial exe running with `SessionId ≠ 0`, deadline 720 s), missing ones listed as `[FAILED]`. AC 4: slow terminal → `[WARN]` after 90 s. AC 6: no `Start-Process`. AC 7: no-terminals path unchanged. AC 5 (duration) is measured in task 2 | 1 | 0.5 |
