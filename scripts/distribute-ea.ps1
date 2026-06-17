$terminals = Get-ChildItem 'C:\Users\Administrator\AppData\Roaming\MetaQuotes\Terminal\' -Directory
$count = 0

foreach ($t in $terminals) {
    $dest = Join-Path $t.FullName 'MQL4\Experts\'
    if (-not (Test-Path $dest)) { continue }

    Copy-Item 'C:\deploy\HttpBridgeCommands.mq4' $dest -Force
    Copy-Item 'C:\deploy\HttpBridgeState.mq4'    $dest -Force

    if (Test-Path 'C:\deploy\HttpBridgeCommands.ex4') { Copy-Item 'C:\deploy\HttpBridgeCommands.ex4' $dest -Force }
    if (Test-Path 'C:\deploy\HttpBridgeState.ex4')    { Copy-Item 'C:\deploy\HttpBridgeState.ex4'    $dest -Force }

    Write-Host "Deployed to $dest"
    $count++
}

Write-Host "Total MT4 instances updated: $count"
