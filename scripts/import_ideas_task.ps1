# Scheduled-task wrapper for the Discord idea inbox importer.
# Appends each run's one-line result to <inbox>\import.log so runs are auditable.
# Requires the User-scope env vars documented in docs/runbooks/discord-idea-inbox.md.

$ErrorActionPreference = "Continue"
if (-not $env:IDEAS_INBOX_DIR -or -not $env:DISCORD_BOT_TOKEN -or -not $env:DISCORD_IDEAS_CHANNEL_ID) {
    exit 1
}
$repo = Split-Path -Parent $PSScriptRoot
Set-Location $repo
$result = (python "automation\import_discord_ideas.py" 2>&1 | Out-String).Trim()
$log = Join-Path $env:IDEAS_INBOX_DIR "import.log"
Add-Content -Path $log -Value "[$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')] $result"
if ($result -like "FAIL*") {
    exit 1
}
