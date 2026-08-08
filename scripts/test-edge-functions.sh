#!/usr/bin/env bash
# Manual test harness for the update-game-scores / determine-weekly-winners
# Edge Functions. Both authenticate via withSupabase({ auth: 'secret' }),
# so the only thing a caller needs is the project's service-role key on the
# `apikey` header (see supabase/functions/*/index.ts and
# supabase/migrations/20260803220827_schedule_winners_and_scores_cron.sql).
#
# Usage:
#   scripts/test-edge-functions.sh local scores
#   scripts/test-edge-functions.sh local winners
#   scripts/test-edge-functions.sh local both
#   scripts/test-edge-functions.sh prod scores
#   scripts/test-edge-functions.sh prod winners
#   scripts/test-edge-functions.sh prod both
#
# local  - requires `npx supabase start` (and separately
#          `npx supabase functions serve --no-verify-jwt --env-file .env.local`)
#          already running. Reads the local service_role key from
#          `npx supabase status` — no key ever needs to be pasted or stored.
# prod   - hits the deployed functions directly and WILL write to production
#          tables (games / weekly_winners / period_winners / season_winners /
#          scores). Reads NEXT_PUBLIC_SUPABASE_URL and
#          SUPABASE_SECRET_KEY from .env.local.

set -euo pipefail
cd "$(dirname "$0")/.."

target="${1:-}"
fn="${2:-both}"

if [[ "$target" != "local" && "$target" != "prod" ]]; then
  echo "Usage: $0 <local|prod> <scores|winners|both>" >&2
  exit 1
fi

if [[ "$target" == "local" ]]; then
  status_env="$(npx supabase status -o env 2>/dev/null || true)"
  if [[ -z "$status_env" ]]; then
    echo "Could not read local Supabase status. Is 'npx supabase start' running?" >&2
    exit 1
  fi
  base_url="http://127.0.0.1:$(echo "$status_env" | grep -oE 'API_URL="http://127.0.0.1:[0-9]+"' | grep -oE '[0-9]+' || echo 54321)"
  apikey="$(echo "$status_env" | grep '^SERVICE_ROLE_KEY=' | cut -d'"' -f2)"
  if [[ -z "$apikey" ]]; then
    echo "Could not extract SERVICE_ROLE_KEY from 'npx supabase status -o env'." >&2
    exit 1
  fi
else
  if [[ ! -f .env.local ]]; then
    echo ".env.local not found." >&2
    exit 1
  fi
  base_url="$(grep -E '^NEXT_PUBLIC_SUPABASE_URL=' .env.local | cut -d'=' -f2-)"
  apikey="$(grep -E '^SUPABASE_SECRET_KEY=' .env.local | cut -d'=' -f2-)"
  if [[ -z "$base_url" || -z "$apikey" ]]; then
    echo "NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SECRET_KEY missing from .env.local." >&2
    exit 1
  fi
  echo "WARNING: this will call the DEPLOYED functions and can write to production tables." >&2
fi

call() {
  local name="$1"
  local url="${base_url}/functions/v1/${name}"
  echo "==> POST ${url}"
  curl -sS -i -X POST "$url" \
    -H "Content-Type: application/json" \
    -H "apikey: ${apikey}" \
    -d '{}'
  echo
  echo
}

case "$fn" in
  scores)  call update-game-scores ;;
  winners) call determine-weekly-winners ;;
  both)    call update-game-scores; call determine-weekly-winners ;;
  *) echo "Unknown function '$fn'. Use scores, winners, or both." >&2; exit 1 ;;
esac
