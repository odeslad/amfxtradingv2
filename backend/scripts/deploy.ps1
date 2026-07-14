$ErrorActionPreference = 'Stop'

function Invoke-Step {
    param([string]$Label, [scriptblock]$Command)
    Write-Host "[$Label]"
    & $Command
    if ($LASTEXITCODE -ne 0) { throw "$Label failed with exit code $LASTEXITCODE" }
}

Set-Location C:\amfxtradingv2

Invoke-Step "git reset" { git reset --hard HEAD }
Invoke-Step "git clean" { git clean -fd }
Invoke-Step "git pull" { git pull origin master }

Set-Location backend

# Stop the running app first. Use `npm install` (not `npm ci`): ci wipes
# node_modules and must unlink Prisma's native query-engine DLL, which stays
# locked by the process for a moment on Windows and caused EPERM. install
# updates in place without deleting the DLL, avoiding the lock entirely.
# Tolerate a missing process: after a crash/BSOD pm2 may have lost the app
# (the orphan cleanup below still frees the port), so absence is not an error.
Invoke-Step "pm2 delete" {
    pm2 delete amfxtrading-backend
    if ($LASTEXITCODE -ne 0) { Write-Host "  not registered in pm2, continuing" }
    $global:LASTEXITCODE = 0
}

# pm2 can lose track of its child (e.g. after a BSOD or failed restart), leaving
# an orphaned node.exe holding port 3000 and making pm2 start loop on EADDRINUSE.
# Kill it only if it is actually the backend; anything else holding the port is
# a config conflict and must fail the deploy, not get killed.
Invoke-Step "free port 3000" {
    $ownerPids = Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue |
        Select-Object -ExpandProperty OwningProcess -Unique
    foreach ($ownerPid in $ownerPids) {
        $proc = Get-CimInstance Win32_Process -Filter "ProcessId = $ownerPid"
        if ($null -eq $proc) { continue }
        # pm2 forks run wrapped in ProcessContainerFork.js, so the backend path
        # never appears in their command line — a pm2 child on OUR port is ours.
        $isBackend = $proc.CommandLine -like '*amfxtradingv2\backend*' -or
            $proc.CommandLine -like '*pm2\lib\ProcessContainerFork.js*'
        if ($isBackend) {
            Write-Host "  killing orphaned backend process $ownerPid"
            Stop-Process -Id $ownerPid -Force
        } else {
            throw "Port 3000 is held by unrelated process $ownerPid ($($proc.Name)): $($proc.CommandLine)"
        }
    }
    $global:LASTEXITCODE = 0
}

Invoke-Step "npm install" { npm install }
Invoke-Step "prisma generate" { node_modules\.bin\prisma generate }
Invoke-Step "prisma migrate" { node_modules\.bin\prisma migrate deploy }
Invoke-Step "build" { npm run build }

Invoke-Step "pm2 start" {
    pm2 start C:\amfxtradingv2\backend\dist\index.js --name amfxtrading-backend `
        --node-args="--expose-gc --max-old-space-size=450" `
        --max-memory-restart 500M
}

Invoke-Step "pm2 save" { pm2 save }

Write-Host "[OK] Backend deployed and running"
