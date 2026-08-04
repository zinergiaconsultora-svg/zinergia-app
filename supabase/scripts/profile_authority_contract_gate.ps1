<#
.SYNOPSIS
    ZIN-SDD-041 read-only contract gate. Decides whether the three contract migrations
    (20260803190000 / 191000 / 192000) can be applied to a target project without
    aborting mid-promotion or locking authority management out of the application.

.DESCRIPTION
    The staging preflight (profile_authority_preflight.ps1) refuses to resolve the
    production project by design, which left no approved way to answer the only question
    that decides whether the contract is safe: does the target actually hold canonical
    authority tuples today?

    This script closes that gap without weakening anything:

      * It reuses profile_authority_preflight.sql verbatim - one aggregate SELECT that
        returns catalog metadata and counts, never profile, invitation or Auth identifiers.
      * It connects with default_transaction_read_only=on and a statement timeout, exactly
        like the staging runner.
      * Production requires an explicit -ConfirmProduction switch, so it can never be
        reached by supplying the wrong env file.
      * It never writes, never applies a migration and never prints a secret.

    Exit code 0 means the contract may be applied. Any other exit code means it may not.

.PARAMETER EnvFile
    Dotenv file holding NEXT_PUBLIC_SUPABASE_URL and the database password.

.PARAMETER PasswordVariable
    Name of the dotenv key holding the database password.

.PARAMETER ConfirmProduction
    Required when the resolved project ref is production. Without it the script refuses.

.EXAMPLE
    ./profile_authority_contract_gate.ps1 -EnvFile .env.staging.local -PasswordVariable STAGING_DB_PASSWORD

.EXAMPLE
    ./profile_authority_contract_gate.ps1 -EnvFile .env.production.local -PasswordVariable PRODUCTION_DB_PASSWORD -ConfirmProduction
#>
param(
    [string]$EnvFile = '.env.production.local',
    # Preferred: one full connection URL. This is what .env.production.local actually holds.
    [string]$DatabaseUrlVariable = 'ZINERGIA_PROD_DATABASE_URL',
    # Fallback for env files that keep the pieces separate, like .env.staging.local.
    [string]$PasswordVariable = 'PRODUCTION_DB_PASSWORD',
    [string]$PoolerHost = 'aws-1-eu-central-1.pooler.supabase.com',
    [switch]$ConfirmProduction
)

$ErrorActionPreference = 'Stop'
$productionRef = 'gmjgkzaxmkaggsyczwcm'
$queryFile = Join-Path $PSScriptRoot 'profile_authority_preflight.sql'

# Every counter here must be zero for the contract to be applicable. They map one-to-one
# onto what profiles_authority_tuple_check enforces and what can_read_profile_directory
# and change_profile_authority require of a canonical Admin.
$mustBeZero = @(
    'invalid_role',
    'neutral_with_non_null_authority',
    'admin_noncanonical_tuple',
    'franchise_noncanonical_tuple',
    'agent_noncanonical_tuple',
    'orphan_parent',
    'orphan_franchise',
    'inactive_franchise_reference',
    'self_parent',
    'profiles_in_cycle',
    'cycle_depth_limit_hits'
)

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

if (-not (Test-Path -LiteralPath $EnvFile)) { throw "Env file not found: $EnvFile" }
if (-not (Test-Path -LiteralPath $queryFile)) { throw "Preflight SQL file not found: $queryFile" }

$config = Read-DotEnvFile $EnvFile
$connectionOptions = 'sslmode=require&options=-c%20default_transaction_read_only%3Don%20-c%20statement_timeout%3D30000'

if ($config.ContainsKey($DatabaseUrlVariable) -and -not [string]::IsNullOrWhiteSpace($config[$DatabaseUrlVariable])) {
    # A full URL was supplied. The project ref lives in the username (postgres.<ref>), and
    # the read-only options are appended rather than replacing whatever is already there.
    $rawUrl = $config[$DatabaseUrlVariable].Trim()
    $parsed = [Uri]$rawUrl
    $userInfo = $parsed.UserInfo.Split(':')[0]
    # Supabase exposes two connection shapes and the project ref sits in a different place
    # in each: pooler puts it in the username (postgres.<ref>@...pooler...), direct puts it
    # in the host (postgres@db.<ref>.supabase.co).
    $projectRef = if ($userInfo -match '^postgres\.(.+)$') {
        $Matches[1]
    } elseif ($parsed.Host -match '^db\.([a-z0-9]+)\.supabase\.(co|com)$') {
        $Matches[1]
    } elseif ($parsed.Host -match '^([a-z0-9]+)\.supabase\.(co|com)$') {
        $Matches[1]
    } else {
        $parsed.Host
    }
    # Supabase direct connections (db.<ref>.supabase.co) are IPv6-only since 2024, so on an
    # IPv4 network the hostname does not resolve at all. Rewrite to the pooler, which is
    # dual-stack, keeping the credentials from the original URL untouched.
    if ($parsed.Host -match '^db\.[a-z0-9]+\.supabase\.(co|com)$') {
        $credentials = $parsed.UserInfo
        $secretIndex = $credentials.IndexOf(':')
        $secret = if ($secretIndex -ge 0) { $credentials.Substring($secretIndex + 1) } else { '' }
        $port = if ($parsed.Port -gt 0) { $parsed.Port } else { 5432 }
        $rawUrl = "postgresql://postgres.${projectRef}:${secret}@${PoolerHost}:${port}/postgres"
        Write-Output 'connection=rewritten_to_pooler reason=direct_host_is_ipv6_only'
    }

    $separator = if ($rawUrl.Contains('?')) { '&' } else { '?' }
    $databaseUrl = "${rawUrl}${separator}${connectionOptions}"
} elseif ($config.ContainsKey('NEXT_PUBLIC_SUPABASE_URL') -and $config.ContainsKey($PasswordVariable)) {
    $projectRef = ([Uri]$config['NEXT_PUBLIC_SUPABASE_URL']).Host.Split('.')[0]
    $encodedPassword = [Uri]::EscapeDataString($config[$PasswordVariable])
    $databaseUrl = "postgresql://postgres.${projectRef}:${encodedPassword}@${PoolerHost}:5432/postgres?${connectionOptions}"
} else {
    throw "No usable connection found in ${EnvFile}. Expected either ${DatabaseUrlVariable}, or NEXT_PUBLIC_SUPABASE_URL plus ${PasswordVariable}."
}

$isProduction = $projectRef -eq $productionRef
if ($isProduction -and -not $ConfirmProduction) {
    throw 'Refusing to run against production without -ConfirmProduction. This script is read-only, but the switch must be deliberate.'
}

# Masking must never be the thing that breaks the run: a short or unexpected ref just
# gets shown as-is rather than throwing on Substring.
$maskedRef = if ($projectRef.Length -ge 10) {
    $projectRef.Substring(0, 4) + '...' + $projectRef.Substring($projectRef.Length - 4)
} else {
    $projectRef
}
Write-Output "target_ref=$maskedRef production=$($isProduction.ToString().ToLower()) mode=read_only"

Write-Output 'migration_history:'
npx supabase migration list --db-url $databaseUrl
if ($LASTEXITCODE -ne 0) { throw 'Migration history query failed.' }

Write-Output 'catalog_and_data_quality:'
# The Supabase CLI writes progress ("Connecting to remote database...") to stderr. With
# ErrorActionPreference=Stop, merging stderr into the captured output turns that harmless
# line into a terminating error. Relax the preference just for the capture and judge the
# call by its exit code, which is what actually reports failure.
$previousPreference = $ErrorActionPreference
$ErrorActionPreference = 'Continue'
$raw = & npx supabase db query --db-url $databaseUrl --file $queryFile 2>&1 | Out-String
$queryExitCode = $LASTEXITCODE
$ErrorActionPreference = $previousPreference

if ($queryExitCode -ne 0) {
    Write-Output $raw
    throw 'Catalog/data-quality query failed.'
}

# The SQL returns a single jsonb column. Extract the outermost object; if the CLI output
# shape ever changes, fail closed and hand the operator the raw text rather than guessing.
$match = [regex]::Match($raw, '\{(?:[^{}]|(?<open>\{)|(?<-open>\}))*(?(open)(?!))\}')
if (-not $match.Success) {
    Write-Output $raw
    throw 'Could not parse the preflight result. Verify manually; the gate does not pass on unparsed output.'
}

try {
    $result = $match.Value | ConvertFrom-Json
} catch {
    Write-Output $raw
    throw 'Preflight result was not valid JSON. Verify manually; the gate does not pass on unparsed output.'
}

# The CLI wraps results as { boundary, rows: [ { profile_authority_preflight: {...} } ] }.
# Accept the nested shape and the bare aggregate, so a CLI output change degrades to a
# clear failure rather than a wrong verdict.
$preflight = if ($result.rows -and $result.rows.Count -gt 0 -and $result.rows[0].profile_authority_preflight) {
    $result.rows[0].profile_authority_preflight
} elseif ($result.profile_authority_preflight) {
    $result.profile_authority_preflight
} else {
    $result
}

$quality = $preflight.profile_quality
if ($null -eq $quality) {
    Write-Output $raw
    throw 'Preflight result did not contain profile_quality. Verify manually.'
}

Write-Output ''
Write-Output '--- CONTRACT GATE ---'

$failures = @()

$canonicalAdmins = [int]$quality.canonical_active_admins
if ($canonicalAdmins -lt 1) {
    $failures += "canonical_active_admins=$canonicalAdmins (need at least 1)"
    Write-Output "FAIL canonical_active_admins=$canonicalAdmins"
} else {
    Write-Output "PASS canonical_active_admins=$canonicalAdmins"
}

foreach ($counter in $mustBeZero) {
    $value = [int]$quality.$counter
    if ($value -ne 0) {
        $failures += "$counter=$value (need 0)"
        Write-Output "FAIL $counter=$value"
    } else {
        Write-Output "PASS $counter=0"
    }
}

# Informational only: these do not block the contract but shape the recovery plan.
Write-Output ''
Write-Output '--- CONTEXT (non-blocking) ---'
Write-Output "profiles=$($preflight.row_counts.profiles) auth_users=$($preflight.row_counts.auth_users) franchises=$($preflight.row_counts.franchises)"
Write-Output "neutral_auth_account=$($quality.neutral_auth_account) auth_user_without_profile=$($quality.auth_user_without_profile) currently_banned_auth_account=$($quality.currently_banned_auth_account)"

Write-Output ''
if ($failures.Count -gt 0) {
    Write-Output 'contract_gate=BLOCKED'
    Write-Output 'Do NOT apply 20260803190000 / 191000 / 192000. Resolve these first:'
    foreach ($failure in $failures) { Write-Output "  - $failure" }
    Write-Output 'An explicit, reviewed authority recovery must run BEFORE the contract, never after: 190000 closes browser writes and 191000 adds a CHECK with no repair path.'
    exit 2
}

Write-Output 'contract_gate=PASS'
Write-Output 'The target holds canonical authority tuples. The contract migrations may be applied as a single unit (190000 -> 191000 -> 192000).'
exit 0
