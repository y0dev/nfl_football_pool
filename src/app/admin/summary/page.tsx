'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { 
  ArrowLeft, 
  CheckCircle, 
  XCircle, 
  AlertTriangle, 
  Trophy,
  Users,
  Calendar,
  BarChart3,
  RefreshCw
} from 'lucide-react';

interface SummaryResult {
  poolId: string;
  poolName: string;
  period: string;
  winner: string | null;
  points?: number;
  correctPicks?: number;
  weeksWon?: number;
  tieBreakerUsed?: boolean;
  tieBreakerAnswer?: number;
  tieBreakerDifference?: number;
  totalParticipants?: number;
  status: 'generated' | 'no_winner' | 'error';
  reason?: string;
}

interface SummaryData {
  operation: string;
  timestamp: string;
  poolsProcessed: number;
  poolsWithWinners: number;
  generatedWinners: number;
  noWinners: number;
  errors: number;
  results: SummaryResult[];
}

function AdminSummaryContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [summaryData, setSummaryData] = useState<SummaryData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadSummaryData = async () => {
      try {
        setIsLoading(true);
        
        // Get summary data from URL params or localStorage
        const operation = searchParams.get('operation') || 'Period Winners Generation';
        const dataParam = searchParams.get('data');
        
        let data: SummaryData;
        
        if (dataParam) {
          // Data passed via URL
          data = JSON.parse(decodeURIComponent(dataParam));
        } else {
          // Try to get from localStorage
          const storedData = localStorage.getItem('adminSummaryData');
          if (storedData) {
            data = JSON.parse(storedData);
          } else {
            throw new Error('No summary data available');
          }
        }
        
        setSummaryData(data);
      } catch (err) {
        console.error('Error loading summary data:', err);
        setError(err instanceof Error ? err.message : 'Failed to load summary data');
      } finally {
        setIsLoading(false);
      }
    };

    loadSummaryData();
  }, [searchParams]);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'generated':
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'no_winner':
        return <AlertTriangle className="h-4 w-4 text-yellow-600" />;
      case 'error':
        return <XCircle className="h-4 w-4 text-red-600" />;
      default:
        return <AlertTriangle className="h-4 w-4 text-gray-600" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'generated':
        return <Badge className="bg-green-100 text-green-800">Success</Badge>;
      case 'no_winner':
        return <Badge className="bg-yellow-100 text-yellow-800">No Winner</Badge>;
      case 'error':
        return <Badge className="bg-red-100 text-red-800">Error</Badge>;
      default:
        return <Badge className="bg-gray-100 text-gray-800">Unknown</Badge>;
    }
  };

  const groupResultsByPool = (results: SummaryResult[]) => {
    return results.reduce((acc, item) => {
      if (!acc[item.poolName]) {
        acc[item.poolName] = [];
      }
      acc[item.poolName].push(item);
      return acc;
    }, {} as Record<string, SummaryResult[]>);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center">
        <div className="flex items-center gap-3">
          <RefreshCw className="h-6 w-6 animate-spin text-blue-600" />
          <span className="text-lg text-gray-600">Loading summary...</span>
        </div>
      </div>
    );
  }

  if (error || !summaryData) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-red-600">
              <XCircle className="h-5 w-5" />
              Error
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-gray-600 mb-4">{error || 'No summary data available'}</p>
            <Button onClick={() => router.back()} className="w-full">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Go Back
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const poolResults = groupResultsByPool(summaryData.results);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-4 mb-4">
            <Button
              variant="outline"
              size="sm"
              onClick={() => router.back()}
              className="flex items-center gap-2"
            >
              <ArrowLeft className="h-4 w-4" />
              Back
            </Button>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">{summaryData.operation}</h1>
              <p className="text-gray-600">
                Completed on {new Date(summaryData.timestamp).toLocaleString()}
              </p>
            </div>
          </div>
        </div>

        {/* Summary Statistics */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <Users className="h-5 w-5 text-blue-600" />
                <div>
                  <p className="text-sm text-gray-600">Pools Processed</p>
                  <p className="text-2xl font-bold text-blue-600">{summaryData.poolsProcessed}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <Trophy className="h-5 w-5 text-green-600" />
                <div>
                  <p className="text-sm text-gray-600">Pools with Winners</p>
                  <p className="text-2xl font-bold text-green-600">{summaryData.poolsWithWinners}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-emerald-600" />
                <div>
                  <p className="text-sm text-gray-600">Winners Generated</p>
                  <p className="text-2xl font-bold text-emerald-600">{summaryData.generatedWinners}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-yellow-600" />
                <div>
                  <p className="text-sm text-gray-600">No Winners</p>
                  <p className="text-2xl font-bold text-yellow-600">{summaryData.noWinners}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <XCircle className="h-5 w-5 text-red-600" />
                <div>
                  <p className="text-sm text-gray-600">Errors</p>
                  <p className="text-2xl font-bold text-red-600">{summaryData.errors}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Detailed Results */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Detailed Results
            </CardTitle>
            <CardDescription>
              Complete breakdown of all processed pools and periods
            </CardDescription>
          </CardHeader>
          <CardContent>
            {Object.keys(poolResults).length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <AlertTriangle className="h-12 w-12 mx-auto mb-4 text-gray-400" />
                <p>No results to display</p>
              </div>
            ) : (
              <div className="space-y-6">
                {Object.entries(poolResults).map(([poolName, periods]) => {
                  const generatedPeriods = periods.filter(p => p.status === 'generated');
                  const noWinnerPeriods = periods.filter(p => p.status === 'no_winner');
                  const errorPeriods = periods.filter(p => p.status === 'error');

                  return (
                    <div key={poolName} className="border rounded-lg p-4">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                          <Trophy className="h-5 w-5 text-blue-600" />
                          {poolName}
                        </h3>
                        <div className="flex gap-2">
                          {generatedPeriods.length > 0 && (
                            <Badge className="bg-green-100 text-green-800">
                              {generatedPeriods.length} Winners
                            </Badge>
                          )}
                          {noWinnerPeriods.length > 0 && (
                            <Badge className="bg-yellow-100 text-yellow-800">
                              {noWinnerPeriods.length} No Winners
                            </Badge>
                          )}
                          {errorPeriods.length > 0 && (
                            <Badge className="bg-red-100 text-red-800">
                              {errorPeriods.length} Errors
                            </Badge>
                          )}
                        </div>
                      </div>

                      <div className="space-y-3">
                        {/* Generated Winners */}
                        {generatedPeriods.map((period, index) => (
                          <div key={index} className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
                            <div className="flex items-center gap-3">
                              {getStatusIcon(period.status)}
                              <div>
                                <p className="font-medium text-gray-900">
                                  {period.period}: {period.winner}
                                </p>
                                <div className="flex items-center gap-4 text-sm text-gray-600">
                                  <span>{period.points} points</span>
                                  <span>{period.correctPicks}/{period.totalParticipants} picks</span>
                                  {period.weeksWon !== undefined && (
                                    <span>{period.weeksWon} weeks won</span>
                                  )}
                                  {period.tieBreakerUsed && (
                                    <Badge className="bg-blue-100 text-blue-800 text-xs">
                                      Tie-breaker used
                                    </Badge>
                                  )}
                                </div>
                              </div>
                            </div>
                            {getStatusBadge(period.status)}
                          </div>
                        ))}

                        {/* No Winners */}
                        {noWinnerPeriods.map((period, index) => (
                          <div key={index} className="flex items-center justify-between p-3 bg-yellow-50 rounded-lg">
                            <div className="flex items-center gap-3">
                              {getStatusIcon(period.status)}
                              <div>
                                <p className="font-medium text-gray-900">
                                  {period.period}: No winner
                                </p>
                                <p className="text-sm text-gray-600">{period.reason}</p>
                              </div>
                            </div>
                            {getStatusBadge(period.status)}
                          </div>
                        ))}

                        {/* Errors */}
                        {errorPeriods.map((period, index) => (
                          <div key={index} className="flex items-center justify-between p-3 bg-red-50 rounded-lg">
                            <div className="flex items-center gap-3">
                              {getStatusIcon(period.status)}
                              <div>
                                <p className="font-medium text-gray-900">
                                  {period.period}: Error
                                </p>
                                <p className="text-sm text-gray-600">{period.reason}</p>
                              </div>
                            </div>
                            {getStatusBadge(period.status)}
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Actions */}
        <div className="mt-8 flex justify-center gap-4">
          <Button onClick={() => router.back()} variant="outline">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Dashboard
          </Button>
          <Button onClick={() => window.print()}>
            <BarChart3 className="h-4 w-4 mr-2" />
            Print Summary
          </Button>
        </div>
      </div>
    </div>
  );
}

export default function AdminSummaryPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center">
        <div className="flex items-center gap-3">
          <RefreshCw className="h-6 w-6 animate-spin text-blue-600" />
          <span className="text-lg text-gray-600">Loading summary...</span>
        </div>
      </div>
    }>
      <AdminSummaryContent />
    </Suspense>
  );
}
