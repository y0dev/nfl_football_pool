# NFL Confidence Pool - Scripts Guide

This directory contains essential scripts for setting up and managing the NFL Confidence Pool application.

## 📁 Scripts Overview

### 1. `setup-database.ts` - Database Initialization
**Purpose**: Creates all database tables and applies security policies

**What it does**:
- Creates all required tables (admins, pools, participants, games, picks, scores, etc.)
- Applies Row Level Security (RLS) policies
- Sets up audit logging system
- Configures tie-breaker tables

**How to run**:
```bash
# Make sure you have environment variables set
npm run setup-db
# OR
npx tsx scripts/setup-database.ts
```

**Prerequisites**:
- Supabase project configured
- Environment variables set in `.env.local`:
  - `SUPABASE_URL`
  - `SUPABASE_SERVICE_ROLE_KEY`

---

### 2. `seed.ts` - Database Seeding
**Purpose**: Populates the database with initial data

**What it does**:
- Creates admin users
- Sets up NFL teams
- Creates sample pools
- Adds sample participants
- Creates sample games for the season
- Sets up initial picks and scores

**How to run**:
```bash
# Seed with default data
npm run seed
# OR
npx tsx scripts/seed.ts

# Seed with custom data (if supported)
npx tsx scripts/seed.ts --env production
```

**Prerequisites**:
- Database tables must be created (run `setup-database.ts` first)
- Supabase project configured
- Environment variables set

---

### 3. `deploy-edge-function.sh` - Supabase Edge Function Deployment
**Purpose**: Deploys automated functions for game updates and score calculations

**What it does**:
- Deploys the `update-games` Edge Function
- Sets up cron jobs for automatic execution
- Configures automated score calculations
- Sets up game result updates

**How to run**:
```bash
# Make script executable
chmod +x scripts/deploy-edge-function.sh

# Deploy edge functions
./scripts/deploy-edge-function.sh
# OR
bash scripts/deploy-edge-function.sh
```

**Prerequisites**:
- Supabase CLI installed (`npm install -g supabase`)
- Logged into Supabase CLI (`supabase login`)
- Project linked (`supabase link --project-ref YOUR_PROJECT_ID`)

---

## 🚀 Complete Setup Workflow

### Step 1: Environment Setup
```bash
# Copy environment template
cp env.example .env.local

# Edit environment variables
nano .env.local
```

Required variables:
```env
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
SUPABASE_ANON_KEY=your_anon_key
```

### Step 2: Database Setup
```bash
# Create all tables and security policies
npm run setup-db
```

### Step 3: Seed Initial Data
```bash
# Populate with sample data
npm run seed
```

### Step 4: Deploy Edge Functions
```bash
# Deploy automated functions
./scripts/deploy-edge-function.sh
```

### Step 5: Verify Setup
```bash
# Start development server
npm run dev

# Check admin dashboard at http://localhost:3000/admin/dashboard
```

---

## 📋 Script Dependencies

```
setup-database.ts
    ↓ (creates tables)
seed.ts
    ↓ (populates data)
deploy-edge-function.sh
    ↓ (deploys automation)
```

---

## 🔧 Troubleshooting

### Common Issues:

**1. "Permission denied" on deploy script**
```bash
chmod +x scripts/deploy-edge-function.sh
```

**2. "Supabase CLI not found"**
```bash
npm install -g supabase
```

**3. "Environment variables not set"**
```bash
# Check if .env.local exists and has required variables
cat .env.local
```

**4. "Database connection failed"**
```bash
# Verify Supabase project is active
supabase status
```

**5. "Tables already exist"**
```bash
# Drop and recreate (WARNING: This will delete all data)
supabase db reset
npm run setup-db
```

---

## 📊 What Each Script Creates

### `setup-database.ts` Output:
- ✅ `admins` table
- ✅ `pools` table  
- ✅ `admin_pools` table
- ✅ `participants` table
- ✅ `teams` table
- ✅ `games` table
- ✅ `picks` table
- ✅ `scores` table
- ✅ `tie_breakers` table
- ✅ `audit_logs` table
- ✅ Row Level Security policies

### `seed.ts` Output:
- ✅ Admin user: `admin@example.com`
- ✅ 32 NFL teams
- ✅ Sample pool: "Office Pool"
- ✅ Sample participants (10 users)
- ✅ Sample games for current season
- ✅ Sample picks and scores

### `deploy-edge-function.sh` Output:
- ✅ `update-games` Edge Function
- ✅ Cron job: Runs every 4 hours
- ✅ Automated score calculations
- ✅ Game result updates

---

## 🎯 Quick Start Commands

```bash
# Complete setup in one go
npm run setup-db && npm run seed && ./scripts/deploy-edge-function.sh

# Development workflow
npm run dev          # Start development server
npm run build        # Build for production
npm run setup-db     # Reset database
npm run seed         # Reset sample data
```

---

## 📝 Notes

- **Backup First**: Always backup your data before running setup scripts
- **Environment**: Scripts use `.env.local` for configuration
- **Permissions**: Some scripts require admin privileges
- **Logs**: Check console output for detailed error messages
- **Rollback**: Use `supabase db reset` to start fresh

---

## 🆘 Support

If you encounter issues:
1. Check the console output for error messages
2. Verify environment variables are set correctly
3. Ensure Supabase project is properly configured
4. Check that all dependencies are installed
