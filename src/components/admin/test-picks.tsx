'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Calendar, ExternalLink, Share2, Users } from 'lucide-react';
import { loadCurrentWeek } from '@/actions/loadCurrentWeek';
import { useToast } from '@/hooks/use-toast';

interface TestPicksProps {
  poolId: string;
  poolName: string;
}

export function TestPicks({ poolId, poolName }: TestPicksProps) {
  const [currentWeek, setCurrentWeek] = useState(1);
  const [selectedWeek, setSelectedWeek] = useState(1);
  const [selectedSeasonType, setSelectedSeasonType] = useState(2); // Default to regular season
  const [availableWeeks, setAvailableWeeks] = useState<number[]>([]);
  const [testUrl, setTestUrl] = useState('');
  const { toast } = useToast();

  const seasonTypeOptions = [
    { value: 1, label: 'Preseason', weeks: [1, 2, 3, 4] }, // 1 = Hall of Fame Game, 2-4 = Preseason Weeks
    { value: 2, label: 'Regular Season', weeks: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18] },
    { value: 3, label: 'Postseason', weeks: [1, 2, 3, 4] }
  ];

  useEffect(() => {
    const loadWeek = async () => {
      try {
        const weekData = await loadCurrentWeek();
        const week = weekData?.week_number || 1;
        setCurrentWeek(week);
        setSelectedWeek(week);
        
        // Set available weeks based on selected season type
        const currentSeasonType = seasonTypeOptions.find(option => option.value === selectedSeasonType);
        setAvailableWeeks(currentSeasonType?.weeks || [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18]);
      } catch (error) {
        console.error('Error loading current week:', error);
        // Fallback to week 1
        setCurrentWeek(1);
        setSelectedWeek(1);
        setAvailableWeeks([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18]);
      }
    };
    loadWeek();
  }, [selectedSeasonType]);

  useEffect(() => {
    const baseUrl = window.location.origin;
    const url = `${baseUrl}/participant?pool=${poolId}&week=${selectedWeek}&seasonType=${selectedSeasonType}`;
    setTestUrl(url);
  }, [poolId, selectedWeek, selectedSeasonType]);

  const handleTestPicks = () => {
    window.open(testUrl, '_blank');
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(testUrl);
      const seasonTypeLabel = seasonTypeOptions.find(opt => opt.value === selectedSeasonType)?.label;
      toast({
        title: "Copied!",
        description: `${seasonTypeLabel} Week ${selectedWeek} test link copied to clipboard`,
      });
    } catch (error) {
      console.error('Failed to copy:', error);
      toast({
        title: "Error",
        description: "Failed to copy link",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Test Weekly Picks</h3>
          <p className="text-sm text-gray-600">
            Test the participant experience for different weeks
          </p>
        </div>
        <Badge variant="outline" className="flex items-center gap-1">
          <Users className="h-3 w-3" />
          {poolName}
        </Badge>
      </div>

      {/* Week Selection */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Select Week to Test
          </CardTitle>
          <CardDescription>
            Choose which week's picks you want to test
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="test-season-type-select">Season Type</Label>
              <Select 
                value={selectedSeasonType.toString()} 
                onValueChange={(value) => {
                  const newSeasonType = parseInt(value);
                  setSelectedSeasonType(newSeasonType);
                  // Reset to first week of the new season type
                  const newSeasonTypeOption = seasonTypeOptions.find(option => option.value === newSeasonType);
                  if (newSeasonTypeOption && newSeasonTypeOption.weeks.length > 0) {
                    setSelectedWeek(newSeasonTypeOption.weeks[0]);
                  }
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select season type" />
                </SelectTrigger>
                <SelectContent>
                  {seasonTypeOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value.toString()}>
                      <div className="flex items-center gap-2">
                        {option.value === 1 && <span className="text-orange-600">🏈</span>}
                        {option.value === 2 && <span className="text-blue-600">🏆</span>}
                        {option.value === 3 && <span className="text-purple-600">🎯</span>}
                        {option.label}
                        <span className="text-xs text-gray-500">({option.weeks.length} weeks)</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="test-week-select">Week</Label>
              <Select value={selectedWeek.toString()} onValueChange={(value) => setSelectedWeek(parseInt(value))}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a week" />
                </SelectTrigger>
                <SelectContent>
                  {availableWeeks.map((week) => (
                    <SelectItem key={week} value={week.toString()}>
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4" />
                        Week {week}
                        {week === currentWeek && (
                          <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">Current</span>
                        )}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Test URL Display */}
          <div>
            <Label>Test URL</Label>
            <div className="flex gap-2 mt-1">
              <input
                type="text"
                value={testUrl}
                readOnly
                className="flex-1 px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-sm"
              />
              <Button
                onClick={handleCopyLink}
                variant="outline"
                size="sm"
                className="flex items-center gap-2"
              >
                <Share2 className="h-4 w-4" />
                Copy
              </Button>
            </div>
          </div>

          {/* Test Button */}
          <Button
            onClick={handleTestPicks}
            className="w-full flex items-center gap-2"
          >
            <ExternalLink className="h-4 w-4" />
            Test {seasonTypeOptions.find(opt => opt.value === selectedSeasonType)?.label} Week {selectedWeek} Picks
          </Button>
        </CardContent>
      </Card>

      {/* Instructions */}
      <Card>
        <CardHeader>
          <CardTitle>How to Test</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-sm font-medium">
              1
            </div>
            <div>
              <p className="font-medium">Select a Week</p>
              <p className="text-sm text-gray-600">Choose which week you want to test from the dropdown above</p>
            </div>
          </div>
          
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-sm font-medium">
              2
            </div>
            <div>
              <p className="font-medium">Click "Test Picks"</p>
              <p className="text-sm text-gray-600">This will open the participant page in a new tab</p>
            </div>
          </div>
          
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-sm font-medium">
              3
            </div>
            <div>
              <p className="font-medium">Test the Experience</p>
              <p className="text-sm text-gray-600">Try making picks, checking the leaderboard, and testing all features</p>
            </div>
          </div>
          
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-sm font-medium">
              4
            </div>
            <div>
              <p className="font-medium">Share the Link</p>
              <p className="text-sm text-gray-600">Copy the test URL to share with participants for that specific week</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Current Week Info */}
      {selectedWeek === currentWeek && (
        <Card className="border-blue-200 bg-blue-50">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-blue-800">
              <Calendar className="h-4 w-4" />
              <span className="font-medium">Testing Current Week</span>
            </div>
            <p className="text-sm text-blue-700 mt-1">
              You're testing Week {currentWeek}, which is the current active week. This is what participants will see when they use the regular pool link.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
