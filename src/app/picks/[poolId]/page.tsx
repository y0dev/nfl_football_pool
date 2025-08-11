"use client"

import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import { supabase } from "@/lib/supabase"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors } from "@dnd-kit/core"
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy } from "@dnd-kit/sortable"
import { SortableItem } from "@/components/picks/sortable-item"
import { getNFLTeamName, formatDate, formatTime } from "@/lib/utils"
import { Save, Lock, User, Trophy } from "lucide-react"

interface Pool {
  id: string
  name: string
  logo_url: string | null
  season: number
}

interface Participant {
  id: string
  name: string
  email: string | null
}

interface Game {
  id: string
  week: number
  season: number
  home_team: string
  away_team: string
  kickoff_time: string
  winner: string | null
  home_score: number | null
  away_score: number | null
  game_status: string
}

interface Pick {
  id: string
  game_id: string
  predicted_winner: string
  confidence_points: number
  locked: boolean
}

export default function ParticipantPicksPage() {
  const params = useParams()
  const poolId = params.poolId as string
  
  const [pool, setPool] = useState<Pool | null>(null)
  const [participants, setParticipants] = useState<Participant[]>([])
  const [selectedParticipant, setSelectedParticipant] = useState<string>("")
  const [games, setGames] = useState<Game[]>([])
  const [picks, setPicks] = useState<Pick[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [currentWeek, setCurrentWeek] = useState(1)
  const [showParticipantSelect, setShowParticipantSelect] = useState(true)
  const [mounted, setMounted] = useState(false)

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (poolId && mounted) {
      fetchPool()
      fetchParticipants()
      fetchGames()
    }
  }, [poolId, mounted])

  useEffect(() => {
    if (selectedParticipant && games.length > 0) {
      fetchPicks()
    }
  }, [selectedParticipant, currentWeek, games])

  const fetchPool = async () => {
    try {
      const { data, error } = await supabase
        .from('pools')
        .select('*')
        .eq('id', poolId)
        .single()

      if (error) throw error
      setPool(data)
    } catch (error) {
      console.error('Error fetching pool:', error)
    }
  }

  const fetchParticipants = async () => {
    try {
      const { data, error } = await supabase
        .from('participants')
        .select('*')
        .eq('pool_id', poolId)
        .eq('is_active', true)
        .order('name')

      if (error) throw error
      setParticipants(data || [])
    } catch (error) {
      console.error('Error fetching participants:', error)
    }
  }

  const fetchGames = async () => {
    try {
      const { data, error } = await supabase
        .from('games')
        .select('*')
        .eq('season', 2024)
        .eq('week', currentWeek)
        .order('kickoff_time')

      if (error) throw error
      setGames(data || [])
    } catch (error) {
      console.error('Error fetching games:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchPicks = async () => {
    if (!selectedParticipant) return

    try {
      const { data, error } = await supabase
        .from('picks')
        .select('*')
        .eq('participant_id', selectedParticipant)
        .eq('pool_id', poolId)
        .eq('week', currentWeek)

      if (error) throw error

      // Create picks for games that don't have picks yet
      const existingPicks = data || []
      const gamesWithoutPicks = games.filter(game => 
        !existingPicks.find(pick => pick.game_id === game.id)
      )

      const newPicks = gamesWithoutPicks.map((game, index) => ({
        id: `temp-${game.id}-${index}`,
        game_id: game.id,
        predicted_winner: game.home_team, // Default to home team
        confidence_points: 0,
        locked: false
      }))

      setPicks([...existingPicks, ...newPicks])
    } catch (error) {
      console.error('Error fetching picks:', error)
    }
  }

  const handleDragEnd = (event: any) => {
    const { active, over } = event

    if (active.id !== over.id) {
      setPicks((items) => {
        const oldIndex = items.findIndex(item => item.id === active.id)
        const newIndex = items.findIndex(item => item.id === over.id)

        const newItems = arrayMove(items, oldIndex, newIndex)
        
        // Update confidence points based on new order
        return newItems.map((item, index) => ({
          ...item,
          confidence_points: newItems.length - index
        }))
      })
    }
  }

  const updatePick = (gameId: string, predictedWinner: string) => {
    setPicks(prev => prev.map(pick => 
      pick.game_id === gameId 
        ? { ...pick, predicted_winner: predictedWinner }
        : pick
    ))
  }

  const savePicks = async () => {
    if (!selectedParticipant) return

    setSaving(true)
    try {
      // Delete existing picks for this week
      await supabase
        .from('picks')
        .delete()
        .eq('participant_id', selectedParticipant)
        .eq('pool_id', poolId)
        .eq('week', currentWeek)

      // Insert new picks
      const picksToSave = picks
        .filter(pick => pick.confidence_points > 0)
        .map(pick => ({
          participant_id: selectedParticipant,
          pool_id: poolId,
          game_id: pick.game_id,
          predicted_winner: pick.predicted_winner,
          confidence_points: pick.confidence_points,
          locked: false,
          submitted_by: null // Anonymous submission
        }))

      if (picksToSave.length > 0) {
        const { error } = await supabase
          .from('picks')
          .insert(picksToSave)

        if (error) throw error
      }

      alert('Picks saved successfully!')
    } catch (error) {
      console.error('Error saving picks:', error)
      alert('Error saving picks. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  const isGameLocked = (game: Game) => {
    if (!mounted) return false
    return new Date(game.kickoff_time) <= new Date()
  }

  if (!mounted || loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    )
  }

  if (!pool) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardContent className="text-center py-12">
            <Trophy className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
              Pool Not Found
            </h3>
            <p className="text-gray-600 dark:text-gray-300">
              The pool you're looking for doesn't exist or has been removed.
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (showParticipantSelect) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="flex items-center justify-center mb-4">
              {pool.logo_url ? (
                <img src={pool.logo_url} alt={pool.name} className="w-16 h-16 rounded-full" />
              ) : (
                <div className="w-16 h-16 bg-blue-600 rounded-full flex items-center justify-center">
                  <Trophy className="w-8 h-8 text-white" />
                </div>
              )}
            </div>
            <CardTitle>{pool.name}</CardTitle>
            <CardDescription>
              Select your name to submit your picks for Week {currentWeek}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="participant">Your Name</Label>
              <select
                id="participant"
                value={selectedParticipant}
                onChange={(e) => setSelectedParticipant(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 mt-1"
              >
                <option value="">Select your name...</option>
                {participants.map(participant => (
                  <option key={participant.id} value={participant.id}>
                    {participant.name}
                  </option>
                ))}
              </select>
            </div>
            
            {selectedParticipant && (
              <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
                <p className="text-sm text-blue-800 dark:text-blue-200">
                  You are submitting picks for: <strong>{participants.find(p => p.id === selectedParticipant)?.name}</strong>
                </p>
              </div>
            )}

            <Button 
              onClick={() => setShowParticipantSelect(false)}
              disabled={!selectedParticipant}
              className="w-full"
            >
              Continue to Picks
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  const selectedParticipantData = participants.find(p => p.id === selectedParticipant)

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
      {/* Header */}
      <header className="nfl-gradient text-white shadow-xl">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center shadow-lg">
                <span className="text-blue-600 font-bold text-xl">🏈</span>
              </div>
              <div>
                <h1 className="text-2xl font-bold">{pool.name}</h1>
                <p className="text-blue-100 text-sm">Make your picks for Week {currentWeek}</p>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2 text-blue-100">
                <User className="w-4 h-4" />
                <span className="text-sm font-medium">{selectedParticipantData?.name}</span>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowParticipantSelect(true)}
                className="text-white border-white hover:bg-white hover:text-blue-600 transition-all duration-200"
              >
                Change Name
              </Button>
            </div>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-3xl font-bold text-gray-900 dark:text-white">Make Your Picks</h2>
            <p className="text-gray-600 dark:text-gray-300 text-lg">Week {currentWeek} - {pool.season} Season</p>
          </div>
          <Button onClick={savePicks} disabled={saving} className="btn-primary">
            <Save className="w-4 h-4 mr-2" />
            {saving ? 'Saving...' : 'Save Picks'}
          </Button>
        </div>

        {games.length === 0 ? (
          <Card>
            <CardContent className="text-center py-12">
              <p className="text-gray-600 dark:text-gray-300">No games scheduled for Week {currentWeek}</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid lg:grid-cols-2 gap-6">
            {/* Games List */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Games</h3>
              {games.map((game) => {
                const pick = picks.find(p => p.game_id === game.id)
                const locked = isGameLocked(game)
                
                                 return (
                   <Card key={game.id} className={mounted && locked ? 'opacity-75' : ''}>
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between mb-3">
                        <div className="text-sm text-gray-600 dark:text-gray-300">
                          {formatDate(game.kickoff_time)} at {formatTime(game.kickoff_time)}
                        </div>
                        {mounted && locked && (
                          <div className="flex items-center text-red-600">
                            <Lock className="w-4 h-4 mr-1" />
                            <span className="text-sm">Locked</span>
                          </div>
                        )}
                      </div>
                      
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-4">
                          <div className="text-center">
                            <div className="font-semibold">{getNFLTeamName(game.away_team)}</div>
                            <div className="text-sm text-gray-600 dark:text-gray-300">@</div>
                            <div className="font-semibold">{getNFLTeamName(game.home_team)}</div>
                          </div>
                        </div>
                        
                        <div className="flex space-x-2">
                                                     <Button
                             size="sm"
                             variant={pick?.predicted_winner === game.away_team ? "default" : "outline"}
                             onClick={() => !locked && updatePick(game.id, game.away_team)}
                             disabled={mounted && locked}
                           >
                             {game.away_team}
                           </Button>
                           <Button
                             size="sm"
                             variant={pick?.predicted_winner === game.home_team ? "default" : "outline"}
                             onClick={() => !locked && updatePick(game.id, game.home_team)}
                             disabled={mounted && locked}
                           >
                             {game.home_team}
                           </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
            </div>

            {/* Confidence Points */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Confidence Points</h3>
              <p className="text-sm text-gray-600 dark:text-gray-300">
                Drag and drop to assign confidence points (16 = most confident)
              </p>
              
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
              >
                <SortableContext
                  items={picks.map(pick => pick.id)}
                  strategy={verticalListSortingStrategy}
                >
                  <div className="space-y-2">
                    {picks
                      .filter(pick => pick.confidence_points > 0)
                      .sort((a, b) => b.confidence_points - a.confidence_points)
                      .map((pick) => {
                        const game = games.find(g => g.id === pick.game_id)
                        if (!game) return null

                        return (
                          <SortableItem key={pick.id} id={pick.id}>
                            <Card className="team-card">
                              <CardContent className="p-4">
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center space-x-3">
                                    <div className={`confidence-point bg-blue-600`}>
                                      {pick.confidence_points}
                                    </div>
                                    <div>
                                      <div className="font-semibold">
                                        {getNFLTeamName(pick.predicted_winner)}
                                      </div>
                                      <div className="text-sm text-gray-600 dark:text-gray-300">
                                        vs {getNFLTeamName(pick.predicted_winner === game.home_team ? game.away_team : game.home_team)}
                                      </div>
                                    </div>
                                  </div>
                                  <div className="text-sm text-gray-500">
                                    {formatDate(game.kickoff_time)}
                                  </div>
                                </div>
                              </CardContent>
                            </Card>
                          </SortableItem>
                        )
                      })}
                  </div>
                </SortableContext>
              </DndContext>
            </div>
          </div>
        )}
      </div>
    </div>
  )
} 