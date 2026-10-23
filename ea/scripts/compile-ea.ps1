# Compiles the EA sources with MetaEditor and fails (exit 1) when any of them
# does not produce a fresh .ex4, so the deploy workflow stops before distributing.
# Optional: -SourceDir <folder> (default C:\amfxtradingv2\ea), -Files <names>.
param(
    [string]   $SourceDir = 'C:\amfxtradingv2\ea',
    [string[]] $Files     = @('HttpBridgeCommands.mq4', 'HttpBridgeState.mq4')
)

$editor = Get-ChildItem 'C:\Program Files (x86)' -Recurse -Filter 'metaeditor.exe' -ErrorAction SilentlyContinue | Select-Object -First 1
if (-not $editor) { Write-Error 'metaeditor.exe not found'; exit 1 }
Write-Host "Using metaeditor: $($editor.FullName)"

$failed = @()

foreach ($f in $Files) {
    $path    = Join-Path $SourceDir $f
    $ex4     = [System.IO.Path]::ChangeExtension($path, '.ex4')
    $log     = [System.IO.Path]::ChangeExtension($path, '.log')
    $started = Get-Date

    if (-not (Test-Path $path)) { Write-Host "[FAILED] $f : source not found"; $failed += $f; continue }
    if (Test-Path $log) { Remove-Item $log -Force }

    $proc = Start-Process -FilePath $editor.FullName -ArgumentList "/compile:`"$path`"", '/log' -Wait -PassThru
    Write-Host "$f : metaeditor exit code $($proc.ExitCode)"

    if (Test-Path $log) {
        # MetaEditor writes its log as UTF-16; show the result lines and any error.
        $lines = Get-Content $log -Encoding Unicode
        $lines | Where-Object { $_ -match 'error|warning|Result' } | ForEach-Object { Write-Host "  $_" }
    } else {
        Write-Host "  (no compile log written)"
    }

    $fresh = (Test-Path $ex4) -and ((Get-Item $ex4).LastWriteTime -ge $started.AddSeconds(-2))
    $logErrors = $false
    if (Test-Path $log) {
        $result = ($lines | Where-Object { $_ -match 'Result:' } | Select-Object -Last 1)
        if ($result -and $result -notmatch '\b0 error') { $logErrors = $true }
    }

    if ($fresh -and -not $logErrors) {
        Write-Host "[OK] $f compiled -> $([System.IO.Path]::GetFileName($ex4))"
    } else {
        $why = if (-not (Test-Path $ex4)) { 'no .ex4 produced' } elseif (-not $fresh) { '.ex4 not updated' } else { 'errors in the compile log' }
        Write-Host "[FAILED] $f : $why"
        $failed += $f
    }
}

if ($failed.Count -gt 0) {
    Write-Host "Compilation failed for: $($failed -join ', ')"
    exit 1
}
Write-Host "All EA files compiled"
exit 0
