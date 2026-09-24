# Registers the scheduled tasks that keep the backend and MT4 terminals alive.
# Run once on the VPS as Administrator. Re-running replaces the tasks.
#
#   AMFX-Startup   -> at Administrator logon (1 min delay)
#   AMFX-Watchdog  -> every 5 minutes, only while Administrator is logged on
#
# Both run interactively (not in session 0) so MT4 windows stay visible over RDP.
# Combine with Windows autologon so the logon happens after every reboot.

$Script  = 'C:\amfxtradingv2\infra\scripts\startup.ps1'
$User    = "$env:COMPUTERNAME\Administrator"
$Action  = New-ScheduledTaskAction -Execute 'powershell.exe' `
    -Argument "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$Script`""
$Principal = New-ScheduledTaskPrincipal -UserId $User -LogonType Interactive -RunLevel Highest
$Settings  = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries `
    -ExecutionTimeLimit (New-TimeSpan -Minutes 10) -MultipleInstances IgnoreNew -StartWhenAvailable

$logon = New-ScheduledTaskTrigger -AtLogOn -User $User
$logon.Delay = 'PT1M'
Register-ScheduledTask -TaskName 'AMFX-Startup' -Action $Action -Trigger $logon `
    -Principal $Principal -Settings $Settings -Force | Out-Null
Write-Host "Registered AMFX-Startup (at logon of $User)"

$every5 = New-ScheduledTaskTrigger -Once -At (Get-Date).Date -RepetitionInterval (New-TimeSpan -Minutes 5)
Register-ScheduledTask -TaskName 'AMFX-Watchdog' -Action $Action -Trigger $every5 `
    -Principal $Principal -Settings $Settings -Force | Out-Null
Write-Host "Registered AMFX-Watchdog (every 5 minutes)"

Get-ScheduledTask -TaskName 'AMFX-*' | Format-Table TaskName, State
