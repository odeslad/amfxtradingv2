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
Invoke-Step "pm2 delete" { pm2 delete amfxtrading-backend }

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
