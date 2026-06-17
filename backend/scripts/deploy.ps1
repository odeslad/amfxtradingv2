Set-Location C:\amfxtradingv2

Write-Host "Pulling latest code..."
git pull origin master

Set-Location backend

Write-Host "Stopping backend..."
pm2 stop amfxtrading-backend

Write-Host "Installing dependencies..."
npm ci

Write-Host "Generating Prisma client..."
node_modules\.bin\prisma generate

Write-Host "Running migrations..."
node_modules\.bin\prisma migrate deploy

Write-Host "Building..."
npm run build

Write-Host "Restarting backend..."
pm2 restart amfxtrading-backend

pm2 save
Write-Host "Backend deployed successfully"
