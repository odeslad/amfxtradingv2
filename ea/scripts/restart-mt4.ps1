# Reloads the EA on every running MT4 terminal, one terminal at a time: stops it
# and lets the AMFX-Watchdog scheduled task (infra/scripts/startup.ps1, running as
# the logged-on Administrator) start it again in the interactive session.
# Never Start-Process terminal.exe from here: a process started from an SSH
# session lands in session 0, invisible, and dies.
# The task ignores /run while it is still running (it sleeps 20 s after each
# start), so every /run waits for it to be idle first (spec 031).
# Exit 1 only when a terminal is still missing at the end.
param(
    [int] $TimeoutSec = 720,
    [int] $SoftWaitSec = 90,
    [int] $IdleWaitSec = 120
)

$task = 'AMFX-Watchdog'
$deadline = (Get-Date).AddSeconds($TimeoutSec)

function Running-Terminals {
    @(Get-CimInstance Win32_Process -Filter "Name = 'terminal.exe'" | Select-Object ProcessId, SessionId, ExecutablePath)
}

function Is-Back([string] $exe) {
    [bool](Running-Terminals | Where-Object { $_.ExecutablePath -eq $exe -and $_.SessionId -ne 0 })
}

function Wait-WatchdogIdle {
    $limit = (Get-Date).AddSeconds($IdleWaitSec)
    while ((Get-ScheduledTask -TaskName $task).State -eq 'Running') {
        if ((Get-Date) -ge $limit) { Write-Host "[WARN] $task still running after $IdleWaitSec s, asking anyway"; return }
        Start-Sleep -Seconds 2
    }
}

function Run-Watchdog {
    Wait-WatchdogIdle
    schtasks /run /tn $task | Out-Null
}

$initial = Running-Terminals
if ($initial.Count -eq 0) {
    Write-Host "No MT4 terminal running; asking $task to start them"
    schtasks /run /tn $task | Out-Null
    exit 0
}

$started = Get-Date
Write-Host "Reloading $($initial.Count) terminal(s) through $task"

foreach ($t in $initial) {
    $exe = $t.ExecutablePath
    Write-Host "Stopping: $exe (pid $($t.ProcessId), session $($t.SessionId))"
    $proc = Get-Process -Id $t.ProcessId -ErrorAction SilentlyContinue
    if ($proc) {
        $null = $proc.CloseMainWindow()
        if (-not $proc.WaitForExit(10000)) { Stop-Process -Id $t.ProcessId -Force }
    }

    Run-Watchdog

    $soft = (Get-Date).AddSeconds($SoftWaitSec)
    while (-not (Is-Back $exe) -and (Get-Date) -lt $soft) { Start-Sleep -Seconds 3 }
    if (Is-Back $exe) { Write-Host "Started: $exe" }
    else { Write-Host "[WARN] $exe not back after $SoftWaitSec s, checking again at the end" }
}

$missing = @($initial | Where-Object { -not (Is-Back $_.ExecutablePath) })
if ($missing.Count -gt 0) { Run-Watchdog }
while ($missing.Count -gt 0 -and (Get-Date) -lt $deadline) {
    Start-Sleep -Seconds 5
    $missing = @($initial | Where-Object { -not (Is-Back $_.ExecutablePath) })
}

$final = Running-Terminals
$elapsed = [int]((Get-Date) - $started).TotalSeconds
Write-Host "Terminals running: $($final.Count)/$($initial.Count) in $elapsed s"
if ($missing.Count -gt 0) {
    foreach ($m in $missing) { Write-Host "[FAILED] $($m.ExecutablePath) is not running" }
    exit 1
}
Write-Host "Done - $($initial.Count) terminal(s) reloaded"
exit 0
