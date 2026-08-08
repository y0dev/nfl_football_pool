#!/bin/bash

# Deploy Supabase Edge Functions
#
# Uses `npx supabase` (no global CLI install required) and bundles each
# function from its full local directory tree, so relative imports like
# update-game-scores/index.ts's `../_shared/cron-lock.ts` resolve correctly —
# unlike the Dashboard's single-file paste editor, which only uploads the
# one file and fails with "Module not found" on that import.
set -e
echo "Deploying Supabase Edge Functions..."

: "${SUPABASE_PROJECT_ID:=muvtenjtdzlwcwmzksxy}"

echo "Deploying determine-weekly-winners..."
npx supabase functions deploy determine-weekly-winners --project-ref "$SUPABASE_PROJECT_ID"

echo "Deploying update-game-scores..."
npx supabase functions deploy update-game-scores --project-ref "$SUPABASE_PROJECT_ID"

echo "Deployment complete! Scheduling is managed by the SQL migration in"
echo "supabase/migrations/ (pg_cron), not this script — run 'supabase db push'"
echo "(or apply the migration via the SQL editor) once, separately, to"
echo "(re)install the cron jobs."
