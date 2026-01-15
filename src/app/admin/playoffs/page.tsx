'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/lib/auth';
import { AuthProvider } from '@/lib/auth';
import { AdminGuard } from '@/components/auth/admin-guard';
import { 
  Trophy, 
  Plus, 
  Edit, 
  Trash2, 
  Save, 
  X, 
  Calendar,
  ArrowLeft,
  RefreshCw,
  AlertCircle,
  CheckCircle,
  AlertTriangle,
  Shield
} from 'lucide-react';
import { debugLog, NFL_TEAMS, getNFLSeasonYear } from '@/lib/utils';

interface PlayoffTeam {
  id?: string;
  season: number;
  team_name: string;
  team_abbreviation: string | null;
  conference: string;
  seed: number;
}

interface PlayoffGame {
  id?: string;
  season: number;
  week: number; // 1-4 (Wild Card, Divisional, Conference Championship, Super Bowl)
  away_team: string;
  home_team: string;
  kickoff_time?: string;
  status?: string;
  winner?: string | null;
}

const ROUND_NAMES: Record<number, string> = {
  1: 'Wild Card',
  2: 'Divisional Round',
  3: 'Conference Championship',
  4: 'Super Bowl'
};

const ROUND_GAME_COUNTS: Record<number, number> = {
  1: 6, // Wild Card
  2: 4, // Divisional Round
  3: 2, // Conference Championship
  4: 1  // Super Bowl
};

function PlayoffManagementContent() {
  const router = useRouter();
  const { toast } = useToast();
  const { user, verifyAdminStatus } = useAuth();

  const [season, setSeason] = useState<number>(getNFLSeasonYear());
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'teams' | 'games'>('teams');
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [checkingAccess, setCheckingAccess] = useState(true);

  // Teams state
  const [teams, setTeams] = useState<PlayoffTeam[]>([]);
  const [editingTeam, setEditingTeam] = useState<PlayoffTeam | null>(null);
  const [teamDialogOpen, setTeamDialogOpen] = useState(false);
  const [selectedConference, setSelectedConference] = useState<'AFC' | 'NFC'>('AFC');

  // Games state
  const [games, setGames] = useState<PlayoffGame[]>([]);
  const [editingGame, setEditingGame] = useState<PlayoffGame | null>(null);
  const [originalGameId, setOriginalGameId] = useState<string | undefined>(undefined);
  const [gameDialogOpen, setGameDialogOpen] = useState(false);
  const [selectedRound, setSelectedRound] = useState<number>(1);
  const [teamSeeds, setTeamSeeds] = useState<Record<string, number>>({});
  const [fetchingGameIds, setFetchingGameIds] = useState(false);
  
  // Result dialog state
  const [resultDialogOpen, setResultDialogOpen] = useState(false);
  const [resultDialogType, setResultDialogType] = useState<'success' | 'error'>('success');
  const [resultDialogTitle, setResultDialogTitle] = useState('');
  const [resultDialogDescription, setResultDialogDescription] = useState('');
  
  // Confirmation dialog state for game fetching
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [pendingGames, setPendingGames] = useState<PlayoffGame[]>([]);
  const [pendingRound, setPendingRound] = useState<number | null>(null);
  const [fetchingRoundGames, setFetchingRoundGames] = useState<number | null>(null);

  // Check if user is a super admin (not a commissioner)
  useEffect(() => {
    const checkAccess = async () => {
      if (!user) {
        setCheckingAccess(false);
        return;
      }

      try {
        // Only super admins can access this page (not commissioners)
        const superAdminStatus = await verifyAdminStatus(true);
        setIsSuperAdmin(superAdminStatus);
        
        if (!superAdminStatus) {
          // User is not a super admin (might be a commissioner), redirect to dashboard
          toast({
            title: 'Access Denied',
            description: 'This page is only accessible to system administrators.',
            variant: 'destructive',
          });
          router.push('/admin/dashboard');
        }
      } catch (error) {
        console.error('Error checking admin status:', error);
        router.push('/admin/dashboard');
      } finally {
        setCheckingAccess(false);
      }
    };

    if (user) {
      checkAccess();
    } else {
      setCheckingAccess(false);
    }
  }, [user, verifyAdminStatus, router, toast]);

  useEffect(() => {
    if (season && isSuperAdmin && !checkingAccess) {
      loadTeams();
      loadGames();
    }
  }, [season, isSuperAdmin, checkingAccess]);

  useEffect(() => {
    if (teams.length > 0) {
      const seeds: Record<string, number> = {};
      teams.forEach(team => {
        seeds[team.team_name] = team.seed;
      });
      setTeamSeeds(seeds);
    }
  }, [teams]);

  const loadTeams = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/admin/playoff-teams?season=${season}`);
      const data = await response.json();

      if (data.success) {
        setTeams(data.teams || []);
      } else {
        toast({
          title: 'Error',
          description: data.error || 'Failed to load playoff teams',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Error loading teams:', error);
      toast({
        title: 'Error',
        description: 'Failed to load playoff teams',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const loadGames = async () => {
    try {
      const response = await fetch(`/api/admin/playoff-games?season=${season}`);
      const data = await response.json();

      if (data.success) {
        setGames(data.games || []);
        debugLog('PLAYOFFS: Games loaded:', data.games);
      } else {
        toast({
          title: 'Error',
          description: data.error || 'Failed to load playoff games',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Error loading games:', error);
    }
  };

    const fetchGameIdsForGamesWithoutIds = async (gamesWithoutIds: PlayoffGame[]) => {
      debugLog('Fetching game IDs for games without IDs');
      debugLog('Games without IDs:', gamesWithoutIds);
      setFetchingGameIds(true);
    
    try {
      // Group games by week
      const gamesByWeek = new Map<number, PlayoffGame[]>();
      gamesWithoutIds.forEach(game => {
        if (!gamesByWeek.has(game.week)) {
          gamesByWeek.set(game.week, []);
        }
        gamesByWeek.get(game.week)!.push(game);
      });

      // Fetch ESPN IDs for each week
      let totalUpdated = 0;
      for (const [week, weekGames] of gamesByWeek.entries()) {
        try {
          const response = await fetch('/api/admin/playoff-games/fetch-espn-ids', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ season, week })
          });

          const data = await response.json();

          if (data.success && data.games) {
            // Match ESPN games to our games by team names
            const updatedGames: PlayoffGame[] = [];
            
            for (const ourGame of weekGames) {
              const espnGame = data.games.find((eg: any) => 
                (eg.away_team === ourGame.away_team && eg.home_team === ourGame.home_team) ||
                (eg.away_team === ourGame.home_team && eg.home_team === ourGame.away_team) // Handle reversed
              );

              if (espnGame) {
                // Update game with ESPN ID
                // If game already has an ID in our database, use it; otherwise use ESPN ID
                const gameToUpdate: PlayoffGame = {
                  season: ourGame.season,
                  week: ourGame.week,
                  away_team: ourGame.away_team,
                  home_team: ourGame.home_team,
                  id: ourGame.id || espnGame.id, // Use existing DB ID if present, otherwise ESPN ID
                  kickoff_time: espnGame.kickoff_time || ourGame.kickoff_time,
                  status: ourGame.status || 'scheduled',
                  winner: ourGame.winner || null
                };
                
                // If game doesn't have an ID, we'll need to match by season/week/teams
                // The API will handle finding the matching game if no ID is provided
                const updateResponse = await fetch('/api/admin/playoff-games', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    season,
                    games: [gameToUpdate]
                  })
                });

                if (updateResponse.ok) {
                  const responseData = await updateResponse.json();
                  if (responseData.success) {
                    updatedGames.push({ ...ourGame, id: espnGame.id });
                    totalUpdated++;
                    debugLog(`Updated game ${ourGame.away_team} @ ${ourGame.home_team} with ESPN ID: ${espnGame.id}`);
                  }
                } else {
                  const errorData = await updateResponse.json();
                  console.error(`Failed to update game:`, errorData);
                }
              }
            }

            if (updatedGames.length > 0) {
              debugLog(`Fetched ${updatedGames.length} game ID(s) from ESPN for Week ${week}`);
            }
          }
        } catch (error) {
          console.error(`Error fetching ESPN IDs for week ${week}:`, error);
        }
      }

      if (totalUpdated > 0) {
        toast({
          title: 'Success',
          description: `Fetched and updated ${totalUpdated} game ID(s) from ESPN`,
        });
        // Reload games to show updated IDs
        await loadGames();
      } else {
        toast({
          title: 'Info',
          description: 'No game IDs were found or updated. All games may already have IDs, or no matching games were found on ESPN.',
        });
      }
    } catch (error) {
      console.error('Error fetching game IDs:', error);
      toast({
        title: 'Warning',
        description: 'Failed to fetch some game IDs from ESPN',
        variant: 'destructive',
      });
    } finally {
      setFetchingGameIds(false);
    }
  };

  const fetchGamesForRound = async (round: number) => {
    try {
      setFetchingRoundGames(round);
      debugLog(`Fetching complete game data for round ${round} (${ROUND_NAMES[round]}) from ESPN`);
      
      // Calculate playoff year: 2025 season games are in Jan/Feb 2026
      const playoffYear = season + 1;
      
      // Use the server-side API route to fetch ESPN game data (avoids CORS issues)
      const response = await fetch('/api/admin/playoff-games/fetch-espn-ids', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ season: playoffYear, week: round })
      });

      const data = await response.json();
      debugLog('PLAYOFFS: Response:', response);
      debugLog('PLAYOFFS: Data:', data);
      
      if (!data.success || !data.games) {
        toast({
          title: 'Error',
          description: 'Failed to fetch game data from ESPN',
          variant: 'destructive',
        });
        return;
      }

      // Extract complete game data: id, kickoff_time, away_team, home_team
      const espnGames: Array<{ id: string; kickoff_time: string; away_team?: string; home_team?: string }> = [];
      if (data.games.length > 0) {
        for (const game of data.games) {
          if (game.id && game.kickoff_time) {
            espnGames.push({
              id: game.id,
              kickoff_time: game.kickoff_time,
              ...(game.away_team && game.home_team ? { away_team: game.away_team, home_team: game.home_team } : {})
            });
          }
        }
      }
      debugLog('PLAYOFFS: ESPN Games with full data:', espnGames);
      debugLog(`Fetched ${espnGames.length} games with complete data from ESPN for round ${round}`);

      // Get existing games for this round
      const roundGames = getGamesByRound(round);
      
      // Create a set of existing game IDs and team matchups for quick lookup
      const existingGameIds = new Set(roundGames.filter(g => g.id).map(g => g.id));
      const existingMatchups = new Set(
        roundGames.map(g => {
          // Create a normalized matchup key (team1 vs team2, sorted alphabetically to handle home/away order)
          const teams = [g.away_team, g.home_team].sort().join('|');
          return teams;
        })
      );

      // Find existing games with TBD teams that can be updated
      const gamesWithTbdTeams = roundGames.filter(g => 
        g.away_team === 'TBD' || g.home_team === 'TBD'
      );
      debugLog(`Found ${gamesWithTbdTeams.length} existing game(s) with TBD teams for round ${round}`);

      // Find ESPN games that don't already exist OR can update existing games with mismatched teams
      const gamesToCreate: PlayoffGame[] = [];
      const matchedTbdGames = new Set<string>(); // Track which TBD games we've matched
      const updatedGames = new Set<string>(); // Track which games we've updated due to team mismatch
      
      for (const espnGame of espnGames) {
        // Check if game already exists by ID
        if (espnGame.id && existingGameIds.has(espnGame.id)) {
          const existingGame = roundGames.find(g => g.id === espnGame.id);
          
          if (existingGame) {
            const hasTbd = existingGame.away_team === 'TBD' || existingGame.home_team === 'TBD';
            
            // If ESPN has teams, check if they match the existing game
            if (espnGame.away_team && espnGame.home_team) {
              // Check if teams match (considering home/away swap)
              const teamsMatch = 
                (existingGame.away_team === espnGame.away_team && existingGame.home_team === espnGame.home_team) ||
                (existingGame.away_team === espnGame.home_team && existingGame.home_team === espnGame.away_team);
              
              // If teams don't match OR there's a TBD, update with ESPN data (ESPN is source of truth)
              if (!teamsMatch || hasTbd) {
                if (!teamsMatch && !hasTbd) {
                  debugLog(`Updating game ${espnGame.id}: DB has ${existingGame.away_team} @ ${existingGame.home_team}, ESPN has ${espnGame.away_team} @ ${espnGame.home_team}`);
                } else if (hasTbd) {
                  debugLog(`Updating existing TBD game ${espnGame.id} with teams: ${espnGame.away_team} @ ${espnGame.home_team}`);
                }
                
                gamesToCreate.push({
                  season,
                  week: round,
                  away_team: espnGame.away_team,
                  home_team: espnGame.home_team,
                  id: espnGame.id, // Keep the ESPN ID
                  kickoff_time: espnGame.kickoff_time || existingGame.kickoff_time,
                  status: existingGame.status || 'scheduled'
                });
                updatedGames.add(espnGame.id);
                continue;
              }
              
              // Teams match and no TBD, skip
              debugLog(`Game with ID ${espnGame.id} already exists with matching teams, skipping`);
              continue;
            } else if (hasTbd) {
              // ESPN doesn't have teams but DB has TBD - update kickoff time if available
              if (espnGame.kickoff_time && espnGame.kickoff_time !== existingGame.kickoff_time) {
                gamesToCreate.push({
                  season,
                  week: round,
                  away_team: existingGame.away_team || 'TBD',
                  home_team: existingGame.home_team || 'TBD',
                  id: espnGame.id,
                  kickoff_time: espnGame.kickoff_time,
                  status: existingGame.status || 'scheduled'
                });
                updatedGames.add(espnGame.id);
                continue;
              }
            }
          }
        }

        // Check if game already exists by team matchup (if teams are available and we haven't already processed it)
        if (espnGame.away_team && espnGame.home_team && !updatedGames.has(espnGame.id || '')) {
          const matchupKey = [espnGame.away_team, espnGame.home_team].sort().join('|');
          if (existingMatchups.has(matchupKey)) {
            // Find all games with this matchup
            const existingGamesWithMatchup = roundGames.filter(g => {
              const gameMatchup = [g.away_team, g.home_team].sort().join('|');
              return gameMatchup === matchupKey;
            });
            
            // Check if any of these games already has this ESPN ID
            const gameWithMatchingId = existingGamesWithMatchup.find(g => g.id === espnGame.id);
            if (gameWithMatchingId) {
              debugLog(`Game ${espnGame.away_team} @ ${espnGame.home_team} already exists with matching ID ${espnGame.id}, skipping`);
              continue;
            }
            
            // If we have multiple games with same teams but different IDs, skip to avoid duplicates
            // (The ID-based update above should have handled any mismatches)
            debugLog(`Game ${espnGame.away_team} @ ${espnGame.home_team} already exists with different ID(s), skipping`);
            continue;
          }
        }

        // Check if we can update an existing TBD game (that hasn't been matched yet)
        if (espnGame.away_team && espnGame.home_team && gamesWithTbdTeams.length > 0) {
          // Find a TBD game that hasn't been matched yet and doesn't have an ESPN ID
          const tbdGameToUpdate = gamesWithTbdTeams.find(g => 
            !matchedTbdGames.has(g.id || '') &&
            !updatedGames.has(g.id || '') &&
            (g.away_team === 'TBD' || g.home_team === 'TBD') &&
            (!g.id || !espnGame.id || g.id !== espnGame.id) // Don't match if IDs conflict
          );

          if (tbdGameToUpdate) {
            // Update the existing TBD game with ESPN data
            debugLog(`Updating existing TBD game ${tbdGameToUpdate.id} with teams: ${espnGame.away_team} @ ${espnGame.home_team}`);
            gamesToCreate.push({
              season,
              week: round,
              away_team: espnGame.away_team,
              home_team: espnGame.home_team,
              id: tbdGameToUpdate.id || espnGame.id, // Keep existing ID if available, otherwise use ESPN ID
              kickoff_time: espnGame.kickoff_time || tbdGameToUpdate.kickoff_time,
              status: tbdGameToUpdate.status || 'scheduled'
            });
            matchedTbdGames.add(tbdGameToUpdate.id || '');
            continue;
          }
        }

        // This game doesn't exist yet and doesn't match any existing game, add it to create list with complete data
        gamesToCreate.push({
          season,
          week: round,
          away_team: espnGame.away_team || 'TBD',
          home_team: espnGame.home_team || 'TBD',
          id: espnGame.id,
          kickoff_time: espnGame.kickoff_time,
          status: 'scheduled'
        });
      }
      
      // If we still need more games (e.g., ESPN doesn't have all games yet), create TBD placeholders
      const expectedGameCount = ROUND_GAME_COUNTS[round];
      const totalAfterCreate = roundGames.length + gamesToCreate.length;
      const stillNeeded = expectedGameCount - totalAfterCreate;
      
      if (stillNeeded > 0) {
        debugLog(`Creating ${stillNeeded} additional TBD placeholder game(s) to reach expected count of ${expectedGameCount}`);
        // Generate a unique ID for TBD games
        const timestamp = Date.now();
        const playoffYear = season + 1;
        const defaultDates: Record<number, string> = {
          1: `${playoffYear}-01-11T18:00:00Z`,
          2: `${playoffYear}-01-18T18:00:00Z`,
          3: `${playoffYear}-01-25T18:00:00Z`,
          4: `${playoffYear}-02-08T18:00:00Z`
        };
        
        for (let i = 0; i < stillNeeded; i++) {
          const generatedId = `${season}_3_${round}_TBD_${timestamp}_${i}`;
          
          gamesToCreate.push({
            season,
            week: round,
            away_team: 'TBD',
            home_team: 'TBD',
            id: generatedId,
            kickoff_time: defaultDates[round] || new Date().toISOString(),
            status: 'scheduled'
          });
        }
      }

      // Show confirmation dialog instead of saving immediately
      if (gamesToCreate.length > 0) {
        setPendingGames(gamesToCreate);
        setPendingRound(round);
        setConfirmDialogOpen(true);
      } else {
        toast({
          title: 'Info',
          description: `No new games to create for ${ROUND_NAMES[round]}. All games already exist.`,
        });
      }
    } catch (error) {
      console.error(`Error fetching games for round ${round}:`, error);
      toast({
        title: 'Error',
        description: `Failed to fetch games for ${ROUND_NAMES[round]}: ${error instanceof Error ? error.message : 'Unknown error'}`,
        variant: 'destructive',
      });
    } finally {
      setFetchingRoundGames(null);
    }
  };

  // Save pending games to database after confirmation
  const confirmSaveGames = async () => {
    if (!pendingRound || pendingGames.length === 0) return;

    try {
      debugLog('PLAYOFFS: Saving confirmed games:', pendingGames);
      const saveResponse = await fetch('/api/admin/playoff-games', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          season,
          games: pendingGames
        })
      });

      const saveData = await saveResponse.json();
      if (saveData.success) {
        debugLog(`Created ${pendingGames.length} new games for round ${pendingRound}`);
        toast({
          title: 'Success',
          description: `Successfully created ${pendingGames.length} game(s) for ${ROUND_NAMES[pendingRound]}.`,
        });
        setConfirmDialogOpen(false);
        setPendingGames([]);
        setPendingRound(null);
        // Reload games to refresh the state
        await loadGames();
      } else {
        console.error('Error saving games:', saveData.error);
        toast({
          title: 'Error',
          description: `Failed to save games: ${saveData.error || 'Unknown error'}`,
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Error saving games:', error);
      toast({
        title: 'Error',
        description: `Failed to save games: ${error instanceof Error ? error.message : 'Unknown error'}`,
        variant: 'destructive',
      });
    }
  };

  const handleFetchAllGameIds = async () => {
    // Check all expected playoff games - ensure all games in all rounds have IDs
    const gamesNeedingIds: PlayoffGame[] = [];
    
    debugLog(`Fetching all game IDs for season ${season}`);

    // Check each round (1-4) for expected number of games
    for (const round of [1, 2, 3, 4]) {
      const expectedGameCount = ROUND_GAME_COUNTS[round];
      const roundGames = getGamesByRound(round);
      // Check if we have the expected number of games
      if (roundGames.length < expectedGameCount) {
        // Missing some games entirely - fetch from ESPN and create them
        debugLog(`Round ${round} (${ROUND_NAMES[round]}) has ${roundGames.length} games but expects ${expectedGameCount}`);
        // Fetch all games for this round from ESPN
        await fetchGamesForRound(round);
        // Reload games after fetching
        await loadGames();
      }
      
      // Check existing games in this round for missing IDs
      const roundGamesAfterFetch = getGamesByRound(round);
      const roundGamesWithoutIds = roundGamesAfterFetch.filter(g => !g.id);
      if (roundGamesWithoutIds.length > 0) {
        gamesNeedingIds.push(...roundGamesWithoutIds);
        debugLog(`Round ${round} (${ROUND_NAMES[round]}) has ${roundGamesWithoutIds.length} games without IDs`);
      }
    }
    
    if (gamesNeedingIds.length === 0) {
      toast({
        title: 'Info',
        description: 'All expected playoff games already have IDs assigned.',
      });
      return;
    }

    debugLog(`Total games needing IDs: ${gamesNeedingIds.length}`);
    await fetchGameIdsForGamesWithoutIds(gamesNeedingIds);
  };

  const handleSaveTeam = async () => {
    if (!editingTeam) return;

    // Validate max 7 seeds per conference
    if (!editingTeam.id) {
      // Check if adding a new team would exceed the limit
      const conferenceTeams = teams.filter(t => t.conference === editingTeam.conference);
      if (conferenceTeams.length >= 7) {
        toast({
          title: 'Error',
          description: `Maximum of 7 teams allowed per conference. ${editingTeam.conference} already has 7 teams.`,
          variant: 'destructive',
        });
        return;
      }
      
      // Check if the seed is already taken in this conference
      const existingTeamWithSeed = teams.find(
        t => t.conference === editingTeam.conference && 
             t.seed === editingTeam.seed &&
             t.id !== editingTeam.id
      );
      if (existingTeamWithSeed) {
        toast({
          title: 'Error',
          description: `Seed #${editingTeam.seed} is already assigned to ${existingTeamWithSeed.team_name} in ${editingTeam.conference}.`,
          variant: 'destructive',
        });
        return;
      }
    } else {
      // For updates, check if changing conference would exceed limit
      const originalTeam = teams.find(t => t.id === editingTeam.id);
      if (originalTeam && originalTeam.conference !== editingTeam.conference) {
        const targetConferenceTeams = teams.filter(t => 
          t.conference === editingTeam.conference && t.id !== editingTeam.id
        );
        if (targetConferenceTeams.length >= 7) {
          toast({
            title: 'Error',
            description: `Cannot move team to ${editingTeam.conference}. Maximum of 7 teams allowed per conference.`,
            variant: 'destructive',
          });
          return;
        }
      }
      
      // Check if the seed is already taken by another team in this conference
      const existingTeamWithSeed = teams.find(
        t => t.conference === editingTeam.conference && 
             t.seed === editingTeam.seed &&
             t.id !== editingTeam.id
      );
      if (existingTeamWithSeed) {
        toast({
          title: 'Error',
          description: `Seed #${editingTeam.seed} is already assigned to ${existingTeamWithSeed.team_name} in ${editingTeam.conference}.`,
          variant: 'destructive',
        });
        return;
      }
    }

    try {
      const response = await fetch('/api/admin/playoff-teams', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          season,
          teams: [editingTeam]
        })
      });

      const data = await response.json();

      if (data.success) {
        toast({
          title: 'Success',
          description: 'Playoff team saved successfully',
        });
        setTeamDialogOpen(false);
        setEditingTeam(null);
        await loadTeams();
      } else {
        toast({
          title: 'Error',
          description: data.error || 'Failed to save playoff team',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Error saving team:', error);
      toast({
        title: 'Error',
        description: 'Failed to save playoff team',
        variant: 'destructive',
      });
    }
  };

  const handleDeleteTeam = async (team: PlayoffTeam) => {
    if (!team.id || !confirm(`Are you sure you want to delete ${team.team_name}?`)) {
      return;
    }

    try {
      const response = await fetch(`/api/admin/playoff-teams?id=${team.id}`, {
        method: 'DELETE',
      });

      const data = await response.json();

      if (data.success) {
        toast({
          title: 'Success',
          description: 'Playoff team deleted successfully',
        });
        await loadTeams();
      } else {
        toast({
          title: 'Error',
          description: data.error || 'Failed to delete playoff team',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Error deleting team:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete playoff team',
        variant: 'destructive',
      });
    }
  };

  const handleSaveGame = async () => {
    if (!editingGame) return;

    // Warn if exceeding expected game count for the round
    const expectedGames = ROUND_GAME_COUNTS[editingGame.week];
    const currentGamesForRound = getGamesByRound(editingGame.week);
    const willExceed = !editingGame.id && currentGamesForRound.length >= expectedGames;

    if (willExceed) {
      const confirmExceed = confirm(
        `Warning: ${ROUND_NAMES[editingGame.week]} should have ${expectedGames} game(s), but you're adding a ${currentGamesForRound.length + 1}th game. Continue anyway?`
      );
      if (!confirmExceed) {
        return;
      }
    }

    // Check if ID was changed
    const idChanged = originalGameId && editingGame.id && originalGameId !== editingGame.id;
    
    // If ID changed, check if new ID already exists
    if (idChanged && editingGame.id) {
      const existingGameWithNewId = games.find(g => g.id === editingGame.id);
      if (existingGameWithNewId) {
        toast({
          title: 'Error',
          description: `A game with ID "${editingGame.id}" already exists. Please use a different ID.`,
          variant: 'destructive',
        });
        return;
      }
    }

    try {
      // If ID changed, we need to delete the old game first, then create/update with new ID
      if (idChanged && originalGameId) {
        // Delete the old game
        const deleteResponse = await fetch(`/api/admin/playoff-games?id=${originalGameId}`, {
          method: 'DELETE',
        });
        
        if (!deleteResponse.ok) {
          const deleteData = await deleteResponse.json();
          toast({
            title: 'Error',
            description: deleteData.error || 'Failed to delete old game',
            variant: 'destructive',
          });
          return;
        }
      }

      const response = await fetch('/api/admin/playoff-games', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          season,
          games: [editingGame]
        })
      });

      const data = await response.json();

      if (data.success) {
        toast({
          title: 'Success',
          description: idChanged ? 'Playoff game ID updated successfully' : 'Playoff game saved successfully',
        });
        setGameDialogOpen(false);
        setEditingGame(null);
        setOriginalGameId(undefined);
        await loadGames();
      } else {
        toast({
          title: 'Error',
          description: data.error || 'Failed to save playoff game',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Error saving game:', error);
      toast({
        title: 'Error',
        description: 'Failed to save playoff game',
        variant: 'destructive',
      });
    }
  };

  const handleDeleteGame = async (game: PlayoffGame) => {
    if (!game.id || !confirm(`Are you sure you want to delete this game?`)) {
      return;
    }

    try {
      const response = await fetch(`/api/admin/playoff-games?id=${game.id}`, {
        method: 'DELETE',
      });

      const data = await response.json();

      if (data.success) {
        toast({
          title: 'Success',
          description: 'Playoff game deleted successfully',
        });
        await loadGames();
      } else {
        toast({
          title: 'Error',
          description: data.error || 'Failed to delete playoff game',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Error deleting game:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete playoff game',
        variant: 'destructive',
      });
    }
  };

  const openTeamDialog = (team?: PlayoffTeam | { isPlaceholder: true; seed: number; conference: string }) => {
    if (team && 'isPlaceholder' in team) {
      // Opening from placeholder
      setEditingTeam({
        season,
        team_name: '',
        team_abbreviation: null,
        conference: team.conference,
        seed: team.seed
      });
      setSelectedConference(team.conference as 'AFC' | 'NFC');
    } else if (team) {
      // Opening existing team
      setEditingTeam({ ...team });
      setSelectedConference(team.conference as 'AFC' | 'NFC');
    } else {
      // Opening new team dialog
      setEditingTeam({
        season,
        team_name: '',
        team_abbreviation: null,
        conference: selectedConference,
        seed: 1
      });
    }
    setTeamDialogOpen(true);
  };

  const openGameDialog = (game?: PlayoffGame) => {
    if (game) {
      setEditingGame({ ...game });
      setOriginalGameId(game.id);
      setSelectedRound(game.week);
    } else {
      setEditingGame({
        season,
        week: selectedRound,
        away_team: '',
        home_team: '',
        status: 'scheduled',
        winner: null
      });
      setOriginalGameId(undefined);
    }
    setGameDialogOpen(true);
  };

  const getTeamsByConference = (conference: string) => {
    return teams.filter(t => t.conference === conference).sort((a, b) => a.seed - b.seed);
  };

  const getTeamsWithPlaceholders = (conference: string) => {
    const existingTeams = getTeamsByConference(conference);
    const teamsWithPlaceholders: (PlayoffTeam | { isPlaceholder: true; seed: number; conference: string })[] = [];
    
    for (let seed = 1; seed <= 7; seed++) {
      const team = existingTeams.find(t => t.seed === seed);
      if (team) {
        teamsWithPlaceholders.push(team);
      } else {
        teamsWithPlaceholders.push({
          isPlaceholder: true,
          seed,
          conference
        });
      }
    }
    
    return teamsWithPlaceholders;
  };

  const getGamesByRound = (round: number) => {
    return games.filter(g => g.week === round);
  };

  // Get available teams for the selected conference, excluding teams already assigned
  // Always include the current team being edited (if any) so it can be kept or changed
  const getAvailableTeams = () => {
    const assignedTeamNames = new Set(
      teams
        .filter(t => t.id !== editingTeam?.id) // Exclude current team being edited
        .map(t => t.team_name)
    );
    
    return NFL_TEAMS.filter(t => 
      t.conference === selectedConference && 
      (!assignedTeamNames.has(t.name) || t.name === editingTeam?.team_name) // Include if not assigned OR if it's the current team
    );
  };

  const toLocalDateTimeInput = (utcString: string) => {
    const date = new Date(utcString);
    const pad = (n: number) => n.toString().padStart(2, '0');
  
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
  };
  
  const availableTeams = getAvailableTeams();

  // Show loading while checking access
  if (checkingAccess || loading) {
    return (
      <div className="container mx-auto p-4 sm:p-6 max-w-7xl">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4 text-blue-600" />
            <p className="text-gray-600">Verifying access...</p>
          </div>
        </div>
      </div>
    );
  }

  // Don't render content if user is not a super admin
  if (!isSuperAdmin) {
    return (
      <div className="container mx-auto p-4 sm:p-6 max-w-7xl">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <Shield className="h-16 w-16 mx-auto mb-4 text-red-500" />
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Access Denied</h1>
            <p className="text-gray-600 mb-4">This page is only accessible to system administrators.</p>
            <Button onClick={() => router.push('/admin/dashboard')}>
              Go to Dashboard
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 sm:p-6 max-w-7xl">
      {/* Header */}
      <div className="mb-6">
        <Button
          variant="outline"
          size="sm"
          onClick={() => router.push('/admin/dashboard')}
          className="mb-4"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Dashboard
        </Button>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-xl sm:text-2xl md:text-3xl font-bold flex items-center gap-2">
              <Trophy className="h-6 w-6 sm:h-8 sm:w-8" />
              Playoff Management
            </h1>
            <p className="text-gray-600 mt-1 text-sm sm:text-base">Manage playoff teams and games</p>
          </div>
          <div className="flex items-center gap-2">
            <Label htmlFor="season-select" className="text-sm whitespace-nowrap">Season:</Label>
            <Input
              id="season-select"
              type="number"
              value={season}
              onChange={(e) => setSeason(parseInt(e.target.value) || getNFLSeasonYear())}
              className="w-20 sm:w-24"
            />
            <Button variant="outline" size="sm" onClick={() => { loadTeams(); loadGames(); }}>
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6 border-b">
        <Button
          variant={activeTab === 'teams' ? 'default' : 'ghost'}
          onClick={() => setActiveTab('teams')}
        >
          Playoff Teams
        </Button>
        <Button
          variant={activeTab === 'games' ? 'default' : 'ghost'}
          onClick={() => setActiveTab('games')}
        >
          Playoff Games
        </Button>
      </div>

      {/* Teams Tab */}
      {activeTab === 'teams' && (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                  <CardTitle>Playoff Teams</CardTitle>
                  <CardDescription>
                    Manage playoff team seeds and conferences
                  </CardDescription>
                </div>
                <Button onClick={() => openTeamDialog()} className="w-full sm:w-auto">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Team
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="text-center py-8">Loading...</div>
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* AFC Teams */}
                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-bold text-red-600">AFC</h3>
                      <Badge 
                        variant={getTeamsByConference('AFC').length >= 7 ? "default" : "outline"}
                        className={getTeamsByConference('AFC').length >= 7 ? "" : "border-yellow-500 text-yellow-700"}
                      >
                        {getTeamsByConference('AFC').length} / 7 teams
                      </Badge>
                    </div>
                    <div className="overflow-x-auto">
                      <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Seed</TableHead>
                          <TableHead>Team</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {getTeamsWithPlaceholders('AFC').map((team) => {
                          if ('isPlaceholder' in team) {
                            return (
                              <TableRow 
                                key={`placeholder-${team.conference}-${team.seed}`}
                                className="cursor-pointer hover:bg-gray-50"
                                onClick={() => openTeamDialog(team)}
                              >
                                <TableCell className="font-semibold text-gray-400">#{team.seed}</TableCell>
                                <TableCell className="text-gray-400 italic">
                                  Click to add team
                                </TableCell>
                                <TableCell className="text-right">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      openTeamDialog(team);
                                    }}
                                  >
                                    <Plus className="h-4 w-4" />
                                  </Button>
                                </TableCell>
                              </TableRow>
                            );
                          }
                          
                          return (
                            <TableRow key={team.id || `${team.conference}-${team.seed}`}>
                              <TableCell className="font-semibold">#{team.seed}</TableCell>
                              <TableCell>{team.team_name}</TableCell>
                              <TableCell className="text-right">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => openTeamDialog(team)}
                                >
                                  <Edit className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleDeleteTeam(team)}
                                >
                                  <Trash2 className="h-4 w-4 text-red-500" />
                                </Button>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                    </div>
                  </div>

                  {/* NFC Teams */}
                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-bold text-blue-600">NFC</h3>
                      <Badge 
                        variant={getTeamsByConference('NFC').length >= 7 ? "default" : "outline"}
                        className={getTeamsByConference('NFC').length >= 7 ? "" : "border-yellow-500 text-yellow-700"}
                      >
                        {getTeamsByConference('NFC').length} / 7 teams
                      </Badge>
                    </div>
                    <div className="overflow-x-auto">
                      <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Seed</TableHead>
                          <TableHead>Team</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {getTeamsWithPlaceholders('NFC').map((team) => {
                          if ('isPlaceholder' in team) {
                            return (
                              <TableRow 
                                key={`placeholder-${team.conference}-${team.seed}`}
                                className="cursor-pointer hover:bg-gray-50"
                                onClick={() => openTeamDialog(team)}
                              >
                                <TableCell className="font-semibold text-gray-400">#{team.seed}</TableCell>
                                <TableCell className="text-gray-400 italic">
                                  Click to add team
                                </TableCell>
                                <TableCell className="text-right">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      openTeamDialog(team);
                                    }}
                                  >
                                    <Plus className="h-4 w-4" />
                                  </Button>
                                </TableCell>
                              </TableRow>
                            );
                          }
                          
                          return (
                            <TableRow key={team.id || `${team.conference}-${team.seed}`}>
                              <TableCell className="font-semibold">#{team.seed}</TableCell>
                              <TableCell>{team.team_name}</TableCell>
                              <TableCell className="text-right">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => openTeamDialog(team)}
                                >
                                  <Edit className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleDeleteTeam(team)}
                                >
                                  <Trash2 className="h-4 w-4 text-red-500" />
                                </Button>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Games Tab */}
      {activeTab === 'games' && (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <CardTitle>Playoff Games</CardTitle>
                </div>
                <CardDescription>
                  Manage playoff game matchups by round
                </CardDescription>
                <div className="flex flex-wrap gap-2">
                  {fetchingGameIds && (
                    <Button variant="outline" disabled className="w-full sm:w-auto">
                      <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                      Fetching IDs...
                    </Button>
                  )}
                  <Button 
                    onClick={handleFetchAllGameIds}
                    disabled={fetchingGameIds}
                    variant="outline"
                    className="flex-1 sm:flex-initial"
                  >
                    <RefreshCw className={`h-4 w-4 mr-2 ${fetchingGameIds ? 'animate-spin' : ''}`} />
                    <span className="hidden sm:inline">Fetch Missing Game IDs</span>
                    <span className="sm:hidden">Fetch IDs</span>
                  </Button>
                  <Button onClick={() => openGameDialog()} className="flex-1 sm:flex-initial">
                    <Plus className="h-4 w-4 mr-2" />
                    Add Game
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {[1, 2, 3, 4].map(round => {
                  const roundGames = getGamesByRound(round);
                  const expectedGames = ROUND_GAME_COUNTS[round];
                  const hasCorrectCount = roundGames.length === expectedGames;
                  return (
                    <div key={round} className="border rounded-lg p-3 sm:p-4">
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-4">
                        <div className="flex items-center gap-2">
                          <h3 className="text-base sm:text-lg font-bold">{ROUND_NAMES[round]} <span className="text-sm font-normal">(Week {round})</span></h3>
                          {!hasCorrectCount && (
                            <div title={`Expected ${expectedGames} game(s)`}>
                              <AlertCircle className="h-4 w-4 text-yellow-500" />
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge 
                            variant={hasCorrectCount ? "default" : "secondary"}
                            className={hasCorrectCount ? "" : "border-yellow-500 text-yellow-700"}
                          >
                            {roundGames.length} / {expectedGames} games
                          </Badge>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => fetchGamesForRound(round)}
                            disabled={fetchingRoundGames === round}
                            className="ml-2"
                          >
                            {fetchingRoundGames === round ? (
                              <>
                                <RefreshCw className="h-3 w-3 mr-1 animate-spin" />
                                <span className="hidden sm:inline">Fetching...</span>
                              </>
                            ) : (
                              <>
                                <RefreshCw className="h-3 w-3 mr-1" />
                                <span className="hidden sm:inline">Fetch Games</span>
                                <span className="sm:hidden">Fetch</span>
                              </>
                            )}
                          </Button>
                        </div>
                      </div>
                      {roundGames.length > 0 ? (
                        <>
                          {/* Card Layout for Mobile */}
                          <div className="md:hidden space-y-3">
                            {roundGames.map((game) => (
                              <Card key={game.id} className="p-4">
                                <div className="space-y-3">
                                  <div className="flex items-start justify-between gap-2">
                                    <div className="flex-1 min-w-0">
                                      <div className="flex items-center gap-2 mb-2">
                                        <code className="text-xs bg-gray-100 px-2 py-1 rounded break-all">
                                          {game.id || 'No ID'}
                                        </code>
                                      </div>
                                      <div className="space-y-2">
                                        <div className="flex items-center gap-2">
                                          <span className="text-sm font-medium text-gray-600">Away:</span>
                                          {teamSeeds[game.away_team] && (
                                            <Badge variant="outline" className="text-xs shrink-0">#{teamSeeds[game.away_team]}</Badge>
                                          )}
                                          <span className="font-medium">{game.away_team}</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                          <span className="text-sm font-medium text-gray-600">Home:</span>
                                          {teamSeeds[game.home_team] && (
                                            <Badge variant="outline" className="text-xs shrink-0">#{teamSeeds[game.home_team]}</Badge>
                                          )}
                                          <span className="font-medium">{game.home_team}</span>
                                        </div>
                                      </div>
                                    </div>
                                    <div className="flex gap-1 shrink-0">
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => { setSelectedRound(round); openGameDialog(game); }}
                                      >
                                        <Edit className="h-4 w-4" />
                                      </Button>
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => handleDeleteGame(game)}
                                      >
                                        <Trash2 className="h-4 w-4 text-red-500" />
                                      </Button>
                                    </div>
                                  </div>
                                  <div className="grid grid-cols-2 gap-2 pt-2 border-t">
                                    <div>
                                      <span className="text-xs text-gray-500">Kickoff</span>
                                      <p className="text-sm font-medium">
                                        {game.kickoff_time ? new Date(game.kickoff_time).toLocaleString() : 'TBD'}
                                      </p>
                                    </div>
                                    <div>
                                      <span className="text-xs text-gray-500">Status</span>
                                      <div className="mt-1">
                                        <Badge variant={game.status === 'final' ? 'default' : 'secondary'}>
                                          {game.status || 'scheduled'}
                                        </Badge>
                                      </div>
                                    </div>
                                    {game.winner && (
                                      <div className="col-span-2">
                                        <span className="text-xs text-gray-500">Winner</span>
                                        <p className="text-sm font-medium">{game.winner}</p>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </Card>
                            ))}
                          </div>

                          {/* Table Layout for Desktop */}
                          <div className="hidden md:block overflow-x-auto">
                            <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead className="min-w-[120px]">Game ID</TableHead>
                                <TableHead className="min-w-[140px]">Home Team</TableHead>
                                <TableHead className="min-w-[140px]">Away Team</TableHead>
                                <TableHead className="min-w-[160px]">Kickoff</TableHead>
                                <TableHead className="min-w-[100px]">Status</TableHead>
                                <TableHead className="min-w-[120px]">Winner</TableHead>
                                <TableHead className="text-right min-w-[100px]">Actions</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {roundGames.map((game) => (
                                <TableRow key={game.id}>
                                  <TableCell className="min-w-[120px]">
                                    <code className="text-xs bg-gray-100 px-2 py-1 rounded break-all">
                                      {game.id || 'No ID'}
                                    </code>
                                  </TableCell>
                                <TableCell className="min-w-[140px]">
                                  <div className="flex items-center gap-2">
                                    {teamSeeds[game.home_team] && (
                                      <Badge variant="outline" className="text-xs shrink-0">#{teamSeeds[game.home_team]}</Badge>
                                    )}
                                    <span className="truncate">{game.home_team}</span>
                                  </div>
                                </TableCell>
                                  <TableCell className="min-w-[140px]">
                                    <div className="flex items-center gap-2">
                                      {teamSeeds[game.away_team] && (
                                        <Badge variant="outline" className="text-xs shrink-0">#{teamSeeds[game.away_team]}</Badge>
                                      )}
                                      <span className="truncate">{game.away_team}</span>
                                    </div>
                                  </TableCell>
                                  <TableCell className="min-w-[160px] whitespace-nowrap">
                                    {game.kickoff_time ? new Date(game.kickoff_time).toLocaleString() : 'TBD'}
                                  </TableCell>
                                  <TableCell>
                                    <Badge variant={game.status === 'final' ? 'default' : 'secondary'}>
                                      {game.status || 'scheduled'}
                                    </Badge>
                                  </TableCell>
                                  <TableCell className="min-w-[120px]">
                                    <span className="truncate block">{game.winner || '-'}</span>
                                  </TableCell>
                                  <TableCell className="text-right">
                                    <div className="flex justify-end gap-1">
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => { setSelectedRound(round); openGameDialog(game); }}
                                      >
                                        <Edit className="h-4 w-4" />
                                      </Button>
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => handleDeleteGame(game)}
                                      >
                                        <Trash2 className="h-4 w-4 text-red-500" />
                                      </Button>
                                    </div>
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                          </div>
                        </>
                      ) : (
                        <p className="text-gray-500 text-center py-4">No games scheduled for this round</p>
                      )}
                      {!hasCorrectCount && (
                        <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                          <p className="text-sm text-yellow-800">
                            <strong>Expected:</strong> {expectedGames} game(s) for this round. Currently have {roundGames.length}.
                          </p>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Team Dialog */}
      <Dialog open={teamDialogOpen} onOpenChange={setTeamDialogOpen}>
        <DialogContent className="max-w-md w-[calc(100vw-2rem)] sm:w-full">
          <DialogHeader>
            <DialogTitle>{editingTeam?.id ? 'Edit' : 'Add'} Playoff Team</DialogTitle>
            <DialogDescription>
              Configure team seed and conference
            </DialogDescription>
          </DialogHeader>
          {editingTeam && (
            <div className="space-y-4">
              <div>
                <Label>Conference</Label>
                <Select
                  value={editingTeam.conference}
                  onValueChange={(value) => {
                    setEditingTeam({ ...editingTeam, conference: value });
                    setSelectedConference(value as 'AFC' | 'NFC');
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="AFC">AFC</SelectItem>
                    <SelectItem value="NFC">NFC</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Seed (1-7)</Label>
                <Select
                  value={editingTeam.seed.toString()}
                  onValueChange={(value) => setEditingTeam({ ...editingTeam, seed: parseInt(value) })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[1, 2, 3, 4, 5, 6, 7].map((seedNum) => (
                      <SelectItem key={seedNum} value={seedNum.toString()}>
                        {seedNum}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Team</Label>
                <Select
                  value={editingTeam.team_name}
                  onValueChange={(value) => {
                    const team = availableTeams.find(t => t.name === value);
                    setEditingTeam({
                      ...editingTeam,
                      team_name: value,
                      team_abbreviation: team?.abbreviation || null,
                      conference: team?.conference || editingTeam.conference
                    });
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select team" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableTeams.map((team) => (
                      <SelectItem key={team.name} value={team.name}>
                        {team.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex justify-end gap-2 pt-4">
                <Button variant="outline" onClick={() => setTeamDialogOpen(false)}>
                  <X className="h-4 w-4 mr-2" />
                  Cancel
                </Button>
                <Button onClick={handleSaveTeam}>
                  <Save className="h-4 w-4 mr-2" />
                  Save
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Game Dialog */}
      <Dialog open={gameDialogOpen} onOpenChange={setGameDialogOpen}>
        <DialogContent className="max-w-md w-[calc(100vw-2rem)] sm:w-full max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingGame?.id ? 'Edit' : 'Add'} Playoff Game</DialogTitle>
              <DialogDescription>
                Configure game matchup
                {editingGame && !editingGame.id && (
                  <span className="block mt-1 text-xs">
                    Expected games for {ROUND_NAMES[editingGame.week]}: {ROUND_GAME_COUNTS[editingGame.week]}
                  </span>
                )}
              </DialogDescription>
            </DialogHeader>
          {editingGame && (
            <div className="space-y-4">
              <div>
                <Label>Game ID</Label>
                <Input
                  type="text"
                  value={editingGame.id || ''}
                  onChange={(e) => setEditingGame({ ...editingGame, id: e.target.value || undefined })}
                  placeholder="Enter game ID (e.g., ESPN ID)"
                />
                <p className="text-xs text-gray-500 mt-1">
                  {editingGame.id ? 'Current ID: ' + editingGame.id : 'Leave empty to auto-generate or fetch from ESPN'}
                </p>
              </div>
              <div>
                <Label>Round</Label>
                <Select
                  value={editingGame.week.toString()}
                  onValueChange={(value) => {
                    setEditingGame({ ...editingGame, week: parseInt(value) });
                    setSelectedRound(parseInt(value));
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(ROUND_NAMES).map(([week, name]) => (
                      <SelectItem key={week} value={week}>
                        {name} (Week {week})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Away Team</Label>
                <Select
                  value={editingGame.away_team}
                  onValueChange={(value) => setEditingGame({ ...editingGame, away_team: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select away team" />
                  </SelectTrigger>
                  <SelectContent>
                    {NFL_TEAMS.map((team) => (
                      <SelectItem key={team.name} value={team.name}>
                        {team.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Home Team</Label>
                <Select
                  value={editingGame.home_team}
                  onValueChange={(value) => setEditingGame({ ...editingGame, home_team: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select home team" />
                  </SelectTrigger>
                  <SelectContent>
                    {NFL_TEAMS.map((team) => (
                      <SelectItem key={team.name} value={team.name}>
                        {team.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Kickoff Time</Label>
                <Input
                  type="datetime-local"
                  value={editingGame.kickoff_time ? toLocalDateTimeInput(editingGame.kickoff_time) : ''}
                  onChange={(e) => setEditingGame({ ...editingGame, kickoff_time: e.target.value})}
                />
              </div>
              <div>
                <Label>Status</Label>
                <Select
                  value={editingGame.status || 'scheduled'}
                  onValueChange={(value) => setEditingGame({ ...editingGame, status: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="scheduled">Scheduled</SelectItem>
                    <SelectItem value="in_progress">In Progress</SelectItem>
                    <SelectItem value="final">Final</SelectItem>
                    <SelectItem value="post">Post</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {editingGame.status === 'final' && (
                <div>
                  <Label>Winner</Label>
                  <Select
                    value={editingGame.winner || ''}
                    onValueChange={(value) => setEditingGame({ ...editingGame, winner: value || null })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select winner" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">No winner</SelectItem>
                      <SelectItem value={editingGame.away_team}>{editingGame.away_team}</SelectItem>
                      <SelectItem value={editingGame.home_team}>{editingGame.home_team}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div className="flex justify-end gap-2 pt-4">
                <Button variant="outline" onClick={() => setGameDialogOpen(false)}>
                  <X className="h-4 w-4 mr-2" />
                  Cancel
                </Button>
                <Button onClick={handleSaveGame}>
                  <Save className="h-4 w-4 mr-2" />
                  Save
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Result Dialog (Success/Error) */}
      <Dialog open={resultDialogOpen} onOpenChange={setResultDialogOpen}>
        <DialogContent className="max-w-md w-[calc(100vw-2rem)] sm:w-full">
          <DialogHeader>
            <div className="flex items-center gap-3">
              {resultDialogType === 'success' ? (
                <CheckCircle className="h-6 w-6 text-green-600" />
              ) : (
                <AlertTriangle className="h-6 w-6 text-red-600" />
              )}
              <DialogTitle className={resultDialogType === 'success' ? 'text-green-900' : 'text-red-900'}>
                {resultDialogTitle}
              </DialogTitle>
            </div>
          </DialogHeader>
          <DialogDescription className="text-base pt-2">
            {resultDialogDescription}
          </DialogDescription>
          <div className="flex justify-end pt-4">
            <Button onClick={() => setResultDialogOpen(false)}>
              OK
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Confirmation Dialog for Game Fetching */}
      <Dialog open={confirmDialogOpen} onOpenChange={setConfirmDialogOpen}>
        <DialogContent className="max-w-4xl w-[calc(100vw-1rem)] sm:w-full lg:max-w-5xl max-h-[90vh] overflow-y-auto p-4 sm:p-6">
          <DialogHeader className="px-0">
            <DialogTitle className="text-lg sm:text-xl">Review Games Before Saving</DialogTitle>
            <DialogDescription className="text-sm sm:text-base">
              Please review the {pendingGames.length} game(s) that will be created for {pendingRound ? ROUND_NAMES[pendingRound] : 'this round'}.
              Click "Confirm & Save" to add them to the database, or "Cancel" to discard.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            {pendingGames.length > 0 && (
              <>
                {/* Mobile Card Layout */}
                <div className="md:hidden space-y-3">
                  {pendingGames.map((game, index) => (
                    <Card key={game.id || `pending-${index}`} className="p-3 sm:p-4">
                      <div className="space-y-2">
                        <div className="flex items-start justify-between gap-2">
                          <code className="text-xs bg-gray-100 px-2 py-1 rounded break-all flex-1 min-w-0">
                            {game.id || 'No ID'}
                          </code>
                          <Badge variant="secondary" className="text-xs shrink-0">
                            {game.status || 'scheduled'}
                          </Badge>
                        </div>
                        <div className="space-y-1.5 pt-1">
                          <div>
                            <span className="text-xs text-gray-500">Away:</span>
                            <p className={`text-sm font-medium ${game.away_team === 'TBD' ? 'text-gray-400 italic' : ''}`}>
                              {game.away_team || 'TBD'}
                            </p>
                          </div>
                          <div>
                            <span className="text-xs text-gray-500">Home:</span>
                            <p className={`text-sm font-medium ${game.home_team === 'TBD' ? 'text-gray-400 italic' : ''}`}>
                              {game.home_team || 'TBD'}
                            </p>
                          </div>
                          <div>
                            <span className="text-xs text-gray-500">Kickoff:</span>
                            <p className="text-sm">
                              {game.kickoff_time ? new Date(game.kickoff_time).toLocaleString() : 'TBD'}
                            </p>
                          </div>
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>

                {/* Desktop Table Layout */}
                <div className="hidden md:block border rounded-lg overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="min-w-[120px]">Game ID</TableHead>
                        <TableHead className="min-w-[140px]">Away Team</TableHead>
                        <TableHead className="min-w-[140px]">Home Team</TableHead>
                        <TableHead className="min-w-[180px]">Kickoff Time</TableHead>
                        <TableHead className="min-w-[100px]">Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {pendingGames.map((game, index) => (
                        <TableRow key={game.id || `pending-${index}`}>
                          <TableCell>
                            <code className="text-xs bg-gray-100 px-2 py-1 rounded break-all">
                              {game.id || 'No ID'}
                            </code>
                          </TableCell>
                          <TableCell>
                            <span className={game.away_team === 'TBD' ? 'text-gray-400 italic' : ''}>
                              {game.away_team || 'TBD'}
                            </span>
                          </TableCell>
                          <TableCell>
                            <span className={game.home_team === 'TBD' ? 'text-gray-400 italic' : ''}>
                              {game.home_team || 'TBD'}
                            </span>
                          </TableCell>
                          <TableCell className="whitespace-nowrap text-sm">
                            {game.kickoff_time ? new Date(game.kickoff_time).toLocaleString() : 'TBD'}
                          </TableCell>
                          <TableCell>
                            <Badge variant="secondary">{game.status || 'scheduled'}</Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </>
            )}
            
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 sm:p-4">
              <p className="text-xs sm:text-sm text-blue-800">
                <strong>Note:</strong> Games with "TBD" teams are placeholders that will need to be updated once the actual matchups are determined.
              </p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row justify-end gap-2 pt-4 border-t px-0">
            <Button 
              variant="outline" 
              onClick={() => {
                setConfirmDialogOpen(false);
                setPendingGames([]);
                setPendingRound(null);
              }}
              className="w-full sm:w-auto"
            >
              <X className="h-4 w-4 mr-2" />
              Cancel
            </Button>
            <Button onClick={confirmSaveGames} className="w-full sm:w-auto">
              <CheckCircle className="h-4 w-4 mr-2" />
              Confirm & Save
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function PlayoffManagementPage() {
  return (
    <AuthProvider>
      <AdminGuard requireSuperAdmin={true}>
        <PlayoffManagementContent />
      </AdminGuard>
    </AuthProvider>
  );
}

