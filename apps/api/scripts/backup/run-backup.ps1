# Executado pelo Agendador de Tarefas do Windows (tarefa "BucketEgg - Backup incremental", 00h00).
# Corre o backup incremental e acrescenta o resultado a backups/logs/backup-AAAA-MM.log.
# Registar a tarefa: powershell -ExecutionPolicy Bypass -File scripts\backup\register-task.ps1
$ErrorActionPreference = 'Continue'
$api = Resolve-Path (Join-Path $PSScriptRoot '..\..')
$logDir = Join-Path $api '..\..\backups\logs'
New-Item -ItemType Directory -Force $logDir | Out-Null
$log = Join-Path $logDir ("backup-{0}.log" -f (Get-Date -Format 'yyyy-MM'))

Set-Location $api
$node = (Get-Command node -ErrorAction Stop).Source
& $node 'scripts/backup/backup.mjs' *>&1 | ForEach-Object { "$_" } | Out-File -FilePath $log -Append -Encoding utf8
exit $LASTEXITCODE
