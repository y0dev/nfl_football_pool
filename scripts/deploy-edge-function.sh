#!/bin/bash

# Deploy Supabase Edge Functions
set -e
echo "Deploying Supabase Edge Functions..."

echo "Deploying determine-weekly-winners..."
supabase functions deploy determine-weekly-winners --project-ref "$SUPABASE_PROJECT_ID"

echo "Deploying update-game-scores..."
supabase functions deploy update-game-scores --project-ref "$SUPABASE_PROJECT_ID"

echo "Deployment complete! Scheduling is managed by the SQL migration in"
echo "supabase/migrations/ (pg_cron), not this script — run 'supabase db push'"
echo "(or apply the migration via the SQL editor) once, separately, to"
echo "(re)install the cron jobs."
