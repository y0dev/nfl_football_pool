'use client';

import { useState, useEffect, useRef } from 'react';
import { useToast } from '@/hooks/use-toast';
import { submitPicks } from '@/actions/submitPicks';
import { loadWeekGames } from '@/actions/loadWeekGames';
import { isWeekUnlockedForPicks, getUpcomingWeek } from '@/actions/loadCurrentWeek';
import { computeWeekUnlockStatus } from '@/lib/week-unlock-status';
import { PickConfirmationDialog } from './pick-confirmation-dialog';
import { MondayNightScoreInput } from './monday-night-score-input';
import { userSessionManager } from '@/lib/user-session';
import { pickStorage } from '@/lib/pick-storage';
import { Clock, Save, AlertTriangle } from 'lucide-react';
import { Game, Pick, StoredPick, SelectedUser } from '@/types/game';
import { debugLog, DAYS_BEFORE_GAME, PERIOD_WEEKS, SUPER_BOWL_SEASON_TYPE, debugError, showDebugPanel, simulatePicksEnabled} from '@/lib/utils';
import { getPlayoffConfidencePoints } from '@/lib/playoff-utils';
import { GameCard } from '@/components/picks/game-card';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

// Design tokens
const surface = 'oklch(17% 0.028 255)';
const card    = 'oklch(20% 0.03 255)';
const border  = 'oklch(26% 0.03 255)';
const green   = 'oklch(46% 0.14 155)';
const greenHi = 'oklch(59% 0.15 155)';
const text    = 'oklch(95% 0.006 255)';
const textMid = 'oklch(72% 0.015 255)';
const textDim = 'oklch(50% 0.018 255)';
const amber   = 'oklch(72% 0.16 60)';
const purple  = 'oklch(65% 0.12 290)';
const liveRed = 'oklch(62% 0.22 25)';
const bc = { fontFamily: 'var(--font-barlow-condensed)' } as const;
const b  = { fontFamily: 'var(--font-barlow)' } as const;

interface WeeklyPickProps {
  poolId: string;
  weekNumber?: number;
  seasonType?: number;
  selectedUser?: SelectedUser;
  games?: Game[];
  preventGameLoading?: boolean;
  forceWeekUnlocked?: boolean;
  /** Already-known "current/upcoming week" result — when provided alongside
   * preventGameLoading+games, the unlock check is computed synchronously via
   * computeWeekUnlockStatus instead of an async isWeekUnlockedForPicks call. */
  upcomingWeek?: { week: number; seasonType: number };
  onPicksSubmitted?: () => void;
  onUserChangeRequested?: () => void;
}

export function WeeklyPick({ poolId, weekNumber, seasonType, selectedUser: propSelectedUser, games: propGames, preventGameLoading, forceWeekUnlocked: propForceWeekUnlocked, upcomingWeek, onPicksSubmitted, onUserChangeRequested }: WeeklyPickProps) {
  const [selectedUser, setSelectedUser] = useState<SelectedUser | null>(propSelectedUser || null);
  const [games, setGames] = useState<Game[]>(propGames || []);
  const [picks, setPicks] = useState<Pick[]>([]);
  const [currentWeek, setCurrentWeek] = useState<number>(1);
  const [isLoading, setIsLoading] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [showErrorDialog, setShowErrorDialog] = useState(false);
  const [submissionError, setSubmissionError] = useState<string>('');

  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  // null = not yet determined — must never be treated as "locked" by any
  // consumer below. Starts null (rather than false) so the UI shows a
  // neutral loading state instead of flashing the locked view before the
  // real status is known.
  const [isWeekUnlocked, setIsWeekUnlocked] = useState<boolean | null>(null);
  const [unlockTime, setUnlockTime] = useState<string>('');
  const [countdownToUnlock, setCountdownToUnlock] = useState<string>('');
  const devForceUnlockedRef = useRef(simulatePicksEnabled());
  const [, setDevForceUnlocked] = useState(devForceUnlockedRef.current);
  const [mondayNightScore, setMondayNightScore] = useState<number | null>(null);
  const [poolSeason, setPoolSeason] = useState<number | null>(null);
  const [, setPlayoffConfidencePoints] = useState<Record<string, number>>({});

  const { toast } = useToast();
  const errorsRef = useRef<HTMLDivElement>(null);

  // Sync forceWeekUnlocked prop into the ref so the checkWeekUnlocked effect respects it
  useEffect(() => {
    if (propForceWeekUnlocked !== undefined) {
      devForceUnlockedRef.current = propForceWeekUnlocked;
      setDevForceUnlocked(propForceWeekUnlocked);
      setIsWeekUnlocked(propForceWeekUnlocked);
    }
  }, [propForceWeekUnlocked]);

  // Determine if we're in playoff mode
  const isPlayoffMode = seasonType === 3;

  // Load current week and games (only if not prevented)
  useEffect(() => {
    const loadData = async () => {
      // Load data for the week
      debugLog('WeeklyPick: loadData called with props:', { weekNumber, seasonType, preventGameLoading, propGames: propGames?.length || 0 });
      debugLog('WeeklyPick: current state:', { currentWeek, games: games.length });

      if (preventGameLoading && propGames) {
        // Use provided games and set current week
        setGames(propGames);
        setCurrentWeek(weekNumber || 1);

        debugLog('WeeklyPick: Using propGames, setting currentWeek to:', weekNumber || 1);

        // Unlock status is computed by the dedicated effect below (keyed on
        // games/currentWeek/seasonType) — not here, so it only runs once.

        // Initialize picks array with the provided games
        const initialPicks: Pick[] = propGames.map((game: Game) => ({
          participant_id: selectedUser?.id || '',
          pool_id: poolId,
          game_id: game.id,
          predicted_winner: '',
          confidence_points: 0
        }));
        setPicks(initialPicks);

        debugLog('WeeklyPick: Using propGames with preventGameLoading=true');
        debugLog('Games:', propGames);
        debugLog('Initial picks:', initialPicks);
        return;
      }

      try {
        // Use provided week number or load upcoming week
        let weekToUse = weekNumber;
        let seasonTypeToUse = seasonType;

        if (!weekToUse) {
          const upcomingWeek = await getUpcomingWeek();
          weekToUse = upcomingWeek.week;
          seasonTypeToUse = seasonTypeToUse || upcomingWeek.seasonType;
        }


        setCurrentWeek(weekToUse);
        seasonTypeToUse = seasonTypeToUse || 2; // Default to regular season

        const gamesData = await loadWeekGames(weekToUse, seasonTypeToUse);
        setGames(gamesData);
        debugLog('WeeklyPick: Games loaded:', gamesData);

        // Unlock status is computed by the dedicated effect below (keyed on
        // games/currentWeek/seasonType) — not here, so it only runs once.
        debugLog('Selected user:', selectedUser);
        // Initialize picks array
        const initialPicks: Pick[] = gamesData.map((game: Game) => ({
          participant_id: selectedUser?.id || '',
          pool_id: poolId,
          game_id: game.id,
          predicted_winner: '',
          confidence_points: 0
        }));
        setPicks(initialPicks);

        debugLog('WeeklyPick: Loaded games from loadWeekGames');
        debugLog('Week:', weekToUse, 'Season Type:', seasonTypeToUse);
        debugLog('Games:', gamesData);
        debugLog('Initial picks:', initialPicks);
      } catch (error) {
        debugError('Error loading data:', error);
        toast({
          title: 'Error',
          description: 'Failed to load games data',
          variant: 'destructive',
        });
      }
    };

    loadData();
  }, [poolId, weekNumber, seasonType, preventGameLoading, propGames, toast, selectedUser, currentWeek, games.length]);

  // Monitor currentWeek changes
  useEffect(() => {
    debugLog('WeeklyPick: currentWeek changed to:', currentWeek);
  }, [currentWeek]);

  // Monitor games changes
  useEffect(() => {
    debugLog('WeeklyPick: games changed to:', games.map(g => ({ id: g.id, home_team: g.home_team, away_team: g.away_team, week: g.week, season_type: g.season_type })));
  }, [games]);

  // Update selectedUser when prop changes
  useEffect(() => {
    debugLog('WeeklyPick: propSelectedUser changed to:', propSelectedUser);
    debugLog('WeeklyPick: selectedUser changed to:', selectedUser);
    if (propSelectedUser && propSelectedUser !== selectedUser) {
      debugLog('WeeklyPick: propSelectedUser changed to:', propSelectedUser);
      setSelectedUser(propSelectedUser);
    } else {
      debugLog('WeeklyPick: propSelectedUser is the same as selectedUser');
    }
  }, [propSelectedUser, selectedUser]);

  // Load pool season for playoff mode
  useEffect(() => {
    const loadPoolSeason = async () => {
      if (isPlayoffMode && !poolSeason) {
        try {
          const response = await fetch(`/api/pools/${poolId}`);
          const data = await response.json();
          if (data.success && data.pool?.season) {
            setPoolSeason(data.pool.season);
            debugLog('WeeklyPick: Loaded pool season for playoff mode:', data.pool.season);
          }
        } catch (error) {
          debugError('Error loading pool season:', error);
        }
      }
    };
    loadPoolSeason();
  }, [isPlayoffMode, poolId, poolSeason]);

  // Load playoff confidence points when user is selected (playoff mode only)
  useEffect(() => {
    const loadPlayoffConfidencePoints = async () => {
      if (isPlayoffMode && selectedUser && poolSeason) {
        try {
          const pointsMap = await getPlayoffConfidencePoints(poolId, poolSeason, selectedUser.id);
          if (pointsMap) {
            setPlayoffConfidencePoints(pointsMap);
            debugLog('WeeklyPick: Loaded playoff confidence points:', pointsMap);
          } else {
            setPlayoffConfidencePoints({});
            debugLog('WeeklyPick: No playoff confidence points found for user');
          }
        } catch (error) {
          debugError('Error loading playoff confidence points:', error);
          setPlayoffConfidencePoints({});
        }
      } else if (!isPlayoffMode) {
        setPlayoffConfidencePoints({});
      }
    };
    loadPlayoffConfidencePoints();
  }, [isPlayoffMode, selectedUser, poolId, poolSeason]);

  // Load saved picks from localStorage when user is selected
  useEffect(() => {
    if (selectedUser && games.length > 0) {
      debugLog('WeeklyPick: Loading picks for user:', selectedUser.id, 'pool:', poolId, 'week:', currentWeek);
      const savedPicks = pickStorage.loadPicks(selectedUser.id, poolId, currentWeek);
      debugLog('WeeklyPick: Saved picks from localStorage:', savedPicks);

      if (savedPicks.length > 0) {
        // Map saved picks to the current games array
        const updatedPicks = games.map(game => {
          const savedPick = savedPicks.find(sp => sp.game_id === game.id);
          if (savedPick) {
            return {
              participant_id: selectedUser.id,
              pool_id: poolId,
              game_id: game.id,
              predicted_winner: savedPick.predicted_winner || '',
              confidence_points: savedPick.confidence_points || 0
            };
          }
          return {
            participant_id: selectedUser.id,
            pool_id: poolId,
            game_id: game.id,
            predicted_winner: '',
            confidence_points: 0
          };
        });

        debugLog('WeeklyPick: Updated picks with localStorage data:', updatedPicks);
        setPicks(updatedPicks);
        setHasUnsavedChanges(false);
        setLastSaved(new Date(savedPicks[0]?.timestamp || Date.now()));

        // For playoff mode, confidence_points can be 0, just need predicted_winner
        const validPicks = isPlayoffMode
          ? savedPicks.filter(sp => sp.predicted_winner && sp.predicted_winner.trim() !== '')
          : savedPicks.filter(sp => sp.predicted_winner && sp.confidence_points > 0);
        if (validPicks.length > 0) {
          toast({
            title: 'Picks Restored',
            description: `Loaded ${validPicks.length} saved picks from localStorage`,
          });
        }
      } else {
        // Initialize picks with selected user
        const initialPicks = games.map(game => ({
          participant_id: selectedUser.id,
          pool_id: poolId,
          game_id: game.id,
          predicted_winner: '',
          confidence_points: 0
        }));
        debugLog('WeeklyPick: Initializing new picks for user:', initialPicks);
        setPicks(initialPicks);
      }
    }
  }, [selectedUser, games, poolId, currentWeek, toast, isPlayoffMode]);

  // Check if week is unlocked for picks when games are loaded — the single
  // source of truth for isWeekUnlocked (the loadData effect above no longer
  // computes this itself, to avoid the same check firing twice per mount).
  useEffect(() => {
    if (games.length === 0 || currentWeek <= 0) return;

    const applyUnlockResult = (weekUnlocked: boolean) => {
      setIsWeekUnlocked(devForceUnlockedRef.current || weekUnlocked);

      if (!weekUnlocked && games.length > 0) {
        const firstGameTime = new Date(games[0].kickoff_time);
        const daysBeforeFirstGame = new Date(firstGameTime.getTime() - (DAYS_BEFORE_GAME * 24 * 60 * 60 * 1000));
        setUnlockTime(daysBeforeFirstGame.toLocaleString());
        debugLog('WeeklyPick: Week is locked, unlock time:', daysBeforeFirstGame.toLocaleString());
      } else {
        debugLog('WeeklyPick: Week is unlocked for picks');
      }
    };

    // When the parent already knows both this week's games and the
    // upcoming-week result (the Picks page's preventGameLoading usage),
    // compute the answer synchronously — no network round trip, no async
    // window where the UI has to guess "locked" before the real answer
    // is known.
    if (preventGameLoading && upcomingWeek) {
      const weekUnlocked = computeWeekUnlockStatus(games, currentWeek, seasonType || 2, upcomingWeek);
      debugLog('WeeklyPick: Week unlock result (sync):', weekUnlocked);
      applyUnlockResult(weekUnlocked);
      return;
    }

    const checkWeekUnlocked = async () => {
      try {
        debugLog('WeeklyPick: Checking if week is unlocked for picks:', currentWeek, 'season type:', seasonType);
        const weekUnlocked = await isWeekUnlockedForPicks(currentWeek, seasonType || 2);
        debugLog('WeeklyPick: Week unlock result:', weekUnlocked);
        applyUnlockResult(weekUnlocked);
      } catch (error) {
        debugError('Error checking week unlock status:', error);
        // Default to unlocked if there's an error
        setIsWeekUnlocked(true);
        debugLog('WeeklyPick: Defaulting to unlocked due to error');
      }
    };

    checkWeekUnlocked();
  }, [games, currentWeek, seasonType, preventGameLoading, upcomingWeek]);

  // Auto-save picks to localStorage when picks change (backup mechanism)
  useEffect(() => {
    if (selectedUser && picks.length > 0 && hasUnsavedChanges) {
      // Only auto-save if we haven&apos;t already saved in the last second
      const now = Date.now();
      const lastSavedTime = lastSaved?.getTime() || 0;

      if (now - lastSavedTime > 1000) { // Only save if more than 1 second has passed
        const storedPicks: StoredPick[] = picks.map(pick => ({
          ...pick,
          timestamp: now
        }));

        pickStorage.savePicks(storedPicks, selectedUser.id, poolId, currentWeek);
        setLastSaved(new Date(now));
        setHasUnsavedChanges(false);
      }
    }
  }, [picks, selectedUser, poolId, currentWeek, hasUnsavedChanges, lastSaved]);

  // Countdown timer for week unlock
  useEffect(() => {
    if (isWeekUnlocked === false && unlockTime) {
      const timer = setInterval(() => {
        const now = new Date();
        const unlockDate = new Date(unlockTime);
        const timeDiff = unlockDate.getTime() - now.getTime();

        if (timeDiff <= 0) {
          // Week is now unlocked
          setCountdownToUnlock('');
          setIsWeekUnlocked(true);
        } else {
          // Calculate remaining time
          const days = Math.floor(timeDiff / (1000 * 60 * 60 * 24));
          const hours = Math.floor((timeDiff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
          const minutes = Math.floor((timeDiff % (1000 * 60 * 60)) / (1000 * 60));
          const seconds = Math.floor((timeDiff % (1000 * 60)) / 1000);

          let countdownText = '';
          if (days > 0) {
            countdownText = `${days}d ${hours}h ${minutes}m`;
          } else if (hours > 0) {
            countdownText = `${hours}h ${minutes}m ${seconds}s`;
          } else if (minutes > 0) {
            countdownText = `${minutes}m ${seconds}s`;
          } else {
            countdownText = `${seconds}s`;
          }

          setCountdownToUnlock(countdownText);
        }
      }, 1000);

      return () => clearInterval(timer);
    }
  }, [isWeekUnlocked, unlockTime]);

  // Validate picks — every requirement below is derived from games.length
  // (and which games actually have a pick), never a hardcoded count, so
  // this scales correctly from a single-game week (e.g. the Hall of Fame
  // Game) up through a full slate.
  const validatePicks = (): string[] => {
    const errors: string[] = [];
    const usedConfidencePoints = new Set<number>();

    // Check if participant_id is set
    if (!selectedUser?.id || picks.some(pick => !pick.participant_id || pick.participant_id !== selectedUser.id)) {
      errors.push('Please select a user before submitting picks');
      return errors;
    }

    // Missing-winner and missing-confidence-point are reported separately
    // (rather than one generic "make a pick for all games" message) so a
    // user who already picked a winner but forgot the confidence point
    // isn't told to redo work they've already done.
    const missingWinner = games.filter(game => {
      const pick = picks.find(p => p.game_id === game.id);
      return !pick?.predicted_winner || pick.predicted_winner.trim() === '';
    });
    if (missingWinner.length > 0) {
      errors.push(
        missingWinner.length === 1
          ? "You're missing a pick for 1 remaining game."
          : `You're missing picks for ${missingWinner.length} remaining games.`
      );
    }

    // For regular season only: validate confidence points uniqueness and sequentiality
    if (!isPlayoffMode) {
      const missingConfidence = games.filter(game => {
        const pick = picks.find(p => p.game_id === game.id);
        return pick?.predicted_winner && pick.predicted_winner.trim() !== '' && !(pick.confidence_points > 0);
      });
      if (missingConfidence.length > 0) {
        errors.push(
          missingConfidence.length === 1
            ? 'Please assign a confidence point to your remaining game.'
            : `Please assign confidence points to your ${missingConfidence.length} remaining games.`
        );
      }

      const validPicks = picks.filter(pick => pick.predicted_winner && pick.confidence_points > 0);
      validPicks.forEach(pick => {
        if (usedConfidencePoints.has(pick.confidence_points)) {
          errors.push(`Confidence point ${pick.confidence_points} is used multiple times`);
        }
        usedConfidencePoints.add(pick.confidence_points);
      });

      // Check for sequential confidence points
      const confidencePoints = Array.from(usedConfidencePoints).sort((a, b) => a - b);
      for (let i = 0; i < confidencePoints.length; i++) {
        if (confidencePoints[i] !== i + 1) {
          errors.push('Confidence points must be sequential (1, 2, 3, etc.)');
          break;
        }
      }
    }

    // Check Monday night score for period weeks and Super Bowl
    const isPeriodWeek = PERIOD_WEEKS.includes(currentWeek as typeof PERIOD_WEEKS[number]);
    const isSuperBowl = (seasonType === SUPER_BOWL_SEASON_TYPE) && currentWeek === 4;
    if ((isPeriodWeek || isSuperBowl) && (mondayNightScore === null || mondayNightScore === undefined)) {
      errors.push('Please enter your Monday night game score prediction for tie-breaking purposes');
    }

    return errors;
  };

  
  const handleSelectTeam = (gameId: string, team: string) => {
    // A single-game week (e.g. the Hall of Fame Game) has exactly one
    // possible confidence value — requiring a separate click to assign the
    // only value that could ever apply is pure friction, so assign it
    // automatically the moment the winner is picked.
    const isOnlyPossibleConfidenceValue = !isPlayoffMode && games.length === 1;
    const updatedPicks = picks.map(p =>
      p.game_id === gameId
        ? { ...p, predicted_winner: team, confidence_points: isOnlyPossibleConfidenceValue ? 1 : p.confidence_points }
        : p
    );
    setPicks(updatedPicks);
    setHasUnsavedChanges(true);
    if (selectedUser) {
      const storedPicks: StoredPick[] = updatedPicks.map(p => ({ ...p, timestamp: Date.now() }));
      pickStorage.savePicks(storedPicks, selectedUser.id, poolId, currentWeek);
      setLastSaved(new Date());
    }
  };

  const handleSetConfidence = (gameId: string, points: number) => {
    const updatedPicks = picks.map(p => {
      if (p.game_id === gameId) return { ...p, confidence_points: points };
      if (p.confidence_points === points) return { ...p, confidence_points: 0 };
      return p;
    });
    setPicks(updatedPicks);
    setHasUnsavedChanges(true);
    if (selectedUser) {
      const storedPicks: StoredPick[] = updatedPicks.map(p => ({ ...p, timestamp: Date.now() }));
      pickStorage.savePicks(storedPicks, selectedUser.id, poolId, currentWeek);
      setLastSaved(new Date());
    }
  };


  // Handle form submission
  const handleSubmit = async () => {
    const validationErrors = validatePicks();
    setErrors(validationErrors);
    if (validationErrors.length > 0) {
      // Scroll to errors
      if (errorsRef.current) {
        errorsRef.current.scrollIntoView({ behavior: 'smooth' });
      }
      return;
    }

    setShowConfirmation(true);
  };

  // Confirm submission
  const confirmSubmission = async () => {
    setIsLoading(true);
    setShowConfirmation(false);

    try {
      // Ensure all picks have the correct participant_id
      const picksWithParticipantId = picks.map(pick => ({
        ...pick,
        participant_id: selectedUser!.id
      }));

      // For playoff mode, confidence_points can be 0 (from playoff_confidence_points table)
      // For regular season, confidence_points must be > 0
      const validPicks = picksWithParticipantId.filter(pick =>
        pick.predicted_winner && (isPlayoffMode ? true : pick.confidence_points > 0)
      );

      debugLog('WeeklyPick: Submitting picks with game IDs:', validPicks.map(p => ({ game_id: p.game_id, predicted_winner: p.predicted_winner, confidence_points: p.confidence_points })));
      debugLog('WeeklyPick: Current games in state:', games.map(g => ({ id: g.id, home_team: g.home_team, away_team: g.away_team })));
      debugLog('WeeklyPick: Week number:', currentWeek, 'Season type:', seasonType);

      const result = await submitPicks(validPicks, mondayNightScore);

      if (result.success) {
        toast({
          title: 'Success',
          description: 'Picks submitted successfully!',
        });

        debugLog('WeeklyPick: Picks submitted successfully, clearing picks and removing user session');
        debugLog('WeeklyPick: Picks:', validPicks);
        debugLog('WeeklyPick: Selected user:', selectedUser);
        debugLog('WeeklyPick: Pool ID:', poolId);
        // Clear localStorage after successful submission and remove user session
        pickStorage.clearPicks();
        userSessionManager.removeSession(selectedUser?.id || '', poolId);
        setPicks([]);
        setSelectedUser(null);
        setHasUnsavedChanges(false);
        setLastSaved(null);

        // Call the callback to refresh the parent component
        if (onPicksSubmitted) {
          onPicksSubmitted();
        }
      } else {
        // Show error dialog instead of toast for better visibility
        setSubmissionError(result.error || 'Failed to submit picks');
        setShowErrorDialog(true);
      }
    } catch (error: unknown) {
      debugError('Error submitting picks:', error);
      setSubmissionError(error instanceof Error ? error.message : 'Failed to submit picks');
      setShowErrorDialog(true);
    } finally {
      setIsLoading(false);
    }
  };

  // Fills every game with a predicted winner + confidence points. Shared by
  // the "Generate Random Picks" dev button (shuffled, re-rollable) and the
  // NEXT_PUBLIC_SIMULATE_PICKS auto-fill (deterministic, so screenshots are
  // reproducible across reloads).
  const fillPicks = (deterministic: boolean) => {
    if (!games.length) return;

    const newPicks = [...picks];
    const availablePoints = Array.from({ length: games.length }, (_, i) => i + 1);
    const orderedPoints = deterministic ? availablePoints : availablePoints.sort(() => Math.random() - 0.5);

    games.forEach((game, index) => {
      const teams = [game.home_team, game.away_team];
      const winner = deterministic ? teams[index % 2] : teams[Math.random() < 0.5 ? 0 : 1];
      const points = orderedPoints[index];

      const pickIndex = newPicks.findIndex(p => p.game_id === game.id);
      if (pickIndex !== -1) {
        newPicks[pickIndex] = { ...newPicks[pickIndex], predicted_winner: winner, confidence_points: points };
      }
    });

    setPicks(newPicks);
    setHasUnsavedChanges(true);

    const storedPicks = newPicks.map(pick => ({ ...pick, timestamp: Date.now() }));
    pickStorage.savePicks(storedPicks, selectedUser!.id, poolId, currentWeek);
    setLastSaved(new Date());

    return newPicks;
  };

  // Generate random picks for testing (development only)
  const generateRandomPicks = () => {
    if (!fillPicks(false)) return;
    toast({
      title: 'Random Picks Generated',
      description: `Generated random picks for ${games.length} games with shuffled confidence points`,
    });
  };

  // Handle user change
  const handleChangeUser = () => {
    // Clear local state
    setPicks([]);
    setHasUnsavedChanges(false);
    setLastSaved(null);
    pickStorage.clearPicks();
    userSessionManager.removeSession(selectedUser?.id || '', poolId);

    // Notify parent component that user change is requested
    if (onUserChangeRequested) {
      onUserChangeRequested();
    }
  };

  // NEXT_PUBLIC_SIMULATE_PICKS: auto-fill every game once per selected user
  // so How-To guide screenshots can show a fully-picked form without seeding
  // real pick rows. Deterministic so reloading gives the same screenshot.
  const simulatedFillDoneRef = useRef<string | null>(null);
  useEffect(() => {
    if (!simulatePicksEnabled() || !selectedUser || games.length === 0) return;
    if (picks.length !== games.length) return;
    if (simulatedFillDoneRef.current === selectedUser.id) return;
    if (picks.some(p => p.predicted_winner)) return; // don't clobber real/existing picks
    simulatedFillDoneRef.current = selectedUser.id;
    fillPicks(true);
    // fillPicks is a plain function (not useCallback) that also closes over
    // poolId/currentWeek — omitted here so this dev-only simulate-fill effect
    // stays gated on selectedUser/games/picks only, matching its guard logic
    // above (one fill per selected user).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedUser, games, picks]);

  if (!selectedUser) {
    // Don't render anything if no user is selected - parent component handles this
    return null;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>

      {/* Header with user info */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h2 style={{ ...bc, fontWeight: 900, fontSize: '1.3rem', color: text, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.2rem' }}>
            Week {currentWeek} Picks
          </h2>
          <p style={{ ...b, fontSize: '0.82rem', color: textMid }}>
            Making picks as: <span style={{ fontWeight: 700, color: text }}>{selectedUser.name}</span>
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
          {lastSaved && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <Save style={{ width: 13, height: 13, color: greenHi, flexShrink: 0 }} />
              <span style={{ ...b, fontSize: '0.72rem', color: greenHi }}>
                Saved {lastSaved.toLocaleTimeString()}
              </span>
            </div>
          )}
          <button
            onClick={handleChangeUser}
            style={{
              padding: '0.35rem 0.75rem',
              background: 'transparent',
              color: textMid,
              border: `1px solid ${border}`,
              borderRadius: 5,
              ...bc, fontWeight: 600, fontSize: '0.72rem',
              letterSpacing: '0.07em', textTransform: 'uppercase',
              cursor: 'pointer',
            }}
          >
            Change User
          </button>
        </div>
      </div>

      {/* Auto-save warning */}
      {hasUnsavedChanges && (
        <div style={{
          background: 'oklch(58% 0.15 250 / 0.1)',
          border: '1px solid oklch(58% 0.15 250 / 0.4)',
          borderRadius: 7,
          padding: '0.75rem 1rem',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <AlertTriangle style={{ width: 14, height: 14, color: 'oklch(58% 0.15 250)', flexShrink: 0 }} />
            <span style={{ ...b, fontSize: '0.8rem', color: 'oklch(75% 0.12 250)' }}>
              Your picks are being auto-saved. They will be automatically submitted in 5 minutes if you don&apos;t submit them manually.
            </span>
          </div>
        </div>
      )}

      {/* Neutral loading state while unlock status is still being determined
          — must never render the locked banner/button before we actually
          know the answer. */}
      {isWeekUnlocked === null && (
        <div style={{
          background: surface,
          border: `1px solid ${border}`,
          borderRadius: 7,
          padding: '0.75rem 1rem',
          display: 'flex', alignItems: 'center', gap: '0.5rem',
        }}>
          <span style={{ ...b, fontSize: '0.8rem', color: textMid }}>Checking picks availability for Week {currentWeek}…</span>
        </div>
      )}

      {/* Week locked warning */}
      {isWeekUnlocked === false && (
        <div style={{
          background: 'oklch(72% 0.16 60 / 0.1)',
          border: '1px solid oklch(72% 0.16 60 / 0.4)',
          borderRadius: 7,
          padding: '0.75rem 1rem',
        }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem' }}>
            <AlertTriangle style={{ width: 14, height: 14, color: amber, flexShrink: 0, marginTop: 2 }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ ...bc, fontWeight: 700, fontSize: '0.85rem', color: amber, marginBottom: '0.3rem' }}>
                Picks for Week {currentWeek} are not yet available.
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                <p style={{ ...b, fontSize: '0.78rem', color: textMid }}>Picks unlock within {DAYS_BEFORE_GAME} days of the first game&apos;s kickoff time.</p>
                {unlockTime && (
                  <p style={{ ...b, fontSize: '0.78rem', color: textMid }}>
                    <strong>Unlocks:</strong> {unlockTime}
                  </p>
                )}
                {countdownToUnlock && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <Clock style={{ width: 12, height: 12, color: amber, flexShrink: 0 }} />
                    <span style={{ ...bc, fontWeight: 700, fontSize: '0.78rem', color: amber }}>Unlocks in: {countdownToUnlock}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Error messages */}
      {errors.length > 0 && (
        <div ref={errorsRef} style={{
          background: 'oklch(62% 0.22 25 / 0.1)',
          border: '1px solid oklch(62% 0.22 25 / 0.4)',
          borderRadius: 7,
          padding: '0.75rem 1rem',
        }}>
          <h3 style={{ ...bc, fontWeight: 800, fontSize: '0.85rem', color: liveRed, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.4rem' }}>
            Please fix the following errors:
          </h3>
          <ul style={{ listStyle: 'disc', paddingLeft: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
            {errors.map((error, index) => (
              <li key={index} style={{ ...b, fontSize: '0.8rem', color: liveRed }}>{error}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Confidence Points Summary - Only show for regular season */}
      {!isPlayoffMode && (() => {
        const usedPoints = picks
          .filter(p => p.confidence_points > 0)
          .map(p => p.confidence_points);
        const totalPoints = games.length || 0;
        const availablePoints = totalPoints - usedPoints.length;

        return (
          <div style={{
            background: 'oklch(58% 0.15 250 / 0.08)',
            border: '1px solid oklch(58% 0.15 250 / 0.3)',
            borderRadius: 7,
            padding: '0.85rem 1rem',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', marginBottom: usedPoints.length > 0 ? '0.6rem' : 0 }}>
              <div>
                <h3 style={{ ...bc, fontWeight: 800, fontSize: '0.85rem', color: 'oklch(72% 0.12 250)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.2rem' }}>
                  Confidence Points Summary
                </h3>
                <p style={{ ...b, fontSize: '0.75rem', color: textMid }}>
                  {usedPoints.length} of {totalPoints} points assigned
                </p>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ ...bc, fontWeight: 900, fontSize: '1.5rem', color: 'oklch(72% 0.12 250)', lineHeight: 1 }}>{availablePoints}</div>
                <div style={{ ...b, fontSize: '0.68rem', color: textDim }}>Available</div>
              </div>
            </div>
            {usedPoints.length > 0 && (
              <div>
                <div style={{ ...b, fontSize: '0.7rem', color: textDim, marginBottom: '0.35rem' }}>Used points:</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem' }}>
                  {usedPoints.sort((a, b) => a - b).map(points => (
                    <span key={points} style={{
                      ...bc, fontWeight: 700, fontSize: '0.68rem',
                      padding: '0.1rem 0.4rem', borderRadius: 4,
                      background: 'oklch(58% 0.15 250 / 0.2)',
                      color: 'oklch(72% 0.12 250)',
                      border: '1px solid oklch(58% 0.15 250 / 0.35)',
                    }}>
                      {points}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        );
      })()}

      {/* Playoff mode info */}
      {isPlayoffMode && (
        <div style={{
          background: 'oklch(65% 0.12 290 / 0.1)',
          border: '1px solid oklch(65% 0.12 290 / 0.35)',
          borderRadius: 7,
          padding: '0.85rem 1rem',
        }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem' }}>
            <div style={{ flex: 1 }}>
              <h3 style={{ ...bc, fontWeight: 800, fontSize: '0.88rem', color: purple, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.25rem' }}>
                Playoff Mode
              </h3>
              <p style={{ ...b, fontSize: '0.78rem', color: textMid }}>
                Confidence points are input at the beginning of the playoffs. You can no longer them after the start of the first playoff game.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Games grid */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
        {games.map((game) => {
          const pick = picks.find(p => p.game_id === game.id);
          const isLocked = isWeekUnlocked !== true;
          const usedConfidencePoints = picks
            .filter(p => p.game_id !== game.id && p.confidence_points > 0)
            .map(p => p.confidence_points);

          return (
            <GameCard
              key={game.id}
              game={game}
              pick={pick}
              onSelectTeam={handleSelectTeam}
              onSetConfidence={handleSetConfidence}
              totalGames={games.length}
              usedPoints={usedConfidencePoints}
              locked={isLocked}
            />
          );
        })}
      </div>

      {/* Monday Night Score Input - Only show for tie-breaker weeks */}
      {selectedUser && (
        <MondayNightScoreInput
          poolId={poolId}
          weekNumber={currentWeek}
          seasonType={seasonType || 2}
          participantId={selectedUser.id}
          initialScore={mondayNightScore || undefined}
          onScoreChange={setMondayNightScore}
          isRequired={PERIOD_WEEKS.includes(currentWeek as typeof PERIOD_WEEKS[number]) || (seasonType === SUPER_BOWL_SEASON_TYPE && currentWeek === 4)}
          games={games}
          isLocked={isWeekUnlocked !== true}
        />
      )}

      {/* Submit button area */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.65rem' }}>
        {/* Debug information - only show in development */}
        {showDebugPanel() && (
          <div style={{
            ...b, fontSize: '0.68rem', color: textDim,
            padding: '0.5rem 0.75rem',
            background: 'oklch(17% 0.028 255)',
            border: `1px solid ${border}`,
            borderRadius: 5,
            width: '100%',
          }}>
            <p>Debug: isLoading={isLoading.toString()}, isWeekUnlocked={String(isWeekUnlocked)}</p>
            <p>Selected User: {selectedUser?.id || 'None'}</p>
            <p>Picks Count: {picks.length}</p>
            <p>Valid Picks: {picks.filter(p => p.predicted_winner && p.confidence_points > 0).length}</p>
          </div>
        )}

        {/* Random Picks Button - Only show in development */}
        {(showDebugPanel() || simulatePicksEnabled()) && (
          <button
            type="button"
            onClick={generateRandomPicks}
            disabled={isLoading || isWeekUnlocked !== true}
            style={{
              padding: '0.6rem 1.5rem',
              background: 'oklch(65% 0.12 290 / 0.15)',
              color: purple,
              border: '1px solid oklch(65% 0.12 290 / 0.4)',
              borderRadius: 6,
              ...bc, fontWeight: 700, fontSize: '0.78rem',
              letterSpacing: '0.06em', textTransform: 'uppercase',
              cursor: (isLoading || isWeekUnlocked !== true) ? 'not-allowed' : 'pointer',
              opacity: (isLoading || isWeekUnlocked !== true) ? 0.5 : 1,
              width: '100%',
            }}
          >
            🎲 Generate Random Picks
          </button>
        )}

        <button
          onClick={handleSubmit}
          disabled={isLoading || isWeekUnlocked !== true}
          style={{
            padding: '0.75rem 2rem',
            background: (isLoading || isWeekUnlocked !== true) ? 'oklch(26% 0.03 255)' : green,
            color: (isLoading || isWeekUnlocked !== true) ? textDim : text,
            border: `1px solid ${(isLoading || isWeekUnlocked !== true) ? border : green}`,
            borderRadius: 6,
            ...bc, fontWeight: 800, fontSize: '0.92rem',
            letterSpacing: '0.08em', textTransform: 'uppercase',
            cursor: (isLoading || isWeekUnlocked !== true) ? 'not-allowed' : 'pointer',
            width: '100%',
            transition: 'all 0.12s',
          }}
        >
          {isLoading ? 'Submitting...' : isWeekUnlocked === false ? 'Week Locked' : isWeekUnlocked === null ? 'Checking Week Status…' : 'Submit Picks'}
        </button>

        {isWeekUnlocked === false && unlockTime && (
          <div style={{ ...b, fontSize: '0.78rem', color: textDim, textAlign: 'center', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <p>Picks will unlock on {unlockTime}</p>
            <p style={{ fontSize: '0.7rem' }}>You can make your selections now and submit when the week unlocks</p>
            {countdownToUnlock && (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem' }}>
                <Clock style={{ width: 12, height: 12, color: amber, flexShrink: 0 }} />
                <span style={{ ...bc, fontWeight: 700, fontSize: '0.78rem', color: amber }}>Unlocks in: {countdownToUnlock}</span>
              </div>
            )}
          </div>
        )}

        {isWeekUnlocked === true && (
          <div style={{ textAlign: 'center' }}>
            <p style={{ ...b, fontSize: '0.75rem', color: greenHi }}>✓ Week is unlocked — you can submit your picks</p>
          </div>
        )}
      </div>

      {/* Pick Confirmation Dialog */}
      <PickConfirmationDialog
        open={showConfirmation}
        onOpenChange={setShowConfirmation}
        picks={picks.map(pick => ({
          gameId: pick.game_id,
          pickedTeamId: pick.predicted_winner,
          confidencePoints: pick.confidence_points
        }))}
        games={games}
        weekNumber={currentWeek}
        seasonType={seasonType}
        mondayNightScore={mondayNightScore}
        onConfirm={confirmSubmission}
        isSubmitting={isLoading}
        userName={selectedUser?.name || 'Unknown User'}
        userEmail={selectedUser?.email}
      />

      {/* Error Dialog */}
      <AlertDialog open={showErrorDialog} onOpenChange={setShowErrorDialog}>
        <AlertDialogContent style={{ background: card, border: `1px solid ${border}`, borderTop: `3px solid ${liveRed}` }}>
          <AlertDialogHeader>
            <AlertDialogTitle style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', ...bc, fontWeight: 800, fontSize: '1rem', color: text, textTransform: 'uppercase' }}>
              <AlertTriangle style={{ width: 18, height: 18, color: liveRed }} />
              Submission Failed
            </AlertDialogTitle>
            <AlertDialogDescription style={{ ...b, fontSize: '0.85rem', color: textMid, textAlign: 'left' }}>
              {submissionError}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction
              onClick={() => setShowErrorDialog(false)}
              style={{ padding: '0.5rem 1.25rem', background: green, color: text, border: 'none', borderRadius: 6, ...bc, fontWeight: 700, fontSize: '0.78rem', letterSpacing: '0.07em', textTransform: 'uppercase', cursor: 'pointer' }}
            >
              OK
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
