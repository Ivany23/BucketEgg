# Regista (ou atualiza) a tarefa diária do backup incremental às 00h00 (hora deste computador).
# Se o computador estiver desligado à meia-noite, a tarefa corre assim que ele voltar a ligar
# (StartWhenAvailable). Como o backup é incremental, nada se perde: apanha tudo o que mudou desde o último.
#   powershell -ExecutionPolicy Bypass -File scripts\backup\register-task.ps1
$script = Join-Path $PSScriptRoot 'run-backup.ps1'
$action = New-ScheduledTaskAction -Execute 'powershell.exe' `
  -Argument "-NoProfile -NonInteractive -ExecutionPolicy Bypass -File `"$script`""
$trigger = New-ScheduledTaskTrigger -Daily -At '00:00'
$settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries `
  -RunOnlyIfNetworkAvailable -ExecutionTimeLimit (New-TimeSpan -Hours 2) -MultipleInstances IgnoreNew `
  -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 10)
Register-ScheduledTask -TaskName 'BucketEgg - Backup incremental' -Action $action -Trigger $trigger -Settings $settings `
  -Description 'Backup incremental diário da base Neon (pnpm db:backup). Registo em backups/logs.' -Force | Out-Null
Get-ScheduledTask -TaskName 'BucketEgg - Backup incremental' | Get-ScheduledTaskInfo |
  Select-Object TaskName, NextRunTime, LastRunTime, LastTaskResult
