$editor = Get-ChildItem 'C:\Program Files (x86)' -Recurse -Filter 'metaeditor.exe' -ErrorAction SilentlyContinue | Select-Object -First 1
if (-not $editor) { Write-Error 'metaeditor.exe not found'; exit 1 }
Write-Host "Using metaeditor: $($editor.FullName)"

foreach ($f in @('HttpBridgeCommands.mq4', 'HttpBridgeState.mq4')) {
    $path = "C:\amfxtradingv2\ea\$f"
    $proc = Start-Process -FilePath $editor.FullName -ArgumentList "/compile:`"$path`"", '/log' -Wait -PassThru
    if ($proc.ExitCode -ne 0) { Write-Warning "$f compile exit code: $($proc.ExitCode)" }
    else { Write-Host "$f compiled OK" }
}
