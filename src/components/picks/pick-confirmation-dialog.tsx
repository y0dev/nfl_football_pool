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
import { useAuth } from '@/lib/auth';
import { AlertTriangle, User } from 'lucide-react';

interface Pick {
  gameId: number;
  pickedTeamId: number | null;
  confidencePoints: number | null;
}

interface Game {
  id: number;
  home_team_id: number;
  away_team_id: number;
  home_team_name: string;
  home_team_city: string;
  away_team_name: string;
  away_team_city: string;
}

interface PickConfirmationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  picks: Pick[];
  games: Game[];
  weekNumber: number;
  onConfirm: () => Promise<void>;
  isSubmitting: boolean;
}

export function PickConfirmationDialog({
  open,
  onOpenChange,
  picks,
  games,
  weekNumber,
  onConfirm,
  isSubmitting,
}: PickConfirmationDialogProps) {
  const { user } = useAuth();
  const [userConfirmed, setUserConfirmed] = useState(false);

  const handleConfirm = () => {
    onConfirm();
    setUserConfirmed(false); // Reset for next time
  };

  const getTeamName = (teamId: number) => {
    // Find team name from games data
    for (const game of games) {
      if (game.home_team_id === teamId) {
        return `${game.home_team_city} ${game.home_team_name}`;
      }
      if (game.away_team_id === teamId) {
        return `${game.away_team_city} ${game.away_team_name}`;
      }
    }
    return 'Unknown Team';
  };

  const sortedPicks = picks
    .filter(pick => pick.pickedTeamId && pick.confidencePoints)
    .sort((a, b) => (b.confidencePoints || 0) - (a.confidencePoints || 0));

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
            <div className="text-lg font-bold text-blue-900">{user?.display_name}</div>
            <div className="mt-3">
              <label className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={userConfirmed}
                  onChange={(e) => setUserConfirmed(e.target.checked)}
                  className="rounded border-gray-300"
                />
                <span className="text-sm text-blue-800">
                  I confirm that I am <strong>{user?.display_name}</strong> and these are my picks
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
                        vs {game.home_team_id === pick.pickedTeamId 
                          ? `${game.away_team_city} ${game.away_team_name}` 
                          : `${game.home_team_city} ${game.home_team_name}`}
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
