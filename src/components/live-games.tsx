"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { getNFLTeamName, formatTime } from "@/lib/utils"
import { Clock, Wifi } from "lucide-react"

interface LiveGame {
  id: string
  home_team: string
  away_team: string
  home_score: number | null
  away_score: number | null
  kickoff_time: string
  game_status: string
  winner: string | null
}

export function LiveGames() {
  const [liveGames, setLiveGames] = useState<LiveGame[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchLiveGames()
    const interval = setInterval(fetchLiveGames, 30000) // Update every 30 seconds
    return () => clearInterval(interval)
  }, [])

  const fetchLiveGames = async () => {
    try {
      const response = await fetch('/api/games/live')
      if (response.ok) {
        const data = await response.json()
        setLiveGames(data.games || [])
      }
    } catch (error) {
      console.error('Error fetching live games:', error)
    } finally {
      setLoading(false)
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'live':
        return 'text-red-600'
      case 'halftime':
        return 'text-yellow-600'
      case 'finished':
        return 'text-green-600'
      default:
        return 'text-gray-600'
    }
  }

  const getStatusText = (status: string) => {
    switch (status) {
      case 'live':
        return 'LIVE'
      case 'halftime':
        return 'HALFTIME'
      case 'finished':
        return 'FINAL'
      default:
        return status.toUpperCase()
    }
  }

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wifi className="w-5 h-5 text-red-500 animate-pulse" />
            Live Games
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-4">
            <div className="h-4 bg-gray-200 rounded w-3/4"></div>
            <div className="h-4 bg-gray-200 rounded w-1/2"></div>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (liveGames.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wifi className="w-5 h-5 text-gray-400" />
            Live Games
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-gray-600">
            No games currently live
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Wifi className="w-5 h-5 text-red-500 animate-pulse" />
          Live Games ({liveGames.length})
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {liveGames.map((game) => (
            <div key={game.id} className="border rounded-lg p-4">
              <div className="flex items-center justify-between mb-3">
                <p className="text-gray-600">
                  {game.status === 'scheduled' ? (
                    <>
                      <Clock className="inline h-4 w-4 mr-1" />
                      {new Date(game.kickoff_time).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </>
                  ) : (
                    <>
                      <span className="text-sm text-gray-600">
                        {game.status === 'final' ? 'Final' : game.status}
                      </span>
                    </>
                  )}
                </p>
              </div>
              
              <div className="grid grid-cols-3 gap-4 items-center">
                <div className="text-center">
                  <div className="font-semibold text-lg">
                    {getNFLTeamName(game.away_team)}
                  </div>
                  <div className="text-2xl font-bold text-blue-600">
                    {game.away_score ?? '-'}
                  </div>
                </div>
                
                <div className="text-center text-gray-500">
                  <div className="text-sm">@</div>
                  <div className="text-xs">VS</div>
                </div>
                
                <div className="text-center">
                  <div className="font-semibold text-lg">
                    {getNFLTeamName(game.home_team)}
                  </div>
                  <div className="text-2xl font-bold text-blue-600">
                    {game.home_score ?? '-'}
                  </div>
                </div>
              </div>

              {game.winner && (
                <div className="mt-3 text-center">
                  <span className="text-sm font-medium text-green-600">
                    Winner: {getNFLTeamName(game.winner)}
                  </span>
                </div>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
} 