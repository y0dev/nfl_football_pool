#!/bin/bash

# Deploy Supabase Edge Function for NFL game updates
echo "🚀 Deploying Supabase Edge Function..."

# Check if Supabase CLI is installed
if ! command -v supabase &> /dev/null; then
    echo "❌ Supabase CLI is not installed. Please install it first:"
    echo "npm install -g supabase"
    exit 1
fi

# Check if we're in a Supabase project
if [ ! -f "supabase/config.toml" ]; then
    echo "❌ Not in a Supabase project. Please run 'supabase init' first."
    exit 1
fi

# Deploy the edge function
echo "📦 Deploying update-games function..."
supabase functions deploy update-games

if [ $? -eq 0 ]; then
    echo "✅ Edge function deployed successfully!"
    echo ""
    echo "🔧 Next steps:"
    echo "1. Set up your API_SPORTS_KEY in Supabase dashboard:"
    echo "   - Go to Settings > Edge Functions"
    echo "   - Add API_SPORTS_KEY environment variable"
    echo ""
    echo "2. Test the function:"
    echo "   curl -X POST https://your-project.supabase.co/functions/v1/update-games \\"
    echo "     -H 'Content-Type: application/json' \\"
    echo "     -d '{\"season\": 2024, \"week\": 1}'"
    echo ""
    echo "3. Set up cron jobs for automatic updates"
else
    echo "❌ Failed to deploy edge function"
    exit 1
fi 