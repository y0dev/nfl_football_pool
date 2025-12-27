#!/usr/bin/env python3
"""Interactive menu functions for populate-playoff-teams script."""

import sys
import os
import importlib.util
import requests
from datetime import datetime

# Add current directory to path
current_dir = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, current_dir)

from typing import List, Dict, Optional
from supabase import Client

# Load the main module using importlib since filename has hyphens
main_module_path = os.path.join(current_dir, 'populate-playoff-teams.py')
spec = importlib.util.spec_from_file_location("populate_playoff_teams", main_module_path)
populate_playoff_teams = importlib.util.module_from_spec(spec)
spec.loader.exec_module(populate_playoff_teams)

# ESPN API dates for playoff games
PLAYOFF_API_DATES = {
    1: ['20260110', '20260111'],  # Wild Card (Week 1)
    2: ['20260117', '20260118'],  # Divisional Round (Week 2)
    3: ['20260125'],              # Conference Championship (Week 3)
    4: ['20260208']               # Super Bowl (Week 4)
}


def display_main_menu() -> str:
    """Display main menu and get user choice."""
    print("\n" + "=" * 60)
    print("NFL Playoff Teams Manager")
    print("=" * 60)
    print("1. Add Teams")
    print("2. Update Teams")
    print("3. Add/Update Playoff Games")
    print("x. Exit")
    print("=" * 60)
    
    while True:
        choice = input("\nSelect an option (1-3, x): ").strip().lower()
        if choice in ['1', '2', '3', 'x']:
            return '4' if choice == 'x' else choice
        print("Invalid choice. Please enter 1, 2, 3, or x.")


def get_season() -> int:
    """Get season year from user."""
    while True:
        try:
            season = input("\nEnter season year (e.g., 2025): ").strip()
            season_int = int(season)
            if 2020 <= season_int <= 2100:
                return season_int
            print("Please enter a valid year between 2020 and 2100.")
        except ValueError:
            print("Please enter a valid number.")


def display_conference_menu() -> str:
    """Display conference selection menu."""
    print("\n" + "=" * 60)
    print("Conference Selection")
    print("=" * 60)
    print("1. AFC")
    print("2. NFC")
    print("x. Back to Main Menu")
    print("=" * 60)
    
    while True:
        choice = input("\nSelect conference (1-2, x): ").strip().lower()
        if choice == '1':
            return 'AFC'
        elif choice == '2':
            return 'NFC'
        elif choice == 'x':
            return 'BACK'
        print("Invalid choice. Please enter 1, 2, or x.")


def display_team_selection_menu(teams: List[Dict], current_selection: Optional[str] = None, allow_skip: bool = False) -> Optional[str]:
    """Display team selection menu and return selected team name.
    
    Args:
        teams: List of team objects
        current_selection: Currently selected team name (if any)
        allow_skip: If True, show skip option (for add mode)
    """
    print("\n" + "=" * 60)
    print("Select Team")
    print("=" * 60)
    
    # Display teams in pairs (2 columns)
    for i in range(0, len(teams), 2):
        team1 = teams[i]
        team1_name = team1.get('name', team1) if isinstance(team1, dict) else team1
        marker1 = " <- Current" if team1_name == current_selection else ""
        print(f"{i+1:2}. {team1_name:<30}", end="")
        
        if i + 1 < len(teams):
            team2 = teams[i + 1]
            team2_name = team2.get('name', team2) if isinstance(team2, dict) else team2
            marker2 = " <- Current" if team2_name == current_selection else ""
            print(f"{i+2:2}. {team2_name:<30}{marker2}")
        else:
            print(marker1)
    
    print("=" * 60)
    if allow_skip:
        print("s. Skip this seed")
    print("c. Clear Selection")
    print("x. Back")
    print("=" * 60)
    
    while True:
        options_text = f"1-{len(teams)}"
        if allow_skip:
            options_text += ", s (skip), c (clear), x (back)"
        else:
            options_text += ", c (clear), x (back)"
        choice = input(f"\nSelect team ({options_text}): ").strip().lower()
        
        # Handle special keys
        if choice == 's' and allow_skip:
            return 'SKIP'
        elif choice == 'c':
            return None  # Clear selection
        elif choice == 'x':
            return 'BACK'
        
        # Handle numeric selection
        try:
            choice_int = int(choice)
            if 1 <= choice_int <= len(teams):
                selected_team = teams[choice_int - 1]
                # Return the team name (string) for compatibility
                return selected_team.get('name', selected_team) if isinstance(selected_team, dict) else selected_team
            else:
                print(f"Please enter a number between 1 and {len(teams)}.")
        except ValueError:
            print(f"Please enter a valid option.")


def select_teams_for_conference(conference: str, existing_teams: Dict[str, Dict[str, any]], allow_skip: bool = False, start_seed: int = 1) -> Dict[int, str]:
    """Interactive team selection for a conference (seeds 1-7).
    
    Args:
        conference: Conference name (AFC or NFC)
        existing_teams: Existing teams from database
        allow_skip: If True, allow skipping seeds (for add mode)
        start_seed: First seed to start selecting from (for resuming add mode)
    """
    NFL_TEAMS = populate_playoff_teams.NFL_TEAMS
    
    # Filter teams by conference
    conference_teams = [t for t in NFL_TEAMS if t.get('conference', '').upper() == conference.upper()]
    
    teams_by_seed = {}
    
    # Get already assigned teams from existing_teams (across all seeds for this conference)
    already_assigned = set()
    for key, team_data in existing_teams.items():
        conf = team_data.get('conference', '').upper()
        if conf == conference.upper():
            team_name = team_data.get('team_name', '')
            if team_name:
                already_assigned.add(team_name)
    
    print(f"\n{'=' * 60}")
    print(f"Selecting Teams for {conference} Conference")
    print(f"{'=' * 60}")
    if allow_skip:
        print("You can select teams for seeds 1-7, or skip seeds that haven't been determined yet.")
    else:
        print("You will select teams for seeds 1 through 7.")
    if already_assigned:
        print(f"\n⚠️  Teams already assigned (excluded from selection): {', '.join(sorted(already_assigned))}")
    print("=" * 60)
    
    for seed in range(start_seed, 8):
        existing_key = f"{conference}_{seed}"
        current_team = existing_teams.get(existing_key, {}).get('team_name') if existing_key in existing_teams else None
        
        print(f"\n--- Seed {seed} ---")
        if current_team:
            print(f"Current: {current_team}")
        else:
            print("Current: (none)")
        
        while True:
            # Get list of already selected teams in this session (excluding current seed)
            selected_teams = [team for s, team in teams_by_seed.items() if team and s != seed]
            
            # Filter available teams: only conference teams that haven't been selected yet
            # Exclude teams already assigned to other seeds in the database (unless it's the current team)
            available_teams = [
                t for t in conference_teams 
                if t.get('name') not in selected_teams 
                and (t.get('name') not in already_assigned or (current_team and t.get('name') == current_team))
            ]
            
            selected = display_team_selection_menu(available_teams, current_team, allow_skip=allow_skip)
            
            if selected == 'BACK':
                # Go back to conference menu
                return teams_by_seed
            elif selected == 'SKIP':
                # Skip this seed (only in add mode)
                if allow_skip:
                    # Don't add to teams_by_seed, just continue to next seed
                    break
                else:
                    print("Skip not allowed in update mode. Use 'c' to clear instead.")
                    continue
            elif selected is None:
                # Clear selection - allow empty seed
                teams_by_seed[seed] = None
                break
            else:
                # Team is already filtered to be available, so just assign it
                teams_by_seed[seed] = selected
                break
    
    return teams_by_seed


def interactive_add_teams(supabase: Client, season: int) -> List[Dict[str, any]]:
    """Interactive flow for adding teams."""
    get_team_abbreviation = populate_playoff_teams.get_team_abbreviation
    get_existing_teams = populate_playoff_teams.get_existing_teams
    
    teams = []
    
    print(f"\n{'=' * 60}")
    print(f"Adding Teams for Season {season}")
    print(f"{'=' * 60}")
    
    # Check for existing teams to determine starting seed and show current assignments
    existing_teams = get_existing_teams(supabase, season)
    
    # Display current team assignments
    if existing_teams:
        print("\nCurrent team assignments:")
        afc_existing = {}
        nfc_existing = {}
        for key, team_data in existing_teams.items():
            conf = team_data.get('conference', '').upper()
            seed = team_data.get('seed', 0)
            team_name = team_data.get('team_name', '')
            if conf == 'AFC':
                afc_existing[seed] = team_name
            elif conf == 'NFC':
                nfc_existing[seed] = team_name
        
        if afc_existing:
            print("\nAFC:")
            for seed in sorted(afc_existing.keys()):
                print(f"  Seed {seed}: {afc_existing[seed]}")
        
        if nfc_existing:
            print("\nNFC:")
            for seed in sorted(nfc_existing.keys()):
                print(f"  Seed {seed}: {nfc_existing[seed]}")
    else:
        print("\nNo existing teams found. Starting fresh.")
    
    # Determine starting seeds for each conference
    afc_start_seed = 1
    nfc_start_seed = 1
    
    # Find the highest seed that already exists for each conference
    for key, team_data in existing_teams.items():
        conf = team_data.get('conference', '').upper()
        seed = team_data.get('seed', 0)
        if conf == 'AFC' and seed >= afc_start_seed:
            afc_start_seed = seed + 1
        elif conf == 'NFC' and seed >= nfc_start_seed:
            nfc_start_seed = seed + 1
    
    # Limit to seeds 1-7
    afc_start_seed = min(afc_start_seed, 8)
    nfc_start_seed = min(nfc_start_seed, 8)
    
    # Get teams for AFC
    print("\n--- AFC Conference ---")
    if afc_start_seed > 7:
        print("All AFC seeds (1-7) are already assigned.")
        afc_teams_by_seed = {}
    else:
        if afc_start_seed > 1:
            print(f"Starting from seed {afc_start_seed} (seeds 1-{afc_start_seed-1} already assigned).")
        # Pass existing teams so they're excluded from selection
        afc_teams_by_seed = select_teams_for_conference('AFC', existing_teams, allow_skip=True, start_seed=afc_start_seed)
    
    if afc_teams_by_seed == {}:
        # User went back or all seeds assigned
        if afc_start_seed <= 7:
            return []  # User went back
    
    # Get teams for NFC
    print("\n--- NFC Conference ---")
    if nfc_start_seed > 7:
        print("All NFC seeds (1-7) are already assigned.")
        nfc_teams_by_seed = {}
    else:
        if nfc_start_seed > 1:
            print(f"Starting from seed {nfc_start_seed} (seeds 1-{nfc_start_seed-1} already assigned).")
        # Pass existing teams so they're excluded from selection
        nfc_teams_by_seed = select_teams_for_conference('NFC', existing_teams, allow_skip=True, start_seed=nfc_start_seed)
    
    if nfc_teams_by_seed == {}:
        # User went back or all seeds assigned
        if nfc_start_seed <= 7:
            return []  # User went back
    
    # Build teams list
    for seed, team_name in afc_teams_by_seed.items():
        if team_name:
            # Find team object to get abbreviation
            team_obj = next((t for t in populate_playoff_teams.NFL_TEAMS if t.get('name') == team_name), None)
            abbreviation = team_obj.get('abbreviation') if team_obj else get_team_abbreviation(team_name)
            teams.append({
                'team_name': team_name,
                'team_abbreviation': abbreviation,
                'conference': 'AFC',
                'seed': seed
            })
    
    for seed, team_name in nfc_teams_by_seed.items():
        if team_name:
            # Find team object to get abbreviation
            team_obj = next((t for t in populate_playoff_teams.NFL_TEAMS if t.get('name') == team_name), None)
            abbreviation = team_obj.get('abbreviation') if team_obj else get_team_abbreviation(team_name)
            teams.append({
                'team_name': team_name,
                'team_abbreviation': abbreviation,
                'conference': 'NFC',
                'seed': seed
            })
    
    return teams


def interactive_update_teams(supabase: Client, season: int) -> List[Dict[str, any]]:
    """Interactive flow for updating teams."""
    get_team_abbreviation = populate_playoff_teams.get_team_abbreviation
    get_existing_teams = populate_playoff_teams.get_existing_teams
    
    teams = []
    
    print(f"\n{'=' * 60}")
    print(f"Updating Teams for Season {season}")
    print(f"{'=' * 60}")
    
    # Get existing teams
    existing_teams = get_existing_teams(supabase, season)
    
    if not existing_teams:
        print(f"\nNo existing teams found for season {season}.")
        print("Would you like to add teams instead? (y/n): ", end="")
        if input().strip().lower() != 'y':
            return []
        # Fall through to add mode
    
    if existing_teams:
        print("\nCurrent teams:")
        afc_teams = {}
        nfc_teams = {}
        for key, team_data in existing_teams.items():
            conf = team_data.get('conference', '').upper()
            seed = team_data.get('seed')
            team_name = team_data.get('team_name', '')
            if conf == 'AFC':
                afc_teams[seed] = team_name
            elif conf == 'NFC':
                nfc_teams[seed] = team_name
        
        print("\nAFC:")
        for seed in sorted(afc_teams.keys()):
            print(f"  Seed {seed}: {afc_teams[seed]}")
        print("\nNFC:")
        for seed in sorted(nfc_teams.keys()):
            print(f"  Seed {seed}: {nfc_teams[seed]}")
    
    # Select which conference to update
    while True:
        conference = display_conference_menu()
        if conference == 'BACK':
            return []
        
        # Get teams for selected conference
        conference_existing = {k: v for k, v in existing_teams.items() if v.get('conference', '').upper() == conference}
        # In update mode, allow skip to add missing seeds, but also allow updating existing ones
        teams_by_seed = select_teams_for_conference(conference, conference_existing, allow_skip=True, start_seed=1)
        
        if teams_by_seed == {}:
            continue  # User went back, show conference menu again
        
        # Build teams list for this conference
        for seed, team_name in teams_by_seed.items():
            if team_name:
                # Find team object to get abbreviation
                team_obj = next((t for t in populate_playoff_teams.NFL_TEAMS if t.get('name') == team_name), None)
                abbreviation = team_obj.get('abbreviation') if team_obj else get_team_abbreviation(team_name)
                teams.append({
                    'team_name': team_name,
                    'team_abbreviation': abbreviation,
                    'conference': conference,
                    'seed': seed
                })
        
        # Ask if user wants to update the other conference
        other_conf = 'NFC' if conference == 'AFC' else 'AFC'
        update_other = input(f"\nUpdate {other_conf} conference as well? (y/n): ").strip().lower()
        
        if update_other == 'y':
            other_existing = {k: v for k, v in existing_teams.items() if v.get('conference', '').upper() == other_conf}
            # In update mode, allow skip to add missing seeds, but also allow updating existing ones
            other_teams_by_seed = select_teams_for_conference(other_conf, other_existing, allow_skip=True, start_seed=1)
            
            if other_teams_by_seed != {}:
                for seed, team_name in other_teams_by_seed.items():
                    if team_name:
                        # Find team object to get abbreviation
                        team_obj = next((t for t in populate_playoff_teams.NFL_TEAMS if t.get('name') == team_name), None)
                        abbreviation = team_obj.get('abbreviation') if team_obj else get_team_abbreviation(team_name)
                        teams.append({
                            'team_name': team_name,
                            'team_abbreviation': abbreviation,
                            'conference': other_conf,
                            'seed': seed
                        })
        
        # Get all existing teams to include unchanged ones
        all_existing = get_existing_teams(supabase, season)
        for key, team_data in all_existing.items():
            conf = team_data.get('conference', '').upper()
            seed = team_data.get('seed')
            # Check if we're updating this team
            updating = any(t.get('conference') == conf and t.get('seed') == seed for t in teams)
            if not updating:
                # Include unchanged team
                teams.append({
                    'team_name': team_data.get('team_name'),
                    'team_abbreviation': team_data.get('team_abbreviation'),
                    'conference': conf,
                    'seed': seed
                })
        
        break
    
    return teams


def get_week_for_games() -> int:
    """Get playoff week from user."""
    print("\n" + "=" * 60)
    print("Playoff Week Selection")
    print("=" * 60)
    print("1. Wild Card Round (Week 1)")
    print("2. Divisional Round (Week 2)")
    print("3. Conference Championships (Week 3)")
    print("4. Super Bowl (Week 4)")
    print("x. Back to Main Menu")
    print("=" * 60)
    
    while True:
        choice = input("\nSelect week (1-4, x): ").strip().lower()
        if choice == '1':
            return 1
        elif choice == '2':
            return 2
        elif choice == '3':
            return 3
        elif choice == '4':
            return 4
        elif choice == 'x':
            return None
        print("Invalid choice. Please enter 1-4, or x.")


def get_playoff_teams(supabase: Client, season: int) -> Dict[str, Dict[int, str]]:
    """Get playoff teams organized by conference and seed."""
    try:
        response = supabase.table('playoff_teams').select('*').eq('season', season).execute()
        teams_by_conf = {'AFC': {}, 'NFC': {}}
        if response.data:
            for team in response.data:
                conf = team.get('conference', '').upper()
                seed = team.get('seed')
                team_name = team.get('team_name', '')
                if conf in ['AFC', 'NFC'] and seed and team_name:
                    teams_by_conf[conf][seed] = team_name
        return teams_by_conf
    except Exception as e:
        print(f"Error fetching playoff teams: {e}")
        return {'AFC': {}, 'NFC': {}}


def get_espn_game_ids(week: int) -> List[Dict[str, str]]:
    """Fetch game IDs from ESPN API for a given playoff week.
    
    Returns a list of game info dicts with id, home_team, away_team, and kickoff_time.
    """
    if week not in PLAYOFF_API_DATES:
        return []
    
    games = []
    dates = PLAYOFF_API_DATES[week]
    
    for date_str in dates:
        try:
            url = f"https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard?dates={date_str}"
            response = requests.get(url, timeout=10)
            
            if response.status_code == 200:
                data = response.json()
                events = data.get('events', [])
                
                for event in events:
                    event_id = event.get('id')
                    competitions = event.get('competitions', [])
                    event_date = event.get('date', '')
                    
                    if event_id and competitions:
                        comp = competitions[0]
                        competitors = comp.get('competitors', [])
                        start_date = comp.get('date', event_date)
                        
                        if len(competitors) >= 2:
                            away_comp = competitors[1] if competitors[1].get('homeAway') == 'away' else competitors[0]
                            home_comp = competitors[0] if competitors[0].get('homeAway') == 'home' else competitors[1]
                            
                            away_team = away_comp.get('team', {}).get('displayName', '').strip()
                            home_team = home_comp.get('team', {}).get('displayName', '').strip()
                            
                            # Store game info even if TBD - we'll match it later
                            games.append({
                                'id': event_id,
                                'home_team': home_team if home_team != 'TBD' else None,
                                'away_team': away_team if away_team != 'TBD' else None,
                                'kickoff_time': start_date,
                                'date': date_str
                            })
                            
        except Exception as e:
            print(f"Warning: Could not fetch game IDs for date {date_str}: {e}")
            continue
    
    return games


def generate_wild_card_games(teams_by_conf: Dict[str, Dict[int, str]]) -> List[Dict[str, any]]:
    """Generate wild card round games (Week 1). #1 seeds don't play."""
    games = []
    
    for conference in ['AFC', 'NFC']:
        teams = teams_by_conf.get(conference, {})
        if not teams:
            continue
            
        # Wild card: #2 vs #7, #3 vs #6, #4 vs #5
        matchups = [(2, 7), (3, 6), (4, 5)]
        
        for high_seed, low_seed in matchups:
            home_team = teams.get(high_seed)  # Highest seed is home
            away_team = teams.get(low_seed)
            
            if home_team and away_team:
                games.append({
                    'week': 1,
                    'home_team': home_team,
                    'away_team': away_team,
                    'home_seed': high_seed,
                    'away_seed': low_seed,
                    'conference': conference
                })
    
    return games


def generate_divisional_games(teams_by_conf: Dict[str, Dict[int, str]], week_1_winners: Dict[str, List[str]]) -> List[Dict[str, any]]:
    """Generate divisional round games (Week 2). #1 plays lowest remaining seed, other two winners play each other."""
    games = []
    
    for conference in ['AFC', 'NFC']:
        teams = teams_by_conf.get(conference, {})
        winners = week_1_winners.get(conference, [])
        
        # Get seeds of winners from wild card
        winner_seeds = []
        for winner in winners:
            for seed, team_name in teams.items():
                if team_name == winner:
                    winner_seeds.append(seed)
                    break
        
        # #1 seed plays lowest remaining seed (worst team that won wild card)
        seed_1_team = teams.get(1)
        if seed_1_team and winner_seeds:
            lowest_seed = min(winner_seeds)  # Lowest seed number = worst team
            lowest_team = teams[lowest_seed]
            games.append({
                'week': 2,
                'home_team': seed_1_team,  # #1 is always home
                'away_team': lowest_team,
                'home_seed': 1,
                'away_seed': lowest_seed,
                'conference': conference
            })
            
            # Remove lowest from remaining
            remaining = [s for s in winner_seeds if s != lowest_seed]
        else:
            remaining = winner_seeds
        
        # Other two winners play each other, highest remaining seed (best team) is home
        if len(remaining) >= 2:
            remaining.sort()  # Sort ascending: [2, 5] means seed 2 and seed 5
            # Lower seed number = better team, so seed 2 is better than seed 5
            better_seed = remaining[0]  # Best remaining team (lowest seed number)
            worse_seed = remaining[1]    # Worst remaining team (highest seed number)
            
            games.append({
                'week': 2,
                'home_team': teams[better_seed],  # Better seed (lower number) is home
                'away_team': teams[worse_seed],
                'home_seed': better_seed,
                'away_seed': worse_seed,
                'conference': conference
            })
    
    return games


def generate_conference_championship_games(teams_by_conf: Dict[str, Dict[int, str]], week_2_winners: Dict[str, List[str]]) -> List[Dict[str, any]]:
    """Generate conference championship games (Week 3). Two winners play each other."""
    games = []
    
    for conference in ['AFC', 'NFC']:
        teams = teams_by_conf.get(conference, {})
        winners = week_2_winners.get(conference, [])
        
        if len(winners) == 2:
            # Get seeds for both winners
            seeds = []
            for winner in winners:
                for seed, team_name in teams.items():
                    if team_name == winner:
                        seeds.append(seed)
                        break
            
            if len(seeds) == 2:
                seeds.sort()  # Sort ascending: [1, 2] means seed 1 and seed 2
                better_seed = seeds[0]  # Lower number = better seed (seed 1 is best)
                worse_seed = seeds[1]   # Higher number = worse seed (seed 2 is worse than seed 1)
                
                games.append({
                    'week': 3,
                    'home_team': teams[better_seed],  # Better seed (lower number) is home
                    'away_team': teams[worse_seed],
                    'home_seed': better_seed,
                    'away_seed': worse_seed,
                    'conference': conference
                })
    
    return games


def generate_super_bowl_game(week_3_winners: Dict[str, str]) -> List[Dict[str, any]]:
    """Generate Super Bowl game (Week 4). AFC Champion vs NFC Champion."""
    games = []
    
    afc_champion = week_3_winners.get('AFC')
    nfc_champion = week_3_winners.get('NFC')
    
    if afc_champion and nfc_champion:
        # Super Bowl is neutral site, but we need to assign home/away
        # Convention: AFC team is "away", NFC team is "home"
        games.append({
            'week': 4,
            'home_team': nfc_champion,  # NFC is home in Super Bowl
            'away_team': afc_champion,   # AFC is away
            'home_seed': None,
            'away_seed': None,
            'conference': 'SUPER_BOWL'
        })
    
    return games


def get_week_winners(supabase: Client, season: int, week: int) -> Dict[str, List[str]]:
    """Get winners from a previous week's games."""
    try:
        response = supabase.table('games').select('winner, home_team, away_team').eq('season', season).eq('week', week).eq('season_type', 3).execute()
        winners_by_conf = {}
        
        if response.data:
            # Get playoff teams to determine conference
            playoff_teams = get_playoff_teams(supabase, season)
            
            for game in response.data:
                winner = game.get('winner')
                if not winner:
                    continue
                
                # Determine conference of winner
                for conf in ['AFC', 'NFC']:
                    teams = playoff_teams.get(conf, {})
                    if winner in teams.values():
                        if conf not in winners_by_conf:
                            winners_by_conf[conf] = []
                        winners_by_conf[conf].append(winner)
                        break
        
        return winners_by_conf
    except Exception as e:
        print(f"Error fetching week winners: {e}")
        return {}


def get_week_3_winners(supabase: Client, season: int) -> Dict[str, str]:
    """Get conference champions from week 3."""
    winners = get_week_winners(supabase, season, 3)
    result = {}
    for conf in ['AFC', 'NFC']:
        if conf in winners and len(winners[conf]) > 0:
            result[conf] = winners[conf][0]  # Only one champion per conference
    return result


def display_week_menu() -> str:
    """Display menu for selecting how to create games."""
    print("\n" + "=" * 60)
    print("Playoff Games Options")
    print("=" * 60)
    print("1. Auto-generate games (based on playoff teams)")
    print("2. Manual entry")
    print("x. Back")
    print("=" * 60)
    
    while True:
        choice = input("\nSelect option (1-2, x): ").strip().lower()
        if choice in ['1', '2', 'x']:
            return choice
        print("Invalid choice. Please enter 1, 2, or x.")


def interactive_add_update_games(supabase: Client, season: int):
    """Interactive flow for adding/updating playoff games."""
    from datetime import datetime, timedelta
    
    print(f"\n{'=' * 60}")
    print(f"Adding/Updating Playoff Games for Season {season}")
    print(f"{'=' * 60}")
    
    # Check if playoff teams exist
    playoff_teams = get_playoff_teams(supabase, season)
    if not playoff_teams['AFC'] and not playoff_teams['NFC']:
        print(f"\n⚠️  No playoff teams found for season {season}.")
        print("Please add playoff teams first using option 1 or 2.")
        return
    
    while True:
        week = get_week_for_games()
        if week is None:
            return
        
        week_names = {1: 'Wild Card Round', 2: 'Divisional Round', 3: 'Conference Championships', 4: 'Super Bowl'}
        print(f"\n--- {week_names[week]} (Week {week}) ---")
        
        # Check existing games for this week
        try:
            existing_response = supabase.table('games').select('*').eq('season', season).eq('week', week).eq('season_type', 3).execute()
            existing_games = existing_response.data if existing_response.data else []
            
            if existing_games:
                print(f"\nExisting games for {week_names[week]}:")
                for game in existing_games:
                    print(f"  {game.get('away_team')} @ {game.get('home_team')} (Status: {game.get('status', 'scheduled')})")
        except Exception as e:
            print(f"Error checking existing games: {e}")
            existing_games = []
        
        choice = display_week_menu()
        
        if choice == 'x':
            continue
        elif choice == '1':
            # Auto-generate
            games = []
            
            if week == 1:
                games = generate_wild_card_games(playoff_teams)
            elif week == 2:
                week_1_winners = get_week_winners(supabase, season, 1)
                if not week_1_winners or (not week_1_winners.get('AFC') and not week_1_winners.get('NFC')):
                    print("\n⚠️  No winners found for Wild Card Round (Week 1).")
                    print("   Please ensure Week 1 games are completed with winners set.")
                    continue
                games = generate_divisional_games(playoff_teams, week_1_winners)
            elif week == 3:
                week_2_winners = get_week_winners(supabase, season, 2)
                if not week_2_winners or (not week_2_winners.get('AFC') and not week_2_winners.get('NFC')):
                    print("\n⚠️  No winners found for Divisional Round (Week 2).")
                    print("   Please ensure Week 2 games are completed with winners set.")
                    continue
                games = generate_conference_championship_games(playoff_teams, week_2_winners)
            elif week == 4:
                week_3_winners = get_week_3_winners(supabase, season)
                if 'AFC' not in week_3_winners or 'NFC' not in week_3_winners:
                    print("\n⚠️  Conference champions not determined yet.")
                    print("   Please ensure Conference Championships (Week 3) are completed.")
                    continue
                games = generate_super_bowl_game(week_3_winners)
            
            if not games:
                print(f"\n⚠️  Could not generate games for {week_names[week]}.")
                print("   Make sure playoff teams are set correctly.")
                continue
            
            # Display generated games
            print(f"\nGenerated games for {week_names[week]}:")
            for game in games:
                print(f"  {game['away_team']} @ {game['home_team']}")
            
            confirm = input("\nCreate these games? (y/n): ").strip().lower()
            if confirm == 'y':
                insert_playoff_games(supabase, season, week, games, existing_games)
        elif choice == '2':
            # Manual entry
            manual_add_game(supabase, season, week, existing_games)


def manual_add_game(supabase: Client, season: int, week: int, existing_games: List[Dict]):
    """Manually add a playoff game."""
    from datetime import datetime, timedelta
    
    print("\n--- Manual Game Entry ---")
    
    # Get available teams based on week
    playoff_teams = get_playoff_teams(supabase, season)
    all_teams = []
    for conf_teams in playoff_teams.values():
        all_teams.extend(conf_teams.values())
    
    if not all_teams:
        print("⚠️  No playoff teams found. Please add playoff teams first.")
        return
    
    # Select home team (highest seed)
    print("\nSelect Home Team (highest seed):")
    home_team = select_team_from_list(all_teams)
    if not home_team:
        return
    
    # Select away team
    print("\nSelect Away Team:")
    away_team = select_team_from_list([t for t in all_teams if t != home_team])
    if not away_team:
        return
    
    # Try to get game ID from ESPN API
    espn_id = None
    kickoff_time = None
    
    print("\nFetching game ID from ESPN API...")
    espn_games = get_espn_game_ids(week)
    for espn_game in espn_games:
        if (espn_game.get('home_team') == home_team and 
            espn_game.get('away_team') == away_team):
            espn_id = espn_game['id']
            kickoff_time = espn_game['kickoff_time']
            print(f"✅ Found matching ESPN game ID: {espn_id}")
            break
    
    # Get kickoff time (default to next Saturday/Sunday or from ESPN)
    if not kickoff_time:
        print("\nEnter kickoff time (YYYY-MM-DD HH:MM, or press Enter for default):")
        kickoff_input = input().strip()
        if kickoff_input:
            try:
                kickoff_time = datetime.strptime(kickoff_input, '%Y-%m-%d %H:%M')
            except ValueError:
                print("Invalid format. Using default time.")
                kickoff_time = datetime.now().replace(hour=13, minute=0, second=0, microsecond=0)
                # Next Saturday
                days_until_saturday = (5 - kickoff_time.weekday()) % 7 or 7
                kickoff_time += timedelta(days=days_until_saturday)
        else:
            kickoff_time = datetime.now().replace(hour=13, minute=0, second=0, microsecond=0)
            days_until_saturday = (5 - kickoff_time.weekday()) % 7 or 7
            kickoff_time += timedelta(days=days_until_saturday)
    
    # Use ESPN ID if found, otherwise generate one
    if espn_id:
        game_id = espn_id
    else:
        game_id = f"{season}_3_{week}_{home_team.replace(' ', '_')}_{away_team.replace(' ', '_')}"
    
    # Convert kickoff_time to string if it's a datetime object
    if isinstance(kickoff_time, datetime):
        kickoff_time_str = kickoff_time.isoformat()
    else:
        kickoff_time_str = kickoff_time
    
    game_data = {
        'id': game_id,
        'week': week,
        'season': season,
        'season_type': 3,
        'home_team': home_team,
        'away_team': away_team,
        'kickoff_time': kickoff_time_str,
        'status': 'scheduled'
    }
    
    print(f"\nGame to create:")
    print(f"  {away_team} @ {home_team}")
    print(f"  Week {week}, Game ID: {game_id}")
    if isinstance(kickoff_time, datetime):
        print(f"  Kickoff: {kickoff_time.strftime('%Y-%m-%d %H:%M')}")
    else:
        print(f"  Kickoff: {kickoff_time}")
    
    confirm = input("\nCreate this game? (y/n): ").strip().lower()
    if confirm == 'y':
        try:
            # Check if game already exists
            existing_ids = [g.get('id') for g in existing_games]
            if game_id in existing_ids:
                # Update existing
                supabase.table('games').update({
                    'home_team': home_team,
                    'away_team': away_team,
                    'kickoff_time': kickoff_time_str
                }).eq('id', game_id).execute()
                print("✅ Game updated successfully!")
            else:
                # Insert new
                supabase.table('games').insert(game_data).execute()
                print("✅ Game created successfully!")
        except Exception as e:
            print(f"❌ Error creating game: {e}")


def select_team_from_list(teams: List[str]) -> Optional[str]:
    """Select a team from a list."""
    if not teams:
        print("No teams available.")
        return None
    
    print("\nTeams:")
    for i, team in enumerate(teams, 1):
        print(f"  {i}. {team}")
    
    while True:
        choice = input(f"\nSelect team (1-{len(teams)}, x to cancel): ").strip().lower()
        if choice == 'x':
            return None
        try:
            idx = int(choice) - 1
            if 0 <= idx < len(teams):
                return teams[idx]
            print(f"Please enter a number between 1 and {len(teams)}.")
        except ValueError:
            print("Please enter a valid number.")


def insert_playoff_games(supabase: Client, season: int, week: int, games: List[Dict[str, any]], existing_games: List[Dict]):
    """Insert or update playoff games."""
    from datetime import datetime, timedelta
    
    try:
        # Fetch ESPN game IDs for this week
        print(f"\nFetching game IDs from ESPN API for Week {week}...")
        espn_games = get_espn_game_ids(week)
        espn_game_map = {}  # Map by team names
        
        # Build a map of ESPN games by team names (for matching)
        for espn_game in espn_games:
            if espn_game.get('home_team') and espn_game.get('away_team'):
                key = f"{espn_game['away_team']}_{espn_game['home_team']}"
                espn_game_map[key] = espn_game
            elif not espn_game.get('home_team') or not espn_game.get('away_team'):
                # TBD game - store by index
                if 'tbd_games' not in espn_game_map:
                    espn_game_map['tbd_games'] = []
                espn_game_map['tbd_games'].append(espn_game)
        
        # Also create a list of TBD games for matching by position
        tbd_games = espn_game_map.get('tbd_games', [])
        tbd_index = 0
        
        existing_ids = {g.get('id') for g in existing_games}
        games_to_insert = []
        games_to_update = []
        
        for game in games:
            # Try to find matching ESPN game ID
            espn_id = None
            kickoff_time = None
            
            # Try exact match first
            key = f"{game['away_team']}_{game['home_team']}"
            if key in espn_game_map:
                espn_id = espn_game_map[key]['id']
                kickoff_time = espn_game_map[key]['kickoff_time']
            elif tbd_games and tbd_index < len(tbd_games):
                # Use next TBD game if available
                espn_id = tbd_games[tbd_index]['id']
                kickoff_time = tbd_games[tbd_index]['kickoff_time']
                tbd_index += 1
            
            # Use ESPN ID if found, otherwise generate one
            if espn_id:
                game_id = espn_id
            else:
                game_id = f"{season}_3_{week}_{game['home_team'].replace(' ', '_')}_{game['away_team'].replace(' ', '_')}"
            
            # Generate default kickoff time if not from ESPN
            if not kickoff_time:
                default_kickoff = datetime.now().replace(hour=13, minute=0, second=0, microsecond=0)
                days_until_saturday = (5 - default_kickoff.weekday()) % 7 or 7
                default_kickoff += timedelta(days=days_until_saturday)
                kickoff_time = default_kickoff.isoformat()
            
            game_data = {
                'id': game_id,
                'week': week,
                'season': season,
                'season_type': 3,
                'home_team': game['home_team'],
                'away_team': game['away_team'],
                'kickoff_time': kickoff_time,
                'status': 'scheduled'
            }
            
            if game_id in existing_ids:
                games_to_update.append((game_id, game_data))
            else:
                games_to_insert.append(game_data)
        
        # Update existing games
        for game_id, game_data in games_to_update:
            supabase.table('games').update({
                'home_team': game_data['home_team'],
                'away_team': game_data['away_team'],
                'kickoff_time': game_data['kickoff_time']
            }).eq('id', game_id).execute()
        
        # Insert new games
        if games_to_insert:
            supabase.table('games').insert(games_to_insert).execute()
        
        print(f"\n✅ Successfully created/updated {len(games)} game(s)!")
        print(f"   ({len(games_to_insert)} new, {len(games_to_update)} updated)")
        if espn_games:
            print(f"   Used ESPN game IDs from API")
        
    except Exception as e:
        print(f"❌ Error creating games: {e}")
        import traceback
        traceback.print_exc()


def run_interactive_mode(supabase: Client):
    """Run the interactive menu mode."""
    insert_playoff_teams = populate_playoff_teams.insert_playoff_teams
    
    while True:
        choice = display_main_menu()
        
        if choice == '4':
            print("\nExiting...")
            break
        elif choice in ['1', '2']:
            season = get_season()
            
            if choice == '1':
                # Add teams
                teams = interactive_add_teams(supabase, season)
                if teams:
                    success = insert_playoff_teams(supabase, season, teams, skip_approval=False, save_preview=False, update_mode=False)
                    if success:
                        print("\n✅ Teams added successfully!")
                    else:
                        print("\n❌ Failed to add teams.")
            elif choice == '2':
                # Update teams
                teams = interactive_update_teams(supabase, season)
                if teams:
                    success = insert_playoff_teams(supabase, season, teams, skip_approval=False, save_preview=False, update_mode=True)
                    if success:
                        print("\n✅ Teams updated successfully!")
                    else:
                        print("\n❌ Failed to update teams.")
        elif choice == '3':
            # Add/Update playoff games
            season = get_season()
            interactive_add_update_games(supabase, season)

