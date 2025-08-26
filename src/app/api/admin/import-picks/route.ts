import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServiceClient } from '@/lib/supabase';
import * as XLSX from 'xlsx';

export async function POST(request: NextRequest) {
  try {
    const supabase = getSupabaseServiceClient();
    
    // Check if this is a file upload or data submission
    const contentType = request.headers.get('content-type');
    
    if (contentType?.includes('multipart/form-data')) {
      // Handle file upload and parsing
      return await handleFileUpload(request);
    } else {
      // Handle data submission
      return await handleDataSubmission(request);
    }
  } catch (error) {
    console.error('Error in import picks API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

async function handleFileUpload(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const poolId = formData.get('poolId') as string;

    if (!file || !poolId) {
      return NextResponse.json(
        { error: 'File and pool ID are required' },
        { status: 400 }
      );
    }

    // Get pool and games information
    const supabase = getSupabaseServiceClient();
    
    const { data: pool } = await supabase
      .from('pools')
      .select('*')
      .eq('id', poolId)
      .single();

    if (!pool) {
      return NextResponse.json(
        { error: 'Pool not found' },
        { status: 404 }
      );
    }

    // Get current week games
    const { data: games } = await supabase
      .from('games')
      .select('*')
      .eq('week', pool.current_week || 1)
      .eq('season_type', pool.current_season_type || 2)
      .order('kickoff_time', { ascending: true });

    if (!games || games.length === 0) {
      return NextResponse.json(
        { error: 'No games found for current week' },
        { status: 400 }
      );
    }

    // Parse the file
    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

    if (jsonData.length < 2) {
      return NextResponse.json(
        { error: 'File must have at least a header row and one data row' },
        { status: 400 }
      );
    }

    // Parse the data
    const parsedData = parseExcelData(jsonData, games);

    return NextResponse.json({
      success: true,
      data: parsedData,
      message: `Successfully parsed ${parsedData.length} participants`
    });

  } catch (error) {
    console.error('Error handling file upload:', error);
    return NextResponse.json(
      { error: 'Failed to parse file' },
      { status: 500 }
    );
  }
}

async function handleDataSubmission(request: NextRequest) {
  try {
    const { poolId, participants } = await request.json();

    if (!poolId || !participants || !Array.isArray(participants)) {
      return NextResponse.json(
        { error: 'Pool ID and participants array are required' },
        { status: 400 }
      );
    }

    const supabase = getSupabaseServiceClient();
    
    // Get pool information
    const { data: pool } = await supabase
      .from('pools')
      .select('*')
      .eq('id', poolId)
      .single();

    if (!pool) {
      return NextResponse.json(
        { error: 'Pool not found' },
        { status: 404 }
      );
    }

    // Get current week games
    const { data: games } = await supabase
      .from('games')
      .select('*')
      .eq('week', pool.current_week || 1)
      .eq('season_type', pool.current_season_type || 2)
      .order('kickoff_time', { ascending: true });

    if (!games || games.length === 0) {
      return NextResponse.json(
        { error: 'No games found for current week' },
        { status: 400 }
      );
    }

    let importedCount = 0;
    const errors: string[] = [];

    // Process each participant
    for (const participant of participants) {
      try {
        // Create or get participant
        let participantId: string;
        
        const { data: existingParticipant } = await supabase
          .from('participants')
          .select('id')
          .eq('pool_id', poolId)
          .eq('name', participant.participantName)
          .single();

        if (existingParticipant) {
          participantId = existingParticipant.id;
        } else {
          const { data: newParticipant, error: createError } = await supabase
            .from('participants')
            .insert({
              pool_id: poolId,
              name: participant.participantName,
              email: participant.participantEmail || null,
              is_active: true
            })
            .select('id')
            .single();

          if (createError) throw createError;
          participantId = newParticipant.id;
        }

        // Insert picks for each game
        for (const pick of participant.gamePicks) {
          const game = games.find(g => 
            (g.home_team === pick.homeTeam && g.away_team === pick.awayTeam) ||
            (g.home_team === pick.awayTeam && g.away_team === pick.homeTeam)
          );

          if (game) {
            const { error: pickError } = await supabase
              .from('picks')
              .upsert({
                participant_id: participantId,
                pool_id: poolId,
                game_id: game.id,
                predicted_winner: pick.predictedWinner,
                confidence_points: pick.confidencePoints
              }, { onConflict: 'participant_id,pool_id,game_id' });

            if (pickError) {
              errors.push(`Failed to insert pick for ${participant.participantName} - ${game.home_team} vs ${game.away_team}`);
            }
          }
        }

        // Insert tie breaker if provided
        if (participant.tieBreaker !== undefined) {
          const { error: tieBreakerError } = await supabase
            .from('tie_breakers')
            .upsert({
              participant_id: participantId,
              pool_id: poolId,
              week: pool.current_week || 1,
              season: pool.season,
              value: participant.tieBreaker
            }, { onConflict: 'participant_id,pool_id,week,season' });

          if (tieBreakerError) {
            errors.push(`Failed to insert tie breaker for ${participant.participantName}`);
          }
        }

        importedCount++;
      } catch (error) {
        console.error(`Error processing participant ${participant.participantName}:`, error);
        errors.push(`Failed to process ${participant.participantName}: ${error}`);
      }
    }

    return NextResponse.json({
      success: true,
      importedCount,
      errors: errors.length > 0 ? errors : undefined,
      message: `Successfully imported ${importedCount} participants`
    });

  } catch (error) {
    console.error('Error handling data submission:', error);
    return NextResponse.json(
      { error: 'Failed to import picks' },
      { status: 500 }
    );
  }
}

function parseExcelData(jsonData: any[][], games: any[]) {
  const headers = jsonData[0];
  const dataRows = jsonData.slice(1);
  
  // Find column indices
  const nameIndex = headers.findIndex((h: string) => 
    h && h.toString().toLowerCase().includes('name')
  );
  
  const emailIndex = headers.findIndex((h: string) => 
    h && h.toString().toLowerCase().includes('email')
  );

  // Find game columns (look for team names in headers)
  const gameColumns: Array<{ index: number; homeTeam: string; awayTeam: string }> = [];
  
  headers.forEach((header, index) => {
    if (header && typeof header === 'string') {
      const headerStr = header.toString();
      if (headerStr.includes('@')) {
        // This is a game column like "Arizona Cardinals @"
        const awayTeam = headerStr.replace(' @', '').trim();
        const homeTeam = headers[index + 1]?.toString().trim();
        
        if (homeTeam && !homeTeam.includes('@')) {
          gameColumns.push({ index, homeTeam, awayTeam });
        }
      }
    }
  });

  // Parse data rows
  const participants: any[] = [];
  
  dataRows.forEach((row, rowIndex) => {
    if (row.length === 0 || !row[nameIndex]) return;
    
    const participantName = row[nameIndex]?.toString().trim();
    const participantEmail = emailIndex >= 0 ? row[emailIndex]?.toString().trim() : undefined;
    
    if (!participantName) return;
    
    const gamePicks: any[] = [];
    
    gameColumns.forEach(({ index, homeTeam, awayTeam }) => {
      const predictedWinner = row[index]?.toString().trim();
      const confidencePoints = parseInt(row[index + 1]) || 0;
      
      if (predictedWinner && confidencePoints > 0) {
        gamePicks.push({
          gameId: '', // Will be filled when processing
          awayTeam,
          homeTeam,
          predictedWinner,
          confidencePoints
        });
      }
    });
    
    // Get tie breaker from last column if it's a number
    const lastColumn = row[row.length - 1];
    const tieBreaker = typeof lastColumn === 'number' ? lastColumn : undefined;
    
    if (gamePicks.length > 0) {
      participants.push({
        participantName,
        participantEmail,
        gamePicks,
        tieBreaker
      });
    }
  });
  
  return participants;
}

