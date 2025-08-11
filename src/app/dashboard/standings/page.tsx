"use client"

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Trophy, Medal, Award } from "lucide-react"
import { getNFLTeamName } from "@/lib/utils"

interface Standing {
  participant_id: string
  participant_name: string
  points: number
  correct_picks: number
  total_picks: number
  rank: number
}

interface Pool {
  id: string
  name: string
}

export default function StandingsPage() {
  const [pools, setPools] = useState<Pool[]>([])
  const [selectedPool, setSelectedPool] = useState<string>("")
  const [currentWeek, setCurrentWeek] = useState(1)
  const [weeklyStandings, setWeeklyStandings] = useState<Standing[]>([])
  const [overallStandings, setOverallStandings] = useState<Standing[]>([])
  const [loading, setLoading] = useState(true)
  const [viewMode, setViewMode] = useState<'weekly' | 'overall'>('weekly')

  useEffect(() => {
    fetchPools()
  }, [])

  useEffect(() => {
    if (selectedPool) {
      fetchStandings()
    }
  }, [selectedPool, currentWeek, viewMode])

  const fetchPools = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: adminPools, error } = await supabase
        .from('admin_pools')
        .select(`
          pool_id,
          pools (
            id,
            name
          )
        `)
        .eq('admin_id', user.id)

      if (error) throw error

      const formattedPools = adminPools?.map(ap => ({
        id: ap.pools.id,
        name: ap.pools.name
      })) || []

      setPools(formattedPools)
      if (formattedPools.length > 0) {
        setSelectedPool(formattedPools[0].id)
      }
    } catch (error) {
      console.error('Error fetching pools:', error)
    }
  }

  const fetchStandings = async () => {
    if (!selectedPool) return

    setLoading(true)
    try {
      if (viewMode === 'weekly') {
        await fetchWeeklyStandings()
      } else {
        await fetchOverallStandings()
      }
    } catch (error) {
      console.error('Error fetching standings:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchWeeklyStandings = async () => {
    const { data, error } = await supabase
      .from('scores')
      .select(`
        participant_id,
        points,
        correct_picks,
        total_picks,
        participants (
          name
        )
      `)
      .eq('pool_id', selectedPool)
      .eq('week', currentWeek)
      .eq('season', 2024)
      .order('points', { ascending: false })

    if (error) throw error

    const standings = data?.map((score, index) => ({
      participant_id: score.participant_id,
      participant_name: score.participants.name,
      points: score.points,
      correct_picks: score.correct_picks,
      total_picks: score.total_picks,
      rank: index + 1
    })) || []

    setWeeklyStandings(standings)
  }

  const fetchOverallStandings = async () => {
    const { data, error } = await supabase
      .rpc('get_overall_standings', {
        pool_id_param: selectedPool,
        season_param: 2024
      })

    if (error) throw error

    const standings = data?.map((score: any, index: number) => ({
      participant_id: score.participant_id,
      participant_name: score.participant_name,
      points: score.total_points,
      correct_picks: score.total_correct_picks,
      total_picks: score.total_picks,
      rank: index + 1
    })) || []

    setOverallStandings(standings)
  }

  const getRankIcon = (rank: number) => {
    switch (rank) {
      case 1:
        return <Trophy className="w-5 h-5 text-yellow-500" />
      case 2:
        return <Medal className="w-5 h-5 text-gray-400" />
      case 3:
        return <Award className="w-5 h-5 text-amber-600" />
      default:
        return <span className="w-5 h-5 text-center text-sm font-medium">{rank}</span>
    }
  }

  const getRankColor = (rank: number) => {
    switch (rank) {
      case 1:
        return 'bg-yellow-50 border-yellow-200 dark:bg-yellow-900/20 dark:border-yellow-800'
      case 2:
        return 'bg-gray-50 border-gray-200 dark:bg-gray-800 dark:border-gray-700'
      case 3:
        return 'bg-amber-50 border-amber-200 dark:bg-amber-900/20 dark:border-amber-800'
      default:
        return 'bg-white border-gray-200 dark:bg-gray-800 dark:border-gray-700'
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  const currentStandings = viewMode === 'weekly' ? weeklyStandings : overallStandings

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Standings</h2>
          <p className="text-gray-600 dark:text-gray-300">
            {viewMode === 'weekly' ? `Week ${currentWeek}` : 'Overall'} - 2024 Season
          </p>
        </div>
        <div className="flex space-x-4">
          <select
            value={selectedPool}
            onChange={(e) => setSelectedPool(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {pools.map(pool => (
              <option key={pool.id} value={pool.id}>{pool.name}</option>
            ))}
          </select>
          <div className="flex border border-gray-300 rounded-md">
            <button
              onClick={() => setViewMode('weekly')}
              className={`px-4 py-2 text-sm font-medium ${
                viewMode === 'weekly'
                  ? 'bg-blue-600 text-white'
                  : 'bg-white text-gray-700 hover:bg-gray-50'
              }`}
            >
              Weekly
            </button>
            <button
              onClick={() => setViewMode('overall')}
              className={`px-4 py-2 text-sm font-medium ${
                viewMode === 'overall'
                  ? 'bg-blue-600 text-white'
                  : 'bg-white text-gray-700 hover:bg-gray-50'
              }`}
            >
              Overall
            </button>
          </div>
        </div>
      </div>

      {viewMode === 'weekly' && (
        <div className="flex space-x-4 mb-6">
          {Array.from({ length: 18 }, (_, i) => i + 1).map(week => (
            <button
              key={week}
              onClick={() => setCurrentWeek(week)}
              className={`px-3 py-1 rounded-md text-sm font-medium ${
                currentWeek === week
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Week {week}
            </button>
          ))}
        </div>
      )}

      {currentStandings.length === 0 ? (
        <Card>
          <CardContent className="text-center py-12">
            <Trophy className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
              No standings available
            </h3>
            <p className="text-gray-600 dark:text-gray-300">
              {viewMode === 'weekly' 
                ? `No scores recorded for Week ${currentWeek} yet`
                : 'No overall standings available yet'
              }
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {currentStandings.map((standing) => (
            <Card key={standing.participant_id} className={getRankColor(standing.rank)}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <div className="flex items-center justify-center w-8 h-8">
                      {getRankIcon(standing.rank)}
                    </div>
                    <div>
                      <div className="font-semibold text-gray-900 dark:text-white">
                        {standing.participant_name}
                      </div>
                      <div className="text-sm text-gray-600 dark:text-gray-300">
                        {standing.correct_picks}/{standing.total_picks} correct picks
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-bold text-blue-600">
                      {standing.points}
                    </div>
                    <div className="text-sm text-gray-600 dark:text-gray-300">
                      points
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Stats Summary */}
      {currentStandings.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Pool Statistics</CardTitle>
            <CardDescription>
              {viewMode === 'weekly' ? `Week ${currentWeek}` : 'Season'} summary
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">
                  {currentStandings.length}
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-300">
                  Participants
                </div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">
                  {Math.max(...currentStandings.map(s => s.points))}
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-300">
                  Highest Score
                </div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-purple-600">
                  {Math.round(currentStandings.reduce((sum, s) => sum + s.points, 0) / currentStandings.length)}
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-300">
                  Average Score
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
} 