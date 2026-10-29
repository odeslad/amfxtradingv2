# 031 — Reliable EA reload after deploy

> Status: **closed**

## Context
The EA pipeline (`.github/workflows/deploy-ea.yml`) ends with `ea/scripts/restart-mt4.ps1`, which reloads the EA on every MT4 terminal: it stops one terminal, runs the AMFX-Watchdog scheduled task (`infra/scripts/startup.ps1`) so it starts it again in the interactive session, and waits up to 120 s for it. The task is configured with `MultipleInstances = IgnoreNew` and each Watchdog run takes a while (backend health check, a delay between terminals), so a `/run` issued while the previous one is still going is silently ignored and the terminal only comes back on a later run. In run #41 (spec 030, EA 3.15) 6 of 12 terminals were reported `[FAILED]`, the script itself printed `Terminals running: 12/12`, the job still exited 1 (red), and the whole reload took ~15 min.

## Affected layers
- infra (`ea/scripts/restart-mt4.ps1`, and `deploy-ea.yml` only if the step needs a new timeout)

## User stories
- As the operator, I want the EA deploy to go green when every terminal ends up running the new EA, so that a red run means a real problem.
- As the operator, I want the reload to take as little as possible, so that terminals are without the EA for the shortest time.

## Acceptance criteria
- AC 1. WHEN the script asks AMFX-Watchdog to start terminals THEN it never issues `/run` while the task is already running (it waits for the task to be idle first), so no request is silently ignored.
- AC 2. WHEN every terminal that was running at the start is running again at the end, in the interactive session (session ≠ 0) THEN the script exits 0, even if some took longer than expected.
- AC 3. WHEN a terminal that was running at the start is not running when the overall timeout expires THEN the script prints which ones are missing and exits 1.
- AC 4. A terminal that is slow to come back is logged as a warning, not as `[FAILED]`.
- AC 5. A full reload of the 12 terminals takes clearly less than today's ~15 min (target: under ~6 min).
- AC 6. The script still never starts `terminal.exe` itself from the SSH session (session 0); only AMFX-Watchdog starts terminals.
- AC 7. WHEN no terminal is running at the start THEN behaviour is unchanged: it asks AMFX-Watchdog to start them and exits 0.

## Out of scope
- Changing `infra/scripts/startup.ps1` or the AMFX-Watchdog task settings.
- Changing the EA itself or the compile/distribute steps of the pipeline.
- Reloading the EA without restarting the terminal.
