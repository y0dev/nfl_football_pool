#!/usr/bin/env python3
"""Interactive menu functions for populate-playoff-teams script."""

from typing import List, Dict, Optional
from supabase import Client


def display_main_menu() -> str:
    """Display main menu and get user choice."""
    print("\n" + "=" * 60)
    print("NFL Playoff Teams Manager")
    print("=" * 60)
    print("1. Add Teams")
    print("2. Update Teams")
    print("3. Exit")
    print("=" * 60)
    
    while True:
        choice = input("\nSelect an option (1-3): ").strip()
        if choice in ['1', '2', '3']:
            return choice
        print("Invalid choice. Please enter 1, 2, or 3.")


def get_season() -> int:
    """Get season year from user."""
    while True:
        try:
            season = input("\nEnter season year (e.g., 2024): ").strip()
            season_int = int(season)
            if 2000 <= season_int <= 2100:
                return season_int
            print("Please enter a valid year between 2000 and 2100.")
        except ValueError:
            print("Please enter a valid number.")


def display_conference_menu() -> str:
    """Display conference selection menu."""
    print("\n" + "=" * 60)
    print("Conference Selection")
    print("=" * 60)
    print("1. AFC")
    print("2. NFC")
    print("3. Back to Main Menu")
    print("=" * 60)
    
    while True:
        choice = input("\nSelect conference (1-3): ").strip()
        if choice == '1':
            return 'AFC'
        elif choice == '2':
            return 'NFC'
        elif choice == '3':
            return 'BACK'
        print("Invalid choice. Please enter 1, 2, or 3.")


def display_team_selection_menu(teams: List[str], current_selection: Optional[str] = None) -> Optional[str]:
    """Display team selection menu and return selected team."""
    print("\n" + "=" * 60)
    print("Select Team")
    print("=" * 60)
    
    # Display teams in a grid (4 columns)
    for i, team in enumerate(teams, 1):
        marker = " <- Current" if team == current_selection else ""
        print(f"{i:2}. {team:<30}", end="")
        if i % 2 == 0:
            print()
    
    if len(teams) % 2 != 0:
        print()
    
    print("=" * 60)
    print(f"{len(teams) + 1}. Clear Selection")
    print(f"{len(teams) + 2}. Back")
    print("=" * 60)
    
    while True:
        try:
            choice = input(f"\nSelect team (1-{len(teams) + 2}): ").strip()
            choice_int = int(choice)
            
            if 1 <= choice_int <= len(teams):
                return teams[choice_int - 1]
            elif choice_int == len(teams) + 1:
                return None  # Clear selection
            elif choice_int == len(teams) + 2:
                return 'BACK'
            else:
                print(f"Please enter a number between 1 and {len(teams) + 2}.")
        except ValueError:
            print("Please enter a valid number.")


def select_teams_for_conference(conference: str, existing_teams: Dict[str, Dict[str, any]], all_teams: List[str]) -> Dict[int, str]:
    """Interactive team selection for a conference (seeds 1-7)."""
    teams_by_seed = {}
    
    print(f"\n{'=' * 60}")
    print(f"Selecting Teams for {conference} Conference")
    print(f"{'=' * 60}")
    print("You will select teams for seeds 1 through 7.")
    print("=" * 60)
    
    for seed in range(1, 8):
        existing_key = f"{conference}_{seed}"
        current_team = existing_teams.get(existing_key, {}).get('team_name') if existing_key in existing_teams else None
        
        print(f"\n--- Seed {seed} ---")
        if current_team:
            print(f"Current: {current_team}")
        else:
            print("Current: (none)")
        
        while True:
            selected = display_team_selection_menu(all_teams, current_team)
            
            if selected == 'BACK':
                # Go back to conference menu
                return teams_by_seed
            elif selected is None:
                # Clear selection - allow empty seed
                teams_by_seed[seed] = None
                break
            else:
                # Check if team is already selected for another seed
                already_selected = False
                for s, team in teams_by_seed.items():
                    if team and team == selected:
                        print(f"\n⚠️  {selected} is already selected for seed {s}.")
                        confirm = input(f"Replace seed {s} with {selected}? (y/n): ").strip().lower()
                        if confirm == 'y':
                            teams_by_seed[s] = None
                            teams_by_seed[seed] = selected
                            already_selected = True
                            break
                        else:
                            already_selected = True
                            break
                
                if not already_selected:
                    teams_by_seed[seed] = selected
                    break
    
    return teams_by_seed


def interactive_add_teams(supabase: Client, season: int, all_teams: List[str]) -> List[Dict[str, any]]:
    """Interactive flow for adding teams."""
    teams = []
    
    print(f"\n{'=' * 60}")
    print(f"Adding Teams for Season {season}")
    print(f"{'=' * 60}")
    
    # Get teams for AFC
    print("\n--- AFC Conference ---")
    afc_teams_by_seed = select_teams_for_conference('AFC', {}, all_teams)
    
    if afc_teams_by_seed == {}:
        # User went back
        return []
    
    # Get teams for NFC
    print("\n--- NFC Conference ---")
    nfc_teams_by_seed = select_teams_for_conference('NFC', {}, all_teams)
    
    if nfc_teams_by_seed == {}:
        # User went back
        return []
    
    # Build teams list
    for seed, team_name in afc_teams_by_seed.items():
        if team_name:
            teams.append({
                'team_name': team_name,
                'team_abbreviation': get_team_abbreviation(team_name),
                'conference': 'AFC',
                'seed': seed
            })
    
    for seed, team_name in nfc_teams_by_seed.items():
        if team_name:
            teams.append({
                'team_name': team_name,
                'team_abbreviation': get_team_abbreviation(team_name),
                'conference': 'NFC',
                'seed': seed
            })
    
    return teams


def interactive_update_teams(supabase: Client, season: int, all_teams: List[str], get_existing_teams_func, get_team_abbreviation_func) -> List[Dict[str, any]]:
    """Interactive flow for updating teams."""
    teams = []
    
    print(f"\n{'=' * 60}")
    print(f"Updating Teams for Season {season}")
    print(f"{'=' * 60}")
    
    # Get existing teams
    existing_teams = get_existing_teams_func(supabase, season)
    
    if not existing_teams:
        print(f"\nNo existing teams found for season {season}.")
        print("Would you like to add teams instead? (y/n): ", end="")
        if input().strip().lower() != 'y':
            return []
    else:
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
        
        # Show existing teams in the selection format
        existing_teams_dict = {}
        for key, team_data in existing_teams.items():
            conf = team_data.get('conference', '').upper()
            seed = team_data.get('seed')
            existing_teams_dict[f"{conf}_{seed}"] = team_data
    
    # Select which conference to update
    while True:
        conference = display_conference_menu()
        if conference == 'BACK':
            return []
        
        # Get teams for selected conference
        conference_existing = {k: v for k, v in existing_teams.items() if v.get('conference', '').upper() == conference}
        teams_by_seed = select_teams_for_conference(conference, conference_existing, all_teams)
        
        if teams_by_seed == {}:
            continue  # User went back, show conference menu again
        
        # Build teams list for this conference
        for seed, team_name in teams_by_seed.items():
            if team_name:
                teams.append({
                    'team_name': team_name,
                    'team_abbreviation': get_team_abbreviation_func(team_name),
                    'conference': conference,
                    'seed': seed
                })
        
        # Ask if user wants to update the other conference
        other_conf = 'NFC' if conference == 'AFC' else 'AFC'
        update_other = input(f"\nUpdate {other_conf} conference as well? (y/n): ").strip().lower()
        
        if update_other == 'y':
            other_existing = {k: v for k, v in existing_teams.items() if v.get('conference', '').upper() == other_conf}
            other_teams_by_seed = select_teams_for_conference(other_conf, other_existing, all_teams)
            
            if other_teams_by_seed != {}:
                for seed, team_name in other_teams_by_seed.items():
                    if team_name:
                        teams.append({
                            'team_name': team_name,
                            'team_abbreviation': get_team_abbreviation_func(team_name),
                            'conference': other_conf,
                            'seed': seed
                        })
        
        # Get all existing teams to include unchanged ones
        all_existing = get_existing_teams_func(supabase, season)
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


def get_team_abbreviation(full_name: str) -> str:
    """Convert full team name to abbreviation."""
    team_abbreviations = {
        'Arizona Cardinals': 'ARI',
        'Atlanta Falcons': 'ATL',
        'Baltimore Ravens': 'BAL',
        'Buffalo Bills': 'BUF',
        'Carolina Panthers': 'CAR',
        'Chicago Bears': 'CHI',
        'Cincinnati Bengals': 'CIN',
        'Cleveland Browns': 'CLE',
        'Dallas Cowboys': 'DAL',
        'Denver Broncos': 'DEN',
        'Detroit Lions': 'DET',
        'Green Bay Packers': 'GB',
        'Houston Texans': 'HOU',
        'Indianapolis Colts': 'IND',
        'Jacksonville Jaguars': 'JAX',
        'Kansas City Chiefs': 'KC',
        'Las Vegas Raiders': 'LV',
        'Los Angeles Chargers': 'LAC',
        'Los Angeles Rams': 'LAR',
        'Miami Dolphins': 'MIA',
        'Minnesota Vikings': 'MIN',
        'New England Patriots': 'NE',
        'New Orleans Saints': 'NO',
        'New York Giants': 'NYG',
        'New York Jets': 'NYJ',
        'Philadelphia Eagles': 'PHI',
        'Pittsburgh Steelers': 'PIT',
        'San Francisco 49ers': 'SF',
        'Seattle Seahawks': 'SEA',
        'Tampa Bay Buccaneers': 'TB',
        'Tennessee Titans': 'TEN',
        'Washington Commanders': 'WSH'
    }
    return team_abbreviations.get(full_name, full_name.split()[-1][:3].upper())

