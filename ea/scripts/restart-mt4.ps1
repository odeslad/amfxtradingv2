# Reloads the EA on every running MT4 terminal, one terminal at a time: stops it
# and lets the AMFX-Watchdog scheduled task (infra/scripts/startup.ps1, running as
# the logged-on Administrator) start it again in the interactive session.
# Never Start-Process terminal.exe from here: a process started from an SSH
# session lands in session 0, invisible, and dies.
# Exit 1 when a terminal does not come back within the timeout.
param(
    [int] $TimeoutSec = 120
)

$task = 'AMFX-Watchdog'

function Running-Terminals {
    @(Get-CimInstance Win32_Process -Filter "Name = 'terminal.exe'" | Select-Object ProcessId, SessionId, ExecutablePath)
}

$initial = Running-Terminals
if ($initial.Count -eq 0) {
    Write-Host "No MT4 terminal running; asking $task to start them"
    schtasks /run /tn $task | Out-Null
    exit 0
}

Write-Host "Reloading $($initial.Count) terminal(s) through $task"
$failed = @()

foreach ($t in $initial) {
    $exe = $t.ExecutablePath
    Write-Host "Stopping: $exe (pid $($t.ProcessId), session $($t.SessionId))"
    $proc = Get-Process -Id $t.ProcessId -ErrorAction SilentlyContinue
    if ($proc) {
        $null = $proc.CloseMainWindow()
        if (-not $proc.WaitForExit(10000)) { Stop-Process -Id $t.ProcessId -Force }
    }

    schtasks /run /tn $task | Out-Null

    $deadline = (Get-Date).AddSeconds($TimeoutSec)
    $back = $false
    while ((Get-Date) -lt $deadline) {
        Start-Sleep -Seconds 5
        $now = Running-Terminals | Where-Object { $_.ExecutablePath -eq $exe }
        if ($now) { $back = $true; Write-Host "Started: $exe (session $($now[0].SessionId))"; break }
    }
    if (-not $back) { Write-Host "[FAILED] $exe did not come back within $TimeoutSec s"; $failed += $exe }
}

$final = Running-Terminals
Write-Host "Terminals running: $($final.Count)/$($initial.Count)"
if ($failed.Count -gt 0 -or $final.Count -lt $initial.Count) { exit 1 }
Write-Host "Done - $($initial.Count) terminal(s) reloaded"
exit 0
