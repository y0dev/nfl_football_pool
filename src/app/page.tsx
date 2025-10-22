'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Search, Users, Trophy, Calendar, ArrowRight, Shield } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useAuth, AuthProvider } from '@/lib/auth';
import { loadCurrentWeek } from '@/actions/loadCurrentWeek';
import { createPageUrl } from '@/lib/utils';

interface Game {
  id: string;
  home_team: string;
  away_team: string;
  home_score: number;
  away_score: number;
  status: string;
  kickoff_time: string;
  winner: string;
}

function LandingPage() {
  const { user, verifyAdminStatus } = useAuth();
  const router = useRouter();
  const [isSuperAdmin, setIsSuperAdmin] = useState<boolean | null>(null);
  const [isCheckingAdmin, setIsCheckingAdmin] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentWeek, setCurrentWeek] = useState(1);
  const [currentSeasonType, setCurrentSeasonType] = useState(2);
  const [games, setGames] = useState<Game[]>([]);
  const [isLoadingGames, setIsLoadingGames] = useState(true);

  useEffect(() => {
    const checkAdminStatus = async () => {
      if (user) {
        setIsCheckingAdmin(true);
        try {
          const superAdminStatus = await verifyAdminStatus(true);
          setIsSuperAdmin(superAdminStatus);
        } catch (error) {
          console.error('Error checking admin status:', error);
          setIsSuperAdmin(false);
        } finally {
          setIsCheckingAdmin(false);
        }
      } else {
        setIsSuperAdmin(null);
      }
    };

    checkAdminStatus();
  }, [user]);

  useEffect(() => {
    const loadData = async () => {
      try {
        // Load current week
        const weekData = await loadCurrentWeek();
        setCurrentWeek(weekData?.week_number || 1);
        setCurrentSeasonType(weekData?.season_type || 2);

        // Load games for the current week
        const { getSupabaseClient } = await import('@/lib/supabase');
        const supabase = getSupabaseClient();
        
        const { data: gamesData, error } = await supabase
          .from('games')
          .select('*')
          .eq('week', weekData?.week_number || 1)
          .eq('season_type', weekData?.season_type || 2)
          .order('kickoff_time');

        if (error) {
          console.error('Error loading games:', error);
        } else {
          setGames(gamesData || []);
        }
      } catch (error) {
        console.error('Error loading data:', error);
      } finally {
        setIsLoadingGames(false);
      }
    };

    loadData();
  }, []);


  const handleSearch = async () => {
    if (!searchTerm.trim()) return;
    
    try {
      const { getSupabaseClient } = await import('@/lib/supabase');
      const supabase = getSupabaseClient();
      
      // Search for pools by name or admin email
      const { data: pools, error } = await supabase
        .from('pools')
        .select('id, name, created_by')
        .or(`name.ilike.%${searchTerm}%,created_by.ilike.%${searchTerm}%`)
        .eq('is_active', true)
        .limit(1);

      if (error) {
        console.error('Error searching pools:', error);
        return;
      }

      if (pools && pools.length > 0) {
        // Redirect to participant page with the pool ID
        router.push(createPageUrl(`poolpicks?poolId=${pools[0].id}`));
      } else {
        // Show error message - you could add a toast notification here
        console.log('No pools found');
      }
    } catch (error) {
      console.error('Error searching for pool:', error);
    }
  };

  const getGameStatus = (game: Game) => {
    if (game.status === 'final') return 'Final';
    if (game.status === 'live') return 'Live';
    const kickoff = new Date(game.kickoff_time);
    const now = new Date();
    if (kickoff > now) {
      return kickoff.toLocaleDateString('en-US', { 
        weekday: 'short', 
        month: 'short', 
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit'
      });
    }
    return 'Starting Soon';
  };

  const getGameScore = (game: Game) => {
    if (game.status === 'scheduled') return '';
    return `${game.away_score} - ${game.home_score}`;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-900 via-blue-800 to-purple-900">
      {/* Navigation Bar */}
      <nav className="bg-white/10 backdrop-blur-md border-b border-white/20">
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Trophy className="h-8 w-8 text-white" />
              <h1 className="text-xl font-bold text-white">NFL Confidence Pool</h1>
            </div>
            <div className="flex items-center gap-4">
              {user ? (
                <>
                  <Button
                    className="bg-blue-600 hover:bg-blue-700 text-white border-none"
                    onClick={() => router.push('/season-review')}
                  >
                    <Trophy className="h-4 w-4 mr-2" />
                    Season Review
                  </Button>
                  <Button
                    className="bg-green-600 hover:bg-green-700 text-white border-none"
                    onClick={() => {
                      if (isSuperAdmin === true) {
                        router.push('/admin/dashboard');
                      } else if (isSuperAdmin === false) {
                        router.push('/dashboard');
                      }
                    }}
                    disabled={isCheckingAdmin}
                  >
                    <Shield className="h-4 w-4 mr-2" />
                    {isCheckingAdmin ? 'Loading...' : isSuperAdmin ? 'Admin Dashboard' : 'Commissioner Dashboard'}
                  </Button>
                </>
              ) : (
                <Button
                  className="bg-blue-600 hover:bg-blue-700 text-white border-none"
                  onClick={() => router.push('/admin/login')}
                >
                  <Shield className="h-4 w-4 mr-2" />
                  Commissioner Login
                </Button>
              )}
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <div className="container mx-auto px-4 py-12">
        <div className="text-center mb-12">
          <h2 className="text-4xl md:text-6xl font-bold text-white mb-6">
            NFL Confidence Pool
          </h2>
          <p className="text-xl text-blue-100 mb-8 max-w-2xl mx-auto">
            Join the ultimate NFL prediction challenge. Pick winners, assign confidence points, 
            and compete with friends and family in weekly confidence pools.
          </p>
          
          {/* Pool Search */}
          <Card className="max-w-md mx-auto bg-white/10 backdrop-blur-md border-white/20">
            <CardHeader>
              <CardTitle className="text-white">Find Your Pool</CardTitle>
              <CardDescription className="text-blue-100">
                Enter your pool name or admin email to join
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                <div>
                  <Input
                    placeholder="Enter pool name or admin email..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full"
                    onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                  />
                </div>
                <Button 
                  onClick={handleSearch}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white"
                  disabled={!searchTerm.trim()}
                >
                  <Search className="h-4 w-4 mr-2" />
                  Find Pool
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Features Section */}
        <div className="grid md:grid-cols-3 gap-6 mb-12">
          <Card className="bg-white/10 backdrop-blur-md border-white/20 text-center">
            <CardContent className="pt-6">
              <Trophy className="h-12 w-12 text-yellow-400 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-white mb-2">Weekly Competition</h3>
              <p className="text-blue-100">Compete weekly with friends and family in confidence pools</p>
            </CardContent>
          </Card>
          
          <Card className="bg-white/10 backdrop-blur-md border-white/20 text-center">
            <CardContent className="pt-6">
              <Users className="h-12 w-12 text-blue-400 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-white mb-2">Social Experience</h3>
              <p className="text-blue-100">Join pools, invite friends, and track your performance</p>
            </CardContent>
          </Card>
          
          <Card className="bg-white/10 backdrop-blur-md border-white/20 text-center">
            <CardContent className="pt-6">
              <Calendar className="h-12 w-12 text-green-400 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-white mb-2">Season Long</h3>
              <p className="text-blue-100">Follow your progress throughout the entire NFL season</p>
            </CardContent>
          </Card>
        </div>

        {/* Games Ticker */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-4">
            <Trophy className="h-6 w-6 text-white" />
            <h3 className="text-2xl font-bold text-white">Week {currentWeek} Games</h3>
          </div>
          
          {isLoadingGames ? (
            <div className="bg-white/10 backdrop-blur-md border-white/20 rounded-lg p-6">
              <div className="animate-pulse space-y-4">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="flex items-center gap-4">
                    <div className="h-4 bg-white/20 rounded w-24"></div>
                    <div className="h-4 bg-white/20 rounded w-32"></div>
                    <div className="h-4 bg-white/20 rounded w-20"></div>
                  </div>
                ))}
              </div>
            </div>
          ) : games.length > 0 ? (
            <div className="bg-white/10 backdrop-blur-md border-white/20 rounded-lg p-6">
              <div className="space-y-3">
                {games.map((game) => (
                  <div key={game.id} className="flex items-center justify-between p-3 bg-white/5 rounded-lg">
                    <div className="flex items-center gap-4">
                      <div className="text-sm text-blue-200 min-w-[80px]">
                        {getGameStatus(game)}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-white">{game.away_team}</span>
                        <span className="text-blue-200">@</span>
                        <span className="font-medium text-white">{game.home_team}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {getGameScore(game) && (
                        <Badge variant="secondary" className="bg-white/20 text-white">
                          {getGameScore(game)}
                        </Badge>
                      )}
                      {game.status === 'live' && (
                        <Badge variant="destructive" className="animate-pulse">
                          LIVE
                        </Badge>
                      )}
                      {game.status === 'final' && (
                        <Badge variant="outline" className="border-green-400 text-green-400">
                          Final
                        </Badge>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="bg-white/10 backdrop-blur-md border-white/20 rounded-lg p-6 text-center">
              <p className="text-blue-100">No games scheduled for this week</p>
            </div>
          )}
        </div>

        {/* How It Works */}
        <div className="bg-white/10 backdrop-blur-md border-white/20 rounded-lg p-8">
          <h3 className="text-2xl font-bold text-white mb-6 text-center">How It Works</h3>
          <div className="grid md:grid-cols-4 gap-6">
            <div className="text-center">
              <div className="w-12 h-12 bg-blue-500 rounded-full flex items-center justify-center mx-auto mb-3">
                <span className="text-white font-bold">1</span>
              </div>
              <h4 className="text-white font-semibold mb-2">Join a Pool</h4>
              <p className="text-blue-100 text-sm">Find and join a confidence pool with friends or family</p>
            </div>
            
            <div className="text-center">
              <div className="w-12 h-12 bg-blue-500 rounded-full flex items-center justify-center mx-auto mb-3">
                <span className="text-white font-bold">2</span>
              </div>
              <h4 className="text-white font-semibold mb-2">Make Picks</h4>
              <p className="text-blue-100 text-sm">Pick the winner of each game and assign confidence points</p>
            </div>
            
            <div className="text-center">
              <div className="w-12 h-12 bg-blue-500 rounded-full flex items-center justify-center mx-auto mb-3">
                <span className="text-white font-bold">3</span>
              </div>
              <h4 className="text-white font-semibold mb-2">Watch Games</h4>
              <p className="text-blue-100 text-sm">Follow the games and see how your picks perform</p>
            </div>
            
            <div className="text-center">
              <div className="w-12 h-12 bg-blue-500 rounded-full flex items-center justify-center mx-auto mb-3">
                <span className="text-white font-bold">4</span>
              </div>
              <h4 className="text-white font-semibold mb-2">Win Points</h4>
              <p className="text-blue-100 text-sm">Earn points for correct picks based on your confidence level</p>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="bg-black/20 border-t border-white/20 mt-12">
        <div className="container mx-auto px-4 py-6">
          <div className="text-center text-blue-100">
            <p>&copy; {new Date().getFullYear()} NFL Confidence Pool. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default function HomePage() {
  return (
    <AuthProvider>
      <LandingPage />
    </AuthProvider>
  );
}

