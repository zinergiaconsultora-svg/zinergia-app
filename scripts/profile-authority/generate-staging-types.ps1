param(
    [string]$EnvFile = '.env.staging.local',
    [string]$ExpectedStagingRef = 'dnzytocmtmnptndeczny',
    [string]$PoolerHost = 'aws-1-eu-central-1.pooler.supabase.com'
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
    throw 'Refusing type generation outside the approved staging project.'
}

$encodedPassword = [Uri]::EscapeDataString($values['STAGING_DB_PASSWORD'])
$databaseUrl = "postgresql://postgres.${projectRef}:${encodedPassword}@${PoolerHost}:5432/postgres?sslmode=require"
$temporaryOutput = [System.IO.Path]::GetTempFileName()

try {
    npx supabase gen types typescript --db-url $databaseUrl 2>$null |
        Set-Content -LiteralPath $temporaryOutput -Encoding utf8
    if ($LASTEXITCODE -ne 0) {
        throw 'Supabase type generation failed.'
    }

    $generated = Get-Content -LiteralPath $temporaryOutput -Raw
    if (-not $generated.StartsWith('export type Json')) {
        throw 'Generated type output has an invalid prefix.'
    }
    if ($generated -notmatch 'update_own_iban') {
        throw 'Generated types do not contain update_own_iban.'
    }

    Set-Content -LiteralPath 'src\types\database.types.ts' `
        -Value $generated.TrimEnd("`r", "`n") `
        -Encoding utf8NoBOM
    Write-Output 'STAGING_TYPES_REGENERATED_OK update_own_iban=true'
}
finally {
    Remove-Item -LiteralPath $temporaryOutput -Force -ErrorAction SilentlyContinue
}
