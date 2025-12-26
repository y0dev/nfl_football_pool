#!/usr/bin/env python3
"""Interactive menu functions for populate-playoff-teams script."""

import sys
import os
import importlib.util

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


def display_main_menu() -> str:
    """Display main menu and get user choice."""
    print("\n" + "=" * 60)
    print("NFL Playoff Teams Manager")
    print("=" * 60)
    print("1. Add Teams")
    print("2. Update Teams")
    print("x. Exit")
    print("=" * 60)
    
    while True:
        choice = input("\nSelect an option (1-2, x): ").strip().lower()
        if choice in ['1', '2', 'x']:
            return '3' if choice == 'x' else choice
        print("Invalid choice. Please enter 1, 2, or x.")


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
    
    print(f"\n{'=' * 60}")
    print(f"Selecting Teams for {conference} Conference")
    print(f"{'=' * 60}")
    if allow_skip:
        print("You can select teams for seeds 1-7, or skip seeds that haven't been determined yet.")
    else:
        print("You will select teams for seeds 1 through 7.")
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
            # Get list of already selected teams (excluding current seed)
            selected_teams = [team for s, team in teams_by_seed.items() if team and s != seed]
            
            # Filter available teams: only conference teams that haven't been selected yet
            # But always include the current team if it exists (for display purposes)
            available_teams = [t for t in conference_teams if t.get('name') not in selected_teams or (current_team and t.get('name') == current_team)]
            
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
    
    # Check for existing teams to determine starting seed
    existing_teams = get_existing_teams(supabase, season)
    
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
        afc_teams_by_seed = select_teams_for_conference('AFC', {}, allow_skip=True, start_seed=afc_start_seed)
    
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
        nfc_teams_by_seed = select_teams_for_conference('NFC', {}, allow_skip=True, start_seed=nfc_start_seed)
    
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


def run_interactive_mode(supabase: Client):
    """Run the interactive menu mode."""
    insert_playoff_teams = populate_playoff_teams.insert_playoff_teams
    
    while True:
        choice = display_main_menu()
        
        if choice == '3':
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

