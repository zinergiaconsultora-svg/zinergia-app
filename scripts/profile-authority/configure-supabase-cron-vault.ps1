[CmdletBinding()]
param(
    [Parameter(Mandatory)]
    [ValidateSet('staging', 'production')]
    [string]$Target,

    [string]$CronEnvironmentFile,

    [string]$CronSecret,

    [string]$EndpointUrl,

    [ValidateSet('true', 'false')]
    [string]$Enabled = 'false'
)

$ErrorActionPreference = 'Stop'

function Read-EnvValue {
    param([string]$Path, [string]$Name)

    $line = Get-Content -LiteralPath $Path |
        Where-Object { $_ -match "^$([regex]::Escape($Name))=" } |
        Select-Object -First 1
    if (-not $line) { throw "MISSING_ENV_VALUE_$Name" }
    return $line.Substring($line.IndexOf('=') + 1).Trim('"')
}

function Set-VaultSecret {
    param([string]$Name, [string]$Value, [string]$Description)

    $env:ZINERGIA_VAULT_NAME = $Name
    $env:ZINERGIA_VAULT_VALUE = $Value
    $env:ZINERGIA_VAULT_DESCRIPTION = $Description
    try {
        $result = & $script:PsqlPath @script:PsqlArguments -X -v ON_ERROR_STOP=1 -t -A -f $script:VaultSqlPath 2>&1
        if ($LASTEXITCODE -ne 0) { throw "VAULT_SECRET_WRITE_FAILED_$Name`n$result" }
    }
    finally {
        Remove-Item Env:ZINERGIA_VAULT_NAME -ErrorAction SilentlyContinue
        Remove-Item Env:ZINERGIA_VAULT_VALUE -ErrorAction SilentlyContinue
        Remove-Item Env:ZINERGIA_VAULT_DESCRIPTION -ErrorAction SilentlyContinue
    }
}

$projectRoot = Resolve-Path (Join-Path $PSScriptRoot '..\..')
$psqlPath = 'C:\Program Files\PostgreSQL\17\bin\psql.exe'
if (-not (Test-Path -LiteralPath $psqlPath)) { throw 'PSQL_NOT_FOUND' }

if ($CronEnvironmentFile) {
    $cronEnvironmentFile = Resolve-Path $CronEnvironmentFile
    if (-not $CronSecret) { $CronSecret = Read-EnvValue -Path $cronEnvironmentFile -Name 'CRON_SECRET' }
}
if (-not $CronSecret) { throw 'MISSING_CRON_SECRET' }

if ($Target -eq 'production') {
    $databaseFile = Join-Path $projectRoot '.env.production.local'
    $databaseUrl = Read-EnvValue -Path $databaseFile -Name 'ZINERGIA_PROD_DATABASE_URL'
    $databaseUri = [uri]$databaseUrl
    $databasePassword = [uri]::UnescapeDataString($databaseUri.UserInfo.Split(':', 2)[1])
    $databaseUser = 'postgres.gmjgkzaxmkaggsyczwcm'
}
else {
    $databaseFile = Join-Path $projectRoot '.env.staging.local'
    $databasePassword = Read-EnvValue -Path $databaseFile -Name 'STAGING_DB_PASSWORD'
    $databaseUser = 'postgres.dnzytocmtmnptndeczny'
}

if (-not $EndpointUrl) {
    $projectRef = if ($Target -eq 'production') { 'gmjgkzaxmkaggsyczwcm' } else { 'dnzytocmtmnptndeczny' }
    $EndpointUrl = "https://$projectRef.supabase.co/functions/v1/reconcile-invitation-provisioning"
}
if ($EndpointUrl -notmatch '^https://[^\s]+\.supabase\.co/functions/v1/reconcile-invitation-provisioning$') {
    throw 'INVALID_RECONCILER_EDGE_FUNCTION_URL'
}

$env:PGPASSWORD = $databasePassword
$env:PGSSLMODE = 'require'
$script:PsqlPath = $psqlPath
$script:PsqlArguments = @('-h', 'aws-1-eu-central-1.pooler.supabase.com', '-p', '5432', '-U', $databaseUser, '-d', 'postgres')
$script:VaultSqlPath = Join-Path $PSScriptRoot 'set-vault-secret.sql'

try {
    Set-VaultSecret -Name 'zinergia_reconcile_cron_url' -Value $EndpointUrl -Description 'Zinergia invitation reconciliation Edge Function endpoint'
    Set-VaultSecret -Name 'zinergia_reconcile_cron_secret' -Value $cronSecret -Description 'Bearer secret for Zinergia invitation reconciliation cron'
    Set-VaultSecret -Name 'zinergia_reconcile_cron_enabled' -Value $Enabled -Description 'Whether Supabase Cron invokes Zinergia invitation reconciliation'

    $names = & $psqlPath @script:PsqlArguments -X -v ON_ERROR_STOP=1 -t -A -c "SELECT string_agg(name, ',' ORDER BY name) FROM vault.secrets WHERE name IN ('zinergia_reconcile_cron_enabled', 'zinergia_reconcile_cron_secret', 'zinergia_reconcile_cron_url');"
    if ($LASTEXITCODE -ne 0 -or $names -ne 'zinergia_reconcile_cron_enabled,zinergia_reconcile_cron_secret,zinergia_reconcile_cron_url') {
        throw 'VAULT_SECRET_VERIFICATION_FAILED'
    }
    Write-Output "SUPABASE_CRON_VAULT_CONFIGURED target=$Target enabled=$Enabled"
}
finally {
    Remove-Item Env:PGPASSWORD -ErrorAction SilentlyContinue
    Remove-Item Env:PGSSLMODE -ErrorAction SilentlyContinue
}
