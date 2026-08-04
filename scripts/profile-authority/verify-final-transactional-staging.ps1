param(
    [Parameter(Mandatory = $true)][string]$AdminProfileId,
    [Parameter(Mandatory = $true)][string]$TargetAgentProfileId,
    [Parameter(Mandatory = $true)][string]$SameFranchiseAgentProfileId,
    [Parameter(Mandatory = $true)][string]$OtherFranchiseAgentProfileId,
    [Parameter(Mandatory = $true)][string]$FranchiseProfileId,
    [Parameter(Mandatory = $true)][string]$FranchiseId,
    [Parameter(Mandatory = $true)][string]$NextParentProfileId,
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
    throw 'Refusing final transactional verification outside the approved staging project.'
}

$ids = @{
    '__ADMIN_ID__' = $AdminProfileId
    '__TARGET_ID__' = $TargetAgentProfileId
    '__SAME_FRANCHISE_ID__' = $SameFranchiseAgentProfileId
    '__OTHER_AGENT_ID__' = $OtherFranchiseAgentProfileId
    '__FRANCHISE_ACTOR_ID__' = $FranchiseProfileId
    '__NEXT_PARENT_ID__' = $NextParentProfileId
    '__CONFLICT_PARENT_ID__' = $FranchiseProfileId
    '__NEXT_FRANCHISE_ID__' = $FranchiseId
}
foreach ($entry in $ids.GetEnumerator()) {
    $parsed = [Guid]::Empty
    if (-not [Guid]::TryParse($entry.Value, [ref]$parsed)) {
        throw "Invalid UUID for $($entry.Key)"
    }
}
$profileIds = @($AdminProfileId, $TargetAgentProfileId, $SameFranchiseAgentProfileId, $OtherFranchiseAgentProfileId, $FranchiseProfileId)
if (($profileIds | Select-Object -Unique).Count -ne $profileIds.Count) {
    throw 'Fixture profile IDs must be distinct.'
}

$encodedPassword = [Uri]::EscapeDataString($values['STAGING_DB_PASSWORD'])
$databaseUrl = "postgresql://postgres.${projectRef}:$encodedPassword@${PoolerHost}:5432/postgres?sslmode=require"
$psql = 'C:\Program Files\PostgreSQL\17\bin\psql.exe'
if (-not (Test-Path -LiteralPath $psql)) { $psql = 'psql.exe' }
$env:PGCONNECT_TIMEOUT = '10'
# Supabase's transaction pooler can omit the client row from pg_stat_ssl. TLS is
# still mandatory here because this runner builds the only URL and hard-codes
# sslmode=require; direct hosts retain the catalog-level session assertion.
$tlsPreflight = if ($PoolerHost.EndsWith('.pooler.supabase.com')) {
    'FALSE'
}
else {
    "NOT EXISTS (SELECT 1 FROM pg_catalog.pg_stat_ssl ssl_state WHERE ssl_state.pid = pg_backend_pid() AND ssl_state.ssl IS TRUE)"
}

$preflight = @"
BEGIN TRANSACTION READ ONLY;
DO `$_profile_authority_final_fixture_preflight`$
BEGIN
    IF current_database() IS DISTINCT FROM 'postgres'
       OR $tlsPreflight THEN
        RAISE EXCEPTION 'staging TLS/database preflight failed';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = '$AdminProfileId'::uuid AND role = 'admin' AND parent_id IS NULL AND franchise_id IS NULL)
       OR NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = '$FranchiseProfileId'::uuid AND role = 'franchise' AND franchise_id = '$FranchiseId'::uuid)
       OR NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = '$TargetAgentProfileId'::uuid AND role = 'agent' AND parent_id = '$FranchiseProfileId'::uuid AND franchise_id = '$FranchiseId'::uuid)
       OR NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = '$SameFranchiseAgentProfileId'::uuid AND role = 'agent' AND parent_id = '$FranchiseProfileId'::uuid AND franchise_id = '$FranchiseId'::uuid)
       OR NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = '$OtherFranchiseAgentProfileId'::uuid AND role = 'agent' AND franchise_id <> '$FranchiseId'::uuid)
       OR NOT EXISTS (
           SELECT 1 FROM public.profiles parent_profile
           WHERE parent_profile.id = '$NextParentProfileId'::uuid
             AND (
                (parent_profile.role = 'admin' AND parent_profile.parent_id IS NULL AND parent_profile.franchise_id IS NULL)
                OR (parent_profile.role = 'franchise' AND parent_profile.franchise_id = '$FranchiseId'::uuid)
             )
       ) THEN
        RAISE EXCEPTION 'staging profile fixture topology is invalid';
    END IF;
END
`$_profile_authority_final_fixture_preflight`$;
ROLLBACK;
"@

& $psql --no-psqlrc --set ON_ERROR_STOP=1 --dbname $databaseUrl --command $preflight
if ($LASTEXITCODE -ne 0) { throw 'Final transactional fixture preflight failed.' }

$sql = Get-Content -LiteralPath 'supabase\scripts\profile-authority\verify_transactional.sql' -Raw
foreach ($token in $ids.Keys) { $sql = $sql.Replace($token, $ids[$token]) }
if ($sql -match '__[A-Z_]+__') { throw 'Final transactional verifier contains unresolved placeholders.' }

$temporaryOutput = [System.IO.Path]::GetTempFileName()
try {
    $sqlEncoding = if ($PSVersionTable.PSVersion.Major -ge 6) { 'utf8NoBOM' } else { 'utf8' }
    Set-Content -LiteralPath $temporaryOutput -Value $sql -Encoding $sqlEncoding
    & $psql --no-psqlrc --set ON_ERROR_STOP=1 --dbname $databaseUrl --file $temporaryOutput
    if ($LASTEXITCODE -ne 0) { throw 'Final transactional verifier failed.' }
    Write-Output 'STAGING_FINAL_TRANSACTIONAL_OK rollback=true production=false'
}
finally {
    Remove-Item -LiteralPath $temporaryOutput -Force -ErrorAction SilentlyContinue
}
