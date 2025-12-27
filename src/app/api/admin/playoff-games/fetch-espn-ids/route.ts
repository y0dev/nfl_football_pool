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

    // Map playoff weeks to typical dates (weekend dates in January/February)
    const getPlayoffDates = (weekNum: number, year: number): string[] => {
      switch (weekNum) {
        case 1: // Wild Card (usually 2nd weekend of January)
          return [`${year}0109`, `${year}0110`, `${year}0111`, `${year}0112`];
        case 2: // Divisional (usually 3rd weekend of January)
          return [`${year}0118`, `${year}0119`, `${year}0120`, `${year}0121`];
        case 3: // Conference Championship (usually 4th weekend of January)
          return [`${year}0125`, `${year}0126`, `${year}0127`, `${year}0128`];
        case 4: // Super Bowl (usually 1st Sunday of February)
          return [`${year}0208`, `${year}0209`, `${year}0210`, `${year}0211`];
        default:
          return [];
      }
    };

    const dates = getPlayoffDates(week, season);
    const games: Array<{ id: string; away_team?: string; home_team?: string; kickoff_time: string }> = [];

    for (const dateStr of dates) {
      try {
        const url = `https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard?dates=${dateStr}`;
        const response = await fetch(url, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          },
        });

        if (response.ok) {
          const data = await response.json();
          const events = data.events || [];

          for (const event of events) {
            const competitions = event.competitions || [];
            
            for (const competition of competitions) {
              // Extract game ID and kickoff time (team names are optional for TBD games)
              const gameId = competition.id || event.id;
              const kickoffTime = competition.date || event.date;
              
              if (gameId && kickoffTime) {
                // Try to extract team names if available
                const competitors = competition.competitors || [];
                let awayTeam: string | undefined;
                let homeTeam: string | undefined;
                
                if (competitors.length === 2) {
                  const awayTeamObj = competitors.find((c: any) => c.homeAway === 'away');
                  const homeTeamObj = competitors.find((c: any) => c.homeAway === 'home');
                  
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

