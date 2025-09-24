'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Download, FileSpreadsheet, Calendar, Trophy } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { PERIOD_WEEKS } from '@/lib/utils';
import { getSupabaseServiceClient } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';

interface ExportDataProps {
  poolId: string;
  poolName: string;
  currentWeek?: number;
  currentSeason?: number;
}

export function ExportData({ poolId, poolName, currentWeek = 1, currentSeason = new Date().getFullYear() }: ExportDataProps) {
  const [isExportingWeekly, setIsExportingWeekly] = useState(false);
  const [isExportingPeriod, setIsExportingPeriod] = useState(false);
  const [selectedWeek, setSelectedWeek] = useState(currentWeek.toString());
  const [selectedSeason, setSelectedSeason] = useState(currentSeason.toString());
  const [selectedPeriod, setSelectedPeriod] = useState('');
  const [selectedSeasonType, setSelectedSeasonType] = useState('2');
  const [pools, setPools] = useState<any[]>([]);
  const [selectedPoolId, setSelectedPoolId] = useState(poolId);
  const [isLoadingPools, setIsLoadingPools] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();

  const isSystemWide = poolId === 'system-wide';

  // Load pools when component mounts if this is system-wide export
  useEffect(() => {
    if (isSystemWide && user?.email) {
      loadPools();
    }
  }, [isSystemWide, user?.email]);

  const loadPools = async () => {
    setIsLoadingPools(true);
    try {
      if (!user?.email) return;
      
      // Get pools based on user role - same logic as pools page
      const supabase = getSupabaseServiceClient();
      
      let poolsQuery = supabase
        .from('pools')
        .select('*')
        .order('created_at', { ascending: false });
      
      // For system-wide exports, we want all pools (super admin behavior)
      // This matches the admin dashboard context where super admins can export from any pool
      const { data: poolsData, error: poolsError } = await poolsQuery;
      
      if (poolsError) throw poolsError;
      
      setPools(poolsData || []);
      if (poolsData && poolsData.length > 0) {
        setSelectedPoolId(poolsData[0].id);
      }
    } catch (error) {
      console.error('Error loading pools:', error);
      toast({
        title: "Error",
        description: "Failed to load pools",
        variant: "destructive",
      });
    } finally {
      setIsLoadingPools(false);
    }
  };

  const handleExportWeeklyPicks = async () => {
    if (!selectedPoolId || selectedPoolId === 'system-wide') {
      toast({
        title: "Selection Required",
        description: "Please select a pool to export data from.",
        variant: "destructive",
      });
      return;
    }

    // Validate inputs
    const week = parseInt(selectedWeek);
    const season = parseInt(selectedSeason);
    const seasonType = parseInt(selectedSeasonType);

    if (isNaN(week) || isNaN(season) || isNaN(seasonType)) {
      toast({
        title: "Invalid Input",
        description: "Please enter valid week, season, and season type values.",
        variant: "destructive",
      });
      return;
    }

    setIsExportingWeekly(true);
    try {
      const response = await fetch('/api/admin/export/weekly-picks', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          poolId: selectedPoolId,
          week: week,
          season: season,
          seasonType: seasonType
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Export failed');
      }

      // Get the CSV content
      const csvContent = await response.text();
      
      // Create and download the file
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', `pool-${selectedPoolId}-week-${selectedWeek}-season-${selectedSeason}-picks.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      toast({
        title: "Export Successful",
        description: `Weekly picks for Week ${selectedWeek} have been exported successfully.`,
      });
    } catch (error) {
      console.error('Error exporting weekly picks:', error);
      toast({
        title: "Export Failed",
        description: error instanceof Error ? error.message : 'Failed to export weekly picks',
        variant: "destructive",
      });
    } finally {
      setIsExportingWeekly(false);
    }
  };

  const handleExportPeriodData = async () => {
    if (!selectedPoolId || selectedPoolId === 'system-wide') {
      toast({
        title: "Selection Required",
        description: "Please select a pool to export data from.",
        variant: "destructive",
      });
      return;
    }

    if (!selectedPeriod) {
      toast({
        title: "Selection Required",
        description: "Please select a period to export.",
        variant: "destructive",
      });
      return;
    }

    // Validate inputs
    const season = parseInt(selectedSeason);

    if (isNaN(season)) {
      toast({
        title: "Invalid Input",
        description: "Please enter a valid season value.",
        variant: "destructive",
      });
      return;
    }

    setIsExportingPeriod(true);
    try {
      const response = await fetch('/api/admin/export/period-data', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          poolId: selectedPoolId,
          periodName: selectedPeriod,
          season: season
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Export failed');
      }

      // Get the CSV content
      const csvContent = await response.text();
      
      // Create and download the file
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', `pool-${selectedPoolId}-${selectedPeriod.replace(/\s+/g, '-').toLowerCase()}-season-${selectedSeason}-period-data.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      toast({
        title: "Export Successful",
        description: `Period data for ${selectedPeriod} has been exported successfully.`,
      });
    } catch (error) {
      console.error('Error exporting period data:', error);
      toast({
        title: "Export Failed",
        description: error instanceof Error ? error.message : 'Failed to export period data',
        variant: "destructive",
      });
    } finally {
      setIsExportingPeriod(false);
    }
  };

  const isPeriodWeek = PERIOD_WEEKS.includes(parseInt(selectedWeek) as typeof PERIOD_WEEKS[number]);

  return (
    <div className="space-y-6">
      {/* Weekly Picks Export */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5 text-green-600" />
            Export Weekly Picks
          </CardTitle>
          <CardDescription>
            Export all picks for a specific week in CSV format for manual calculation and verification.
            Includes game results, confidence points, and Monday night scores (if applicable).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Pool Selection - Only show for system-wide exports */}
          {isSystemWide && (
            <div>
              <Label htmlFor="pool-select">Pool</Label>
              <Select 
                value={selectedPoolId} 
                onValueChange={setSelectedPoolId}
                disabled={isLoadingPools}
              >
                <SelectTrigger>
                  <SelectValue placeholder={isLoadingPools ? "Loading pools..." : "Select a pool"} />
                </SelectTrigger>
                <SelectContent>
                  {pools.map(pool => (
                    <SelectItem key={pool.id} value={pool.id}>
                      {pool.name} ({pool.is_active ? 'Active' : 'Inactive'})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {pools.length === 0 && !isLoadingPools && (
                <p className="text-sm text-gray-500 mt-1">No pools available</p>
              )}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label htmlFor="week-select">Week</Label>
              <Select value={selectedWeek} onValueChange={setSelectedWeek}>
                <SelectTrigger>
                  <SelectValue placeholder="Select week" />
                </SelectTrigger>
                <SelectContent>
                  {Array.from({ length: 18 }, (_, i) => i + 1).map(week => (
                    <SelectItem key={week} value={week.toString()}>
                      Week {week}
                      {PERIOD_WEEKS.includes(week as typeof PERIOD_WEEKS[number]) && ' (Tie-breaker Week)'}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="season-input">Season</Label>
              <Input
                id="season-input"
                type="number"
                value={selectedSeason}
                onChange={(e) => setSelectedSeason(e.target.value)}
                min="2020"
                max="2030"
              />
            </div>

            <div>
              <Label htmlFor="season-type-select">Season Type</Label>
              <Select value={selectedSeasonType} onValueChange={setSelectedSeasonType}>
                <SelectTrigger>
                  <SelectValue placeholder="Select season type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">Preseason</SelectItem>
                  <SelectItem value="2">Regular Season</SelectItem>
                  <SelectItem value="3">Postseason</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {isPeriodWeek && (
            <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
              <div className="flex items-center gap-2 text-blue-800">
                <Calendar className="h-4 w-4" />
                <span className="text-sm font-medium">Tie-breaker Week Detected</span>
              </div>
              <p className="text-sm text-blue-700 mt-1">
                This week is a tie-breaker week. Monday night scores (tie breakers) will be included in the export.
              </p>
            </div>
          )}

          <Button 
            onClick={handleExportWeeklyPicks}
            disabled={isExportingWeekly || (isSystemWide && !selectedPoolId)}
            className="w-full md:w-auto"
          >
            <Download className="h-4 w-4 mr-2" />
            {isExportingWeekly ? 'Exporting...' : 'Export Weekly Picks'}
          </Button>
        </CardContent>
      </Card>

      {/* Period Data Export */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Trophy className="h-5 w-5 text-purple-600" />
            Export Period Data
          </CardTitle>
          <CardDescription>
            Export complete period standings and calculations for manual verification.
            Includes weekly breakdowns, total points, and period rankings.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Pool Selection - Only show for system-wide exports */}
          {isSystemWide && (
            <div>
              <Label htmlFor="period-pool-select">Pool</Label>
              <Select 
                value={selectedPoolId} 
                onValueChange={setSelectedPoolId}
                disabled={isLoadingPools}
              >
                <SelectTrigger>
                  <SelectValue placeholder={isLoadingPools ? "Loading pools..." : "Select a pool"} />
                </SelectTrigger>
                <SelectContent>
                  {pools.map(pool => (
                    <SelectItem key={pool.id} value={pool.id}>
                      {pool.name} ({pool.is_active ? 'Active' : 'Inactive'})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {pools.length === 0 && !isLoadingPools && (
                <p className="text-sm text-gray-500 mt-1">No pools available</p>
              )}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="period-select">Period</Label>
              <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
                <SelectTrigger>
                  <SelectValue placeholder="Select period" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Period 1">Period 1 (Weeks 1-4)</SelectItem>
                  <SelectItem value="Period 2">Period 2 (Weeks 5-9)</SelectItem>
                  <SelectItem value="Period 3">Period 3 (Weeks 10-14)</SelectItem>
                  <SelectItem value="Period 4">Period 4 (Weeks 15-18)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="period-season-input">Season</Label>
              <Input
                id="period-season-input"
                type="number"
                value={selectedSeason}
                onChange={(e) => setSelectedSeason(e.target.value)}
                min="2020"
                max="2030"
              />
            </div>
          </div>

          <Button 
            onClick={handleExportPeriodData}
            disabled={isExportingPeriod || !selectedPeriod || (isSystemWide && !selectedPoolId)}
            className="w-full md:w-auto"
          >
            <Download className="h-4 w-4 mr-2" />
            {isExportingPeriod ? 'Exporting...' : 'Export Period Data'}
          </Button>
        </CardContent>
      </Card>

      {/* Export Information */}
      <Card className="bg-gray-50">
        <CardHeader>
          <CardTitle className="text-sm text-gray-700">Export Information</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-gray-600 space-y-2">
          <div>
            <strong>Weekly Picks Export includes:</strong>
            <ul className="list-disc list-inside ml-4 mt-1">
              <li>All participant picks with confidence points</li>
              <li>Game results and actual winners</li>
              <li>Points earned for each pick</li>
              <li>Monday night scores (for tie-breaker weeks)</li>
              <li>Game kickoff times and status</li>
            </ul>
          </div>
          <div>
            <strong>Period Data Export includes:</strong>
            <ul className="list-disc list-inside ml-4 mt-1">
              <li>Total points and correct picks for the period</li>
              <li>Weekly breakdown for each participant</li>
              <li>Weeks won count</li>
              <li>Accuracy percentages</li>
              <li>Period rankings</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
