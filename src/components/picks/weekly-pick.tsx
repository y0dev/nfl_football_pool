'use client';

import { useState, useEffect, useRef } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { submitPicks } from '@/actions/submitPicks';
import { loadWeekGames } from '@/actions/loadWeekGames';
import { isWeekUnlockedForPicks, getUpcomingWeek } from '@/actions/loadCurrentWeek';
import { PickConfirmationDialog } from './pick-confirmation-dialog';
import { MondayNightScoreInput } from './monday-night-score-input';
import { userSessionManager } from '@/lib/user-session';
import { pickStorage } from '@/lib/pick-storage';
import { Clock, Save, AlertTriangle, X } from 'lucide-react';
import { Game, Pick, StoredPick, SelectedUser } from '@/types/game';
import { debugLog, DAYS_BEFORE_GAME, getShortTeamName, PERIOD_WEEKS, SUPER_BOWL_SEASON_TYPE } from '@/lib/utils';
import { getPlayoffConfidencePoints } from '@/lib/playoff-utils';
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
  onPicksSubmitted?: () => void;
  onUserChangeRequested?: () => void;
}

export function WeeklyPick({ poolId, weekNumber, seasonType, selectedUser: propSelectedUser, games: propGames, preventGameLoading, forceWeekUnlocked: propForceWeekUnlocked, onPicksSubmitted, onUserChangeRequested }: WeeklyPickProps) {
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
  const [isWeekUnlocked, setIsWeekUnlocked] = useState(false);
  const [unlockTime, setUnlockTime] = useState<string>('');
  const [countdownToUnlock, setCountdownToUnlock] = useState<string>('');
  const devForceUnlockedRef = useRef(process.env.NEXT_PUBLIC_NODE_ENV === 'development');
  const [devForceUnlocked, setDevForceUnlocked] = useState(devForceUnlockedRef.current);
  const [mondayNightScore, setMondayNightScore] = useState<number | null>(null);
  const [poolSeason, setPoolSeason] = useState<number | null>(null);
  const [playoffConfidencePoints, setPlayoffConfidencePoints] = useState<Record<string, number>>({});

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

        // Check if this week is unlocked for picks
        const weekUnlocked = await isWeekUnlockedForPicks(weekNumber || 1, seasonType || 2);
        setIsWeekUnlocked(devForceUnlockedRef.current || weekUnlocked);

        // Get unlock time if week is locked
        if (!weekUnlocked && propGames && propGames.length > 0) {
          const firstGameTime = new Date(propGames[0].kickoff_time);
          const daysBeforeFirstGame = new Date(firstGameTime.getTime() - (DAYS_BEFORE_GAME * 24 * 60 * 60 * 1000));
          setUnlockTime(daysBeforeFirstGame.toLocaleString());
        }

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

        // Check if this week is unlocked for picks
        const weekUnlocked = await isWeekUnlockedForPicks(weekToUse, seasonTypeToUse);
        setIsWeekUnlocked(devForceUnlockedRef.current || weekUnlocked);

        // Get unlock time if week is locked
        if (!weekUnlocked && gamesData.length > 0) {
          const firstGameTime = new Date(gamesData[0].kickoff_time);
          const daysBeforeFirstGame = new Date(firstGameTime.getTime() - (DAYS_BEFORE_GAME * 24 * 60 * 60 * 1000));
          setUnlockTime(daysBeforeFirstGame.toLocaleString());
        }
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
        console.error('Error loading data:', error);
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
          console.error('Error loading pool season:', error);
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
          console.error('Error loading playoff confidence points:', error);
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
  }, [selectedUser, games, poolId, currentWeek, toast]);

  // Check if week is unlocked for picks when games are loaded
  useEffect(() => {
    const checkWeekUnlocked = async () => {
      if (games.length > 0 && currentWeek > 0) {
        try {
          debugLog('WeeklyPick: Checking if week is unlocked for picks:', currentWeek, 'season type:', seasonType);
          const weekUnlocked = await isWeekUnlockedForPicks(currentWeek, seasonType || 2);
          debugLog('WeeklyPick: Week unlock result:', weekUnlocked);
          setIsWeekUnlocked(devForceUnlockedRef.current || weekUnlocked);

          // If week is locked, get unlock time
          if (!weekUnlocked && games.length > 0) {
            const firstGameTime = new Date(games[0].kickoff_time);
            const daysBeforeFirstGame = new Date(firstGameTime.getTime() - (DAYS_BEFORE_GAME * 24 * 60 * 60 * 1000));
            setUnlockTime(daysBeforeFirstGame.toLocaleString());
            debugLog('WeeklyPick: Week is locked, unlock time:', daysBeforeFirstGame.toLocaleString());
          } else {
            debugLog('WeeklyPick: Week is unlocked for picks');
          }
        } catch (error) {
          console.error('Error checking week unlock status:', error);
          // Default to unlocked if there's an error
          setIsWeekUnlocked(true);
          debugLog('WeeklyPick: Defaulting to unlocked due to error');
        }
      }
    };

    checkWeekUnlocked();
  }, [games, currentWeek, seasonType]);

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
    if (!isWeekUnlocked && unlockTime) {
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

  // Handle pick changes
  const handlePickChange = (gameId: string, field: 'predicted_winner' | 'confidence_points', value: string | number) => {
    // For playoff mode, when selecting a winner, automatically set confidence points from playoff_confidence_points
    if (isPlayoffMode && field === 'predicted_winner' && typeof value === 'string') {
      const confidencePoints = playoffConfidencePoints[value] || 0;
      const updatedPicks = picks.map(pick =>
        pick.game_id === gameId
          ? { ...pick, predicted_winner: value, confidence_points: confidencePoints }
          : pick
      );

      setPicks(updatedPicks);
      setHasUnsavedChanges(true);

      // Immediately save to localStorage
      if (selectedUser) {
        const storedPicks: StoredPick[] = updatedPicks
          .filter(pick => pick.predicted_winner && pick.predicted_winner.trim() !== '')
          .map(pick => ({
            ...pick,
            timestamp: Date.now()
          }));

        pickStorage.savePicks(storedPicks, selectedUser.id, poolId, currentWeek);
        setLastSaved(new Date());
        debugLog('WeeklyPick: Saved playoff pick with confidence points:', { team: value, points: confidencePoints });
      }
      return;
    }

    // Check if confidence point is already used (regular season only)
    if (field === 'confidence_points' && typeof value === 'number' && !isPlayoffMode) {
      const existingPick = picks.find(p => p.confidence_points === value && p.game_id !== gameId);
      if (existingPick) {
        // Show confirmation dialog for override
        if (window.confirm(`Confidence point ${value} is already used by another game. Do you want to override it?`)) {
          // Remove the confidence point from the other game
          const updatedPicks = picks.map(pick =>
            pick.confidence_points === value && pick.game_id !== gameId
              ? { ...pick, confidence_points: 0 }
              : pick
          );

          // Set the new confidence point
          const finalPicks = updatedPicks.map(pick =>
            pick.game_id === gameId
              ? { ...pick, [field]: value }
              : pick
          );

          setPicks(finalPicks);
          setHasUnsavedChanges(true);

          // Immediately save to localStorage
          if (selectedUser) {
            const storedPicks: StoredPick[] = finalPicks.map(pick => ({
              ...pick,
              timestamp: Date.now()
            }));

            pickStorage.savePicks(storedPicks, selectedUser.id, poolId, currentWeek);
            setLastSaved(new Date());
          }
        }
        return;
      }
    }

    const updatedPicks = picks.map(pick =>
      pick.game_id === gameId
        ? { ...pick, [field]: value }
        : pick
    );

    setPicks(updatedPicks);
    setHasUnsavedChanges(true);

    // Immediately save to localStorage
    if (selectedUser) {
      const storedPicks: StoredPick[] = updatedPicks.map(pick => ({
        ...pick,
        timestamp: Date.now()
      }));

      pickStorage.savePicks(storedPicks, selectedUser.id, poolId, currentWeek);
      setLastSaved(new Date());
    }
  };

  // Validate picks
  const validatePicks = (): string[] => {
    const errors: string[] = [];
    const usedConfidencePoints = new Set<number>();
    // For playoff mode, confidence_points can be 0 or any value (from playoff_confidence_points table)
    const validPicks = isPlayoffMode
      ? picks.filter(pick => pick.predicted_winner && pick.predicted_winner.trim() !== '')
      : picks.filter(pick => pick.predicted_winner && pick.confidence_points > 0);

    // Check if participant_id is set
    if (!selectedUser?.id || picks.some(pick => !pick.participant_id || pick.participant_id !== selectedUser.id)) {
      errors.push('Please select a user before submitting picks');
      return errors;
    }

    if (validPicks.length !== games.length) {
      errors.push('Please make a pick for all games');
    }

    // For regular season only: validate confidence points uniqueness and sequentiality
    if (!isPlayoffMode) {
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
      console.error('Error submitting picks:', error);
      setSubmissionError(error instanceof Error ? error.message : 'Failed to submit picks');
      setShowErrorDialog(true);
    } finally {
      setIsLoading(false);
    }
  };

  // Generate random picks for testing (development only)
  const generateRandomPicks = () => {
    if (!games.length) return;

    // Create a copy of current picks
    const newPicks = [...picks];

    // Get available confidence points (1 to number of games)
    const availablePoints = Array.from({ length: games.length }, (_, i) => i + 1);

    // Shuffle available points for random assignment
    const shuffledPoints = availablePoints.sort(() => Math.random() - 0.5);

    games.forEach((game, index) => {
      // Randomly pick home or away team
      const teams = [game.home_team, game.away_team];
      const randomTeam = teams[Math.random() < 0.5 ? 0 : 1];

      // Assign random confidence points
      const randomPoints = shuffledPoints[index];

      // Find the pick for this game
      const pickIndex = newPicks.findIndex(p => p.game_id === game.id);
      if (pickIndex !== -1) {
        newPicks[pickIndex] = {
          ...newPicks[pickIndex],
          predicted_winner: randomTeam,
          confidence_points: randomPoints
        };
      }
    });

    // Update picks state
    setPicks(newPicks);
    setHasUnsavedChanges(true);

    // Convert picks to StoredPick format with timestamps
    const storedPicks = newPicks.map(pick => ({
      ...pick,
      timestamp: Date.now()
    }));

    // Save to localStorage
    pickStorage.savePicks(storedPicks, selectedUser!.id, poolId, currentWeek);
    setLastSaved(new Date());

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

      {/* Week locked warning */}
      {!isWeekUnlocked && (
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
        {games.map((game, index) => {
          const pick = picks.find(p => p.game_id === game.id);
          const isLocked = !isWeekUnlocked;

          // Get used confidence points from other picks
          const usedConfidencePoints = picks
            .filter(p => p.game_id !== game.id && p.confidence_points > 0)
            .map(p => p.confidence_points);

          // Get available confidence points (excluding used ones and the current pick's value)
          const availableConfidencePoints = games.length > 0 ? Array.from({ length: games.length }, (_, i) => i + 1)
            .filter(points =>
              points === pick?.confidence_points || // Include current pick's value
              !usedConfidencePoints.includes(points) // Exclude used by other picks
            ) : [];

          const hasPick = !!pick?.predicted_winner;
          const pickedAway = pick?.predicted_winner === game.away_team;
          const pickedHome = pick?.predicted_winner === game.home_team;

          return (
            <div
              key={game.id}
              style={{
                background: hasPick ? 'oklch(46% 0.14 155 / 0.08)' : card,
                border: `1px solid ${hasPick ? 'oklch(46% 0.14 155 / 0.35)' : border}`,
                borderRadius: 8,
                padding: '0.9rem 1.1rem',
                opacity: isLocked ? 0.7 : 1,
                transition: 'border-color 0.15s, background 0.15s',
              }}
            >
              {/* Game header */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.65rem' }}>
                <span style={{ ...bc, fontWeight: 700, fontSize: '0.7rem', color: textDim, textTransform: 'uppercase', letterSpacing: '0.07em' }}>
                  Game {index + 1}
                </span>
                {isLocked && (
                  <span style={{
                    ...bc, fontWeight: 700, fontSize: '0.62rem', letterSpacing: '0.08em',
                    padding: '0.1rem 0.4rem', borderRadius: 4, textTransform: 'uppercase',
                    background: 'oklch(26% 0.03 255)', color: textDim, border: `1px solid ${border}`,
                  }}>Locked</span>
                )}
              </div>

              {/* Team selection */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginBottom: '0.65rem' }}>
                <button
                  onClick={() => !isLocked && handlePickChange(game.id, 'predicted_winner', game.away_team)}
                  disabled={isLocked}
                  style={{
                    padding: '0.6rem 0.5rem',
                    background: pickedAway ? green : 'oklch(17% 0.028 255)',
                    color: pickedAway ? text : textMid,
                    border: `1px solid ${pickedAway ? green : border}`,
                    borderRadius: 6,
                    ...bc, fontWeight: 700, fontSize: '0.82rem',
                    letterSpacing: '0.04em', textTransform: 'uppercase',
                    cursor: isLocked ? 'not-allowed' : 'pointer',
                    textAlign: 'center',
                    transition: 'all 0.12s',
                  }}
                >
                  {game.away_team}
                  {game.away_team_record && (
                    <span style={{ display: 'block', fontSize: '0.62rem', fontWeight: 600, color: pickedAway ? 'oklch(85% 0.006 255)' : textDim, marginTop: '0.1rem' }}>
                      {game.away_team_record.wins}-{game.away_team_record.losses}
                      {game.away_team_record.ties > 0 && `-${game.away_team_record.ties}`}
                    </span>
                  )}
                </button>
                <button
                  onClick={() => !isLocked && handlePickChange(game.id, 'predicted_winner', game.home_team)}
                  disabled={isLocked}
                  style={{
                    padding: '0.6rem 0.5rem',
                    background: pickedHome ? green : 'oklch(17% 0.028 255)',
                    color: pickedHome ? text : textMid,
                    border: `1px solid ${pickedHome ? green : border}`,
                    borderRadius: 6,
                    ...bc, fontWeight: 700, fontSize: '0.82rem',
                    letterSpacing: '0.04em', textTransform: 'uppercase',
                    cursor: isLocked ? 'not-allowed' : 'pointer',
                    textAlign: 'center',
                    transition: 'all 0.12s',
                  }}
                >
                  {game.home_team}
                  {game.home_team_record && (
                    <span style={{ display: 'block', fontSize: '0.62rem', fontWeight: 600, color: pickedHome ? 'oklch(85% 0.006 255)' : textDim, marginTop: '0.1rem' }}>
                      {game.home_team_record.wins}-{game.home_team_record.losses}
                      {game.home_team_record.ties > 0 && `-${game.home_team_record.ties}`}
                    </span>
                  )}
                </button>
              </div>

              {/* Confidence points - Only show for regular season */}
              {!isPlayoffMode && (
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
                    <label style={{ ...b, fontSize: '0.75rem', fontWeight: 600, color: textMid }}>
                      Confidence Points
                    </label>
                    {usedConfidencePoints.length > 0 && (
                      <span style={{ ...b, fontSize: '0.68rem', color: textDim }}>
                        {usedConfidencePoints.length} used
                      </span>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: '0.4rem' }}>
                    <Select
                      value={pick?.confidence_points?.toString() || ''}
                      onValueChange={(value) => !isLocked && handlePickChange(game.id, 'confidence_points', parseInt(value))}
                      disabled={isLocked}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select confidence points" />
                      </SelectTrigger>
                      <SelectContent>
                        {availableConfidencePoints && availableConfidencePoints.length > 0 ? (
                          availableConfidencePoints.map(points => (
                            <SelectItem key={points} value={points.toString()}>
                              {points} point{points !== 1 ? 's' : ''}
                            </SelectItem>
                          ))
                        ) : (
                          <SelectItem value="" disabled>
                            No confidence points available
                          </SelectItem>
                        )}
                      </SelectContent>
                    </Select>

                    {/* Clear Confidence Button */}
                    {(pick?.confidence_points ?? 0) > 0 && !isLocked && (
                      <button
                        type="button"
                        onClick={() => handlePickChange(game.id, 'confidence_points', 0)}
                        title="Clear confidence points - makes this value available for other games"
                        style={{
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          padding: '0 0.55rem',
                          background: 'transparent',
                          color: textDim,
                          border: `1px solid ${border}`,
                          borderRadius: 5,
                          cursor: 'pointer',
                          flexShrink: 0,
                        }}
                      >
                        <X style={{ width: 14, height: 14 }} />
                      </button>
                    )}
                  </div>

                  {/* Show used confidence points */}
                  {usedConfidencePoints.length > 0 && (
                    <div style={{ marginTop: '0.4rem' }}>
                      <div style={{ ...b, fontSize: '0.68rem', color: textDim, marginBottom: '0.25rem' }}>Used by other games:</div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.25rem' }}>
                        {usedConfidencePoints.sort((a, b) => a - b).map(points => (
                          <span key={points} style={{
                            ...bc, fontWeight: 700, fontSize: '0.65rem',
                            padding: '0.08rem 0.35rem', borderRadius: 3,
                            background: 'oklch(26% 0.03 255)',
                            color: textDim,
                            border: `1px solid ${border}`,
                          }}>
                            {points}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Show message when no confidence points are assigned */}
                  {!pick?.confidence_points && (
                    <div style={{ marginTop: '0.35rem' }}>
                      <span style={{ ...b, fontSize: '0.68rem', color: textDim, fontStyle: 'italic' }}>
                        No confidence points assigned — select a value above
                      </span>
                    </div>
                  )}
                </div>
              )}

              {/* Show confidence points for playoff mode (read-only display) */}
              {isPlayoffMode && pick?.predicted_winner && (
                <div style={{ marginTop: '0.4rem' }}>
                  <span style={{ ...b, fontSize: '0.78rem', color: textMid }}>
                    <span style={{ fontWeight: 600 }}>Confidence Points:</span>{' '}
                    {pick.confidence_points > 0 ? (
                      <span style={{
                        ...bc, fontWeight: 700, fontSize: '0.72rem',
                        padding: '0.1rem 0.4rem', borderRadius: 4,
                        background: 'oklch(46% 0.14 155 / 0.15)',
                        color: greenHi,
                        border: '1px solid oklch(46% 0.14 155 / 0.35)',
                      }}>
                        {pick.confidence_points} points
                      </span>
                    ) : (
                      <span style={{ color: textDim, fontStyle: 'italic' }}>No points assigned to this team</span>
                    )}
                  </span>
                </div>
              )}
            </div>
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
          isLocked={!isWeekUnlocked}
        />
      )}

      {/* Submit button area */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.65rem' }}>
        {/* Debug information - only show in development */}
        {process.env.NODE_ENV === 'development' && (
          <div style={{
            ...b, fontSize: '0.68rem', color: textDim,
            padding: '0.5rem 0.75rem',
            background: 'oklch(17% 0.028 255)',
            border: `1px solid ${border}`,
            borderRadius: 5,
            width: '100%',
          }}>
            <p>Debug: isLoading={isLoading.toString()}, isWeekUnlocked={isWeekUnlocked.toString()}</p>
            <p>Selected User: {selectedUser?.id || 'None'}</p>
            <p>Picks Count: {picks.length}</p>
            <p>Valid Picks: {picks.filter(p => p.predicted_winner && p.confidence_points > 0).length}</p>
          </div>
        )}

        {/* Random Picks Button - Only show in development */}
        {(process.env.NODE_ENV === 'development' || process.env.NEXT_PUBLIC_NODE_ENV === 'development') && (
          <button
            type="button"
            onClick={generateRandomPicks}
            disabled={isLoading || !isWeekUnlocked}
            style={{
              padding: '0.6rem 1.5rem',
              background: 'oklch(65% 0.12 290 / 0.15)',
              color: purple,
              border: '1px solid oklch(65% 0.12 290 / 0.4)',
              borderRadius: 6,
              ...bc, fontWeight: 700, fontSize: '0.78rem',
              letterSpacing: '0.06em', textTransform: 'uppercase',
              cursor: (isLoading || !isWeekUnlocked) ? 'not-allowed' : 'pointer',
              opacity: (isLoading || !isWeekUnlocked) ? 0.5 : 1,
              width: '100%',
            }}
          >
            🎲 Generate Random Picks
          </button>
        )}

        <button
          onClick={handleSubmit}
          disabled={isLoading || !isWeekUnlocked}
          style={{
            padding: '0.75rem 2rem',
            background: (isLoading || !isWeekUnlocked) ? 'oklch(26% 0.03 255)' : green,
            color: (isLoading || !isWeekUnlocked) ? textDim : text,
            border: `1px solid ${(isLoading || !isWeekUnlocked) ? border : green}`,
            borderRadius: 6,
            ...bc, fontWeight: 800, fontSize: '0.92rem',
            letterSpacing: '0.08em', textTransform: 'uppercase',
            cursor: (isLoading || !isWeekUnlocked) ? 'not-allowed' : 'pointer',
            width: '100%',
            transition: 'all 0.12s',
          }}
        >
          {isLoading ? 'Submitting...' : !isWeekUnlocked ? 'Week Locked' : 'Submit Picks'}
        </button>

        {!isWeekUnlocked && unlockTime && (
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

        {isWeekUnlocked && (
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
