Set-Location C:\amfxtradingv2

Write-Host "Pulling latest code..."
git pull origin master

Write-Host "Installing dependencies..."
Set-Location backend
npm ci --omit=dev

Write-Host "Generating Prisma client..."
npx prisma generate

Write-Host "Running migrations..."
npx prisma migrate deploy

Write-Host "Restarting backend service..."
$running = pm2 list | Select-String "amfxtrading-backend"
if ($running) {
    pm2 restart amfxtrading-backend
} else {
    pm2 start dist/index.js --name amfxtrading-backend
}

pm2 save
Write-Host "Backend deployed successfully"
