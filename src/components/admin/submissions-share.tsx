'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Share2, Loader2 } from 'lucide-react';
import { getWeeklySubmissionsForScreenshot } from '@/actions/adminActions';
import { useToast } from '@/hooks/use-toast';
import { Game, Participant } from '@/types/game';

interface SubmissionsShareProps {
  poolId: string;
  poolName: string;
  week: number;
  seasonType?: number;
}

export function SubmissionsShare({ poolId, poolName, week, seasonType }: SubmissionsShareProps) {
  const [submissionsData, setSubmissionsData] = useState<{ games: Game[]; participants: Participant[] } | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    loadSubmissionsData();
  }, [poolId, week, seasonType]);

  const loadSubmissionsData = async () => {
    setIsLoading(true);
    try {
      // If no week provided, get current week from games
      let weekToUse = week;
      let seasonTypeToUse = seasonType;
      
      if (!weekToUse || !seasonTypeToUse) {
        const { getCurrentWeekFromGames } = await import('@/actions/getCurrentWeekFromGames');
        const currentWeekData = await getCurrentWeekFromGames();
        weekToUse = weekToUse || currentWeekData.week;
        seasonTypeToUse = seasonTypeToUse || currentWeekData.seasonType;
      }
      
      const data = await getWeeklySubmissionsForScreenshot(poolId, weekToUse, seasonTypeToUse);
      console.log('data', data);
      setSubmissionsData(data);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to load submissions data",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const shareToText = () => {
    if (!submissionsData) return;

    let text = `${poolName} - Week ${week} Submissions\n\n`;
    
    submissionsData.participants.forEach((participant) => {
      text += `${participant.name}:\n`;
      submissionsData.games.forEach((game, index) => {
        const pick = participant.picks?.get(game.id);
        if (pick) {
          const result = getGameResult(game, pick.predicted_winner);
          const resultIcon = result === 'win' ? '✅' : result === 'loss' ? '❌' : '⏳';
          text += `  ${game.away_team} @ ${game.home_team}: ${pick.predicted_winner} (${pick.confidence_points} pts) ${resultIcon}\n`;
        } else {
          text += `  ${game.away_team} @ ${game.home_team}: Not submitted\n`;
        }
      });
      text += '\n';
    });

    // Copy to clipboard
    navigator.clipboard.writeText(text).then(() => {
      toast({
        title: "Success",
        description: "Submissions copied to clipboard! You can now paste into your text group chat.",
      });
    }).catch(() => {
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = text;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      
      toast({
        title: "Success",
        description: "Submissions copied to clipboard! You can now paste into your text group chat.",
      });
    });
  };

  const getGameResult = (game: Game, predictedWinner: string): 'win' | 'loss' | 'pending' => {
    if (!game.winner || game.status !== 'finished') return 'pending';
    return predictedWinner === game.winner ? 'win' : 'loss';
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-8 w-8 animate-spin" />
        </CardContent>
      </Card>
    );
  }

  if (!submissionsData) {
    return (
      <Card>
        <CardContent className="text-center py-8 text-gray-500">
          No submissions data available for this week
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <CardTitle className="flex items-center space-x-2">
              <Share2 className="h-5 w-5" />
              Week {week} Submissions
            </CardTitle>
            <CardDescription>
              Copy submissions for sharing in text format
            </CardDescription>
          </div>
          <Button
            onClick={shareToText}
            size="sm"
            className="flex items-center gap-2"
          >
            <Share2 className="h-4 w-4" />
            Copy for Text
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="bg-gray-50 p-4 rounded-lg">
          <div className="text-center mb-4">
            <h3 className="font-semibold text-gray-900">{poolName} - Week {week}</h3>
            <p className="text-sm text-gray-600">
              {submissionsData.participants.length} participants, {submissionsData.games.length} games
            </p>
          </div>
          
          <div className="space-y-2 text-sm">
            <div className="flex justify-between items-center">
              <span className="font-medium">Participants with submissions:</span>
              <span className="text-blue-600 font-semibold">
                {submissionsData.participants.filter(p => 
                  submissionsData.games.some(game => p.picks?.has(game.id))
                ).length} / {submissionsData.participants.length}
              </span>
            </div>
            
            <div className="flex justify-between items-center">
              <span className="font-medium">Games this week:</span>
              <span className="text-green-600 font-semibold">{submissionsData.games.length}</span>
            </div>
            
            <div className="flex justify-between items-center">
              <span className="font-medium">Submission status:</span>
              <span className="text-purple-600 font-semibold">
                {submissionsData.participants.length > 0 
                  ? Math.round((submissionsData.participants.filter(p => 
                      submissionsData.games.some(game => p.picks?.has(game.id))
                    ).length / submissionsData.participants.length) * 100)
                  : 0}% complete
              </span>
            </div>
          </div>
          
          <div className="mt-4 p-3 bg-white rounded border">
            <p className="text-xs text-gray-600 text-center">
              Click &quot;Copy for Text&quot; to get a formatted list of all submissions that you can share in group chats or messages.
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
