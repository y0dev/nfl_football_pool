"use client"

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Settings, Users, Lock, Upload, Trash2 } from "lucide-react"

interface Pool {
  id: string
  name: string
  logo_url: string | null
  is_owner: boolean
}

export default function SettingsPage() {
  const [pools, setPools] = useState<Pool[]>([])
  const [selectedPool, setSelectedPool] = useState<string>("")
  const [loading, setLoading] = useState(true)
  const [poolName, setPoolName] = useState("")
  const [logoFile, setLogoFile] = useState<File | null>(null)

  useEffect(() => {
    fetchPools()
  }, [])

  useEffect(() => {
    if (selectedPool) {
      const pool = pools.find(p => p.id === selectedPool)
      if (pool) {
        setPoolName(pool.name)
      }
    }
  }, [selectedPool, pools])

  const fetchPools = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: adminPools, error } = await supabase
        .from('admin_pools')
        .select(`
          is_owner,
          pools (
            id,
            name,
            logo_url
          )
        `)
        .eq('admin_id', user.id)

      if (error) throw error

      const formattedPools = adminPools?.map(ap => ({
        id: ap.pools.id,
        name: ap.pools.name,
        logo_url: ap.pools.logo_url,
        is_owner: ap.is_owner
      })) || []

      setPools(formattedPools)
      if (formattedPools.length > 0) {
        setSelectedPool(formattedPools[0].id)
      }
    } catch (error) {
      console.error('Error fetching pools:', error)
    } finally {
      setLoading(false)
    }
  }

  const updatePoolName = async () => {
    if (!selectedPool || !poolName.trim()) return

    try {
      const { error } = await supabase
        .from('pools')
        .update({ name: poolName })
        .eq('id', selectedPool)

      if (error) throw error

      // Update local state
      setPools(prev => prev.map(pool => 
        pool.id === selectedPool ? { ...pool, name: poolName } : pool
      ))

      alert('Pool name updated successfully!')
    } catch (error) {
      console.error('Error updating pool name:', error)
      alert('Error updating pool name. Please try again.')
    }
  }

  const uploadLogo = async () => {
    if (!selectedPool || !logoFile) return

    try {
      const fileExt = logoFile.name.split('.').pop()
      const fileName = `${selectedPool}-logo.${fileExt}`
      const filePath = `pool-logos/${fileName}`

      const { error: uploadError } = await supabase.storage
        .from('pool-assets')
        .upload(filePath, logoFile)

      if (uploadError) throw uploadError

      const { data: { publicUrl } } = supabase.storage
        .from('pool-assets')
        .getPublicUrl(filePath)

      const { error: updateError } = await supabase
        .from('pools')
        .update({ logo_url: publicUrl })
        .eq('id', selectedPool)

      if (updateError) throw updateError

      // Update local state
      setPools(prev => prev.map(pool => 
        pool.id === selectedPool ? { ...pool, logo_url: publicUrl } : pool
      ))

      setLogoFile(null)
      alert('Logo uploaded successfully!')
    } catch (error) {
      console.error('Error uploading logo:', error)
      alert('Error uploading logo. Please try again.')
    }
  }

  const lockAllPicks = async () => {
    if (!selectedPool) return

    if (!confirm('Are you sure you want to lock all picks for this pool? This action cannot be undone.')) {
      return
    }

    try {
      const { error } = await supabase
        .from('picks')
        .update({ locked: true })
        .eq('pool_id', selectedPool)

      if (error) throw error

      alert('All picks have been locked!')
    } catch (error) {
      console.error('Error locking picks:', error)
      alert('Error locking picks. Please try again.')
    }
  }

  const deletePool = async () => {
    if (!selectedPool) return

    if (!confirm('Are you sure you want to delete this pool? This action cannot be undone and will delete all associated data.')) {
      return
    }

    try {
      // Delete picks
      await supabase
        .from('picks')
        .delete()
        .eq('pool_id', selectedPool)

      // Delete scores
      await supabase
        .from('scores')
        .delete()
        .eq('pool_id', selectedPool)

      // Delete user_pools
      await supabase
        .from('user_pools')
        .delete()
        .eq('pool_id', selectedPool)

      // Delete pool
      const { error } = await supabase
        .from('pools')
        .delete()
        .eq('id', selectedPool)

      if (error) throw error

      // Update local state
      setPools(prev => prev.filter(pool => pool.id !== selectedPool))
      if (pools.length > 1) {
        setSelectedPool(pools[0].id)
      } else {
        setSelectedPool("")
      }

      alert('Pool deleted successfully!')
    } catch (error) {
      console.error('Error deleting pool:', error)
      alert('Error deleting pool. Please try again.')
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  const selectedPoolData = pools.find(p => p.id === selectedPool)

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Settings</h2>
        <p className="text-gray-600 dark:text-gray-300">Manage your pools and preferences</p>
      </div>

      {pools.length === 0 ? (
        <Card>
          <CardContent className="text-center py-12">
            <Settings className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
              No pools to manage
            </h3>
            <p className="text-gray-600 dark:text-gray-300">
              Create a pool first to access settings
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid lg:grid-cols-2 gap-6">
          {/* Pool Selection */}
          <Card>
            <CardHeader>
              <CardTitle>Select Pool</CardTitle>
              <CardDescription>Choose which pool to manage</CardDescription>
            </CardHeader>
            <CardContent>
              <select
                value={selectedPool}
                onChange={(e) => setSelectedPool(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {pools.map(pool => (
                  <option key={pool.id} value={pool.id}>
                    {pool.name} {pool.is_admin ? '(Admin)' : ''}
                  </option>
                ))}
              </select>
            </CardContent>
          </Card>

          {selectedPoolData && (
            <>
              {/* Pool Information */}
              <Card>
                <CardHeader>
                  <CardTitle>Pool Information</CardTitle>
                  <CardDescription>Basic pool details</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label htmlFor="poolName">Pool Name</Label>
                    <div className="flex space-x-2 mt-1">
                      <Input
                        id="poolName"
                        value={poolName}
                        onChange={(e) => setPoolName(e.target.value)}
                        placeholder="Enter pool name"
                      />
                      <Button onClick={updatePoolName} disabled={!selectedPoolData.is_admin}>
                        Update
                      </Button>
                    </div>
                  </div>
                  
                  {selectedPoolData.logo_url && (
                    <div>
                      <Label>Current Logo</Label>
                      <img 
                        src={selectedPoolData.logo_url} 
                        alt="Pool logo" 
                        className="w-16 h-16 object-cover rounded mt-1"
                      />
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Admin Actions */}
                                {selectedPoolData.is_owner && (
                <>
                  <Card>
                    <CardHeader>
                      <CardTitle>Upload Logo</CardTitle>
                      <CardDescription>Add a custom logo for your pool</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div>
                        <Label htmlFor="logo">Logo File</Label>
                        <Input
                          id="logo"
                          type="file"
                          accept="image/*"
                          onChange={(e) => setLogoFile(e.target.files?.[0] || null)}
                          className="mt-1"
                        />
                      </div>
                      <Button onClick={uploadLogo} disabled={!logoFile}>
                        <Upload className="w-4 h-4 mr-2" />
                        Upload Logo
                      </Button>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle>Pool Management</CardTitle>
                      <CardDescription>Administrative actions</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <Button 
                        variant="outline" 
                        onClick={lockAllPicks}
                        className="w-full"
                      >
                        <Lock className="w-4 h-4 mr-2" />
                        Lock All Picks
                      </Button>
                      
                      <Button 
                        variant="destructive" 
                        onClick={deletePool}
                        className="w-full"
                      >
                        <Trash2 className="w-4 h-4 mr-2" />
                        Delete Pool
                      </Button>
                    </CardContent>
                  </Card>
                </>
              )}

              {/* Pool Statistics */}
              <Card>
                <CardHeader>
                  <CardTitle>Pool Statistics</CardTitle>
                  <CardDescription>Overview of pool activity</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-blue-600">
                        {pools.length}
                      </div>
                      <div className="text-sm text-gray-600 dark:text-gray-300">
                        Total Pools
                      </div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-green-600">
                        {selectedPoolData.is_admin ? 'Admin' : 'Member'}
                      </div>
                      <div className="text-sm text-gray-600 dark:text-gray-300">
                        Your Role
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </div>
      )}
    </div>
  )
} 