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

# Stop the app AND kill any orphan node processes so the Prisma query engine
# DLL is released; Windows keeps the file handle for a moment after pm2 delete,
# which made npm ci fail with EPERM on the locked DLL. Kill, wait, then delete
# with retries until the handle is gone.
Invoke-Step "pm2 delete" { pm2 delete amfxtrading-backend; $global:LASTEXITCODE = 0 }
Get-Process node -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
Start-Sleep -Seconds 3

function Remove-WithRetry([string]$Path) {
    for ($i = 0; $i -lt 5; $i++) {
        if (-not (Test-Path $Path)) { return }
        try { Remove-Item -Recurse -Force $Path -ErrorAction Stop; return }
        catch { Start-Sleep -Seconds 2 }
    }
}
Remove-WithRetry "node_modules\.prisma"
Remove-WithRetry "node_modules\prisma\engines"

Invoke-Step "npm ci" { npm ci }
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
