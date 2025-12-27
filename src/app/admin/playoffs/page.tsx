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
  AlertCircle
} from 'lucide-react';
import { debugLog, NFL_TEAMS } from '@/lib/utils';

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
  const { user } = useAuth();

  const [season, setSeason] = useState<number>(new Date().getFullYear());
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'teams' | 'games'>('teams');

  // Teams state
  const [teams, setTeams] = useState<PlayoffTeam[]>([]);
  const [editingTeam, setEditingTeam] = useState<PlayoffTeam | null>(null);
  const [teamDialogOpen, setTeamDialogOpen] = useState(false);
  const [selectedConference, setSelectedConference] = useState<'AFC' | 'NFC'>('AFC');

  // Games state
  const [games, setGames] = useState<PlayoffGame[]>([]);
  const [editingGame, setEditingGame] = useState<PlayoffGame | null>(null);
  const [gameDialogOpen, setGameDialogOpen] = useState(false);
  const [selectedRound, setSelectedRound] = useState<number>(1);
  const [teamSeeds, setTeamSeeds] = useState<Record<string, number>>({});
  const [fetchingGameIds, setFetchingGameIds] = useState(false);

  useEffect(() => {
    if (season) {
      loadTeams();
      loadGames();
    }
  }, [season]);

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
        // Removed auto-fetching - user will manually trigger via button
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

  const handleFetchAllGameIds = async () => {
    // Find all games without IDs
    const gamesWithoutIds = games.filter(g => !g.id);
    
    if (gamesWithoutIds.length === 0) {
      toast({
        title: 'Info',
        description: 'All games already have IDs assigned.',
      });
      return;
    }

    await fetchGameIdsForGamesWithoutIds(gamesWithoutIds);
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

    try {
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
          description: 'Playoff game saved successfully',
        });
        setGameDialogOpen(false);
        setEditingGame(null);
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

  const availableTeams = NFL_TEAMS.filter(t => t.conference === selectedConference);

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
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-2">
              <Trophy className="h-8 w-8" />
              Playoff Management
            </h1>
            <p className="text-gray-600 mt-1">Manage playoff teams and games</p>
          </div>
          <div className="flex items-center gap-2">
            <Label htmlFor="season-select">Season:</Label>
            <Input
              id="season-select"
              type="number"
              value={season}
              onChange={(e) => setSeason(parseInt(e.target.value) || new Date().getFullYear())}
              className="w-24"
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
              <div className="flex items-center justify-between">
                <CardTitle>Playoff Teams</CardTitle>
                <Button onClick={() => openTeamDialog()}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Team
                </Button>
              </div>
              <CardDescription>
                Manage playoff team seeds and conferences
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="text-center py-8">Loading...</div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
              <div className="flex items-center justify-between">
                <CardTitle>Playoff Games</CardTitle>
                <div className="flex gap-2">
                  {fetchingGameIds && (
                    <Button variant="outline" disabled>
                      <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                      Fetching IDs...
                    </Button>
                  )}
                  <Button 
                    onClick={handleFetchAllGameIds}
                    disabled={fetchingGameIds}
                    variant="outline"
                  >
                    <RefreshCw className={`h-4 w-4 mr-2 ${fetchingGameIds ? 'animate-spin' : ''}`} />
                    Fetch Missing Game IDs
                  </Button>
                  <Button onClick={() => openGameDialog()}>
                    <Plus className="h-4 w-4 mr-2" />
                    Add Game
                  </Button>
                </div>
              </div>
              <CardDescription>
                Manage playoff game matchups by round
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {[1, 2, 3, 4].map(round => {
                  const roundGames = getGamesByRound(round);
                  const expectedGames = ROUND_GAME_COUNTS[round];
                  const hasCorrectCount = roundGames.length === expectedGames;
                  return (
                    <div key={round} className="border rounded-lg p-4">
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2">
                          <h3 className="text-lg font-bold">{ROUND_NAMES[round]} (Week {round})</h3>
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
                        </div>
                      </div>
                      {roundGames.length > 0 ? (
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Home Team</TableHead>
                              <TableHead>Away Team</TableHead>
                              <TableHead>Kickoff</TableHead>
                              <TableHead>Status</TableHead>
                              <TableHead>Winner</TableHead>
                              <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {roundGames.map((game) => (
                              <TableRow key={game.id}>
                              <TableCell>
                                <div className="flex items-center gap-2">
                                  {teamSeeds[game.home_team] && (
                                    <Badge variant="outline" className="text-xs">#{teamSeeds[game.home_team]}</Badge>
                                  )}
                                  {game.home_team}
                                </div>
                              </TableCell>
                                <TableCell>
                                  <div className="flex items-center gap-2">
                                    {teamSeeds[game.away_team] && (
                                      <Badge variant="outline" className="text-xs">#{teamSeeds[game.away_team]}</Badge>
                                    )}
                                    {game.away_team}
                                  </div>
                                </TableCell>
                                <TableCell>
                                  {game.kickoff_time ? new Date(game.kickoff_time).toLocaleString() : 'TBD'}
                                </TableCell>
                                <TableCell>
                                  <Badge variant={game.status === 'final' ? 'default' : 'secondary'}>
                                    {game.status || 'scheduled'}
                                  </Badge>
                                </TableCell>
                                <TableCell>{game.winner || '-'}</TableCell>
                                <TableCell className="text-right">
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
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
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
        <DialogContent className="max-w-md">
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
                <Input
                  type="number"
                  min="1"
                  max="7"
                  value={editingTeam.seed}
                  onChange={(e) => setEditingTeam({ ...editingTeam, seed: parseInt(e.target.value) || 1 })}
                />
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
        <DialogContent className="max-w-md">
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
                  value={editingGame.kickoff_time ? new Date(editingGame.kickoff_time).toISOString().slice(0, 16) : ''}
                  onChange={(e) => setEditingGame({ ...editingGame, kickoff_time: e.target.value ? new Date(e.target.value).toISOString() : undefined })}
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

