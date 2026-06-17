$processes = Get-Process -Name 'terminal' -ErrorAction SilentlyContinue

if (-not $processes) {
    Write-Host "No MT4 instances running"
    exit 0
}

foreach ($p in $processes) {
    $exe = $p.Path
    Write-Host "Stopping: $exe"
    Stop-Process -Id $p.Id -Force
    Start-Sleep -Seconds 3
    Start-Process -FilePath $exe
    Write-Host "Started: $exe"
}

Write-Host "Done — $($processes.Count) instance(s) restarted"
