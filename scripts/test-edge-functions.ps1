# Manual test harness for the update-game-scores / determine-weekly-winners
# Edge Functions. Both authenticate via withSupabase({ auth: 'secret' }),
# so the only thing a caller needs is the project's service-role (secret)
# key on the `apikey` header (see supabase/functions/*/index.ts and
# supabase/migrations/20260803220827_schedule_winners_and_scores_cron.sql).
#
# Usage:
#   .\scripts\test-edge-functions.ps1 local scores
#   .\scripts\test-edge-functions.ps1 local winners
#   .\scripts\test-edge-functions.ps1 local both
#   .\scripts\test-edge-functions.ps1 prod scores
#   .\scripts\test-edge-functions.ps1 prod winners
#   .\scripts\test-edge-functions.ps1 prod both
#
# local  - requires `npx supabase start` (and separately
#          `npx supabase functions serve --no-verify-jwt --env-file .env.local`)
#          already running. Reads the local service_role key from
#          `npx supabase status -o env` -- no key ever needs to be pasted or stored.
# prod   - hits the deployed functions directly and WILL write to production
#          tables (games / weekly_winners / period_winners / season_winners /
#          scores). Reads NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY
#          from .env.local.

param(
    [Parameter(Position = 0)]
    [ValidateSet('local', 'prod')]
    [string]$Target,

    [Parameter(Position = 1)]
    [ValidateSet('scores', 'winners', 'both')]
    [string]$Function = 'both'
)

$ErrorActionPreference = 'Stop'

if (-not $Target) {
    Write-Error "Usage: .\scripts\test-edge-functions.ps1 <local|prod> <scores|winners|both>"
    exit 1
}

$repoRoot = Split-Path -Parent $PSScriptRoot
Set-Location $repoRoot

function Get-EnvLocalValue([string]$Name) {
    $envPath = Join-Path $repoRoot '.env.local'
    if (-not (Test-Path $envPath)) {
        throw ".env.local not found at $envPath"
    }
    $line = Get-Content $envPath | Where-Object { $_ -match "^$Name=" } | Select-Object -First 1
    if (-not $line) { return $null }
    return $line.Substring($Name.Length + 1)
}

if ($Target -eq 'local') {
    $statusEnv = & npx supabase status -o env 2>$null
    if (-not $statusEnv) {
        Write-Error "Could not read local Supabase status. Is 'npx supabase start' running?"
        exit 1
    }
    $statusText = $statusEnv -join "`n"

    $urlMatch = [regex]::Match($statusText, 'API_URL="(http://127\.0\.0\.1:\d+)"')
    $baseUrl = if ($urlMatch.Success) { $urlMatch.Groups[1].Value } else { 'http://127.0.0.1:54321' }

    $keyMatch = [regex]::Match($statusText, 'SERVICE_ROLE_KEY="([^"]+)"')
    if (-not $keyMatch.Success) {
        Write-Error "Could not extract SERVICE_ROLE_KEY from 'npx supabase status -o env'."
        exit 1
    }
    $apiKey = $keyMatch.Groups[1].Value
}
else {
    $baseUrl = Get-EnvLocalValue 'NEXT_PUBLIC_SUPABASE_URL'
    $apiKey = Get-EnvLocalValue 'SUPABASE_SECRET_KEY'
    if (-not $baseUrl -or -not $apiKey) {
        Write-Error "NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SECRET_KEY missing from .env.local."
        exit 1
    }
    Write-Warning "This will call the DEPLOYED functions and can write to production tables."
}

function Invoke-EdgeFunction([string]$Name) {
    $url = "$baseUrl/functions/v1/$Name"
    Write-Host "==> POST $url"
    Write-Host "curl.exe -sS -i -X POST `"$url`" -H `"Content-Type: application/json`" -H `"apikey: $apiKey`" -d '{}'"
    & curl.exe -sS -i -X POST $url `
        -H "Content-Type: application/json" `
        -H "apikey: $apiKey" `
        -d '{}'
    Write-Host ""
    Write-Host ""

}

switch ($Function) {
    'scores' { Invoke-EdgeFunction 'update-game-scores' }
    'winners' { Invoke-EdgeFunction 'determine-weekly-winners' }
    'both' {
        Invoke-EdgeFunction 'update-game-scores'
        Invoke-EdgeFunction 'determine-weekly-winners'
    }
}
