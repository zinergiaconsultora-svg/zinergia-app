param(
    [string]$EnvFile = '.env.staging.local',
    [string]$ExpectedStagingRef = 'dnzytocmtmnptndeczny',
    [string]$PoolerHost = 'aws-1-eu-central-1.pooler.supabase.com',
    [switch]$Apply
)

$ErrorActionPreference = 'Stop'
$values = @{}
foreach ($line in Get-Content -LiteralPath $EnvFile) {
    if ($line -match '^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$') {
        $value = $Matches[2].Trim()
        if (($value.StartsWith('"') -and $value.EndsWith('"')) -or
            ($value.StartsWith("'") -and $value.EndsWith("'"))) {
            $value = $value.Substring(1, $value.Length - 2)
        }
        $values[$Matches[1]] = $value
    }
}

foreach ($required in @('NEXT_PUBLIC_SUPABASE_URL', 'STAGING_DB_PASSWORD')) {
    if (-not $values.ContainsKey($required) -or [string]::IsNullOrWhiteSpace($values[$required])) {
        throw "Required staging variable is absent or empty: $required"
    }
}

$projectRef = ([Uri]$values['NEXT_PUBLIC_SUPABASE_URL']).Host.Split('.')[0]
if ($projectRef -ne $ExpectedStagingRef -or $projectRef -eq 'gmjgkzaxmkaggsyczwcm') {
    throw 'Refusing migration verification outside the approved staging project.'
}

$encodedPassword = [Uri]::EscapeDataString($values['STAGING_DB_PASSWORD'])
$databaseUrl = "postgresql://postgres.${projectRef}:${encodedPassword}@${PoolerHost}:5432/postgres?sslmode=require"

# Dry run stays the default. Applying is opt-in through -Apply, so nothing writes
# to staging by accident; the project-ref guard above already refuses production
# either way.
if ($Apply) {
    npx supabase db push --db-url $databaseUrl --yes
    if ($LASTEXITCODE -ne 0) {
        throw 'Staging migration push failed.'
    }
    Write-Output 'STAGING_MIGRATION_APPLIED production=false'
}
else {
    npx supabase db push --db-url $databaseUrl --dry-run
    if ($LASTEXITCODE -ne 0) {
        throw 'Staging migration dry-run failed.'
    }
    Write-Output 'STAGING_MIGRATION_DRY_RUN_OK production=false'
}
