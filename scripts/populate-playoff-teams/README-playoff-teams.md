# Populate Playoff Teams Script

This script populates the `playoff_teams` table with NFL playoff team data for a given season.
Note: Playoff teams are the same for all pools, so you only need to run this once per season.

## Installation

Install required Python packages:

```bash
cd scripts/populate-playoff-teams
pip install -r requirements.txt
```

Or install individually:
```bash
pip install supabase requests python-dotenv beautifulsoup4
```

## Configuration

**Important:** Run the script from the project root directory (where `.env.local` is located).

Ensure your `.env.local` file in the project root contains:

```bash
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

## Usage

**Note:** Playoff teams are the same for all pools, so you only need to specify the season. The script will populate teams for all pools automatically.

### Option 1: Scrape from ESPN (Automated)

```bash
python scripts/populate-playoff-teams/populate-playoff-teams.py --season 2024 --source espn
```

Or simply (ESPN is the default):
```bash
python scripts/populate-playoff-teams/populate-playoff-teams.py --season 2024
```

**Note:** This scrapes data from https://www.espn.com/nfl/standings/_/view/playoff. If ESPN changes their page structure, this may fail. In that case, try NFL.com or use one of the manual options below.

### Option 1b: Scrape from NFL.com (Alternative)

```bash
python scripts/populate-playoff-teams/populate-playoff-teams.py --season 2024 --source nfl
```

**Note:** This scrapes data from https://www.nfl.com/standings/playoff-picture. This is an alternative source if ESPN scraping fails.

### Option 2: Load from JSON File

Create a JSON file with playoff teams (see `playoff-teams-example.json`):

```bash
python scripts/populate-playoff-teams/populate-playoff-teams.py --season 2024 --teams-file scripts/populate-playoff-teams/playoff-teams-example.json
```

### Option 3: Load from CSV File

Create a CSV file with columns: `team_name`, `team_abbreviation`, `conference`, `seed` (see `playoff-teams-example.csv`):

```bash
python scripts/populate-playoff-teams/populate-playoff-teams.py --season 2024 --teams-file scripts/populate-playoff-teams/playoff-teams-example.csv
```

### Option 4: Manual JSON Input

Provide teams directly as a JSON string:

```bash
python scripts/populate-playoff-teams/populate-playoff-teams.py --season 2024 \
  --teams '[{"team_name": "Kansas City Chiefs", "team_abbreviation": "KC", "conference": "AFC", "seed": 1}]'
```

## Example JSON Format

```json
[
  {
    "team_name": "Kansas City Chiefs",
    "team_abbreviation": "KC",
    "conference": "AFC",
    "seed": 1
  },
  {
    "team_name": "San Francisco 49ers",
    "team_abbreviation": "SF",
    "conference": "NFC",
    "seed": 1
  }
]
```

## Example CSV Format

```csv
team_name,team_abbreviation,conference,seed
Kansas City Chiefs,KC,AFC,1
San Francisco 49ers,SF,NFC,1
```

## Getting Playoff Teams Data

The script automatically scrapes from ESPN's playoff standings page. However, if the automatic scraping fails (due to page structure changes), you can use these alternative sources:

1. **ESPN.com Playoff Standings** - https://www.espn.com/nfl/standings/_/view/playoff (what the script scrapes)
2. **NFL.com** - Official NFL standings page shows playoff seeds
3. **Pro Football Reference** - Comprehensive playoff standings
4. **Manual entry** - You can manually compile the list from any source

### Recommended Approach (if scraping fails)

1. Visit [ESPN Playoff Standings](https://www.espn.com/nfl/standings/_/view/playoff) or [NFL.com Standings](https://www.nfl.com/standings)
2. Note the 7 playoff teams from each conference (AFC and NFC) with their seeds
3. Create a JSON or CSV file using the examples provided
4. Run the script with `--teams-file` option

## Notes

- The script will delete existing playoff teams for the season before inserting new ones
- Playoff teams are the same for all pools, so you only need to run this once per season
- Team names must match exactly with how they're stored in your database
- Seeds should be 1-7 for each conference (AFC and NFC)
- Conference values should be "AFC" or "NFC"
- The script validates data before insertion

