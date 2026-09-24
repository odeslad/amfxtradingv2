# Ensures the backend and every MT4 terminal listed in brokers.json are running.
# Idempotent: safe to run at logon and periodically as a watchdog.

$ErrorActionPreference = 'Continue'

$BrokersFile   = 'C:\amfxtradingv2\backend\brokers.json'
$BackendEntry  = 'C:\amfxtradingv2\backend\dist\index.js'
$BackendName   = 'amfxtrading-backend'
$HealthUrl     = 'http://localhost:3000/health'
$LogDir        = 'C:\monitoring'
$LogFile       = Join-Path $LogDir 'startup.log'
$TerminalDelay = 20

function Log([string]$Message) {
    if (-not (Test-Path $LogDir)) { New-Item -ItemType Directory -Path $LogDir | Out-Null }
    $line = "$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss') $Message"
    Add-Content -Path $LogFile -Value $line
    Write-Host $line
}

function Wait-Service([string]$Name, [int]$TimeoutSec) {
    $deadline = (Get-Date).AddSeconds($TimeoutSec)
    while ((Get-Date) -lt $deadline) {
        $svc = Get-Service -Name $Name -ErrorAction SilentlyContinue
        if ($svc -and $svc.Status -eq 'Running') { return $true }
        Start-Sleep -Seconds 5
    }
    return $false
}

function Test-BackendHealth {
    try {
        $r = Invoke-WebRequest -Uri $HealthUrl -UseBasicParsing -TimeoutSec 5
        return $r.StatusCode -eq 200
    } catch { return $false }
}

function Wait-BackendHealth([int]$TimeoutSec) {
    $deadline = (Get-Date).AddSeconds($TimeoutSec)
    while ((Get-Date) -lt $deadline) {
        if (Test-BackendHealth) { return $true }
        Start-Sleep -Seconds 3
    }
    return $false
}

function Ensure-Backend {
    if (Test-BackendHealth) { Log "backend: healthy"; return $true }

    Log "backend: not responding, trying pm2 resurrect"
    pm2 resurrect 2>&1 | Out-Null
    if (Wait-BackendHealth 30) { Log "backend: up after resurrect"; return $true }

    Log "backend: resurrect did not bring it up, starting explicitly"
    pm2 delete $BackendName 2>&1 | Out-Null
    pm2 start $BackendEntry --name $BackendName `
        --node-args="--expose-gc --max-old-space-size=1024" `
        --max-memory-restart 1200M 2>&1 | Out-Null
    pm2 save 2>&1 | Out-Null
    if (Wait-BackendHealth 30) { Log "backend: up after pm2 start"; return $true }

    Log "backend: ERROR still not healthy"
    return $false
}

function Get-TerminalTargets {
    $brokers = Get-Content $BrokersFile -Raw | ConvertFrom-Json
    foreach ($b in $brokers) {
        # bridgePath = <dataDir>\MQL4\Files\bridge
        $dataDir = Split-Path (Split-Path (Split-Path $b.bridgePath -Parent) -Parent) -Parent
        $originFile = Join-Path $dataDir 'origin.txt'
        if (-not (Test-Path $originFile)) { Log "terminal [$($b.name)]: WARN origin.txt missing in $dataDir"; continue }
        $installDir = (Get-Content $originFile -Raw).Trim()
        $exe = Join-Path $installDir 'terminal.exe'
        if (-not (Test-Path $exe)) { Log "terminal [$($b.name)]: WARN terminal.exe missing at $exe"; continue }
        [pscustomobject]@{ Name = $b.name; Exe = $exe; InstallDir = $installDir }
    }
}

function Ensure-Terminals {
    $running = @(Get-CimInstance Win32_Process -Filter "Name = 'terminal.exe'" | Select-Object -ExpandProperty ExecutablePath)
    $targets = @(Get-TerminalTargets)
    $started = 0
    foreach ($t in $targets) {
        if ($running -contains $t.Exe) { continue }
        Log "terminal [$($t.Name)]: starting $($t.Exe)"
        Start-Process -FilePath $t.Exe -WorkingDirectory $t.InstallDir
        $started++
        Start-Sleep -Seconds $TerminalDelay
    }
    $alive = @(Get-CimInstance Win32_Process -Filter "Name = 'terminal.exe'").Count
    Log "terminals: $alive/$($targets.Count) running ($started started now)"
    return ($alive -ge $targets.Count)
}

Log "---- run start ----"

if (-not (Wait-Service 'postgresql-x64-17' 120)) { Log "postgres: ERROR not running after 120s" }
else { Log "postgres: running" }

$backendOk   = Ensure-Backend
$terminalsOk = Ensure-Terminals

if ($backendOk -and $terminalsOk) { Log "---- run end: OK ----" }
else { Log "---- run end: DEGRADED (backend=$backendOk terminals=$terminalsOk) ----" }
