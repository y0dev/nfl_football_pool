'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Save, RefreshCw, Loader2, Settings } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { getTieBreakerSettings, saveTieBreakerSettings, TieBreakerSettings as TieBreakerSettingsType } from '@/lib/tie-breakers';
import { PERIOD_WEEKS } from '@/lib/utils';
import { getMondayNightGameInfo } from '@/lib/monday-night-utils';
import { Game } from '@/types/game';

interface TieBreakerSettingsProps {
  poolId: string;
  poolName: string;
}

const DEFAULT_TIE_BREAKERS = [
  {
    id: 'total_points',
    name: 'Total Points (All Weeks)',
    description: 'Break ties by total points across all weeks'
  },
  {
    id: 'correct_picks',
    name: 'Most Correct Picks',
    description: 'Break ties by total correct picks across all weeks'
  },
  {
    id: 'accuracy',
    name: 'Pick Accuracy',
    description: 'Break ties by percentage of correct picks'
  },
  {
    id: 'last_week',
    name: 'Last Week Performance',
    description: 'Break ties by points in the most recent week'
  },
  {
    id: 'monday_night_total',
    name: 'Monday Night Game Total',
    description: 'Break ties by closest prediction to Monday night game total score'
  },
  {
    id: 'custom',
    name: 'Custom Question',
    description: 'Use a custom tie-breaker question'
  }
];

export function TieBreakerSettings({ poolId, poolName }: TieBreakerSettingsProps) {
  const [settings, setSettings] = useState<TieBreakerSettingsType>({
    method: 'total_points',
    question: null,
    answer: null,
    monday_night_game_id: null
  });
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [games, setGames] = useState<Game[]>([]);
  const [mondayNightGameInfo, setMondayNightGameInfo] = useState<{
    game: Game;
    displayText: string;
  } | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    loadTieBreakerSettings();
  }, [poolId]);

  useEffect(() => {
    if (settings.method === 'monday_night_total') {
      loadGames();
    }
  }, [settings.method]);

  const loadTieBreakerSettings = async () => {
    setIsLoading(true);
    try {
      const settings = await getTieBreakerSettings(poolId);
      if (settings) {
        setSettings(settings);
      } else {
        // Use default settings if none exist
        setSettings({
          method: 'total_points',
          question: null,
          answer: null
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to load tie-breaker settings",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const loadGames = async () => {
    try {
      // Load games for the current week (we'll use week 1 as default for now)
      // In a real implementation, you might want to get the current week
      const response = await fetch('/api/games/week?week=1&seasonType=2');
      if (response.ok) {
        const result = await response.json();
        if (result.success) {
          setGames(result.games);
          
          // Identify the Monday night game
          const mondayNightInfo = getMondayNightGameInfo(result.games);
          setMondayNightGameInfo(mondayNightInfo);
          
          // If we have a Monday night game and no game ID is set, set it
          if (mondayNightInfo && !settings.monday_night_game_id) {
            setSettings(prev => ({
              ...prev,
              monday_night_game_id: mondayNightInfo.game.id
            }));
          }
        }
      }
    } catch (error) {
      console.error('Error loading games:', error);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const success = await saveTieBreakerSettings(poolId, settings);
      
      if (success) {
        toast({
          title: "Success",
          description: "Tie-breaker settings saved successfully",
        });
      } else {
        throw new Error('Failed to save settings');
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to save tie-breaker settings",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleMethodChange = (method: string) => {
    setSettings(prev => ({
      ...prev,
      method,
      question: method === 'custom' ? prev.question : null,
      answer: method === 'custom' ? prev.answer : null
    }));
  };

  const getMethodDescription = (methodId: string) => {
    const method = DEFAULT_TIE_BREAKERS.find(m => m.id === methodId);
    return method?.description || '';
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

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <Settings className="h-5 w-5" />
          Tie-Breaker Settings
        </CardTitle>
        <CardDescription>
          Configure how ties are broken in {poolName}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Method Selection */}
        <div className="space-y-4">
          <Label htmlFor="method">Tie-Breaker Method</Label>
          <Select value={settings.method} onValueChange={handleMethodChange}>
            <SelectTrigger>
              <SelectValue placeholder="Select tie-breaker method" />
            </SelectTrigger>
            <SelectContent>
              {DEFAULT_TIE_BREAKERS.map((method) => (
                <SelectItem key={method.id} value={method.id}>
                  <div className="flex flex-col">
                    <span className="font-medium">{method.name}</span>
                    <span className="text-xs text-gray-500">{method.description}</span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          
          {settings.method && (
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-sm text-blue-800">
                <strong>How it works:</strong> {getMethodDescription(settings.method)}
              </p>
            </div>
          )}
        </div>

        {/* Custom Question (only shown when custom method is selected) */}
        {settings.method === 'custom' && (
          <div className="space-y-4">
            <div>
              <Label htmlFor="question">Custom Tie-Breaker Question</Label>
              <Textarea
                id="question"
                placeholder="e.g., What will be the total combined score of all games this week?"
                value={settings.question || ''}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setSettings(prev => ({ ...prev, question: e.target.value }))}
                className="mt-2"
              />
            </div>
            
            <div>
              <Label htmlFor="answer">Correct Answer</Label>
              <Input
                id="answer"
                type="number"
                step="0.01"
                placeholder="e.g., 245.5"
                value={settings.answer || ''}
                onChange={(e) => setSettings(prev => ({ ...prev, answer: parseFloat(e.target.value) || null }))}
                className="mt-2"
              />
              <p className="text-xs text-gray-500 mt-1">
                This is the answer that will be used to determine the winner in case of a tie
              </p>
            </div>
          </div>
        )}

        {/* Monday Night Total Answer (only shown when Monday night method is selected) */}
        {settings.method === 'monday_night_total' && (
          <div className="space-y-4">
            {/* Monday Night Game Info */}
            {mondayNightGameInfo ? (
              <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
                <div className="flex items-center gap-2 mb-2">
                  <Settings className="h-4 w-4 text-blue-600" />
                  <span className="font-medium text-sm text-blue-900">Selected Monday Night Game:</span>
                </div>
                <div className="text-lg font-semibold text-blue-800">
                  {mondayNightGameInfo.displayText}
                </div>
                <div className="text-xs text-gray-600 mt-1">
                  Game ID: {mondayNightGameInfo.game.id} | Kickoff: {new Date(mondayNightGameInfo.game.kickoff_time).toLocaleString()}
                </div>
              </div>
            ) : (
              <div className="p-3 bg-yellow-50 rounded-lg border border-yellow-200">
                <div className="text-sm text-yellow-800">
                  No Monday night game found for the current week. Please check the games data.
                </div>
              </div>
            )}
            
            <div>
              <Label htmlFor="monday_answer">Monday Night Game Total Score</Label>
              <Input
                id="monday_answer"
                type="number"
                step="1"
                placeholder="e.g., 45"
                value={settings.answer || ''}
                onChange={(e) => setSettings(prev => ({ ...prev, answer: parseInt(e.target.value) || null }))}
                className="mt-2"
              />
              <p className="text-xs text-gray-500 mt-1">
                Enter the actual total points scored in the Monday night game. Participants will predict this score and the closest prediction wins the tie-breaker.
              </p>
            </div>
          </div>
        )}

        {/* Preview */}
        <div className="p-4 bg-gray-50 rounded-lg">
          <h4 className="font-medium mb-2">Tie-Breaker Preview</h4>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span>Method:</span>
              <Badge variant="secondary">
                {DEFAULT_TIE_BREAKERS.find(m => m.id === settings.method)?.name}
              </Badge>
            </div>
            {settings.method === 'custom' && settings.question && (
              <div className="flex justify-between">
                <span>Question:</span>
                <span className="text-gray-600 max-w-xs text-right">{settings.question}</span>
              </div>
            )}
            {settings.method === 'custom' && settings.answer !== null && (
              <div className="flex justify-between">
                <span>Answer:</span>
                <span className="font-medium">{settings.answer}</span>
              </div>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-between items-center">
          <Button
            variant="outline"
            onClick={loadTieBreakerSettings}
            disabled={isSaving}
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Reset
          </Button>
          
          <Button
            onClick={handleSave}
            disabled={isSaving || (settings.method === 'custom' && (!settings.question || settings.answer === null))}
          >
            {isSaving ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                Save Settings
              </>
            )}
          </Button>
        </div>

        {/* Help Text */}
        <div className="text-xs text-gray-500 space-y-1">
          <p><strong>Note:</strong> Tie-breaker settings apply to all weeks in the pool.</p>
          <p>For normal pools, tie-breakers are only used during tie-breaker weeks ({PERIOD_WEEKS.join(', ')}) and the Super Bowl (playoffs).</p>
          <p>For custom questions, participants will be asked to provide their answer when submitting picks.</p>
          <p>The participant whose answer is closest to the correct answer wins the tie-breaker.</p>
        </div>
      </CardContent>
    </Card>
  );
}
