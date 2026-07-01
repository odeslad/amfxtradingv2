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

# Stop and delete so npm ci can replace the locked Prisma DLL
Invoke-Step "pm2 delete" { pm2 delete amfxtrading-backend }
Remove-Item -Recurse -Force "node_modules\.prisma" -ErrorAction SilentlyContinue
Remove-Item -Recurse -Force "node_modules\prisma\engines" -ErrorAction SilentlyContinue

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
