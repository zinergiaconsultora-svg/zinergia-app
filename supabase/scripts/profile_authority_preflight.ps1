param(
    [string]$EnvFile = '.env.staging.local',
    [string]$ExpectedStagingRef = 'dnzytocmtmnptndeczny',
    [string]$PoolerHost = 'aws-1-eu-central-1.pooler.supabase.com'
)

$ErrorActionPreference = 'Stop'
$productionRef = 'gmjgkzaxmkaggsyczwcm'
$queryFile = Join-Path $PSScriptRoot 'profile_authority_preflight.sql'

function Read-DotEnvFile([string]$Path) {
    $values = @{}
    foreach ($line in Get-Content -LiteralPath $Path) {
        if ($line -match '^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$') {
            $value = $Matches[2].Trim()
            if (($value.StartsWith('"') -and $value.EndsWith('"')) -or
                ($value.StartsWith("'") -and $value.EndsWith("'"))) {
                $value = $value.Substring(1, $value.Length - 2)
            }
            $values[$Matches[1]] = $value
        }
    }
    return $values
}

if (-not (Test-Path -LiteralPath $EnvFile)) {
    throw "Staging env file not found: $EnvFile"
}
if (-not (Test-Path -LiteralPath $queryFile)) {
    throw "Preflight SQL file not found: $queryFile"
}

$staging = Read-DotEnvFile $EnvFile
foreach ($required in @('NEXT_PUBLIC_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_ANON_KEY', 'STAGING_DB_PASSWORD')) {
    if (-not $staging.ContainsKey($required) -or [string]::IsNullOrWhiteSpace($staging[$required])) {
        throw "Required staging variable is absent or empty: $required"
    }
}

$projectUri = [Uri]$staging['NEXT_PUBLIC_SUPABASE_URL']
$projectRef = $projectUri.Host.Split('.')[0]
if ($projectRef -eq $productionRef) {
    throw 'Refusing to run: the supplied environment resolves to the production project.'
}
if ($projectRef -ne $ExpectedStagingRef) {
    throw "Refusing to run: the supplied environment is not the approved staging project ref."
}

$maskedRef = $projectRef.Substring(0, 4) + '...' + $projectRef.Substring($projectRef.Length - 4)
Write-Output "target=staging ref=$maskedRef production=false"
Write-Output "env_file=$EnvFile required_variables=present"

Write-Output 'cli_version:'
npx supabase --version

Write-Output 'auth_settings_safe:'
$settingsUri = $staging['NEXT_PUBLIC_SUPABASE_URL'].TrimEnd('/') + '/auth/v1/settings'
$settings = Invoke-RestMethod -Method Get -Uri $settingsUri -Headers @{ apikey = $staging['NEXT_PUBLIC_SUPABASE_ANON_KEY'] } -TimeoutSec 20
[pscustomobject]@{
    disable_signup = $settings.disable_signup
    mailer_autoconfirm = $settings.mailer_autoconfirm
    jwt_exp = $settings.jwt_exp
} | ConvertTo-Json -Compress

$encodedPassword = [Uri]::EscapeDataString($staging['STAGING_DB_PASSWORD'])
$connectionOptions = 'sslmode=require&options=-c%20default_transaction_read_only%3Don%20-c%20statement_timeout%3D30000'
$databaseUrl = "postgresql://postgres.${projectRef}:${encodedPassword}@${PoolerHost}:5432/postgres?${connectionOptions}"

Write-Output 'migration_history:'
npx supabase migration list --db-url $databaseUrl
if ($LASTEXITCODE -ne 0) {
    throw 'Staging migration history query failed.'
}

Write-Output 'catalog_and_data_quality:'
npx supabase db query --db-url $databaseUrl --file $queryFile
if ($LASTEXITCODE -ne 0) {
    throw 'Staging catalog/data-quality query failed.'
}

Write-Output 'safety_note=remote output must confirm transaction settings; regardless, the checked-in SQL is one aggregate SELECT and the staging ref was verified before connection'
Write-Output 'preflight_complete=true'
