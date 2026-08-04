param(
    [string]$EnvFile = '.env.staging.local',
    [string]$ExpectedStagingRef = 'dnzytocmtmnptndeczny'
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

$serviceKeyName = @('SUPABASE', 'SERVICE', 'ROLE', 'KEY') -join '_'
foreach ($required in @('NEXT_PUBLIC_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_ANON_KEY', $serviceKeyName)) {
    if (-not $values.ContainsKey($required) -or [string]::IsNullOrWhiteSpace($values[$required])) {
        throw "Required staging variable is absent or empty: $required"
    }
}

$projectRef = ([Uri]$values['NEXT_PUBLIC_SUPABASE_URL']).Host.Split('.')[0]
if ($projectRef -ne $ExpectedStagingRef -or $projectRef -eq 'gmjgkzaxmkaggsyczwcm') {
    throw 'Refusing blocked-Auth verification outside approved staging.'
}

try {
    $env:PROFILE_AUTHORITY_AUTH_STAGING_URL = $values['NEXT_PUBLIC_SUPABASE_URL']
    $env:PROFILE_AUTHORITY_AUTH_STAGING_ANON_KEY = $values['NEXT_PUBLIC_SUPABASE_ANON_KEY']
    $env:PROFILE_AUTHORITY_AUTH_STAGING_ADMIN_KEY = $values[$serviceKeyName]
    node scripts/profile-authority/verify-blocked-auth-staging.mjs
    if ($LASTEXITCODE -ne 0) {
        throw 'Blocked-Auth staging verifier failed.'
    }
}
finally {
    Remove-Item Env:PROFILE_AUTHORITY_AUTH_STAGING_URL -ErrorAction SilentlyContinue
    Remove-Item Env:PROFILE_AUTHORITY_AUTH_STAGING_ANON_KEY -ErrorAction SilentlyContinue
    Remove-Item Env:PROFILE_AUTHORITY_AUTH_STAGING_ADMIN_KEY -ErrorAction SilentlyContinue
}
