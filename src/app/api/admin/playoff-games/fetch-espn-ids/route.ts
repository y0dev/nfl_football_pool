import { debugLog } from '@/lib/utils';
import { NextRequest, NextResponse } from 'next/server';

// POST - Fetch ESPN game IDs for playoff games
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { season, week } = body;

    if (!season || !week) {
      return NextResponse.json(
        { success: false, error: 'Season and week are required' },
        { status: 400 }
      );
    }

    // Calculate playoff dates dynamically based on year
    // Returns dates in YYYYMMDD format
    const getPlayoffDates = (weekNum: number, year: number): string[] => {
      const dates: string[] = [];
      
      switch (weekNum) {
        case 1: // Wild Card - 2nd weekend of January (Saturday, Sunday, and Monday)
          {
            // Find first Saturday of January
            const firstDayOfJan = new Date(year, 0, 1); // January is month 0
            const dayOfWeek = firstDayOfJan.getDay(); // 0 = Sunday, 6 = Saturday
            // Calculate first Saturday (if Jan 1 is Saturday, it's day 0, otherwise add days to get to Saturday)
            const daysToFirstSaturday = dayOfWeek === 6 ? 0 : (6 - dayOfWeek);
            const firstSaturday = new Date(year, 0, 1 + daysToFirstSaturday);
            
            // 2nd weekend is 7 days later (next Saturday, Sunday, and Monday)
            const secondSaturday = new Date(firstSaturday);
            secondSaturday.setDate(secondSaturday.getDate() + 7);
            const secondSunday = new Date(secondSaturday);
            secondSunday.setDate(secondSunday.getDate() + 1);
            const secondMonday = new Date(secondSunday);
            secondMonday.setDate(secondMonday.getDate() + 1);
            
            // Include Saturday, Sunday, and Monday, plus a few days buffer
            for (let i = -1; i <= 1; i++) {
              const date = new Date(secondSaturday);
              date.setDate(date.getDate() + i);
              dates.push(formatDateForESPN(date));
            }
            for (let i = 0; i <= 1; i++) {
              const date = new Date(secondSunday);
              date.setDate(date.getDate() + i);
              dates.push(formatDateForESPN(date));
            }
            // Include Monday and buffer day
            for (let i = 0; i <= 1; i++) {
              const date = new Date(secondMonday);
              date.setDate(date.getDate() + i);
              dates.push(formatDateForESPN(date));
            }
            
            debugLog('PLAYOFFS: Wild Card Dates:', dates);
          }
          break;
          
        case 2: // Divisional - 3rd weekend of January (Saturday and Sunday)
          {
            // Find first Saturday of January
            const firstDayOfJan = new Date(year, 0, 1);
            const dayOfWeek = firstDayOfJan.getDay();
            const daysToFirstSaturday = dayOfWeek === 6 ? 0 : (6 - dayOfWeek);
            const firstSaturday = new Date(year, 0, 1 + daysToFirstSaturday);
            
            // 3rd weekend is 14 days later
            const thirdSaturday = new Date(firstSaturday);
            thirdSaturday.setDate(thirdSaturday.getDate() + 14);
            const thirdSunday = new Date(thirdSaturday);
            thirdSunday.setDate(thirdSunday.getDate() + 1);
            
            // Include Saturday and Sunday, plus a few days buffer
            for (let i = -1; i <= 1; i++) {
              const date = new Date(thirdSaturday);
              date.setDate(date.getDate() + i);
              dates.push(formatDateForESPN(date));
            }
            for (let i = 0; i <= 1; i++) {
              const date = new Date(thirdSunday);
              date.setDate(date.getDate() + i);
              dates.push(formatDateForESPN(date));
            }
            debugLog('PLAYOFFS: Divisional Dates:', dates);
          }
          break;
          
        case 3: // Conference Championship - 4th weekend of January (typically Sunday)
          {
            // Find first Saturday of January
            const firstDayOfJan = new Date(year, 0, 1);
            const dayOfWeek = firstDayOfJan.getDay();
            const daysToFirstSaturday = dayOfWeek === 6 ? 0 : (6 - dayOfWeek);
            const firstSaturday = new Date(year, 0, 1 + daysToFirstSaturday);
            
            // 4th weekend is 21 days later (Sunday)
            const fourthSunday = new Date(firstSaturday);
            fourthSunday.setDate(fourthSunday.getDate() + 22); // Saturday + 1 day = Sunday of 4th weekend
            
            // Include Saturday and Sunday, plus a few days buffer
            const fourthSaturday = new Date(fourthSunday);
            fourthSaturday.setDate(fourthSaturday.getDate() - 1);
            for (let i = -1; i <= 1; i++) {
              const date = new Date(fourthSaturday);
              date.setDate(date.getDate() + i);
              dates.push(formatDateForESPN(date));
            }
            for (let i = 0; i <= 1; i++) {
              const date = new Date(fourthSunday);
              date.setDate(date.getDate() + i);
              dates.push(formatDateForESPN(date));
            }
            debugLog('PLAYOFFS: Conference Championship Dates:', dates);
          }
          break;
          
        case 4: // Super Bowl - First weekend of February (first Sunday)
          {
            // Find first Sunday of February
            const firstDayOfFeb = new Date(year, 1, 1); // February is month 1
            const dayOfWeek = firstDayOfFeb.getDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
            // If Feb 1 is Sunday (0), first Sunday is Feb 1. Otherwise, add days to get to next Sunday
            const daysToFirstSunday = dayOfWeek === 0 ? 0 : (7 - dayOfWeek);
            const firstSunday = new Date(year, 1, 1 + daysToFirstSunday);
            
            // Include Saturday before and Sunday, plus a few days buffer
            const saturday = new Date(firstSunday);
            saturday.setDate(saturday.getDate() - 1);
            for (let i = -1; i <= 1; i++) {
              const date = new Date(saturday);
              date.setDate(date.getDate() + i);
              dates.push(formatDateForESPN(date));
            }
            for (let i = 0; i <= 2; i++) {
              const date = new Date(firstSunday);
              date.setDate(date.getDate() + i);
              dates.push(formatDateForESPN(date));
            }
            debugLog('PLAYOFFS: Super Bowl Dates:', dates);
          }
          break;
          
        default:
          return [];
      }
      
      // Remove duplicates and sort
      return Array.from(new Set(dates)).sort();
    };
    
    // Helper function to format date as YYYYMMDD for ESPN API
    const formatDateForESPN = (date: Date): string => {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      return `${year}${month}${day}`;
    };

    const dates = getPlayoffDates(week, season);
    const games: Array<{ id: string; away_team?: string; home_team?: string; kickoff_time: string }> = [];

    for (const dateStr of dates) {
      try {
        const url = `https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard?dates=${dateStr}`;
        debugLog(`Fetching ESPN data for date ${dateStr}:`, url);
        const response = await fetch(url, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          },
        });

        // Timeout before next request to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 1000));

        if (response.ok) {
          const data = await response.json();
          const events = data.events || [];
          // debugLog(`PLAYOFFS: Events for date ${dateStr}:`, events);
          
          for (const event of events) {
            const competitions = event.competitions || [];
            
            for (const competition of competitions) {
              // Extract game ID and kickoff time (team names are optional for TBD games)
              const gameId = competition.id || event.id;
              const kickoffTime = competition.date || event.date;
              debugLog(`PLAYOFFS: Game ID: ${gameId}, Kickoff Time: ${kickoffTime}`);
              if (gameId && kickoffTime) {
                // Try to extract team names if available
                const competitors = competition.competitors || [];
                let awayTeam: string | undefined;
                let homeTeam: string | undefined;
                debugLog(`PLAYOFFS: Competitors: ${competitors}`);
                if (competitors.length === 2) {
                  const awayTeamObj = competitors.find((c: any) => c.homeAway === 'away');
                  const homeTeamObj = competitors.find((c: any) => c.homeAway === 'home');
                  debugLog(`PLAYOFFS: Away Team: ${awayTeamObj?.team?.displayName}, Home Team: ${homeTeamObj?.team?.displayName}`);
                  if (awayTeamObj?.team?.displayName && homeTeamObj?.team?.displayName) {
                    awayTeam = awayTeamObj.team.displayName;
                    homeTeam = homeTeamObj.team.displayName;
                  }
                }
                
                games.push({
                  id: gameId,
                  kickoff_time: kickoffTime,
                  ...(awayTeam && homeTeam ? { away_team: awayTeam, home_team: homeTeam } : {})
                });
              }
            }
          }
        }
      } catch (error) {
        console.error(`Error fetching ESPN data for date ${dateStr}:`, error);
        // Continue to next date
      }
    }

    return NextResponse.json({
      success: true,
      games
    });

  } catch (error) {
    console.error('Error in fetch ESPN IDs API:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

