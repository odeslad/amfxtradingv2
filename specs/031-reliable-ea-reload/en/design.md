# 031 — Reliable EA reload after deploy · Design

## Why it is slow and red today

`restart-mt4.ps1`, per terminal: close it (≤10 s) → `schtasks /run AMFX-Watchdog` → poll up to 120 s for it to come back.

A Watchdog run (`infra/scripts/startup.ps1`) checks Postgres and the backend health, then starts every missing terminal and **sleeps `TerminalDelay` = 20 s after each one**. The task is `IgnoreNew`, so while it sleeps it is still `Running` and the next `/run` is dropped. The script has already stopped the next terminal, its `/run` is lost, and that terminal only comes back when some later `/run` lands on an idle task — often after 120 s → false `[FAILED]`, and an `exit 1` driven by that per-terminal flag even when the final count is 12/12.

## Approach (recommended): one at a time, waiting for the Watchdog to be idle

Keep reloading one terminal at a time (only one broker without EA at any moment, and terminal starts stay staggered — memory spikes at start-up were behind the VPS BSODs), but make every `/run` count:

```
for each terminal running at the start:
    close it (CloseMainWindow, 10 s, then Stop-Process -Force)
    Wait-WatchdogIdle            # poll Get-ScheduledTask State until it is not 'Running'
    schtasks /run AMFX-Watchdog
    wait until that exe is running again in session ≠ 0 (soft limit 90 s → WARN, keep going)
at the end:
    Wait-WatchdogIdle, then one last /run if anything is still missing
    wait until every initial exe is running in session ≠ 0, or the overall deadline
    exit 0 if all are back, else list the missing ones and exit 1
```

- The next terminal is closed while the Watchdog is still in its 20 s sleep, so closing overlaps the delay: ~25–30 s per terminal → **~5–6 min for 12** (AC 5), against ~15 min today.
- **The 20 s `TerminalDelay` is kept on purpose** (launching terminals together caused problems): only the *closing* of the next terminal overlaps the Watchdog's sleep, never two starts. Since `/run` is only issued once the Watchdog is idle, two terminal starts are always ≥ 20 s apart.
- `Wait-WatchdogIdle` uses `(Get-ScheduledTask -TaskName AMFX-Watchdog).State`; it has its own timeout (e.g. 120 s) so a hung Watchdog cannot block the deploy forever — it then logs a warning and issues `/run` anyway.
- Exit code depends only on the final state (AC 2, AC 3); a slow terminal is a `[WARN]` line (AC 4).
- Overall deadline: 12 min (parameter `-TimeoutSec`), well inside the GitHub job limit; no workflow change needed.
- "Back" = the same `ExecutablePath` running with `SessionId ≠ 0` (AC 2, AC 6).
- Unchanged: never `Start-Process terminal.exe` from SSH (AC 6); no terminals at start → `/run` once and exit 0 (AC 7).

## Alternative: stop all, one Watchdog run

Stop the 12 terminals, run the Watchdog once; it starts them all, 20 s apart.
- **Pro:** simplest; ~4 min total.
- **Con:** every broker is without EA at the same time (the last one for ~4 min, all pipes `listening`); one failed start leaves the whole fleet down until the next periodic watchdog run.
- Rejected: the one-at-a-time approach is nearly as fast and keeps 11 of 12 brokers live at every moment.

## Files
- `ea/scripts/restart-mt4.ps1` (rewrite of the loop and the exit rule).
- No change to `infra/scripts/startup.ps1`, the AMFX-Watchdog task or `deploy-ea.yml`.

## Verification
The script only runs on the VPS against the live terminals, and a run restarts all of them. Verification is the real thing: trigger `Deploy EA to VPS` by `workflow_dispatch` (no EA change needed) at a quiet moment, and check the step log: no `[FAILED]`, `Terminals running: 12/12`, job green, step duration under ~6 min. The script is also parsed locally (`[System.Management.Automation.Language.Parser]::ParseFile`) before pushing.

## Risks
- **Restarts every terminal**: the validation run is a real reload; do it with no position being managed by hand or accept a few seconds without EA per broker, as with any EA deploy.
- **Watchdog runs on its own schedule too**: a periodic run can be in progress when the script starts; `Wait-WatchdogIdle` covers it.
- **A terminal that really does not start** (bad install, crash at start): reported at the end with exit 1, as intended.
