import { debugLog } from '@/lib/utils';
import { NextRequest, NextResponse } from 'next/server';

// POST - Fetch ESPN game IDs for playoff games
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { season, week, lastGameOfPreviousWeek } = body;

    if (!season || !week || !lastGameOfPreviousWeek) {
      return NextResponse.json(
        { success: false, error: 'Season, week, and lastGameOfPreviousWeek are required' },
        { status: 400 }
      );
    }

    // Calculate playoff dates dynamically based on year
    // Returns dates in YYYYMMDD format
    const getPlayoffDates = (weekNum: number): string[] => {
      const dates: string[] = [];
      
      switch (weekNum) {
        case 1: // Wild Card - 2nd weekend of January (Saturday, Sunday, and Monday)
          {
            debugLog('PLAYOFFS: Wild Card Dates: lastGameOfPreviousWeek', lastGameOfPreviousWeek);

            // Get the last game of the regular season and add 5 days from that date
            for (let i = 0; i < 3; i++) { 
              const date = new Date(lastGameOfPreviousWeek);
              date.setDate(date.getDate() + 6 + i);
              dates.push(formatDateForESPN(date));
            }
            
            
            debugLog('PLAYOFFS: Wild Card Dates:', dates);
          }
          break;
          
        case 2: // Divisional - 3rd weekend of January (Saturday and Sunday)
          {
            debugLog('PLAYOFFS: Divisional Dates: lastGameOfPreviousWeek', lastGameOfPreviousWeek); 

            // Get the date of the last game of the previous week and add 6 and 7 days from that date
            const lastGameOfPreviousWeekDate = new Date(lastGameOfPreviousWeek);
            for (let i = 0; i < 2; i++) { 
              const date = new Date(lastGameOfPreviousWeekDate);
              date.setDate(date.getDate() + 5 + i);
              dates.push(formatDateForESPN(date));
            }
            debugLog('PLAYOFFS: Divisional Dates:', dates);
          }
          break;
          
        case 3: // Conference Championship - 4th weekend of January (typically Sunday)
          {
            debugLog('PLAYOFFS: Conference Championship Dates: lastGameOfPreviousWeek', lastGameOfPreviousWeek);
            
            // Get the date of the last game of the previous week and add 6 and 7 days from that date
            const lastGameOfPreviousWeekDate = new Date(lastGameOfPreviousWeek);
            for (let i = 0; i < 2; i++) { 
              const date = new Date(lastGameOfPreviousWeekDate);
              date.setDate(date.getDate() + 6 + i);
              dates.push(formatDateForESPN(date));
            }
            debugLog('PLAYOFFS: Conference Championship Dates:', dates);
          }
          break;
          
        case 4: // Super Bowl - First weekend of February (first Sunday)
          {
            debugLog('PLAYOFFS: Super Bowl Dates: lastGameOfPreviousWeek', lastGameOfPreviousWeek);

            // Two weeks after last game of previous week
            const firstSunday = new Date(lastGameOfPreviousWeek);
            firstSunday.setDate(firstSunday.getDate() + 14);

            dates.push(formatDateForESPN(firstSunday));
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

    const dates = getPlayoffDates(week);
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

