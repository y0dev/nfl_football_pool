"use client"

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Plus, Users, Trophy, Calendar } from "lucide-react"
import Link from "next/link"
import { LiveGames } from "@/components/live-games"

interface Pool {
  id: string
  name: string
  logo_url: string | null
  created_at: string
  is_owner: boolean
  member_count?: number
}

export default function DashboardPage() {
  const [pools, setPools] = useState<Pool[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [newPoolName, setNewPoolName] = useState("")

  useEffect(() => {
    fetchPools()
  }, [])

  const fetchPools = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: adminPools, error } = await supabase
        .from('admin_pools')
        .select(`
          pool_id,
          is_owner,
          pools (
            id,
            name,
            logo_url,
            created_at
          )
        `)
        .eq('admin_id', user.id)

      if (error) throw error

      const formattedPools = adminPools?.map(ap => ({
        id: ap.pools.id,
        name: ap.pools.name,
        logo_url: ap.pools.logo_url,
        created_at: ap.pools.created_at,
        is_owner: ap.is_owner
      })) || []

      setPools(formattedPools)
    } catch (error) {
      console.error('Error fetching pools:', error)
    } finally {
      setLoading(false)
    }
  }

  const createPool = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newPoolName.trim()) return

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      // Create the pool
      const { data: pool, error: poolError } = await supabase
        .from('pools')
        .insert({
          name: newPoolName,
          created_by: user.id,
          is_active: true
        })
        .select()
        .single()

      if (poolError) throw poolError

      // Add user as admin to the pool
      const { error: adminPoolError } = await supabase
        .from('admin_pools')
        .insert({
          admin_id: user.id,
          pool_id: pool.id,
          is_owner: true
        })

      if (adminPoolError) throw adminPoolError

      setNewPoolName("")
      setShowCreateForm(false)
      fetchPools()
    } catch (error) {
      console.error('Error creating pool:', error)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">My Pools</h2>
          <p className="text-gray-600 dark:text-gray-300">Manage your confidence pools</p>
        </div>
        <Button onClick={() => setShowCreateForm(true)}>
          <Plus className="w-4 h-4 mr-2" />
          Create Pool
        </Button>
      </div>

      {showCreateForm && (
        <Card>
          <CardHeader>
            <CardTitle>Create New Pool</CardTitle>
            <CardDescription>Start a new confidence pool for friends and family</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={createPool} className="space-y-4">
              <div>
                <label htmlFor="poolName" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Pool Name
                </label>
                <input
                  id="poolName"
                  type="text"
                  value={newPoolName}
                  onChange={(e) => setNewPoolName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter pool name..."
                  required
                />
              </div>
              <div className="flex space-x-2">
                <Button type="submit">Create Pool</Button>
                <Button type="button" variant="outline" onClick={() => setShowCreateForm(false)}>
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {pools.length === 0 ? (
        <Card>
          <CardContent className="text-center py-12">
            <Trophy className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">No pools yet</h3>
            <p className="text-gray-600 dark:text-gray-300 mb-4">
              Create your first confidence pool to get started
            </p>
            <Button onClick={() => setShowCreateForm(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Create Your First Pool
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid lg:grid-cols-3 gap-6">
          {/* Live Games */}
          <div className="lg:col-span-1">
            <LiveGames />
          </div>
          
          {/* Pools */}
          <div className="lg:col-span-2">
            <div className="grid md:grid-cols-2 gap-6">
              {pools.map((pool) => (
                <Card key={pool.id} className="hover:shadow-lg transition-shadow">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg">{pool.name}</CardTitle>
                      {pool.is_owner && (
                        <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded-full">
                          Admin
                        </span>
                      )}
                    </div>
                    <CardDescription>
                      Created {new Date(pool.created_at).toLocaleDateString()}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <div className="flex items-center space-x-2 text-sm text-gray-600 dark:text-gray-300">
                        <Users className="w-4 h-4" />
                        <span>{pool.member_count || 1} members</span>
                      </div>
                      <div className="flex space-x-2">
                        <Link href={`/dashboard/pools/${pool.id}`}>
                          <Button size="sm" className="w-full">
                            <Calendar className="w-4 h-4 mr-2" />
                            View Pool
                          </Button>
                        </Link>
                        <Link href={`/dashboard/pools/${pool.id}/picks`}>
                          <Button size="sm" variant="outline" className="w-full">
                            Make Picks
                          </Button>
                        </Link>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
} 