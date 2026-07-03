'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Input } from '@/components/ui/input';
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
  ArrowLeft,
  RefreshCw,
  AlertCircle,
  CheckCircle,
  AlertTriangle,
  Shield
} from 'lucide-react';
import { debugLog, NFL_TEAMS, MAX_WEEKS_REGULAR_SEASON, getNFLSeasonYear, debugError} from '@/lib/utils';
import { Footer } from '@/components/layout/Footer';

// Design tokens
const bg      = 'oklch(13% 0.025 255)';
const surface = 'oklch(17% 0.028 255)';
const card    = 'oklch(20% 0.03 255)';
const border  = 'oklch(26% 0.03 255)';
const green   = 'oklch(46% 0.14 155)';
const greenHi = 'oklch(59% 0.15 155)';
const gold    = 'oklch(74% 0.16 72)';
const text    = 'oklch(95% 0.006 255)';
const textMid = 'oklch(72% 0.015 255)';
const textDim = 'oklch(50% 0.018 255)';
const amber   = 'oklch(72% 0.16 60)';
const liveRed = 'oklch(62% 0.22 25)';
const afcRed  = 'oklch(58% 0.18 20)';
const nfcBlue = 'oklch(58% 0.15 250)';

const bc = { fontFamily: 'var(--font-barlow-condensed)' } as const;
const b  = { fontFamily: 'var(--font-barlow)' } as const;

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
  week: number;
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
  1: 6,
  2: 4,
  3: 2,
  4: 1
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

  const [teams, setTeams] = useState<PlayoffTeam[]>([]);
  const [editingTeam, setEditingTeam] = useState<PlayoffTeam | null>(null);
  const [teamDialogOpen, setTeamDialogOpen] = useState(false);
  const [selectedConference, setSelectedConference] = useState<'AFC' | 'NFC'>('AFC');

  const [games, setGames] = useState<PlayoffGame[]>([]);
  const [editingGame, setEditingGame] = useState<PlayoffGame | null>(null);
  const [originalGameId, setOriginalGameId] = useState<string | undefined>(undefined);
  const [gameDialogOpen, setGameDialogOpen] = useState(false);
  const [selectedRound, setSelectedRound] = useState<number>(1);
  const [teamSeeds, setTeamSeeds] = useState<Record<string, number>>({});
  const [fetchingGameIds, setFetchingGameIds] = useState(false);

  const [resultDialogOpen, setResultDialogOpen] = useState(false);
  const [resultDialogType, setResultDialogType] = useState<'success' | 'error'>('success');
  const [resultDialogTitle, setResultDialogTitle] = useState('');
  const [resultDialogDescription, setResultDialogDescription] = useState('');

  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [pendingGames, setPendingGames] = useState<PlayoffGame[]>([]);
  const [pendingRound, setPendingRound] = useState<number | null>(null);
  const [fetchingRoundGames, setFetchingRoundGames] = useState<number | null>(null);

  useEffect(() => {
    const checkAccess = async () => {
      if (!user) { setCheckingAccess(false); return; }
      try {
        const superAdminStatus = await verifyAdminStatus(true);
        setIsSuperAdmin(superAdminStatus);
        if (!superAdminStatus) {
          toast({ title: 'Access Denied', description: 'This page is only accessible to system administrators.', variant: 'destructive' });
          router.push('/admin/dashboard');
        }
      } catch (error) {
        debugError('Error checking admin status:', error);
        router.push('/admin/dashboard');
      } finally {
        setCheckingAccess(false);
      }
    };
    if (user) checkAccess();
    else setCheckingAccess(false);
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
      teams.forEach(team => { seeds[team.team_name] = team.seed; });
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
        toast({ title: 'Error', description: data.error || 'Failed to load playoff teams', variant: 'destructive' });
      }
    } catch (error) {
      debugError('Error loading teams:', error);
      toast({ title: 'Error', description: 'Failed to load playoff teams', variant: 'destructive' });
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
        toast({ title: 'Error', description: data.error || 'Failed to load playoff games', variant: 'destructive' });
      }
    } catch (error) {
      debugError('Error loading games:', error);
    }
  };

  const fetchGameIdsForGamesWithoutIds = async (gamesWithoutIds: PlayoffGame[]) => {
    debugLog('Fetching game IDs for games without IDs');
    setFetchingGameIds(true);
    try {
      const gamesByWeek = new Map<number, PlayoffGame[]>();
      gamesWithoutIds.forEach(game => {
        if (!gamesByWeek.has(game.week)) gamesByWeek.set(game.week, []);
        gamesByWeek.get(game.week)!.push(game);
      });

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
            const updatedGames: PlayoffGame[] = [];
            for (const ourGame of weekGames) {
              const espnGame = data.games.find((eg: any) =>
                (eg.away_team === ourGame.away_team && eg.home_team === ourGame.home_team) ||
                (eg.away_team === ourGame.home_team && eg.home_team === ourGame.away_team)
              );
              if (espnGame) {
                const gameToUpdate: PlayoffGame = {
                  season: ourGame.season, week: ourGame.week,
                  away_team: ourGame.away_team, home_team: ourGame.home_team,
                  id: ourGame.id || espnGame.id,
                  kickoff_time: espnGame.kickoff_time || ourGame.kickoff_time,
                  status: ourGame.status || 'scheduled',
                  winner: ourGame.winner || null
                };
                const updateResponse = await fetch('/api/admin/playoff-games', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ season, games: [gameToUpdate] })
                });
                if (updateResponse.ok) {
                  const responseData = await updateResponse.json();
                  if (responseData.success) {
                    updatedGames.push({ ...ourGame, id: espnGame.id });
                    totalUpdated++;
                  }
                }
              }
            }
          }
        } catch (error) {
          debugError(`Error fetching ESPN IDs for week ${week}:`, error);
        }
      }

      if (totalUpdated > 0) {
        toast({ title: 'Success', description: `Fetched and updated ${totalUpdated} game ID(s) from ESPN` });
        await loadGames();
      } else {
        toast({ title: 'Info', description: 'No game IDs were found or updated.' });
      }
    } catch (error) {
      debugError('Error fetching game IDs:', error);
      toast({ title: 'Warning', description: 'Failed to fetch some game IDs from ESPN', variant: 'destructive' });
    } finally {
      setFetchingGameIds(false);
    }
  };

  const getLastGameOfPreviousWeek = async (round: number, season: number) => {
    if (round === 1) {
      const res = await fetch(`/api/games/week?week=${MAX_WEEKS_REGULAR_SEASON}&seasonType=2`);
      const data = await res.json();
      if (data.success && data.games && data.games.length > 0) {
        const sorted = data.games.sort((a: any, b: any) => new Date(a.kickoff_time).getTime() - new Date(b.kickoff_time).getTime());
        return sorted[sorted.length - 1].kickoff_time;
      }
      return null;
    }
    const res = await fetch(`/api/admin/playoff-games?season=${season}&week=${round - 1}`);
    const data = await res.json();
    if (data.success && data.games && data.games.length > 0) return data.games[data.games.length - 1].kickoff_time;
    return null;
  };

  const fetchGamesForRound = async (round: number) => {
    try {
      setFetchingRoundGames(round);
      const playoffYear = season + 1;
      const lastGameOfPreviousWeek = await getLastGameOfPreviousWeek(round, season);
      const response = await fetch('/api/admin/playoff-games/fetch-espn-ids', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ season: playoffYear, week: round, lastGameOfPreviousWeek })
      });
      const data = await response.json();
      if (!data.success || !data.games) {
        toast({ title: 'Error', description: 'Failed to fetch game data from ESPN', variant: 'destructive' });
        return;
      }

      const espnGames: Array<{ id: string; kickoff_time: string; away_team?: string; home_team?: string }> = [];
      for (const game of data.games) {
        if (game.id && game.kickoff_time) {
          espnGames.push({ id: game.id, kickoff_time: game.kickoff_time, ...(game.away_team && game.home_team ? { away_team: game.away_team, home_team: game.home_team } : {}) });
        }
      }

      const roundGames = getGamesByRound(round);
      const existingGameIds = new Set(roundGames.filter(g => g.id).map(g => g.id));
      const existingMatchups = new Set(roundGames.map(g => [g.away_team, g.home_team].sort().join('|')));
      const gamesWithTbdTeams = roundGames.filter(g => g.away_team === 'TBD' || g.home_team === 'TBD');

      const gamesToCreate: PlayoffGame[] = [];
      const matchedTbdGames = new Set<string>();
      const updatedGames = new Set<string>();

      for (const espnGame of espnGames) {
        if (espnGame.id && existingGameIds.has(espnGame.id)) {
          const existingGame = roundGames.find(g => g.id === espnGame.id);
          if (existingGame) {
            const hasTbd = existingGame.away_team === 'TBD' || existingGame.home_team === 'TBD';
            if (espnGame.away_team && espnGame.home_team) {
              const teamsMatch = (existingGame.away_team === espnGame.away_team && existingGame.home_team === espnGame.home_team) ||
                (existingGame.away_team === espnGame.home_team && existingGame.home_team === espnGame.away_team);
              if (!teamsMatch || hasTbd) {
                gamesToCreate.push({ season, week: round, away_team: espnGame.away_team, home_team: espnGame.home_team, id: espnGame.id, kickoff_time: espnGame.kickoff_time || existingGame.kickoff_time, status: existingGame.status || 'scheduled' });
                updatedGames.add(espnGame.id);
                continue;
              }
              continue;
            } else if (hasTbd && espnGame.kickoff_time && espnGame.kickoff_time !== existingGame.kickoff_time) {
              gamesToCreate.push({ season, week: round, away_team: existingGame.away_team || 'TBD', home_team: existingGame.home_team || 'TBD', id: espnGame.id, kickoff_time: espnGame.kickoff_time, status: existingGame.status || 'scheduled' });
              updatedGames.add(espnGame.id);
              continue;
            }
          }
        }

        if (espnGame.away_team && espnGame.home_team && !updatedGames.has(espnGame.id || '')) {
          const matchupKey = [espnGame.away_team, espnGame.home_team].sort().join('|');
          if (existingMatchups.has(matchupKey)) {
            const existingGamesWithMatchup = roundGames.filter(g => [g.away_team, g.home_team].sort().join('|') === matchupKey);
            if (existingGamesWithMatchup.find(g => g.id === espnGame.id)) continue;
            continue;
          }
        }

        if (espnGame.away_team && espnGame.home_team && gamesWithTbdTeams.length > 0) {
          const tbdGameToUpdate = gamesWithTbdTeams.find(g =>
            !matchedTbdGames.has(g.id || '') && !updatedGames.has(g.id || '') &&
            (g.away_team === 'TBD' || g.home_team === 'TBD') &&
            (!g.id || !espnGame.id || g.id !== espnGame.id)
          );
          if (tbdGameToUpdate) {
            gamesToCreate.push({ season, week: round, away_team: espnGame.away_team, home_team: espnGame.home_team, id: tbdGameToUpdate.id || espnGame.id, kickoff_time: espnGame.kickoff_time || tbdGameToUpdate.kickoff_time, status: tbdGameToUpdate.status || 'scheduled' });
            matchedTbdGames.add(tbdGameToUpdate.id || '');
            continue;
          }
        }

        gamesToCreate.push({ season, week: round, away_team: espnGame.away_team || 'TBD', home_team: espnGame.home_team || 'TBD', id: espnGame.id, kickoff_time: espnGame.kickoff_time, status: 'scheduled' });
      }

      const expectedGameCount = ROUND_GAME_COUNTS[round];
      const totalAfterCreate = roundGames.length + gamesToCreate.length;
      const stillNeeded = expectedGameCount - totalAfterCreate;

      if (stillNeeded > 0) {
        const timestamp = Date.now();
        const pYear = season + 1;
        const defaultDates: Record<number, string> = {
          1: `${pYear}-01-11T18:00:00Z`, 2: `${pYear}-01-18T18:00:00Z`,
          3: `${pYear}-01-25T18:00:00Z`, 4: `${pYear}-02-08T18:00:00Z`
        };
        for (let i = 0; i < stillNeeded; i++) {
          gamesToCreate.push({ season, week: round, away_team: 'TBD', home_team: 'TBD', id: `${season}_3_${round}_TBD_${timestamp}_${i}`, kickoff_time: defaultDates[round] || new Date().toISOString(), status: 'scheduled' });
        }
      }

      if (gamesToCreate.length > 0) {
        setPendingGames(gamesToCreate);
        setPendingRound(round);
        setConfirmDialogOpen(true);
      } else {
        toast({ title: 'Info', description: `No new games to create for ${ROUND_NAMES[round]}.` });
      }
    } catch (error) {
      debugError(`Error fetching games for round ${round}:`, error);
      toast({ title: 'Error', description: `Failed to fetch games for ${ROUND_NAMES[round]}: ${error instanceof Error ? error.message : 'Unknown error'}`, variant: 'destructive' });
    } finally {
      setFetchingRoundGames(null);
    }
  };

  const confirmSaveGames = async () => {
    if (!pendingRound || pendingGames.length === 0) return;
    try {
      const saveResponse = await fetch('/api/admin/playoff-games', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ season, games: pendingGames })
      });
      const saveData = await saveResponse.json();
      if (saveData.success) {
        toast({ title: 'Success', description: `Successfully created ${pendingGames.length} game(s) for ${ROUND_NAMES[pendingRound]}.` });
        setConfirmDialogOpen(false);
        setPendingGames([]);
        setPendingRound(null);
        await loadGames();
      } else {
        toast({ title: 'Error', description: `Failed to save games: ${saveData.error || 'Unknown error'}`, variant: 'destructive' });
      }
    } catch (error) {
      toast({ title: 'Error', description: `Failed to save games: ${error instanceof Error ? error.message : 'Unknown error'}`, variant: 'destructive' });
    }
  };

  const handleFetchAllGameIds = async () => {
    const gamesNeedingIds: PlayoffGame[] = [];
    for (const round of [1, 2, 3, 4]) {
      const expectedGameCount = ROUND_GAME_COUNTS[round];
      const roundGames = getGamesByRound(round);
      if (roundGames.length < expectedGameCount) {
        await fetchGamesForRound(round);
        await loadGames();
      }
      const roundGamesAfterFetch = getGamesByRound(round);
      const roundGamesWithoutIds = roundGamesAfterFetch.filter(g => !g.id);
      if (roundGamesWithoutIds.length > 0) gamesNeedingIds.push(...roundGamesWithoutIds);
    }
    if (gamesNeedingIds.length === 0) {
      toast({ title: 'Info', description: 'All expected playoff games already have IDs assigned.' });
      return;
    }
    await fetchGameIdsForGamesWithoutIds(gamesNeedingIds);
  };

  const handleSaveTeam = async () => {
    if (!editingTeam) return;
    if (!editingTeam.id) {
      const conferenceTeams = teams.filter(t => t.conference === editingTeam.conference);
      if (conferenceTeams.length >= 7) {
        toast({ title: 'Error', description: `Maximum of 7 teams allowed per conference.`, variant: 'destructive' });
        return;
      }
      const existingTeamWithSeed = teams.find(t => t.conference === editingTeam.conference && t.seed === editingTeam.seed && t.id !== editingTeam.id);
      if (existingTeamWithSeed) {
        toast({ title: 'Error', description: `Seed #${editingTeam.seed} is already assigned to ${existingTeamWithSeed.team_name} in ${editingTeam.conference}.`, variant: 'destructive' });
        return;
      }
    } else {
      const originalTeam = teams.find(t => t.id === editingTeam.id);
      if (originalTeam && originalTeam.conference !== editingTeam.conference) {
        const targetConferenceTeams = teams.filter(t => t.conference === editingTeam.conference && t.id !== editingTeam.id);
        if (targetConferenceTeams.length >= 7) {
          toast({ title: 'Error', description: `Cannot move team to ${editingTeam.conference}. Maximum of 7 teams allowed.`, variant: 'destructive' });
          return;
        }
      }
      const existingTeamWithSeed = teams.find(t => t.conference === editingTeam.conference && t.seed === editingTeam.seed && t.id !== editingTeam.id);
      if (existingTeamWithSeed) {
        toast({ title: 'Error', description: `Seed #${editingTeam.seed} is already assigned to ${existingTeamWithSeed.team_name}.`, variant: 'destructive' });
        return;
      }
    }

    try {
      const response = await fetch('/api/admin/playoff-teams', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ season, teams: [editingTeam] })
      });
      const data = await response.json();
      if (data.success) {
        toast({ title: 'Success', description: 'Playoff team saved successfully' });
        setTeamDialogOpen(false);
        setEditingTeam(null);
        await loadTeams();
      } else {
        toast({ title: 'Error', description: data.error || 'Failed to save playoff team', variant: 'destructive' });
      }
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to save playoff team', variant: 'destructive' });
    }
  };

  const handleDeleteTeam = async (team: PlayoffTeam) => {
    if (!team.id || !confirm(`Are you sure you want to delete ${team.team_name}?`)) return;
    try {
      const response = await fetch(`/api/admin/playoff-teams?id=${team.id}`, { method: 'DELETE' });
      const data = await response.json();
      if (data.success) {
        toast({ title: 'Success', description: 'Playoff team deleted successfully' });
        await loadTeams();
      } else {
        toast({ title: 'Error', description: data.error || 'Failed to delete playoff team', variant: 'destructive' });
      }
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to delete playoff team', variant: 'destructive' });
    }
  };

  const handleSaveGame = async () => {
    if (!editingGame) return;
    const expectedGames = ROUND_GAME_COUNTS[editingGame.week];
    const currentGamesForRound = getGamesByRound(editingGame.week);
    const willExceed = !editingGame.id && currentGamesForRound.length >= expectedGames;
    if (willExceed && !confirm(`Warning: ${ROUND_NAMES[editingGame.week]} should have ${expectedGames} game(s), but you're adding a ${currentGamesForRound.length + 1}th game. Continue anyway?`)) return;

    const idChanged = originalGameId && editingGame.id && originalGameId !== editingGame.id;
    if (idChanged && editingGame.id) {
      if (games.find(g => g.id === editingGame.id)) {
        toast({ title: 'Error', description: `A game with ID "${editingGame.id}" already exists.`, variant: 'destructive' });
        return;
      }
    }

    try {
      if (idChanged && originalGameId) {
        const deleteResponse = await fetch(`/api/admin/playoff-games?id=${originalGameId}`, { method: 'DELETE' });
        if (!deleteResponse.ok) {
          const deleteData = await deleteResponse.json();
          toast({ title: 'Error', description: deleteData.error || 'Failed to delete old game', variant: 'destructive' });
          return;
        }
      }
      const response = await fetch('/api/admin/playoff-games', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ season, games: [editingGame] })
      });
      const data = await response.json();
      if (data.success) {
        toast({ title: 'Success', description: idChanged ? 'Playoff game ID updated successfully' : 'Playoff game saved successfully' });
        setGameDialogOpen(false);
        setEditingGame(null);
        setOriginalGameId(undefined);
        await loadGames();
      } else {
        toast({ title: 'Error', description: data.error || 'Failed to save playoff game', variant: 'destructive' });
      }
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to save playoff game', variant: 'destructive' });
    }
  };

  const handleDeleteGame = async (game: PlayoffGame) => {
    if (!game.id || !confirm('Are you sure you want to delete this game?')) return;
    try {
      const response = await fetch(`/api/admin/playoff-games?id=${game.id}`, { method: 'DELETE' });
      const data = await response.json();
      if (data.success) {
        toast({ title: 'Success', description: 'Playoff game deleted successfully' });
        await loadGames();
      } else {
        toast({ title: 'Error', description: data.error || 'Failed to delete playoff game', variant: 'destructive' });
      }
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to delete playoff game', variant: 'destructive' });
    }
  };

  const openTeamDialog = (team?: PlayoffTeam | { isPlaceholder: true; seed: number; conference: string }) => {
    if (team && 'isPlaceholder' in team) {
      setEditingTeam({ season, team_name: '', team_abbreviation: null, conference: team.conference, seed: team.seed });
      setSelectedConference(team.conference as 'AFC' | 'NFC');
    } else if (team) {
      setEditingTeam({ ...team });
      setSelectedConference(team.conference as 'AFC' | 'NFC');
    } else {
      setEditingTeam({ season, team_name: '', team_abbreviation: null, conference: selectedConference, seed: 1 });
    }
    setTeamDialogOpen(true);
  };

  const openGameDialog = (game?: PlayoffGame) => {
    if (game) {
      setEditingGame({ ...game });
      setOriginalGameId(game.id);
      setSelectedRound(game.week);
    } else {
      setEditingGame({ season, week: selectedRound, away_team: '', home_team: '', status: 'scheduled', winner: null });
      setOriginalGameId(undefined);
    }
    setGameDialogOpen(true);
  };

  const getTeamsByConference = (conference: string) => teams.filter(t => t.conference === conference).sort((a, b) => a.seed - b.seed);

  const getTeamsWithPlaceholders = (conference: string) => {
    const existingTeams = getTeamsByConference(conference);
    const result: (PlayoffTeam | { isPlaceholder: true; seed: number; conference: string })[] = [];
    for (let seed = 1; seed <= 7; seed++) {
      const team = existingTeams.find(t => t.seed === seed);
      result.push(team ?? { isPlaceholder: true, seed, conference });
    }
    return result;
  };

  const getGamesByRound = (round: number) => games.filter(g => g.week === round);

  const getAvailableTeams = () => {
    const assignedTeamNames = new Set(teams.filter(t => t.id !== editingTeam?.id).map(t => t.team_name));
    return NFL_TEAMS.filter(t => t.conference === selectedConference && (!assignedTeamNames.has(t.name) || t.name === editingTeam?.team_name));
  };

  const toLocalDateTimeInput = (utcString: string) => {
    const date = new Date(utcString);
    const pad = (n: number) => n.toString().padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
  };

  const availableTeams = getAvailableTeams();

  const navBtnStyle = {
    display: 'flex', alignItems: 'center', gap: '0.35rem',
    padding: '0.35rem 0.6rem',
    background: 'transparent' as const, color: textMid,
    border: `1px solid ${border}`, borderRadius: 5,
    ...bc, fontWeight: 600, fontSize: '0.72rem',
    letterSpacing: '0.07em', textTransform: 'uppercase' as const,
    cursor: 'pointer',
  };

  if (checkingAccess || loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: bg }}>
        <div style={{ textAlign: 'center' }}>
          <RefreshCw style={{ width: 32, height: 32, color: textDim, margin: '0 auto 0.75rem', animation: 'spin 1s linear infinite' }} />
          <p style={{ ...b, color: textMid, fontSize: '0.9rem' }}>Verifying access…</p>
        </div>
      </div>
    );
  }

  if (!isSuperAdmin) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: bg }}>
        <div style={{ textAlign: 'center' }}>
          <Shield style={{ width: 48, height: 48, color: liveRed, margin: '0 auto 1rem' }} />
          <h1 style={{ ...bc, fontWeight: 900, fontSize: '1.5rem', color: text, textTransform: 'uppercase', marginBottom: '0.5rem' }}>Access Denied</h1>
          <p style={{ ...b, fontSize: '0.875rem', color: textMid, marginBottom: '1.25rem' }}>This page is only accessible to system administrators.</p>
          <button onClick={() => router.push('/admin/dashboard')} style={{ ...navBtnStyle, padding: '0.5rem 1rem', border: `1px solid ${green}`, color: greenHi }}>
            Go to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ background: bg, minHeight: '100vh' }}>

      {/* ── NAV ── */}
      <nav style={{
        position: 'sticky', top: 0, zIndex: 50,
        background: 'oklch(13% 0.025 255 / 0.95)',
        backdropFilter: 'blur(14px)',
        borderBottom: `1px solid ${border}`,
      }}>
        <div className="lp-inner" style={{ paddingTop: '0.75rem', paddingBottom: '0.75rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <button onClick={() => router.push('/admin/dashboard')} style={navBtnStyle}>
                <ArrowLeft style={{ width: 12, height: 12 }} /> Dashboard
              </button>
              <div style={{ width: 1, height: 20, background: border }} />
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <div style={{ width: 30, height: 30, borderRadius: '50%', background: green, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Trophy style={{ width: 14, height: 14, color: text }} />
                </div>
                <span style={{ ...bc, fontWeight: 800, fontSize: '0.92rem', letterSpacing: '0.07em', color: text, textTransform: 'uppercase' }}>
                  Playoff Management
                </span>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{ ...bc, fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.07em', color: textDim, textTransform: 'uppercase' }}>Season:</span>
              <Input
                type="number"
                value={season}
                onChange={(e) => setSeason(parseInt(e.target.value) || getNFLSeasonYear())}
                style={{ background: card, border: `1px solid ${border}`, color: text, ...b, fontSize: '0.85rem', width: 90 }}
              />
              <button onClick={() => { loadTeams(); loadGames(); }} style={navBtnStyle}>
                <RefreshCw style={{ width: 11, height: 11 }} />
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* ── HERO ── */}
      <section style={{
        background: bg,
        backgroundImage: `repeating-linear-gradient(0deg, transparent, transparent 59px, oklch(100% 0 0 / 0.022) 59px, oklch(100% 0 0 / 0.022) 60px)`,
        padding: 'clamp(2.5rem, 5vw, 4rem) 0',
      }}>
        <div className="lp-inner">
          <p style={{ ...bc, fontWeight: 700, fontSize: '0.65rem', letterSpacing: '0.26em', color: greenHi, textTransform: 'uppercase', marginBottom: '0.6rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ display: 'inline-block', width: 18, height: 2, background: greenHi, borderRadius: 1 }} />
            {season} Season
          </p>
          <h1 style={{ ...bc, fontWeight: 900, fontSize: 'clamp(2rem, 5vw, 3rem)', lineHeight: 0.95, color: text, textTransform: 'uppercase', marginBottom: '0.75rem' }}>
            Playoff<br /><span style={{ color: gold }}>Management</span>
          </h1>
          <p style={{ ...b, fontSize: '0.9rem', color: textMid, maxWidth: '44ch' }}>
            Manage playoff teams, seedings, and game matchups for all rounds.
          </p>
        </div>
      </section>

      {/* ── green rule ── */}
      <div style={{ height: 2, background: `linear-gradient(90deg, transparent, ${green}, transparent)` }} />

      {/* ── TABS ── */}
      <section style={{ background: surface, borderBottom: `1px solid ${border}` }}>
        <div className="lp-inner">
          <div style={{ display: 'flex', gap: '0.25rem', paddingTop: '0.5rem' }}>
            {(['teams', 'games'] as const).map((tab) => {
              const active = activeTab === tab;
              return (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  style={{
                    padding: '0.5rem 1.1rem',
                    background: active ? green : 'transparent',
                    color: active ? text : textMid,
                    border: `1px solid ${active ? green : 'transparent'}`,
                    borderRadius: '6px 6px 0 0',
                    ...bc, fontWeight: 700, fontSize: '0.78rem',
                    letterSpacing: '0.07em', textTransform: 'uppercase',
                    cursor: 'pointer', marginBottom: -1,
                  }}
                >
                  {tab === 'teams' ? 'Playoff Teams' : 'Playoff Games'}
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── CONTENT ── */}
      <section style={{ background: bg, padding: '2.5rem 0' }}>
        <div className="lp-inner">

          {/* ── TEAMS TAB ── */}
          {activeTab === 'teams' && (
            <div style={{
              background: card, border: `1px solid ${border}`,
              borderLeft: `3px solid ${green}`, borderRadius: 8, overflow: 'hidden',
            }}>
              {/* Header */}
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '1rem 1.25rem', background: surface, borderBottom: `1px solid ${border}`,
                flexWrap: 'wrap', gap: '0.75rem',
              }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Trophy style={{ width: 15, height: 15, color: gold }} />
                    <span style={{ ...bc, fontWeight: 700, fontSize: '0.88rem', letterSpacing: '0.07em', color: text, textTransform: 'uppercase' }}>Playoff Teams</span>
                  </div>
                  <p style={{ ...b, fontSize: '0.75rem', color: textDim, marginTop: '0.2rem' }}>Manage playoff team seeds and conferences</p>
                </div>
                <button
                  onClick={() => openTeamDialog()}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '0.4rem',
                    padding: '0.45rem 0.9rem',
                    background: green, color: text,
                    border: 'none', borderRadius: 6,
                    ...bc, fontWeight: 700, fontSize: '0.78rem',
                    letterSpacing: '0.07em', textTransform: 'uppercase', cursor: 'pointer',
                  }}
                >
                  <Plus style={{ width: 13, height: 13 }} /> Add Team
                </button>
              </div>

              {/* Conference tables */}
              <div style={{ padding: '1.25rem' }}>
                <div className="admin-2col-grid" style={{ marginBottom: 0 }}>
                  {(['AFC', 'NFC'] as const).map((conference) => {
                    const confColor = conference === 'AFC' ? afcRed : nfcBlue;
                    const confTeams = getTeamsByConference(conference);
                    return (
                      <div key={conference} style={{ background: surface, border: `1px solid ${border}`, borderRadius: 8, overflow: 'hidden' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.75rem 1rem', borderBottom: `1px solid ${border}` }}>
                          <span style={{ ...bc, fontWeight: 900, fontSize: '1rem', color: confColor, letterSpacing: '0.08em' }}>{conference}</span>
                          <span style={{
                            ...bc, fontWeight: 700, fontSize: '0.62rem', letterSpacing: '0.07em',
                            padding: '0.1rem 0.45rem', borderRadius: 4, textTransform: 'uppercase',
                            background: confTeams.length >= 7 ? 'oklch(46% 0.14 155 / 0.2)' : 'oklch(72% 0.16 60 / 0.15)',
                            color: confTeams.length >= 7 ? greenHi : amber,
                          }}>
                            {confTeams.length} / 7 teams
                          </span>
                        </div>
                        <div style={{ overflowX: 'auto' }}>
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Seed</TableHead>
                                <TableHead>Team</TableHead>
                                <TableHead style={{ textAlign: 'right' }}>Actions</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {getTeamsWithPlaceholders(conference).map((team) => {
                                if ('isPlaceholder' in team) {
                                  return (
                                    <TableRow key={`ph-${team.conference}-${team.seed}`} style={{ cursor: 'pointer' }} onClick={() => openTeamDialog(team)}>
                                      <TableCell style={{ color: textDim }}>#{team.seed}</TableCell>
                                      <TableCell style={{ color: textDim, fontStyle: 'italic' }}>Click to add team</TableCell>
                                      <TableCell style={{ textAlign: 'right' }}>
                                        <button onClick={(e) => { e.stopPropagation(); openTeamDialog(team); }} style={{ background: 'transparent', border: 'none', color: textDim, cursor: 'pointer', padding: '0.25rem' }}>
                                          <Plus style={{ width: 14, height: 14 }} />
                                        </button>
                                      </TableCell>
                                    </TableRow>
                                  );
                                }
                                return (
                                  <TableRow key={team.id || `${team.conference}-${team.seed}`}>
                                    <TableCell style={{ fontWeight: 600, color: textMid }}>#{team.seed}</TableCell>
                                    <TableCell style={{ color: text }}>{team.team_name}</TableCell>
                                    <TableCell style={{ textAlign: 'right' }}>
                                      <button onClick={() => openTeamDialog(team)} style={{ background: 'transparent', border: 'none', color: textDim, cursor: 'pointer', padding: '0.25rem' }}>
                                        <Edit style={{ width: 14, height: 14 }} />
                                      </button>
                                      <button onClick={() => handleDeleteTeam(team)} style={{ background: 'transparent', border: 'none', color: liveRed, cursor: 'pointer', padding: '0.25rem' }}>
                                        <Trash2 style={{ width: 14, height: 14 }} />
                                      </button>
                                    </TableCell>
                                  </TableRow>
                                );
                              })}
                            </TableBody>
                          </Table>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* ── GAMES TAB ── */}
          {activeTab === 'games' && (
            <div style={{
              background: card, border: `1px solid ${border}`,
              borderLeft: `3px solid ${green}`, borderRadius: 8, overflow: 'hidden',
            }}>
              {/* Header */}
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '1rem 1.25rem', background: surface, borderBottom: `1px solid ${border}`,
                flexWrap: 'wrap', gap: '0.75rem',
              }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Trophy style={{ width: 15, height: 15, color: gold }} />
                    <span style={{ ...bc, fontWeight: 700, fontSize: '0.88rem', letterSpacing: '0.07em', color: text, textTransform: 'uppercase' }}>Playoff Games</span>
                  </div>
                  <p style={{ ...b, fontSize: '0.75rem', color: textDim, marginTop: '0.2rem' }}>Manage playoff game matchups by round</p>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                  <button
                    onClick={handleFetchAllGameIds}
                    disabled={fetchingGameIds}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '0.4rem',
                      padding: '0.45rem 0.9rem',
                      background: 'transparent', color: fetchingGameIds ? textDim : textMid,
                      border: `1px solid ${border}`, borderRadius: 6,
                      ...bc, fontWeight: 700, fontSize: '0.75rem',
                      letterSpacing: '0.07em', textTransform: 'uppercase',
                      cursor: fetchingGameIds ? 'not-allowed' : 'pointer',
                    }}
                  >
                    <RefreshCw style={{ width: 12, height: 12, animation: fetchingGameIds ? 'spin 1s linear infinite' : 'none' }} />
                    {fetchingGameIds ? 'Fetching IDs…' : 'Fetch Missing Game IDs'}
                  </button>
                  <button
                    onClick={() => openGameDialog()}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '0.4rem',
                      padding: '0.45rem 0.9rem',
                      background: green, color: text,
                      border: 'none', borderRadius: 6,
                      ...bc, fontWeight: 700, fontSize: '0.78rem',
                      letterSpacing: '0.07em', textTransform: 'uppercase', cursor: 'pointer',
                    }}
                  >
                    <Plus style={{ width: 13, height: 13 }} /> Add Game
                  </button>
                </div>
              </div>

              {/* Rounds */}
              <div style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                {[1, 2, 3, 4].map(round => {
                  const roundGames = getGamesByRound(round);
                  const expectedGames = ROUND_GAME_COUNTS[round];
                  const hasCorrectCount = roundGames.length === expectedGames;
                  return (
                    <div key={round} style={{
                      background: surface, border: `1px solid ${border}`,
                      borderRadius: 8, overflow: 'hidden',
                    }}>
                      <div style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        padding: '0.75rem 1rem', borderBottom: `1px solid ${border}`,
                        flexWrap: 'wrap', gap: '0.5rem',
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <span style={{ ...bc, fontWeight: 800, fontSize: '0.88rem', color: text, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                            {ROUND_NAMES[round]}
                          </span>
                          <span style={{ ...b, fontSize: '0.72rem', color: textDim }}>Week {round}</span>
                          {!hasCorrectCount && <AlertCircle style={{ width: 14, height: 14, color: amber }} />}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <span style={{
                            ...bc, fontWeight: 700, fontSize: '0.62rem', letterSpacing: '0.07em',
                            padding: '0.12rem 0.45rem', borderRadius: 4, textTransform: 'uppercase',
                            background: hasCorrectCount ? 'oklch(46% 0.14 155 / 0.2)' : 'oklch(72% 0.16 60 / 0.15)',
                            color: hasCorrectCount ? greenHi : amber,
                          }}>
                            {roundGames.length} / {expectedGames} games
                          </span>
                          <button
                            onClick={() => fetchGamesForRound(round)}
                            disabled={fetchingRoundGames === round}
                            style={{
                              display: 'flex', alignItems: 'center', gap: '0.3rem',
                              padding: '0.3rem 0.65rem',
                              background: 'transparent', color: textDim,
                              border: `1px solid ${border}`, borderRadius: 5,
                              ...bc, fontWeight: 600, fontSize: '0.68rem',
                              letterSpacing: '0.07em', textTransform: 'uppercase',
                              cursor: fetchingRoundGames === round ? 'not-allowed' : 'pointer',
                            }}
                          >
                            <RefreshCw style={{ width: 11, height: 11, animation: fetchingRoundGames === round ? 'spin 1s linear infinite' : 'none' }} />
                            {fetchingRoundGames === round ? 'Fetching…' : 'Fetch Games'}
                          </button>
                        </div>
                      </div>

                      {roundGames.length > 0 ? (
                        <div style={{ overflowX: 'auto', width: '100%' }}>
                          <Table style={{ width: 'max-content', minWidth: '100%' }}>
                            <TableHeader>
                              <TableRow>
                                <TableHead style={{ minWidth: '9rem', whiteSpace: 'nowrap' }}>Game ID</TableHead>
                                <TableHead style={{ minWidth: '8rem', whiteSpace: 'nowrap' }}>Home Team</TableHead>
                                <TableHead style={{ minWidth: '8rem', whiteSpace: 'nowrap' }}>Away Team</TableHead>
                                <TableHead style={{ minWidth: '8rem', whiteSpace: 'nowrap' }}>Kickoff</TableHead>
                                <TableHead style={{ minWidth: '6rem', whiteSpace: 'nowrap' }}>Status</TableHead>
                                <TableHead style={{ minWidth: '6rem', whiteSpace: 'nowrap' }}>Winner</TableHead>
                                <TableHead style={{ textAlign: 'right', minWidth: '6rem', whiteSpace: 'nowrap' }}>Actions</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {roundGames.map((game) => (
                                <TableRow key={game.id}>
                                  <TableCell>
                                    <code style={{ fontSize: '0.7rem', background: border, padding: '0.15rem 0.4rem', borderRadius: 3, wordBreak: 'break-all' }}>
                                      {game.id || 'No ID'}
                                    </code>
                                  </TableCell>
                                  <TableCell style={{ color: text }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                      {teamSeeds[game.home_team] && (
                                        <span style={{ ...bc, fontWeight: 700, fontSize: '0.62rem', color: textDim }}>#{teamSeeds[game.home_team]}</span>
                                      )}
                                      {game.home_team}
                                    </div>
                                  </TableCell>
                                  <TableCell style={{ color: text }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                      {teamSeeds[game.away_team] && (
                                        <span style={{ ...bc, fontWeight: 700, fontSize: '0.62rem', color: textDim }}>#{teamSeeds[game.away_team]}</span>
                                      )}
                                      {game.away_team}
                                    </div>
                                  </TableCell>
                                  <TableCell style={{ color: textMid, whiteSpace: 'nowrap', fontSize: '0.8rem' }}>
                                    {game.kickoff_time ? new Date(game.kickoff_time).toLocaleString() : 'TBD'}
                                  </TableCell>
                                  <TableCell>
                                    <span style={{
                                      ...bc, fontWeight: 700, fontSize: '0.62rem', letterSpacing: '0.07em',
                                      padding: '0.12rem 0.4rem', borderRadius: 4, textTransform: 'uppercase',
                                      background: game.status === 'final' ? 'oklch(46% 0.14 155 / 0.2)' : 'oklch(26% 0.03 255)',
                                      color: game.status === 'final' ? greenHi : textDim,
                                    }}>
                                      {game.status ? game.status.charAt(0).toUpperCase() + game.status.slice(1) : 'Scheduled'}
                                    </span>
                                  </TableCell>
                                  <TableCell style={{ color: textMid, fontSize: '0.8rem' }}>{game.winner || '—'}</TableCell>
                                  <TableCell style={{ textAlign: 'right' }}>
                                    <button onClick={() => { setSelectedRound(round); openGameDialog(game); }} style={{ background: 'transparent', border: 'none', color: textDim, cursor: 'pointer', padding: '0.25rem' }}>
                                      <Edit style={{ width: 14, height: 14 }} />
                                    </button>
                                    <button onClick={() => handleDeleteGame(game)} style={{ background: 'transparent', border: 'none', color: liveRed, cursor: 'pointer', padding: '0.25rem' }}>
                                      <Trash2 style={{ width: 14, height: 14 }} />
                                    </button>
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      ) : (
                        <p style={{ ...b, fontSize: '0.875rem', color: textDim, textAlign: 'center', padding: '1.5rem' }}>
                          No games scheduled for this round
                        </p>
                      )}

                      {!hasCorrectCount && (
                        <div style={{ margin: '0.75rem', padding: '0.75rem', background: 'oklch(72% 0.16 60 / 0.1)', border: `1px solid oklch(72% 0.16 60 / 0.3)`, borderRadius: 6 }}>
                          <p style={{ ...b, fontSize: '0.78rem', color: amber }}>
                            <strong>Expected:</strong> {expectedGames} game(s) for this round. Currently have {roundGames.length}.
                          </p>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </section>

      {/* ── FOOTER ── */}
      <Footer pageName="Commissioner HQ" />

      {/* ── TEAM DIALOG ── */}
      <Dialog open={teamDialogOpen} onOpenChange={setTeamDialogOpen}>
        <DialogContent style={{ maxWidth: '28rem', width: 'calc(100vw - 2rem)' }}>
          <DialogHeader>
            <DialogTitle>{editingTeam?.id ? 'Edit' : 'Add'} Playoff Team</DialogTitle>
            <DialogDescription>Configure team seed and conference</DialogDescription>
          </DialogHeader>
          {editingTeam && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{ ...bc, fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.08em', color: textDim, textTransform: 'uppercase', display: 'block', marginBottom: '0.4rem' }}>Conference</label>
                <Select value={editingTeam.conference} onValueChange={(v) => { setEditingTeam({ ...editingTeam, conference: v }); setSelectedConference(v as 'AFC' | 'NFC'); }}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="AFC">AFC</SelectItem>
                    <SelectItem value="NFC">NFC</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label style={{ ...bc, fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.08em', color: textDim, textTransform: 'uppercase', display: 'block', marginBottom: '0.4rem' }}>Seed (1-7)</label>
                <Select value={editingTeam.seed.toString()} onValueChange={(v) => setEditingTeam({ ...editingTeam, seed: parseInt(v) })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {[1,2,3,4,5,6,7].map(n => <SelectItem key={n} value={n.toString()}>{n}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label style={{ ...bc, fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.08em', color: textDim, textTransform: 'uppercase', display: 'block', marginBottom: '0.4rem' }}>Team</label>
                <Select value={editingTeam.team_name} onValueChange={(v) => {
                  const team = availableTeams.find(t => t.name === v);
                  setEditingTeam({ ...editingTeam, team_name: v, team_abbreviation: team?.abbreviation || null, conference: team?.conference || editingTeam.conference });
                }}>
                  <SelectTrigger><SelectValue placeholder="Select team" /></SelectTrigger>
                  <SelectContent>
                    {availableTeams.map(team => <SelectItem key={team.name} value={team.name}>{team.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', paddingTop: '0.5rem' }}>
                <button onClick={() => setTeamDialogOpen(false)} style={{ ...navBtnStyle, padding: '0.45rem 0.9rem' }}>
                  <X style={{ width: 12, height: 12 }} /> Cancel
                </button>
                <button onClick={handleSaveTeam} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.45rem 0.9rem', background: green, color: text, border: 'none', borderRadius: 6, ...bc, fontWeight: 700, fontSize: '0.78rem', letterSpacing: '0.07em', textTransform: 'uppercase', cursor: 'pointer' }}>
                  <Save style={{ width: 12, height: 12 }} /> Save
                </button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ── GAME DIALOG ── */}
      <Dialog open={gameDialogOpen} onOpenChange={setGameDialogOpen}>
        <DialogContent style={{ maxWidth: '28rem', width: 'calc(100vw - 2rem)', maxHeight: '90vh', overflowY: 'auto' }}>
          <DialogHeader>
            <DialogTitle>{editingGame?.id ? 'Edit' : 'Add'} Playoff Game</DialogTitle>
            <DialogDescription>
              Configure game matchup
              {editingGame && !editingGame.id && (
                <span style={{ display: 'block', marginTop: '0.25rem', fontSize: '0.72rem' }}>
                  Expected games for {ROUND_NAMES[editingGame.week]}: {ROUND_GAME_COUNTS[editingGame.week]}
                </span>
              )}
            </DialogDescription>
          </DialogHeader>
          {editingGame && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {[
                { label: 'Game ID', field: 'id', type: 'text', placeholder: 'Enter game ID (e.g., ESPN ID)' },
              ].map(({ label, field, type, placeholder }) => (
                <div key={field}>
                  <label style={{ ...bc, fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.08em', color: textDim, textTransform: 'uppercase', display: 'block', marginBottom: '0.4rem' }}>{label}</label>
                  <Input type={type} value={(editingGame as any)[field] || ''} onChange={(e) => setEditingGame({ ...editingGame, [field]: e.target.value || undefined })} placeholder={placeholder} />
                  {field === 'id' && <p style={{ ...b, fontSize: '0.72rem', color: textDim, marginTop: '0.25rem' }}>{editingGame.id ? 'Current ID: ' + editingGame.id : 'Leave empty to auto-generate or fetch from ESPN'}</p>}
                </div>
              ))}
              <div>
                <label style={{ ...bc, fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.08em', color: textDim, textTransform: 'uppercase', display: 'block', marginBottom: '0.4rem' }}>Round</label>
                <Select value={editingGame.week.toString()} onValueChange={(v) => { setEditingGame({ ...editingGame, week: parseInt(v) }); setSelectedRound(parseInt(v)); }}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(ROUND_NAMES).map(([week, name]) => <SelectItem key={week} value={week}>{name} (Week {week})</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label style={{ ...bc, fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.08em', color: textDim, textTransform: 'uppercase', display: 'block', marginBottom: '0.4rem' }}>Away Team</label>
                <Select value={editingGame.away_team} onValueChange={(v) => setEditingGame({ ...editingGame, away_team: v })}>
                  <SelectTrigger><SelectValue placeholder="Select away team" /></SelectTrigger>
                  <SelectContent>{NFL_TEAMS.map(t => <SelectItem key={t.name} value={t.name}>{t.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <label style={{ ...bc, fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.08em', color: textDim, textTransform: 'uppercase', display: 'block', marginBottom: '0.4rem' }}>Home Team</label>
                <Select value={editingGame.home_team} onValueChange={(v) => setEditingGame({ ...editingGame, home_team: v })}>
                  <SelectTrigger><SelectValue placeholder="Select home team" /></SelectTrigger>
                  <SelectContent>{NFL_TEAMS.map(t => <SelectItem key={t.name} value={t.name}>{t.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <label style={{ ...bc, fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.08em', color: textDim, textTransform: 'uppercase', display: 'block', marginBottom: '0.4rem' }}>Kickoff Time</label>
                <Input type="datetime-local" value={editingGame.kickoff_time ? toLocalDateTimeInput(editingGame.kickoff_time) : ''} onChange={(e) => setEditingGame({ ...editingGame, kickoff_time: e.target.value })} />
              </div>
              <div>
                <label style={{ ...bc, fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.08em', color: textDim, textTransform: 'uppercase', display: 'block', marginBottom: '0.4rem' }}>Status</label>
                <Select value={editingGame.status ? editingGame.status.charAt(0).toUpperCase() + editingGame.status.slice(1) : 'Scheduled'} onValueChange={(v) => setEditingGame({ ...editingGame, status: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
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
                  <label style={{ ...bc, fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.08em', color: textDim, textTransform: 'uppercase', display: 'block', marginBottom: '0.4rem' }}>Winner</label>
                  <Select value={editingGame.winner || ''} onValueChange={(v) => setEditingGame({ ...editingGame, winner: v || null })}>
                    <SelectTrigger><SelectValue placeholder="Select winner" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">No winner</SelectItem>
                      <SelectItem value={editingGame.away_team}>{editingGame.away_team}</SelectItem>
                      <SelectItem value={editingGame.home_team}>{editingGame.home_team}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', paddingTop: '0.5rem' }}>
                <button onClick={() => setGameDialogOpen(false)} style={{ ...navBtnStyle, padding: '0.45rem 0.9rem' }}>
                  <X style={{ width: 12, height: 12 }} /> Cancel
                </button>
                <button onClick={handleSaveGame} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.45rem 0.9rem', background: green, color: text, border: 'none', borderRadius: 6, ...bc, fontWeight: 700, fontSize: '0.78rem', letterSpacing: '0.07em', textTransform: 'uppercase', cursor: 'pointer' }}>
                  <Save style={{ width: 12, height: 12 }} /> Save
                </button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ── RESULT DIALOG ── */}
      <Dialog open={resultDialogOpen} onOpenChange={setResultDialogOpen}>
        <DialogContent style={{ maxWidth: '28rem', width: 'calc(100vw - 2rem)' }}>
          <DialogHeader>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              {resultDialogType === 'success'
                ? <CheckCircle style={{ width: 22, height: 22, color: greenHi }} />
                : <AlertTriangle style={{ width: 22, height: 22, color: liveRed }} />
              }
              <DialogTitle>{resultDialogTitle}</DialogTitle>
            </div>
          </DialogHeader>
          <DialogDescription style={{ fontSize: '0.9rem', paddingTop: '0.5rem' }}>{resultDialogDescription}</DialogDescription>
          <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: '1rem' }}>
            <button onClick={() => setResultDialogOpen(false)} style={{ padding: '0.45rem 1rem', background: green, color: text, border: 'none', borderRadius: 6, ...bc, fontWeight: 700, fontSize: '0.78rem', letterSpacing: '0.07em', textTransform: 'uppercase', cursor: 'pointer' }}>
              OK
            </button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── CONFIRM DIALOG ── */}
      <Dialog open={confirmDialogOpen} onOpenChange={setConfirmDialogOpen}>
        <DialogContent style={{ maxWidth: '64rem', width: 'calc(100vw - 1rem)', maxHeight: '90vh', overflowY: 'auto', padding: '1.5rem' }}>
          <DialogHeader>
            <DialogTitle>Review Games Before Saving</DialogTitle>
            <DialogDescription>
              Please review the {pendingGames.length} game(s) that will be created for {pendingRound ? ROUND_NAMES[pendingRound] : 'this round'}.
              Click &quot;Confirm &amp; Save&quot; to add them to the database, or &quot;Cancel&quot; to discard.
            </DialogDescription>
          </DialogHeader>

          <div style={{ paddingTop: '1rem', paddingBottom: '1rem' }}>
            {pendingGames.length > 0 && (
              <div style={{ overflowX: 'auto', borderRadius: 6, border: `1px solid ${border}` }}>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Game ID</TableHead>
                      <TableHead>Away Team</TableHead>
                      <TableHead>Home Team</TableHead>
                      <TableHead>Kickoff Time</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pendingGames.map((game, index) => (
                      <TableRow key={game.id || `pending-${index}`}>
                        <TableCell>
                          <code style={{ fontSize: '0.7rem', background: border, padding: '0.15rem 0.4rem', borderRadius: 3, wordBreak: 'break-all' }}>
                            {game.id || 'No ID'}
                          </code>
                        </TableCell>
                        <TableCell style={{ color: game.away_team === 'TBD' ? textDim : text, fontStyle: game.away_team === 'TBD' ? 'italic' : 'normal' }}>
                          {game.away_team || 'TBD'}
                        </TableCell>
                        <TableCell style={{ color: game.home_team === 'TBD' ? textDim : text, fontStyle: game.home_team === 'TBD' ? 'italic' : 'normal' }}>
                          {game.home_team || 'TBD'}
                        </TableCell>
                        <TableCell style={{ color: textMid, whiteSpace: 'nowrap', fontSize: '0.8rem' }}>
                          {game.kickoff_time ? new Date(game.kickoff_time).toLocaleString() : 'TBD'}
                        </TableCell>
                        <TableCell>
                          <span style={{ ...bc, fontWeight: 700, fontSize: '0.62rem', letterSpacing: '0.07em', padding: '0.12rem 0.4rem', borderRadius: 4, textTransform: 'uppercase', background: 'oklch(26% 0.03 255)', color: textDim }}>
                            {game.status ? game.status.charAt(0).toUpperCase() + game.status.slice(1) : 'Scheduled'}
                          </span>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}

            <div style={{ marginTop: '1rem', padding: '0.75rem 1rem', background: 'oklch(46% 0.14 155 / 0.07)', border: `1px solid oklch(46% 0.14 155 / 0.25)`, borderRadius: 6 }}>
              <p style={{ ...b, fontSize: '0.78rem', color: textMid }}>
                <strong>Note:</strong> Games with &quot;TBD&quot; teams are placeholders that will need to be updated once the actual matchups are determined.
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', paddingTop: '0.75rem', borderTop: `1px solid ${border}`, flexWrap: 'wrap' }}>
            <button
              onClick={() => { setConfirmDialogOpen(false); setPendingGames([]); setPendingRound(null); }}
              style={{ ...navBtnStyle, padding: '0.5rem 1rem' }}
            >
              <X style={{ width: 12, height: 12 }} /> Cancel
            </button>
            <button
              onClick={confirmSaveGames}
              style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.5rem 1rem', background: green, color: text, border: 'none', borderRadius: 6, ...bc, fontWeight: 700, fontSize: '0.78rem', letterSpacing: '0.07em', textTransform: 'uppercase', cursor: 'pointer' }}
            >
              <CheckCircle style={{ width: 13, height: 13 }} /> Confirm &amp; Save
            </button>
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
