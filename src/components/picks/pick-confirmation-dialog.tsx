'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, User } from 'lucide-react';
import { Game } from '@/types/game';
import { PERIOD_WEEKS, SUPER_BOWL_SEASON_TYPE } from '@/lib/utils';

interface Pick {
  gameId: string;
  pickedTeamId: string | null;
  confidencePoints: number | null;
}

interface PickConfirmationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  picks: Pick[];
  games: Game[];
  weekNumber: number;
  seasonType?: number;
  mondayNightScore?: number | null;
  onConfirm: () => Promise<void>;
  isSubmitting: boolean;
  userName: string;
  userEmail?: string;
}

export function PickConfirmationDialog({
  open,
  onOpenChange,
  picks,
  games,
  weekNumber,
  seasonType,
  mondayNightScore,
  onConfirm,
  isSubmitting,
  userName,
  userEmail,
}: PickConfirmationDialogProps) {
  const [userConfirmed, setUserConfirmed] = useState(false);

  const handleConfirm = () => {
    onConfirm();
    setUserConfirmed(false); // Reset for next time
  };

  const getTeamName = (teamId: string) => {
    
    // Find team name from games data
    for (const game of games) {
      
      if (game.home_team.toString() === teamId) {
        return game.home_team;
      }
      if (game.away_team.toString() === teamId) {
        return game.away_team;
      }
    }
    return 'Unknown Team';
  };

  const sortedPicks = picks
    .filter(pick => pick.pickedTeamId && pick.confidencePoints)
    .sort((a, b) => (b.confidencePoints || 0) - (a.confidencePoints || 0));

  // Check if Monday night score should be shown
  const isPeriodWeek = PERIOD_WEEKS.includes(weekNumber as typeof PERIOD_WEEKS[number]);
  const isSuperBowl = seasonType === SUPER_BOWL_SEASON_TYPE;
  const shouldShowMondayNightScore = (isPeriodWeek || isSuperBowl) && mondayNightScore !== null && mondayNightScore !== undefined;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            <span>Confirm Your Picks</span>
          </DialogTitle>
          <DialogDescription>
            Please review your Week {weekNumber} picks before submitting. Once submitted, picks cannot be changed.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* User Confirmation */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-center space-x-2 mb-2">
              <User className="h-5 w-5 text-blue-600" />
              <span className="font-semibold text-blue-900">Submitting as:</span>
            </div>
            <div className="text-sm text-gray-600">
              {userName} {userEmail && `- ${userEmail}`}
            </div>
            <div className="mt-3">
              <label className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={userConfirmed}
                  onChange={(e) => setUserConfirmed(e.target.checked)}
                  className="rounded border-gray-300"
                />
                <span className="text-sm text-blue-800">
                  I confirm that I am <strong>{userName}</strong> and these are my picks
                </span>
              </label>
            </div>
          </div>

          {/* Picks Summary */}
          <div>
            <h4 className="font-semibold text-gray-900 mb-3">Your Picks (by confidence):</h4>
            <div className="space-y-2">
              {sortedPicks.map((pick) => {
                const game = games.find(g => g.id === pick.gameId);
                if (!game) return null;

                return (
                  <div key={pick.gameId} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div className="flex-1">
                      <div className="font-medium">
                        {getTeamName(pick.pickedTeamId!)}
                      </div>
                      <div className="text-sm text-gray-600">
                        vs {game.home_team?.toString() === pick.pickedTeamId 
                          ? game.away_team 
                          : game.home_team}
                      </div>
                    </div>
                    <Badge variant="outline" className="ml-2">
                      {pick.confidencePoints} pts
                    </Badge>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Monday Night Score */}
          {shouldShowMondayNightScore && (
            <div>
              <h4 className="font-semibold text-gray-900 mb-3">Monday Night Game Score:</h4>
              <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium text-blue-900">
                      Total Points Prediction
                    </div>
                    <div className="text-sm text-blue-700">
                      Used for tie-breaking in {isPeriodWeek ? 'tie-breaker week' : 'Super Bowl'}
                    </div>
                  </div>
                  <Badge variant="secondary" className="bg-blue-100 text-blue-800">
                    {mondayNightScore} points
                  </Badge>
                </div>
              </div>
            </div>
          )}

          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
            <p className="text-sm text-amber-800">
              <strong>Important:</strong> After submission, you cannot change your picks. 
              Make sure all selections are correct before confirming.
            </p>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
            Review Picks
          </Button>
          <Button 
            onClick={handleConfirm}
            disabled={!userConfirmed || isSubmitting}
          >
            {isSubmitting ? 'Submitting...' : 'Submit Picks'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
