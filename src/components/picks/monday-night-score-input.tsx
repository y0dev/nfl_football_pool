'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Clock, Target } from 'lucide-react';
import { PERIOD_WEEKS, SUPER_BOWL_SEASON_TYPE } from '@/lib/utils';

interface MondayNightScoreInputProps {
  poolId: string;
  weekNumber: number;
  seasonType: number;
  participantId: string;
  initialScore?: number;
  onScoreChange: (score: number | null) => void;
  isRequired?: boolean;
}

export function MondayNightScoreInput({
  poolId,
  weekNumber,
  seasonType,
  participantId,
  initialScore,
  onScoreChange,
  isRequired = false
}: MondayNightScoreInputProps) {
  const [score, setScore] = useState<number | null>(initialScore || null);
  const [isValid, setIsValid] = useState(true);

  // Check if this is a period week where tie breakers are used
  const isPeriodWeek = PERIOD_WEEKS.includes(weekNumber as typeof PERIOD_WEEKS[number]);
  const isSuperBowl = seasonType === SUPER_BOWL_SEASON_TYPE;
  const shouldShowInput = isPeriodWeek || isSuperBowl;

  useEffect(() => {
    onScoreChange(score);
  }, [score, onScoreChange]);

  const handleScoreChange = (value: string) => {
    const numericValue = value === '' ? null : parseInt(value, 10);
    
    // Validate score (reasonable range for NFL game scores)
    if (numericValue !== null) {
      if (numericValue < 0 || numericValue > 100) {
        setIsValid(false);
      } else {
        setIsValid(true);
      }
    } else {
      setIsValid(true);
    }
    
    setScore(numericValue);
  };

  if (!shouldShowInput) {
    return null;
  }

  return (
    <Card className="border-blue-200 bg-blue-50">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Target className="h-5 w-5 text-blue-600" />
          Monday Night Game Score
        </CardTitle>
        <CardDescription>
          Enter your prediction for the total points scored in Monday night&apos;s game.
          This will be used as a tie-breaker if needed.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          <div>
            <Label htmlFor="monday-night-score" className="text-sm font-medium">
              Total Points Scored
              {isRequired && <span className="text-red-500 ml-1">*</span>}
            </Label>
            <Input
              id="monday-night-score"
              type="number"
              min="0"
              max="100"
              step="1"
              placeholder="e.g., 45"
              value={score || ''}
              onChange={(e) => handleScoreChange(e.target.value)}
              className={`mt-1 ${!isValid ? 'border-red-500 focus:border-red-500' : ''}`}
            />
            {!isValid && (
              <p className="text-sm text-red-600 mt-1">
                Please enter a score between 0 and 100
              </p>
            )}
          </div>
          
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <Clock className="h-4 w-4" />
            <span>Used for tie-breaking in period weeks ({PERIOD_WEEKS.join(', ')}) and Super Bowl (playoffs)</span>
          </div>
          
          {score !== null && isValid && (
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="text-green-700 bg-green-100">
                Score: {score} points
              </Badge>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
