#!/bin/bash

# Deploy Supabase Edge Functions
echo "Deploying Supabase Edge Functions..."

# Deploy update-games function
echo "Deploying update-games function..."
supabase functions deploy update-games --project-ref $SUPABASE_PROJECT_ID

# Set up cron job for update-games function
echo "Setting up cron job for update-games function..."
supabase functions cron create update-games --cron "0 */4 * * *" --description "Update NFL game results and recalculate pool scores every 4 hours during game days"

echo "Deployment complete!" 