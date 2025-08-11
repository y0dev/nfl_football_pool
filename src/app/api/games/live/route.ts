import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const supabase = createClient(supabaseUrl, supabaseServiceKey)

export async function GET() {
  try {
    // Get live games from database
    const { data: games, error } = await supabase
      .from('games')
      .select('*')
      .in('game_status', ['live', 'halftime'])
      .order('kickoff_time')

    if (error) {
      throw error
    }

    return NextResponse.json({ 
      games: games || [],
      count: games?.length || 0
    })

  } catch (error: any) {
    console.error('Error fetching live games:', error)
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    )
  }
} 