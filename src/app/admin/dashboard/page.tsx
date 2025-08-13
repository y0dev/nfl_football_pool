'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { PoolDashboard } from '@/components/pools/pool-dashboard';
import { loadCurrentWeek } from '@/actions/loadCurrentWeek';
import { loadPools } from '@/actions/loadPools';
import { AuthProvider, useAuth } from '@/lib/auth';

function AdminDashboardContent() {
  const router = useRouter();
  const { user } = useAuth();
  const [currentWeek, setCurrentWeek] = useState(1);
  const [pools, setPools] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      try {
        const weekData = await loadCurrentWeek();
        setCurrentWeek(weekData?.week_number || 1);
        
        // Load pools based on admin permissions
        const poolsData = await loadPools(
          user?.email, 
          user?.is_super_admin
        );
        setPools(poolsData);
        

      } catch (error) {
        console.error('Error loading data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, [user]);

  if (isLoading) {
    return (
      <div className="container mx-auto p-4">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/3 mb-4"></div>
          <div className="h-4 bg-gray-200 rounded w-1/2"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4">
      <div className="mb-6">
        <h1 className="text-2xl sm:text-3xl font-bold">Admin Dashboard</h1>
        <p className="text-gray-600">Manage your NFL Confidence Pool</p>
        {user?.is_super_admin && (
          <Badge variant="outline" className="mt-2">
            Super Admin
          </Badge>
        )}
      </div>

      <PoolDashboard />

      {/* Pool Management */}
      {pools.length > 0 ? (
        <div className="text-center py-12">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Pool Management</h3>
          <p className="text-gray-600 mb-6">
            {user?.is_super_admin 
              ? "Select a pool to manage its details and participants." 
              : "Manage your pools and participants."
            }
          </p>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {pools.map((pool) => (
              <Card key={pool.id} className="hover:shadow-lg transition-shadow cursor-pointer" onClick={() => router.push(`/admin/pool/${pool.id}`)}>
                <CardHeader>
                  <CardTitle className="text-lg">{pool.name}</CardTitle>
                  <CardDescription>Season {pool.season}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between text-sm text-gray-600">
                    <span>Created by {pool.created_by}</span>
                    <Badge variant={pool.is_active ? "default" : "secondary"}>
                      {pool.is_active ? "Active" : "Inactive"}
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      ) : (
        <div className="text-center py-12">
          <h3 className="text-lg font-semibold text-gray-900 mb-2">No Pools Found</h3>
          <p className="text-gray-600">
            {user?.is_super_admin 
              ? "No pools have been created yet." 
              : "Create your first pool to get started."
            }
          </p>
        </div>
      )}
    </div>
  );
}

export default function AdminDashboard() {
  return (
    <AuthProvider>
      <AdminDashboardContent />
    </AuthProvider>
  );
} 