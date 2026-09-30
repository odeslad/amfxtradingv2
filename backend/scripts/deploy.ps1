$ErrorActionPreference = 'Stop'

$Root      = 'C:\amfxtradingv2'
$Backend   = Join-Path $Root 'backend'
$Ecosystem = Join-Path $Backend 'ecosystem.config.js'
$AppName   = 'amfxtrading-backend'
$HealthUrl = 'http://localhost:3000/health'
$Dist      = Join-Path $Backend 'dist'
$DistNext  = Join-Path $Backend 'dist.next'
$DistPrev  = Join-Path $Backend 'dist.prev'

# Name of the step being run, so a failure message can point at it.
$script:Step = 'start'
# Set once dist/ holds the new build and dist.prev the old one.
$script:Swapped = $false

function Invoke-Step {
    param([string]$Label, [scriptblock]$Command)
    $script:Step = $Label
    Write-Host "[$Label]"
    # Test hook: never set by the workflow; only an interactive SSH session sets it
    # to rehearse the rollback path (spec 005).
    if ($env:AMFX_DEPLOY_FAIL_AT -eq $Label) { throw "injected failure at '$Label' (AMFX_DEPLOY_FAIL_AT)" }
    & $Command
    if ($LASTEXITCODE -ne 0) { throw "$Label failed with exit code $LASTEXITCODE" }
}

function Test-Health {
    try {
        $r = Invoke-WebRequest -Uri $HealthUrl -UseBasicParsing -TimeoutSec 3
        return $r.StatusCode -eq 200
    } catch { return $false }
}

function Wait-Health([int]$TimeoutSec) {
    $deadline = (Get-Date).AddSeconds($TimeoutSec)
    while ((Get-Date) -lt $deadline) {
        if (Test-Health) { return $true }
        Start-Sleep -Seconds 2
    }
    return $false
}

# pm2 goes through cmd.exe: under $ErrorActionPreference = 'Stop', Windows
# PowerShell 5.1 turns any stderr line of a native command into a terminating
# error, which aborted the rollback the first time it ran (pm2 delete on a
# process that was already gone). Only the exit code matters here.
function Stop-App {
    # Tolerate a missing process: after a crash/BSOD pm2 may have lost the app.
    cmd /c "pm2 delete $AppName >nul 2>&1"
    $global:LASTEXITCODE = 0
}

function Start-App {
    cmd /c "pm2 start `"$Ecosystem`" >nul 2>&1"
    if ($LASTEXITCODE -ne 0) { throw "pm2 start failed with exit code $LASTEXITCODE" }
}

Set-Location $Root

Invoke-Step "git reset" { git reset --hard HEAD }
Invoke-Step "git clean" { git clean -fd }
Invoke-Step "git pull"  { git pull origin master }

Set-Location $Backend

# Stop the running app before touching node_modules: Prisma's native query-engine
# DLL stays locked by the process on Windows and `npm install` would hit EPERM.
# This is why the pre-stop compile gate lives in CI, not here.
Invoke-Step "pm2 delete" { Stop-App }

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

# A previous build we can fall back to.
$rollbackReady = Test-Path (Join-Path $Dist 'index.js')

try {
    # `npm install` (not `npm ci`): ci wipes node_modules and re-links the Prisma
    # DLL, which caused EPERM right after the stop; install updates in place.
    Invoke-Step "npm install"     { npm install }
    Invoke-Step "prisma generate" { node_modules\.bin\prisma generate }
    Invoke-Step "prisma migrate"  { node_modules\.bin\prisma migrate deploy }

    # Compile into a fresh directory: noEmitOnError leaves it empty on type errors,
    # and dist/ is only replaced once the whole build succeeded.
    Invoke-Step "build" {
        if (Test-Path $DistNext) { Remove-Item $DistNext -Recurse -Force }
        node_modules\.bin\tsc --outDir $DistNext
    }
    Invoke-Step "swap dist" {
        if (-not (Test-Path (Join-Path $DistNext 'index.js'))) { throw "build produced no dist.next\index.js" }
        if (Test-Path $DistPrev) { Remove-Item $DistPrev -Recurse -Force }
        if (Test-Path $Dist)     { Rename-Item $Dist $DistPrev }
        Rename-Item $DistNext $Dist
        $script:Swapped = $true
        $global:LASTEXITCODE = 0
    }

    Invoke-Step "pm2 start" { Start-App }
    Invoke-Step "health" {
        if (-not (Wait-Health 30)) { throw "backend did not answer $HealthUrl within 30s" }
        $global:LASTEXITCODE = 0
    }
    Invoke-Step "pm2 save" { pm2 save }

    Write-Host "[OK] Backend deployed and running"
    exit 0
}
catch {
    $failedStep = $script:Step
    Write-Host "[FAILED] step: $failedStep - $_"

    # Once swapped, dist/ holds the build that just failed to come up: put the
    # previous one back before restarting.
    if ($script:Swapped -and (Test-Path $DistPrev)) {
        if (Test-Path $Dist) { Remove-Item $Dist -Recurse -Force }
        Rename-Item $DistPrev $Dist
        Write-Host "[ROLLBACK] restored dist from dist.prev"
    }

    if ($rollbackReady -and (Test-Path (Join-Path $Dist 'index.js'))) {
        try {
            Stop-App
            Start-App
            if (Wait-Health 30) {
                cmd /c "pm2 save >nul 2>&1"
                Write-Host "[ROLLBACK] previous build is running"
            } else {
                Write-Host "[ROLLBACK FAILED] previous build started but $HealthUrl did not answer - backend is DOWN"
            }
        } catch {
            Write-Host "[ROLLBACK FAILED] $_ - backend is DOWN"
        }
    } else {
        Write-Host "[ROLLBACK FAILED] no previous build available - backend is DOWN"
    }
    exit 1
}
