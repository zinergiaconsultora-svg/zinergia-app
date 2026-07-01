param(
    [string]$BaseUrl = "https://zinergia.vercel.app",
    [string]$AgentEmail = "",
    [string]$AdminEmail = "",
    [switch]$SkipAgent,
    [switch]$SkipAdmin
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Read-PlainSecret {
    param([string]$Prompt)

    $secure = Read-Host $Prompt -AsSecureString
    $ptr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
    try {
        return [Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr)
    } finally {
        [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr)
    }
}

function Set-EnvValue {
    param(
        [string]$Name,
        [AllowNull()][string]$Value
    )

    if ($null -eq $Value) {
        Remove-Item "Env:\$Name" -ErrorAction SilentlyContinue
    } else {
        Set-Item "Env:\$Name" -Value $Value
    }
}

function Invoke-Playwright {
    param([string[]]$PlaywrightArgs)

    Write-Host ""
    Write-Host "Running: npx playwright $($PlaywrightArgs -join ' ')" -ForegroundColor Cyan
    & npx playwright @PlaywrightArgs
    if ($LASTEXITCODE -ne 0) {
        throw "Playwright failed with exit code $LASTEXITCODE"
    }
}

$previous = @{
    PLAYWRIGHT_BASE_URL = [Environment]::GetEnvironmentVariable("PLAYWRIGHT_BASE_URL")
    CI = [Environment]::GetEnvironmentVariable("CI")
    E2E_AGENT_EMAIL = [Environment]::GetEnvironmentVariable("E2E_AGENT_EMAIL")
    E2E_AGENT_PASSWORD = [Environment]::GetEnvironmentVariable("E2E_AGENT_PASSWORD")
    E2E_ADMIN_EMAIL = [Environment]::GetEnvironmentVariable("E2E_ADMIN_EMAIL")
    E2E_ADMIN_PASSWORD = [Environment]::GetEnvironmentVariable("E2E_ADMIN_PASSWORD")
}

try {
    Set-EnvValue "PLAYWRIGHT_BASE_URL" $BaseUrl
    Set-EnvValue "CI" "1"

    if (-not $SkipAgent) {
        if ([string]::IsNullOrWhiteSpace($AgentEmail)) {
            $AgentEmail = Read-Host "Commercial email"
        }
        $agentPassword = Read-PlainSecret "Commercial password"
        Set-EnvValue "E2E_AGENT_EMAIL" $AgentEmail
        Set-EnvValue "E2E_AGENT_PASSWORD" $agentPassword
    } else {
        Set-EnvValue "E2E_AGENT_EMAIL" ""
        Set-EnvValue "E2E_AGENT_PASSWORD" ""
    }

    if (-not $SkipAdmin) {
        if ([string]::IsNullOrWhiteSpace($AdminEmail)) {
            $AdminEmail = Read-Host "Admin email"
        }
        $adminPassword = Read-PlainSecret "Admin password"
        Set-EnvValue "E2E_ADMIN_EMAIL" $AdminEmail
        Set-EnvValue "E2E_ADMIN_PASSWORD" $adminPassword
    } else {
        Set-EnvValue "E2E_ADMIN_EMAIL" ""
        Set-EnvValue "E2E_ADMIN_PASSWORD" ""
    }

    $authArgs = @(
        "test",
        "e2e/auth.spec.ts",
        "--project=chromium",
        "--no-deps",
        "--reporter=list"
    )
    if ($SkipAgent) {
        $authArgs += @("--grep", "Login page")
    }
    Invoke-Playwright -PlaywrightArgs $authArgs

    if (-not $SkipAgent) {
        Invoke-Playwright -PlaywrightArgs @(
            "test",
            "e2e/dashboard.spec.ts",
            "--project=chromium",
            "--reporter=list"
        )
    }

    if (-not $SkipAdmin) {
        Invoke-Playwright -PlaywrightArgs @(
            "test",
            "e2e/admin.spec.ts",
            "--project=chromium-admin",
            "--reporter=list"
        )
    }
} finally {
    foreach ($entry in $previous.GetEnumerator()) {
        Set-EnvValue $entry.Key $entry.Value
    }
}
