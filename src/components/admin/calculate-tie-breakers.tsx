'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, Calculator, CheckCircle, AlertCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { PERIOD_WEEKS, SUPER_BOWL_SEASON_TYPE } from '@/lib/utils';

interface CalculateTieBreakersProps {
  poolId?: string;
  poolName?: string;
  week: number;
  season: number;
  seasonType: number;
  isCommissioner?: boolean;
}

interface CalculationResult {
  poolId: string;
  poolName: string;
  winner: string;
  points: number;
  tieBreakerUsed: boolean;
}

interface CalculationError {
  poolId: string;
  poolName: string;
  error: string;
}

export function CalculateTieBreakers({
  poolId,
  poolName,
  week,
  season,
  seasonType,
  isCommissioner = false
}: CalculateTieBreakersProps) {
  const [isCalculating, setIsCalculating] = useState(false);
  const [results, setResults] = useState<CalculationResult[]>([]);
  const [errors, setErrors] = useState<CalculationError[]>([]);
  const { toast } = useToast();

  // Check if this is a period week or Super Bowl
  const isPeriodWeek = PERIOD_WEEKS.includes(week as typeof PERIOD_WEEKS[number]);
  const isSuperBowl = seasonType === SUPER_BOWL_SEASON_TYPE;
  const shouldShowButton = isPeriodWeek || isSuperBowl;

  const handleCalculate = async () => {
    setIsCalculating(true);
    setResults([]);
    setErrors([]);

    try {
      const response = await fetch('/api/admin/calculate-tie-breakers', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          poolId,
          week,
          season
        }),
      });

      const result = await response.json();

      if (result.success) {
        setResults(result.results || []);
        setErrors(result.errors || []);
        
        const successCount = result.results?.length || 0;
        const errorCount = result.errors?.length || 0;
        
        toast({
          title: 'Calculation Complete',
          description: `Tie breakers calculated for ${successCount} pools${errorCount > 0 ? ` with ${errorCount} errors` : ''}`,
        });
      } else {
        toast({
          title: 'Error',
          description: result.error,
          variant: 'destructive'
        });
      }
    } catch (error) {
      console.error('Error calculating tie breakers:', error);
      toast({
        title: 'Error',
        description: 'Failed to calculate tie breakers',
        variant: 'destructive'
      });
    } finally {
      setIsCalculating(false);
    }
  };

  if (!shouldShowButton) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calculator className="h-5 w-5 text-green-600" />
          Calculate Tie Breakers
        </CardTitle>
        <CardDescription>
          Calculate weekly winners with tie breakers for this week.
          {isPeriodWeek && ` This is a tie-breaker week (${PERIOD_WEEKS.join(', ')}) where tie breakers are used.`}
          {isSuperBowl && ' This is the Super Bowl where tie breakers are used.'}
          {isCommissioner && ' You can only calculate tie breakers for pools you created.'}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-2">
          <Button
            onClick={handleCalculate}
            disabled={isCalculating}
            className="flex items-center gap-2"
          >
            {isCalculating ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Calculator className="h-4 w-4" />
            )}
            {isCalculating ? 'Calculating...' : `Calculate Tie Breakers${poolName ? ` for ${poolName}` : ' for All Pools'}`}
          </Button>
        </div>

        {/* Results */}
        {results.length > 0 && (
          <div className="space-y-3">
            <h4 className="font-semibold text-green-800 flex items-center gap-2">
              <CheckCircle className="h-4 w-4" />
              Successful Calculations ({results.length})
            </h4>
            <div className="space-y-2">
              {results.map((result, index) => (
                <div key={index} className="p-3 bg-green-50 border border-green-200 rounded-lg">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium text-green-900">{result.poolName}</div>
                      <div className="text-sm text-green-700">
                        Winner: {result.winner} ({result.points} points)
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {result.tieBreakerUsed && (
                        <Badge variant="secondary" className="bg-blue-100 text-blue-800">
                          Tie Breaker Used
                        </Badge>
                      )}
                      <Badge variant="outline" className="text-green-700">
                        ✓ Calculated
                      </Badge>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Errors */}
        {errors.length > 0 && (
          <div className="space-y-3">
            <h4 className="font-semibold text-red-800 flex items-center gap-2">
              <AlertCircle className="h-4 w-4" />
              Errors ({errors.length})
            </h4>
            <div className="space-y-2">
              {errors.map((error, index) => (
                <div key={index} className="p-3 bg-red-50 border border-red-200 rounded-lg">
                  <div className="font-medium text-red-900">{error.poolName}</div>
                  <div className="text-sm text-red-700">{error.error}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {!isCalculating && results.length === 0 && errors.length === 0 && (
          <Alert>
            <AlertDescription>
              Click the button above to calculate tie breakers for this week.
              Make sure all games have finished before calculating.
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}
