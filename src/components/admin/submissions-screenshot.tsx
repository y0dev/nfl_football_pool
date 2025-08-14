'use client';

import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Camera, Share2, Loader2, Download } from 'lucide-react';
import { getWeeklySubmissionsForScreenshot } from '@/actions/adminActions';
import { useToast } from '@/hooks/use-toast';
import html2canvas from 'html2canvas';
import { Game, Participant } from '@/types/game';

interface SubmissionsScreenshotProps {
  poolId: string;
  poolName: string;
  week: number;
}

export function SubmissionsScreenshot({ poolId, poolName, week }: SubmissionsScreenshotProps) {
  const [submissionsData, setSubmissionsData] = useState<{ games: Game[]; participants: Participant[] } | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isGeneratingScreenshot, setIsGeneratingScreenshot] = useState(false);
  const screenshotRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  useEffect(() => {
    loadSubmissionsData();
  }, [poolId, week]);

  const loadSubmissionsData = async () => {
    setIsLoading(true);
    try {
      // If no week provided, get current week from games
      let weekToUse = week;
      if (!weekToUse) {
        const { getCurrentWeekFromGames } = await import('@/actions/getCurrentWeekFromGames');
        const currentWeekData = await getCurrentWeekFromGames();
        weekToUse = currentWeekData.week;
      }
      
      const data = await getWeeklySubmissionsForScreenshot(poolId, weekToUse);
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

  const generateScreenshot = async () => {
    if (!screenshotRef.current) return;

    setIsGeneratingScreenshot(true);
    try {
      // Add a small delay to ensure the DOM is fully rendered
      await new Promise(resolve => setTimeout(resolve, 100));

      const canvas = await html2canvas(screenshotRef.current, {
        background: '#ffffff',
        useCORS: true,
        allowTaint: true,
      });

      // Convert to blob and download
      canvas.toBlob((blob) => {
        if (blob) {
          const url = URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          link.download = `${poolName}-Week-${week}-Submissions.png`;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          URL.revokeObjectURL(url);
          
          toast({
            title: "Success",
            description: "Screenshot generated and downloaded",
          });
        } else {
          throw new Error('Failed to create blob from canvas');
        }
      }, 'image/png', 0.9);

    } catch (error) {
      console.error('Screenshot generation error:', error);
      
      // Provide a helpful error message
      let errorMessage = "Failed to generate screenshot";
      if (error instanceof Error) {
        if (error.message.includes('foreignObjectRendering')) {
          errorMessage = "Screenshot generation failed due to browser compatibility. Try using the 'Copy to Text' option instead.";
        } else if (error.message.includes('canvas')) {
          errorMessage = "Screenshot generation failed. Try refreshing the page and try again.";
        }
      }
      
      toast({
        title: "Screenshot Error",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsGeneratingScreenshot(false);
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

  const getResultColor = (result: 'win' | 'loss' | 'pending') => {
    switch (result) {
      case 'win': return 'text-green-600 bg-green-100';
      case 'loss': return 'text-red-600 bg-red-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const getResultIcon = (result: 'win' | 'loss' | 'pending') => {
    switch (result) {
      case 'win': return '✅';
      case 'loss': return '❌';
      default: return '⏳';
    }
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
              <Camera className="h-5 w-5" />
              Week {week} Submissions
            </CardTitle>
            <CardDescription>
              Generate a screenshot or copy submissions for sharing
            </CardDescription>
          </div>
          <div className="flex flex-col sm:flex-row gap-2">
            <Button
              onClick={shareToText}
              variant="outline"
              size="sm"
              className="flex items-center gap-2"
            >
              <Share2 className="h-4 w-4" />
              Copy for Text
            </Button>
            <Button
              onClick={generateScreenshot}
              disabled={isGeneratingScreenshot}
              size="sm"
              className="flex items-center gap-2"
            >
              {isGeneratingScreenshot ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Download className="h-4 w-4" />
                  Screenshot
                </>
              )}
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div 
          ref={screenshotRef}
          className="bg-white p-4 sm:p-6 rounded-lg border max-w-4xl mx-auto overflow-x-auto"
          style={{ minHeight: '400px' }}
        >
          {/* Header */}
          <div className="text-center mb-6 pb-4 border-b">
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900">{poolName}</h1>
            <p className="text-base sm:text-lg text-gray-600">Week {week} Submissions</p>
            <p className="text-xs sm:text-sm text-gray-500">
              Generated on {new Date().toLocaleDateString()} at {new Date().toLocaleTimeString()}
            </p>
          </div>

          {/* Games Header */}
          <div className="grid grid-cols-1 gap-4 mb-4">
            <div className="grid grid-cols-3 gap-2 sm:gap-4 font-semibold text-xs sm:text-sm text-gray-700 bg-gray-50 p-2 sm:p-3 rounded">
              <div>Game</div>
              <div>Kickoff</div>
              <div>Teams</div>
            </div>
            {submissionsData.games.map((game, index) => (
              <div key={game.id} className="grid grid-cols-3 gap-2 sm:gap-4 text-xs sm:text-sm border-b pb-2">
                <div className="font-medium">Game {index + 1}</div>
                <div>{new Date(game.kickoff_time).toLocaleDateString()}</div>
                <div>{game.away_team} @ {game.home_team}</div>
              </div>
            ))}
          </div>

          {/* Submissions Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-xs sm:text-sm">
              <thead>
                <tr className="border-b-2 border-gray-300">
                  <th className="text-left p-1 sm:p-2 font-semibold text-gray-700">Participant</th>
                  {submissionsData.games.map((game, index) => (
                    <th key={game.id} className="p-1 sm:p-2 font-semibold text-gray-700 text-center">
                      <div>Game {index + 1}</div>
                      <div className="text-xs font-normal text-gray-500 hidden sm:block">
                        {game.away_team} @ {game.home_team}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {submissionsData.participants.map((participant, pIndex) => (
                  <tr key={pIndex} className={pIndex % 2 === 0 ? 'bg-gray-50' : ''}>
                    <td className="p-1 sm:p-2 font-medium text-gray-900 border-r text-xs sm:text-sm">
                      {participant.name}
                    </td>
                    {submissionsData.games.map((game) => {
                      const pick = participant.picks?.get(game.id);
                      const result = pick ? getGameResult(game, pick.predicted_winner) : null;
                      
                      return (
                        <td key={game.id} className="p-1 sm:p-2 text-center border-r">
                          {pick ? (
                            <div className="space-y-1">
                              <div className="font-medium">{pick.predicted_winner}</div>
                              <div className="text-xs text-gray-500">
                                {pick.confidence_points} pts
                              </div>
                              {result && (
                                <div className={`inline-flex items-center justify-center px-2 py-1 rounded-full text-xs font-medium ${getResultColor(result)}`}>
                                  {getResultIcon(result)}
                                </div>
                              )}
                            </div>
                          ) : (
                            <div className="text-gray-400 italic text-xs">
                              Not submitted
                            </div>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Footer */}
          <div className="text-center mt-6 pt-4 border-t text-xs sm:text-sm text-gray-500">
            <p>Total Participants: {submissionsData.participants.length}</p>
            <p>Total Games: {submissionsData.games.length}</p>
            <div className="flex justify-center items-center gap-4 mt-2 text-xs">
              <span className="flex items-center gap-1">
                <span className="w-3 h-3 bg-green-100 text-green-600 rounded-full flex items-center justify-center text-xs">✅</span>
                Win
              </span>
              <span className="flex items-center gap-1">
                <span className="w-3 h-3 bg-red-100 text-red-600 rounded-full flex items-center justify-center text-xs">❌</span>
                Loss
              </span>
              <span className="flex items-center gap-1">
                <span className="w-3 h-3 bg-gray-100 text-gray-600 rounded-full flex items-center justify-center text-xs">⏳</span>
                Pending
              </span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
