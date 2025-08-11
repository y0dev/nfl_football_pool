"use client"

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Users, Plus, Mail, User, Trash2, Edit, Copy, ExternalLink } from "lucide-react"

interface Pool {
  id: string
  name: string
}

interface Participant {
  id: string
  name: string
  email: string | null
  created_at: string
  is_active: boolean
}

export default function ParticipantsPage() {
  const [pools, setPools] = useState<Pool[]>([])
  const [selectedPool, setSelectedPool] = useState<string>("")
  const [participants, setParticipants] = useState<Participant[]>([])
  const [loading, setLoading] = useState(true)
  const [showAddForm, setShowAddForm] = useState(false)
  const [newParticipant, setNewParticipant] = useState({ name: "", email: "" })
  const [editingParticipant, setEditingParticipant] = useState<Participant | null>(null)

  useEffect(() => {
    fetchPools()
  }, [])

  useEffect(() => {
    if (selectedPool) {
      fetchParticipants()
    }
  }, [selectedPool])

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

  const fetchParticipants = async () => {
    if (!selectedPool) return

    try {
      const { data, error } = await supabase
        .from('participants')
        .select('*')
        .eq('pool_id', selectedPool)
        .order('name')

      if (error) throw error
      setParticipants(data || [])
    } catch (error) {
      console.error('Error fetching participants:', error)
    } finally {
      setLoading(false)
    }
  }

  const addParticipant = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedPool || !newParticipant.name.trim()) return

    try {
      const { error } = await supabase
        .from('participants')
        .insert({
          pool_id: selectedPool,
          name: newParticipant.name.trim(),
          email: newParticipant.email.trim() || null,
          is_active: true
        })

      if (error) throw error

      setNewParticipant({ name: "", email: "" })
      setShowAddForm(false)
      fetchParticipants()
    } catch (error) {
      console.error('Error adding participant:', error)
      alert('Error adding participant. Please try again.')
    }
  }

  const updateParticipant = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingParticipant) return

    try {
      const { error } = await supabase
        .from('participants')
        .update({
          name: editingParticipant.name.trim(),
          email: editingParticipant.email?.trim() || null
        })
        .eq('id', editingParticipant.id)

      if (error) throw error

      setEditingParticipant(null)
      fetchParticipants()
    } catch (error) {
      console.error('Error updating participant:', error)
      alert('Error updating participant. Please try again.')
    }
  }

  const deleteParticipant = async (participantId: string) => {
    if (!confirm('Are you sure you want to delete this participant? This action cannot be undone.')) {
      return
    }

    try {
      const { error } = await supabase
        .from('participants')
        .delete()
        .eq('id', participantId)

      if (error) throw error

      fetchParticipants()
    } catch (error) {
      console.error('Error deleting participant:', error)
      alert('Error deleting participant. Please try again.')
    }
  }

  const toggleParticipantStatus = async (participant: Participant) => {
    try {
      const { error } = await supabase
        .from('participants')
        .update({ is_active: !participant.is_active })
        .eq('id', participant.id)

      if (error) throw error

      fetchParticipants()
    } catch (error) {
      console.error('Error updating participant status:', error)
      alert('Error updating participant status. Please try again.')
    }
  }

  const copyPicksLink = (participantId: string) => {
    const link = `${window.location.origin}/picks/${selectedPool}?participant=${participantId}`
    navigator.clipboard.writeText(link)
    alert('Picks link copied to clipboard!')
  }

  const getPicksLink = (participantId: string) => {
    return `${window.location.origin}/picks/${selectedPool}?participant=${participantId}`
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
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Manage Participants</h2>
          <p className="text-gray-600 dark:text-gray-300">Add and manage participants in your pools</p>
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
          <Button onClick={() => setShowAddForm(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Add Participant
          </Button>
        </div>
      </div>

      {showAddForm && (
        <Card>
          <CardHeader>
            <CardTitle>Add New Participant</CardTitle>
            <CardDescription>Add a participant to {pools.find(p => p.id === selectedPool)?.name}</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={addParticipant} className="space-y-4">
              <div>
                <Label htmlFor="name">Name *</Label>
                <Input
                  id="name"
                  value={newParticipant.name}
                  onChange={(e) => setNewParticipant(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="Enter participant name"
                  required
                />
              </div>
              <div>
                <Label htmlFor="email">Email (Optional)</Label>
                <Input
                  id="email"
                  type="email"
                  value={newParticipant.email}
                  onChange={(e) => setNewParticipant(prev => ({ ...prev, email: e.target.value }))}
                  placeholder="Enter participant email"
                />
              </div>
              <div className="flex space-x-2">
                <Button type="submit">Add Participant</Button>
                <Button type="button" variant="outline" onClick={() => setShowAddForm(false)}>
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {participants.length === 0 ? (
        <Card>
          <CardContent className="text-center py-12">
            <Users className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
              No participants yet
            </h3>
            <p className="text-gray-600 dark:text-gray-300 mb-4">
              Add participants to get started with your confidence pool
            </p>
            <Button onClick={() => setShowAddForm(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Add Your First Participant
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {participants.map((participant) => (
            <Card key={participant.id} className={!participant.is_active ? 'opacity-75' : ''}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/20 rounded-full flex items-center justify-center">
                      <User className="w-5 h-5 text-blue-600" />
                    </div>
                    <div>
                      <div className="font-semibold text-gray-900 dark:text-white">
                        {participant.name}
                        {!participant.is_active && (
                          <span className="ml-2 text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded-full">
                            Inactive
                          </span>
                        )}
                      </div>
                      {participant.email && (
                        <div className="text-sm text-gray-600 dark:text-gray-300 flex items-center">
                          <Mail className="w-3 h-3 mr-1" />
                          {participant.email}
                        </div>
                      )}
                      <div className="text-xs text-gray-500">
                        Added {new Date(participant.created_at).toLocaleDateString()}
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => copyPicksLink(participant.id)}
                    >
                      <Copy className="w-4 h-4 mr-1" />
                      Copy Link
                    </Button>
                    
                    <a
                      href={getPicksLink(participant.id)}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <Button size="sm" variant="outline">
                        <ExternalLink className="w-4 h-4 mr-1" />
                        View
                      </Button>
                    </a>
                    
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setEditingParticipant(participant)}
                    >
                      <Edit className="w-4 h-4 mr-1" />
                      Edit
                    </Button>
                    
                    <Button
                      size="sm"
                      variant={participant.is_active ? "outline" : "default"}
                      onClick={() => toggleParticipantStatus(participant)}
                    >
                      {participant.is_active ? 'Deactivate' : 'Activate'}
                    </Button>
                    
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => deleteParticipant(participant.id)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Edit Participant Modal */}
      {editingParticipant && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <Card className="w-full max-w-md">
            <CardHeader>
              <CardTitle>Edit Participant</CardTitle>
              <CardDescription>Update participant information</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={updateParticipant} className="space-y-4">
                <div>
                  <Label htmlFor="edit-name">Name *</Label>
                  <Input
                    id="edit-name"
                    value={editingParticipant.name}
                    onChange={(e) => setEditingParticipant(prev => prev ? { ...prev, name: e.target.value } : null)}
                    placeholder="Enter participant name"
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="edit-email">Email (Optional)</Label>
                  <Input
                    id="edit-email"
                    type="email"
                    value={editingParticipant.email || ""}
                    onChange={(e) => setEditingParticipant(prev => prev ? { ...prev, email: e.target.value } : null)}
                    placeholder="Enter participant email"
                  />
                </div>
                <div className="flex space-x-2">
                  <Button type="submit">Update Participant</Button>
                  <Button type="button" variant="outline" onClick={() => setEditingParticipant(null)}>
                    Cancel
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
} 