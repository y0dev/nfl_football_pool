#!/usr/bin/env python3
"""
Script to populate playoff_teams table with NFL playoff team data.

This script scrapes playoff teams from ESPN's or NFL.com's playoff standings page and inserts them into the Supabase database.

Usage:
    python scripts/populate-playoff-teams/populate-playoff-teams.py --season <season> [--source espn|nfl] [options]

Requirements:
    pip install supabase requests python-dotenv beautifulsoup4
"""

import os
import sys
import argparse
import requests
from datetime import datetime
from typing import List, Dict, Optional
from dotenv import load_dotenv

try:
    from supabase import create_client, Client
except ImportError:
    print("Error: supabase package not installed. Run: pip install supabase")
    sys.exit(1)

# Load environment variables (look for .env.local in project root, two levels up from this script)
script_dir = os.path.dirname(os.path.abspath(__file__))
project_root = os.path.dirname(os.path.dirname(script_dir))
env_path = os.path.join(project_root, '.env.local')
print(f"Loading environment variables from: {env_path}")
print(f"Project root: {project_root}")
print(f"Script directory: {script_dir}")
print(f"Environment path: {env_path}")
if os.path.exists(env_path):
    load_dotenv(env_path)
    # Print loaded environment variables (mask sensitive values)
    # print(f"Environment variables loaded:")
    # supabase_url = os.getenv('NEXT_PUBLIC_SUPABASE_URL') or os.getenv('SUPABASE_URL')
    # supabase_key = os.getenv('NEXT_PUBLIC_SUPABASE_SERVICE_KEY') or os.getenv('SUPABASE_SERVICE_KEY')
    # print(f"  NEXT_PUBLIC_SUPABASE_URL: {'✅ Set' if supabase_url else '❌ Missing'}")
    # if supabase_url:
    #     print(f"    Value: {supabase_url[:30]}..." if len(supabase_url) > 30 else f"    Value: {supabase_url}")
    # print(f"  NEXT_PUBLIC_SUPABASE_SERVICE_KEY: {'✅ Set' if supabase_key else '❌ Missing'}")
    # if supabase_key:
    #     masked_key = supabase_key[:10] + "..." + supabase_key[-10:] if len(supabase_key) > 20 else "***"
    #     print(f"    Value: {masked_key}")
else:
    # Throw an error
    raise ValueError(f"Environment file not found at: {env_path}")

# ESPN playoff standings page
ESPN_PLAYOFF_STANDINGS_URL = "https://www.espn.com/nfl/standings/_/view/playoff"


def get_supabase_client() -> Client:
    """Create and return a Supabase client."""
    supabase_url = os.getenv('NEXT_PUBLIC_SUPABASE_URL') or os.getenv('SUPABASE_URL')
    supabase_key = os.getenv('NEXT_PUBLIC_SUPABASE_SERVICE_KEY') or os.getenv('SUPABASE_SERVICE_ROLE_KEY')
    
    if not supabase_url:
        raise ValueError("NEXT_PUBLIC_SUPABASE_URL or SUPABASE_URL environment variable is required")
    
    if not supabase_key:
        raise ValueError("NEXT_PUBLIC_SUPABASE_SERVICE_KEY or SUPABASE_SERVICE_ROLE_KEY environment variable is required")
    
    return create_client(supabase_url, supabase_key)


# List of all NFL teams for interactive selection (as JSON objects)
NFL_TEAMS = [
    {'name': 'Arizona Cardinals', 'abbreviation': 'ARI', 'conference': 'NFC'},
    {'name': 'Los Angeles Rams', 'abbreviation': 'LAR', 'conference': 'NFC'},
    {'name': 'San Francisco 49ers', 'abbreviation': 'SF', 'conference': 'NFC'},
    {'name': 'Seattle Seahawks', 'abbreviation': 'SEA', 'conference': 'NFC'},

    {'name': 'Atlanta Falcons', 'abbreviation': 'ATL', 'conference': 'NFC'},
    {'name': 'Carolina Panthers', 'abbreviation': 'CAR', 'conference': 'NFC'},
    {'name': 'New Orleans Saints', 'abbreviation': 'NO', 'conference': 'NFC'},
    {'name': 'Tampa Bay Buccaneers', 'abbreviation': 'TB', 'conference': 'NFC'},

    {'name': 'Chicago Bears', 'abbreviation': 'CHI', 'conference': 'NFC'},
    {'name': 'Detroit Lions', 'abbreviation': 'DET', 'conference': 'NFC'},
    {'name': 'Green Bay Packers', 'abbreviation': 'GB', 'conference': 'NFC'},
    {'name': 'Minnesota Vikings', 'abbreviation': 'MIN', 'conference': 'NFC'},

    {'name': 'Dallas Cowboys', 'abbreviation': 'DAL', 'conference': 'NFC'},
    {'name': 'New York Giants', 'abbreviation': 'NYG', 'conference': 'NFC'},
    {'name': 'Philadelphia Eagles', 'abbreviation': 'PHI', 'conference': 'NFC'},
    {'name': 'Washington Commanders', 'abbreviation': 'WSH', 'conference': 'NFC'},
    
    {'name': 'Baltimore Ravens', 'abbreviation': 'BAL', 'conference': 'AFC'},
    {'name': 'Cincinnati Bengals', 'abbreviation': 'CIN', 'conference': 'AFC'},
    {'name': 'Cleveland Browns', 'abbreviation': 'CLE', 'conference': 'AFC'},
    {'name': 'Pittsburgh Steelers', 'abbreviation': 'PIT', 'conference': 'AFC'},

    {'name': 'Buffalo Bills', 'abbreviation': 'BUF', 'conference': 'AFC'},
    {'name': 'Miami Dolphins', 'abbreviation': 'MIA', 'conference': 'AFC'},   
    {'name': 'New England Patriots', 'abbreviation': 'NE', 'conference': 'AFC'},
    {'name': 'New York Jets', 'abbreviation': 'NYJ', 'conference': 'AFC'},

    {'name': 'Denver Broncos', 'abbreviation': 'DEN', 'conference': 'AFC'},
    {'name': 'Kansas City Chiefs', 'abbreviation': 'KC', 'conference': 'AFC'},
    {'name': 'Las Vegas Raiders', 'abbreviation': 'LV', 'conference': 'AFC'},
    {'name': 'Los Angeles Chargers', 'abbreviation': 'LAC', 'conference': 'AFC'},

    {'name': 'Houston Texans', 'abbreviation': 'HOU', 'conference': 'AFC'},
    {'name': 'Indianapolis Colts', 'abbreviation': 'IND', 'conference': 'AFC'},
    {'name': 'Jacksonville Jaguars', 'abbreviation': 'JAX', 'conference': 'AFC'},
    {'name': 'Tennessee Titans', 'abbreviation': 'TEN', 'conference': 'AFC'},
]

def get_team_abbreviation(full_name: str) -> str:
    """Convert full team name to abbreviation."""
    # Look up from NFL_TEAMS list first
    team_obj = next((t for t in NFL_TEAMS if t.get('name') == full_name), None)
    if team_obj:
        return team_obj.get('abbreviation', '')
    # Fallback: generate abbreviation from name
    return full_name.split()[-1][:3].upper()


def fetch_playoff_teams_from_nfl(season: int) -> List[Dict[str, any]]:
    """
    Scrape playoff teams from NFL.com playoff picture page.
    
    Fetches data from: https://www.nfl.com/standings/playoff-picture
    """
    try:
        from bs4 import BeautifulSoup
        import json
        import re
        
        url = "https://www.nfl.com/standings/playoff-picture"
        
        print(f"Scraping playoff teams from NFL.com for season {season}...")
        print(f"Fetching: {url}")
        
        # Set headers to mimic a browser request
        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.5',
            'Referer': 'https://www.nfl.com/'
        }
        
        response = requests.get(url, headers=headers, timeout=15)
        
        if response.status_code != 200:
            print(f"Warning: NFL.com returned status {response.status_code}")
            return []
        
        # Write response to file for debugging purposes
        script_dir = os.path.dirname(os.path.abspath(__file__))
        html_file = os.path.join(script_dir, f"nfl-response-{season}.html")
        with open(html_file, "w", encoding='utf-8', errors='ignore') as f:
            f.write(response.text)
        print(f"Saved response to: {html_file}")
        
        soup = BeautifulSoup(response.content, 'html.parser')
        playoff_teams = []
        
        # NFL.com structure: Look for script tags with JSON data
        scripts = soup.find_all('script')
        for script in scripts:
            if script.string:
                script_text = script.string
                
                # Try to find JSON data with playoff/standings information
                # NFL.com may use different patterns, try multiple approaches
                json_matches = []
                
                # Pattern 1: Look for window.__NEXT_DATA__ or similar
                next_data_pattern = r'__NEXT_DATA__\s*=\s*({.+?});'
                matches = re.findall(next_data_pattern, script_text, re.DOTALL)
                if matches:
                    json_matches = matches
                
                # Pattern 2: Look for playoff-related JSON structures
                if not json_matches:
                    playoff_patterns = [
                        r'playoffPicture["\']?\s*[:=]\s*({.+?})',
                        r'standings["\']?\s*[:=]\s*({.+?})',
                        r'playoffTeams["\']?\s*[:=]\s*\[({.+?})\]',
                    ]
                    for pattern in playoff_patterns:
                        matches = re.findall(pattern, script_text, re.DOTALL | re.IGNORECASE)
                        if matches:
                            json_matches = matches
                            break
                
                if json_matches:
                    for match in json_matches:
                        try:
                            data = json.loads(match)
                            # Recursively search for playoff team data
                            def find_playoff_teams(obj, path=""):
                                """Recursively find playoff teams structure."""
                                if isinstance(obj, dict):
                                    # Look for common patterns in NFL.com data
                                    if 'teams' in obj and isinstance(obj['teams'], list):
                                        return obj.get('teams', [])
                                    if 'playoffTeams' in obj:
                                        return obj['playoffTeams']
                                    if 'standings' in obj:
                                        standings = obj['standings']
                                        if isinstance(standings, list):
                                            return standings
                                        elif isinstance(standings, dict) and 'teams' in standings:
                                            return standings['teams']
                                    # Search deeper
                                    for key, value in obj.items():
                                        result = find_playoff_teams(value, f"{path}.{key}" if path else key)
                                        if result:
                                            return result
                                elif isinstance(obj, list):
                                    # If it's a list of teams, return it
                                    if len(obj) > 0 and isinstance(obj[0], dict):
                                        if 'team' in obj[0] or 'name' in obj[0] or 'abbreviation' in obj[0]:
                                            return obj
                                    # Otherwise search items
                                    for idx, item in enumerate(obj):
                                        result = find_playoff_teams(item, f"{path}[{idx}]")
                                        if result:
                                            return result
                                return None
                            
                            teams_data = find_playoff_teams(data)
                            if teams_data and isinstance(teams_data, list):
                                for team_data in teams_data:
                                    # Handle different data structures
                                    team = team_data.get('team', {}) if isinstance(team_data, dict) else team_data
                                    
                                    if isinstance(team, dict):
                                        team_name = team.get('displayName') or team.get('name') or team.get('fullName') or team.get('teamName', '')
                                        abbreviation = team.get('abbreviation') or team.get('abbr', '')
                                        conference = team.get('conference') or team_data.get('conference', '')
                                        seed = team.get('seed') or team_data.get('seed') or team.get('playoffSeed')
                                        
                                        if team_name and conference:
                                            conference = conference.upper()
                                            if conference in ['AFC', 'NFC'] and seed and 1 <= seed <= 7:
                                                playoff_teams.append({
                                                    'team_name': team_name,
                                                    'team_abbreviation': abbreviation or get_team_abbreviation(team_name),
                                                    'conference': conference,
                                                    'seed': int(seed)
                                                })
                            
                            if playoff_teams:
                                break
                        except (json.JSONDecodeError, KeyError, TypeError, ValueError) as e:
                            continue
                    if playoff_teams:
                        break
        
        # Method 2: If JSON extraction failed, try HTML parsing
        if not playoff_teams:
            print("JSON extraction failed, trying HTML table parsing...")
            # Look for tables or divs with playoff information
            # NFL.com typically has conference sections
            conference_sections = soup.find_all(['section', 'div'], class_=re.compile(r'conference|afc|nfc', re.I))
            
            for section in conference_sections:
                section_text = section.get_text().upper()
                conference = None
                
                if 'AFC' in section_text and ('NFC' not in section_text or section_text.find('AFC') < section_text.find('NFC')):
                    conference = 'AFC'
                elif 'NFC' in section_text:
                    conference = 'NFC'
                
                if not conference:
                    continue
                
                # Find team links/names in this section
                team_links = section.find_all('a', href=re.compile(r'/teams/'))
                for idx, link in enumerate(team_links[:7]):  # Max 7 teams per conference
                    team_name = link.get_text(strip=True)
                    if team_name:
                        # Try to find seed nearby
                        parent = link.find_parent(['tr', 'div', 'li'])
                        seed = None
                        if parent:
                            seed_text = parent.get_text()
                            seed_match = re.search(r'\b([1-7])\b', seed_text)
                            if seed_match:
                                seed = int(seed_match.group(1))
                        
                        if not seed:
                            seed = idx + 1  # Use position as seed
                        
                        if team_name and 1 <= seed <= 7:
                            playoff_teams.append({
                                'team_name': team_name,
                                'team_abbreviation': get_team_abbreviation(team_name),
                                'conference': conference,
                                'seed': seed
                            })
        
        # Remove duplicates and sort
        seen = set()
        unique_teams = []
        for team in playoff_teams:
            key = (team['team_name'], team['conference'], team['seed'])
            if key not in seen:
                seen.add(key)
                unique_teams.append(team)
        
        # Sort by conference and seed
        unique_teams.sort(key=lambda x: (x['conference'], x['seed']))
        
        if unique_teams:
            print(f"✅ Successfully scraped {len(unique_teams)} playoff teams from NFL.com")
            return unique_teams
        else:
            print("⚠️  Could not parse playoff teams from NFL.com page")
            print("The page structure may have changed. Using manual input is recommended.")
            print("\nTry using --teams-file option with a JSON/CSV file instead.")
            return []
            
    except ImportError:
        print("Error: beautifulsoup4 package required for web scraping")
        print("Install it with: pip install beautifulsoup4")
        return []
    except requests.exceptions.RequestException as e:
        print(f"Error fetching from NFL.com: {e}")
        print("Note: You may need to manually input teams using --teams or --teams-file")
        return []
    except Exception as e:
        print(f"Error parsing NFL.com page: {e}")
        import traceback
        traceback.print_exc()
        print("\nConsider using --teams-file option with a JSON/CSV file instead.")
        return []


def fetch_playoff_teams_from_espn(season: int) -> List[Dict[str, any]]:
    """
    Scrape playoff teams from ESPN playoff standings page.
    
    Fetches data from: https://www.espn.com/nfl/standings/_/view/playoff
    """
    try:
        from bs4 import BeautifulSoup
        import json
        import re
        
        url = "https://www.espn.com/nfl/standings/_/view/playoff"
        
        print(f"Scraping playoff teams from ESPN for season {season}...")
        print(f"Fetching: {url}")
        
        # Set headers to mimic a browser request
        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.5',
            'Referer': 'https://www.espn.com/'
        }
        
        response = requests.get(url, headers=headers, timeout=15)
        
        if response.status_code != 200:
            print(f"Warning: ESPN returned status {response.status_code}")
            return []
        
        # Write response to file for debugging purposes
        script_dir = os.path.dirname(os.path.abspath(__file__))
        html_file = os.path.join(script_dir, f"espn-response-{season}.html")
        with open(html_file, "w", encoding='utf-8', errors='ignore') as f:
            f.write(response.text)
        print(f"Saved response to: {html_file}")
        
        # Use the response content for parsing
        soup = BeautifulSoup(response.content, 'html.parser')
        playoff_teams = []
        
        # Method 1: Try to extract JSON data from script tags (ESPN embeds data this way)
        scripts = soup.find_all('script')
        for script in scripts:
            if script.string:
                # Look for window.__espnfitt__ or similar data structures
                script_text = script.string
                
                # Try to find JSON data structures - ESPN uses window['__espnfitt__'] format
                # Pattern 1: window['__espnfitt__'] = {...} or window["__espnfitt__"] = {...}
                json_matches = re.findall(r"window\['__espnfitt__'\]\s*=\s*({.+?});", script_text, re.DOTALL)
                if not json_matches:
                    json_matches = re.findall(r'window\["__espnfitt__"\]\s*=\s*({.+?});', script_text, re.DOTALL)
                if not json_matches:
                    # Pattern 2: window.__espnfitt__ = {...};
                    json_matches = re.findall(r'window\.__espnfitt__\s*=\s*({.+?});', script_text, re.DOTALL)
                if not json_matches:
                    # Pattern 3: __espnfitt__: {...} (in object literal)
                    json_matches = re.findall(r'__espnfitt__\s*:\s*({.+?}),?\s*[;\n}]', script_text, re.DOTALL)
                
                if json_matches:
                    for match in json_matches:
                        try:
                            data = json.loads(match)
                            
                            # Recursively search for standings data
                            def find_standings_data(obj, path=""):
                                """Recursively find standings/groups/entries structure."""
                                if isinstance(obj, dict):
                                    # Check if this looks like standings data
                                    if 'groups' in obj and isinstance(obj['groups'], list):
                                        return obj
                                    if 'standings' in obj:
                                        standings = obj['standings']
                                        if isinstance(standings, dict) and 'groups' in standings:
                                            return standings
                                    # Search deeper
                                    for key, value in obj.items():
                                        result = find_standings_data(value, f"{path}.{key}" if path else key)
                                        if result:
                                            return result
                                elif isinstance(obj, list):
                                    for idx, item in enumerate(obj):
                                        result = find_standings_data(item, f"{path}[{idx}]")
                                        if result:
                                            return result
                                return None
                            
                            standings = find_standings_data(data)
                            
                            if standings and 'groups' in standings:
                                # ESPN structure: standings.groups[] contains conferences
                                for group in standings['groups']:
                                    conference = group.get('name', '').upper()
                                    if conference not in ['AFC', 'NFC']:
                                        # Try alternative conference field names
                                        conference = group.get('abbreviation', '').upper()
                                        if conference not in ['AFC', 'NFC']:
                                            conference = group.get('conference', '').upper()
                                            if conference not in ['AFC', 'NFC']:
                                                continue
                                    
                                    entries = group.get('standings', {})
                                    if isinstance(entries, dict):
                                        entries = entries.get('entries', [])
                                    if not isinstance(entries, list):
                                        entries = []
                                    
                                    for entry in entries:
                                        team = entry.get('team', {})
                                        team_name = team.get('displayName', '') or team.get('name', '') or team.get('fullName', '')
                                        
                                        # Get seed from stats or direct field
                                        seed = entry.get('playoffSeed') or entry.get('seed')
                                        if not seed:
                                            stats = entry.get('stats', [])
                                            for stat in stats:
                                                if isinstance(stat, dict):
                                                    if stat.get('name') == 'playoffSeed' or stat.get('type') == 'playoffSeed':
                                                        seed_val = stat.get('value') or stat.get('displayValue')
                                                        if seed_val:
                                                            try:
                                                                seed = int(seed_val)
                                                            except (ValueError, TypeError):
                                                                continue
                                                            break
                                                elif isinstance(stat, str) and 'seed' in stat.lower():
                                                    # Try to extract number from string
                                                    seed_match = re.search(r'\d+', stat)
                                                    if seed_match:
                                                        seed = int(seed_match.group())
                                                        break
                                        
                                        if team_name and seed and 1 <= seed <= 7:
                                            abbreviation = team.get('abbreviation') or team.get('shortDisplayName', '')
                                            playoff_teams.append({
                                                'team_name': team_name,
                                                'team_abbreviation': abbreviation or get_team_abbreviation(team_name),
                                                'conference': conference,
                                                'seed': int(seed)
                                            })
                            
                            if playoff_teams:
                                break
                        except (json.JSONDecodeError, KeyError, TypeError, ValueError) as e:
                            continue
                    if playoff_teams:
                        break
                
                # Alternative: Look for other JSON patterns
                # Try to find standalone JSON objects
                json_patterns = re.findall(r'\{[^{}]*"standings"[^{}]*\}', script_text)
                for pattern in json_patterns:
                    try:
                        data = json.loads(pattern)
                        # Try to extract teams from various possible structures
                        # This is a fallback if the main structure doesn't match
                    except:
                        continue
        
        # Method 2: If JSON extraction failed, try HTML table parsing
        if not playoff_teams:
            print("JSON extraction failed, trying HTML table parsing...")
            # Find all table elements
            tables = soup.find_all('table')
            
            for table in tables:
                # Find parent container to identify conference
                parent = table.find_parent(['div', 'section', 'article'])
                conference = None
                
                # Look for conference in parent text or nearby headings
                if parent:
                    parent_text = parent.get_text().upper()
                    # Check for AFC/NFC labels
                    if 'AFC' in parent_text:
                        # Make sure it's not NFC
                        if parent_text.find('AFC') < parent_text.find('NFC') or 'NFC' not in parent_text:
                            conference = 'AFC'
                    if 'NFC' in parent_text and not conference:
                        conference = 'NFC'
                
                # Also check for conference in table headers
                if not conference:
                    headers = table.find_all(['th', 'thead'])
                    for header in headers:
                        header_text = header.get_text().upper()
                        if 'AFC' in header_text and 'NFC' not in header_text:
                            conference = 'AFC'
                            break
                        elif 'NFC' in header_text:
                            conference = 'NFC'
                            break
                
                if not conference:
                    continue
                
                # Parse rows
                rows = table.find_all('tr')
                row_num = 0
                for row in rows:
                    # Skip header rows
                    if row.find('th') or 'header' in str(row.get('class', [])).lower():
                        continue
                    
                    cells = row.find_all(['td', 'th'])
                    if len(cells) < 2:
                        continue
                    
                    # Team name is usually in a link
                    team_link = row.find('a', href=re.compile(r'/nfl/team/'))
                    if not team_link:
                        continue
                    
                    team_name = team_link.get_text(strip=True)
                    
                    # Look for seed number in cells
                    seed = None
                    for cell in cells:
                        cell_text = cell.get_text(strip=True)
                        # Seed is typically a single digit 1-7
                        if cell_text.isdigit():
                            seed_val = int(cell_text)
                            if 1 <= seed_val <= 7:
                                seed = seed_val
                                break
                    
                    # If no seed found, try using row position as seed
                    if not seed:
                        row_num += 1
                        if row_num <= 7:  # Only first 7 teams per conference
                            seed = row_num
                    
                    if team_name and conference and seed:
                        playoff_teams.append({
                            'team_name': team_name,
                            'team_abbreviation': get_team_abbreviation(team_name),
                            'conference': conference,
                            'seed': seed
                        })
        
        # Remove duplicates and sort
        seen = set()
        unique_teams = []
        for team in playoff_teams:
            key = (team['team_name'], team['conference'], team['seed'])
            if key not in seen:
                seen.add(key)
                unique_teams.append(team)
        
        # Sort by conference and seed
        unique_teams.sort(key=lambda x: (x['conference'], x['seed']))
        
        if unique_teams:
            print(f"✅ Successfully scraped {len(unique_teams)} playoff teams from ESPN")
            return unique_teams
        else:
            print("⚠️  Could not parse playoff teams from ESPN page")
            print("The page structure may have changed. Using manual input is recommended.")
            print("\nTry using --teams-file option with a JSON/CSV file instead.")
            print("Or visit the page manually and extract teams from:")
            print("  https://www.espn.com/nfl/standings/_/view/playoff")
            return []
            
    except ImportError:
        print("Error: beautifulsoup4 package required for web scraping")
        print("Install it with: pip install beautifulsoup4")
        return []
    except requests.exceptions.RequestException as e:
        print(f"Error fetching from ESPN: {e}")
        print("Note: You may need to manually input teams using --teams or --teams-file")
        return []
    except Exception as e:
        print(f"Error parsing ESPN page: {e}")
        import traceback
        traceback.print_exc()
        print("\nConsider using --teams-file option with a JSON/CSV file instead.")
        return []


def load_teams_from_file(filepath: str) -> List[Dict[str, any]]:
    """Load teams from a JSON or CSV file."""
    import json
    import csv
    
    if not os.path.exists(filepath):
        raise FileNotFoundError(f"File not found: {filepath}")
    
    teams = []
    
    if filepath.endswith('.json'):
        with open(filepath, 'r') as f:
            data = json.load(f)
            if isinstance(data, list):
                teams = data
            elif isinstance(data, dict) and 'teams' in data:
                teams = data['teams']
    elif filepath.endswith('.csv'):
        with open(filepath, 'r') as f:
            reader = csv.DictReader(f)
            for row in reader:
                teams.append({
                    'team_name': row.get('team_name', ''),
                    'team_abbreviation': row.get('team_abbreviation', ''),
                    'conference': row.get('conference', ''),
                    'seed': int(row.get('seed', 0)) if row.get('seed') else None
                })
    else:
        raise ValueError("Unsupported file format. Use .json or .csv")
    
    return teams


def preview_teams(season: int, teams: List[Dict[str, any]], save_json: bool = False) -> None:
    """Display teams that will be inserted for user review."""
    import json
    
    print("\n" + "=" * 60)
    print(f"PREVIEW: Playoff Teams for Season {season}")
    print("=" * 60)
    
    # Group by conference
    afc_teams = [t for t in teams if t.get('conference', '').upper() == 'AFC']
    nfc_teams = [t for t in teams if t.get('conference', '').upper() == 'NFC']
    
    if afc_teams:
        print("\nAFC Teams:")
        for team in sorted(afc_teams, key=lambda x: x.get('seed', 999)):
            print(f"  Seed {team.get('seed', 'N/A'):2}: {team['team_name']:30} ({team.get('team_abbreviation', 'N/A')})")
    
    if nfc_teams:
        print("\nNFC Teams:")
        for team in sorted(nfc_teams, key=lambda x: x.get('seed', 999)):
            print(f"  Seed {team.get('seed', 'N/A'):2}: {team['team_name']:30} ({team.get('team_abbreviation', 'N/A')})")
    
    print("\n" + "=" * 60)
    print(f"Total: {len(teams)} teams ({len(afc_teams)} AFC, {len(nfc_teams)} NFC)")
    print("=" * 60)
    
    # Save JSON to file if requested (save in the script's directory)
    if save_json:
        script_dir = os.path.dirname(os.path.abspath(__file__))
        json_filename = os.path.join(script_dir, f"playoff-teams-{season}-preview.json")
        with open(json_filename, 'w') as f:
            json.dump(teams, f, indent=2)
        print(f"\n📄 Preview JSON saved to: {json_filename}")
        print("   You can review and edit this file, then use --teams-file to load it.")


def get_existing_teams(supabase: Client, season: int) -> Dict[str, Dict[str, any]]:
    """Get existing playoff teams from database, organized by conference and seed."""
    try:
        response = supabase.table('playoff_teams').select('*').eq('season', season).execute()
        existing = {}
        if response.data:
            for team in response.data:
                conf = team.get('conference', '').upper()
                seed = team.get('seed')
                if conf and seed:
                    key = f"{conf}_{seed}"
                    existing[key] = team
        return existing
    except Exception as e:
        print(f"Error fetching existing teams: {e}")
        return {}


def get_user_approval() -> bool:
    """Prompt user for approval before inserting data."""
    while True:
        response = input("\nDo you want to insert these teams into the database? (yes/no): ").strip().lower()
        if response in ['yes', 'y']:
            return True
        elif response in ['no', 'n']:
            return False
        else:
            print("Please enter 'yes' or 'no'")


def insert_playoff_teams(supabase: Client, season: int, teams: List[Dict[str, any]], skip_approval: bool = False, save_preview: bool = False, update_mode: bool = False) -> bool:
    """Insert playoff teams into the database."""
    if not teams:
        print("No teams to insert.")
        return False
    
    # Preview teams before insertion
    preview_teams(season, teams, save_json=save_preview)
    
    # Get user approval unless skipped
    if not skip_approval:
        if not get_user_approval():
            print("\n❌ Insertion cancelled by user.")
            return False
    
    print(f"\nInserting {len(teams)} playoff teams for season {season}...")
    
    # Prepare data for insertion (no pool_id needed - teams are the same for all pools)
    insert_data = []
    for team in teams:
        insert_data.append({
            'season': season,
            'team_name': team['team_name'],
            'team_abbreviation': team.get('team_abbreviation'),
            'conference': team.get('conference'),
            'seed': team.get('seed')
        })
    
    try:
        if update_mode:
            # Update mode: Update existing teams and insert new ones
            existing_teams = get_existing_teams(supabase, season)
            to_insert = []
            to_update = []
            
            for team_data in insert_data:
                conf = team_data.get('conference', '').upper()
                seed = team_data.get('seed')
                key = f"{conf}_{seed}"
                
                if key in existing_teams:
                    # Update existing team
                    team_id = existing_teams[key]['id']
                    to_update.append((team_id, team_data))
                else:
                    # Insert new team
                    to_insert.append(team_data)
            
            # Perform updates
            for team_id, team_data in to_update:
                supabase.table('playoff_teams').update(team_data).eq('id', team_id).execute()
            
            # Perform inserts
            if to_insert:
                supabase.table('playoff_teams').insert(to_insert).execute()
            
            print(f"Updated {len(to_update)} teams and inserted {len(to_insert)} new teams for season {season}")
            
            # Fetch updated teams to display
            all_teams_response = supabase.table('playoff_teams').select('*').eq('season', season).execute()
            if all_teams_response.data:
                print(f"✅ Successfully updated playoff teams for season {season}!")
                print("\nCurrent teams:")
                for team in sorted(all_teams_response.data, key=lambda x: (x.get('conference', ''), x.get('seed', 999))):
                    print(f"  - {team['team_name']} ({team.get('team_abbreviation', 'N/A')}) "
                          f"- {team.get('conference', 'N/A')} #{team.get('seed', 'N/A')}")
                return True
            return True
        else:
            # Normal mode: Delete existing teams for this season first (to allow re-running)
            delete_response = supabase.table('playoff_teams').delete().eq('season', season).execute()
            print(f"Deleted existing playoff teams for season {season}")
            
            # Insert new teams
            response = supabase.table('playoff_teams').insert(insert_data).execute()
        
            if response.data:
                print(f"✅ Successfully inserted {len(response.data)} playoff teams!")
                print("\nTeams inserted:")
                for team in sorted(response.data, key=lambda x: (x.get('conference', ''), x.get('seed', 999))):
                    print(f"  - {team['team_name']} ({team.get('team_abbreviation', 'N/A')}) "
                          f"- {team.get('conference', 'N/A')} #{team.get('seed', 'N/A')}")
                return True
            else:
                print("❌ No data returned from insert operation")
                return False
            
    except Exception as e:
        print(f"❌ Error inserting teams: {e}")
        if hasattr(e, 'message'):
            print(f"   Error message: {e.message}")
        return False


def main():
    parser = argparse.ArgumentParser(
        description='Populate playoff_teams table with NFL playoff team data',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=        """
Examples:
  # Interactive menu mode (recommended for manual entry)
  python scripts/populate-playoff-teams/populate-playoff-teams.py --interactive

  # Scrape from ESPN and insert
  python scripts/populate-playoff-teams/populate-playoff-teams.py --season 2024

  # Scrape from NFL.com instead
  python scripts/populate-playoff-teams/populate-playoff-teams.py --season 2024 --source nfl

  # Use manually specified teams (JSON format)
  python scripts/populate-playoff-teams/populate-playoff-teams.py --season 2024 \\
    --teams '[{"team_name": "Kansas City Chiefs", "team_abbreviation": "KC", "conference": "AFC", "seed": 1}]'

  # Load from file
  python scripts/populate-playoff-teams/populate-playoff-teams.py --season 2024 --teams-file teams.json

  # Skip confirmation prompt (auto-approve)
  python scripts/populate-playoff-teams/populate-playoff-teams.py --season 2024 --yes

  # Save preview JSON to file before approval
  python scripts/populate-playoff-teams/populate-playoff-teams.py --season 2024 --save-preview
        """
    )
    
    parser.add_argument('--season', type=int, help='Season year (e.g., 2024). Required unless using --interactive mode.')
    parser.add_argument('--interactive', '-i', action='store_true',
                        help='Run in interactive menu mode (optional if no other args provided)')
    parser.add_argument('--teams', help='JSON array of teams (alternative to scraping)')
    parser.add_argument('--teams-file', help='Path to JSON/CSV file containing teams')
    parser.add_argument('--source', choices=['espn', 'nfl', 'manual', 'file'], default='espn',
                        help='Data source: espn (ESPN.com), nfl (NFL.com), manual (--teams arg), or file (--teams-file) (default: espn)')
    parser.add_argument('--yes', '-y', action='store_true',
                        help='Skip confirmation prompt and insert immediately')
    parser.add_argument('--save-preview', action='store_true',
                        help='Save preview JSON to file before asking for approval')
    
    args = parser.parse_args()
    
    # Initialize Supabase client
    try:
        supabase = get_supabase_client()
    except Exception as e:
        print(f"❌ Error connecting to Supabase: {e}")
        sys.exit(1)
    
    # If no args provided or interactive mode requested, run interactive mode
    if args.interactive or (not args.season and not args.teams_file and not args.teams):
        # Import interactive functions
        script_dir = os.path.dirname(os.path.abspath(__file__))
        sys.path.insert(0, script_dir)
        try:
            import interactive_mode
            interactive_mode.run_interactive_mode(supabase)
            sys.exit(0)
        except ImportError as e:
            print(f"Error: Could not import interactive mode: {e}")
            print("Make sure interactive_mode.py is in the same directory as populate-playoff-teams.py")
            sys.exit(1)
    
    # Require season for non-interactive mode
    if not args.season:
        print("❌ Error: --season is required for non-interactive mode, or use --interactive for menu mode")
        parser.print_help()
        sys.exit(1)
    
    print("=" * 60)
    print("NFL Playoff Teams Populator")
    print("=" * 60)
    print("✅ Connected to Supabase")
    
    # Get teams based on source
    teams = []
    
    if args.teams_file:
        try:
            teams = load_teams_from_file(args.teams_file)
            print(f"✅ Loaded {len(teams)} teams from file: {args.teams_file}")
        except Exception as e:
            print(f"❌ Error loading teams from file: {e}")
            sys.exit(1)
    elif args.teams:
        try:
            import json
            teams = json.loads(args.teams)
            print(f"✅ Loaded {len(teams)} teams from command line argument")
        except json.JSONDecodeError as e:
            print(f"❌ Error parsing JSON teams: {e}")
            sys.exit(1)
    elif args.source == 'espn':
        teams = fetch_playoff_teams_from_espn(args.season)
        if teams:
            print(f"✅ Fetched {len(teams)} teams from ESPN")
        else:
            print("⚠️  No teams fetched from ESPN. You may need to use --teams or --teams-file")
            print("\nExample manual input:")
            print('  --teams \'[{"team_name": "Team Name", "team_abbreviation": "TEA", "conference": "AFC", "seed": 1}]\'')
            sys.exit(1)
    elif args.source == 'nfl':
        teams = fetch_playoff_teams_from_nfl(args.season)
        if teams:
            print(f"✅ Fetched {len(teams)} teams from NFL.com")
        else:
            print("⚠️  No teams fetched from NFL.com. You may need to use --teams or --teams-file")
            print("\nExample manual input:")
            print('  --teams \'[{"team_name": "Team Name", "team_abbreviation": "TEA", "conference": "AFC", "seed": 1}]\'')
            sys.exit(1)
    else:
        print("❌ No teams provided. Use --teams, --teams-file, or --source espn")
        sys.exit(1)
    
    # Insert teams (no pool_id needed - playoff teams are the same for all pools)
    success = insert_playoff_teams(supabase, args.season, teams, skip_approval=args.yes, save_preview=args.save_preview)
    
    if success:
        print("\n✅ Playoff teams population completed successfully!")
        sys.exit(0)
    else:
        print("\n❌ Failed to populate playoff teams")
        sys.exit(1)


if __name__ == '__main__':
    main()

