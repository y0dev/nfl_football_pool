import { AuthForm } from "@/components/auth/auth-form"

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-blue-50 via-white to-indigo-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
      {/* Header */}
      <header className="nfl-gradient text-white shadow-xl">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center shadow-lg">
                <span className="text-blue-600 font-bold text-xl">🏈</span>
              </div>
              <div>
                <h1 className="text-3xl font-bold">NFL Confidence Pool</h1>
                <p className="text-blue-100 text-sm">The Ultimate Football Experience</p>
              </div>
            </div>
            <nav className="hidden md:flex space-x-8">
              <a href="#features" className="hover:text-blue-200 transition-colors font-medium">Features</a>
              <a href="#how-it-works" className="hover:text-blue-200 transition-colors font-medium">How It Works</a>
              <a href="#pricing" className="hover:text-blue-200 transition-colors font-medium">Pricing</a>
            </nav>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <main className="flex-1">
        <div className="container mx-auto px-4 py-16">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <div className="space-y-8">
              <div className="space-y-6">
                <h2 className="text-5xl lg:text-7xl font-bold text-gray-900 dark:text-white leading-tight">
                  The Ultimate{" "}
                  <span className="bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                    NFL Confidence Pool
                  </span>
                </h2>
                              <p className="text-xl text-gray-600 dark:text-gray-300 leading-relaxed">
                The ultimate way to compete with friends and family during the NFL season. 
                Make your picks, assign confidence points, and climb the leaderboard!
              </p>
              </div>
              
              <div className="grid sm:grid-cols-2 gap-6">
                <div className="bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 p-6 rounded-2xl border border-green-200 dark:border-green-800">
                  <div className="flex items-center space-x-3 mb-3">
                    <div className="w-10 h-10 bg-green-100 dark:bg-green-900/30 rounded-lg flex items-center justify-center">
                      <span className="text-2xl">🏆</span>
                    </div>
                    <h3 className="font-semibold text-green-800 dark:text-green-200">Weekly Prizes</h3>
                  </div>
                  <p className="text-green-700 dark:text-green-300 text-sm">Compete for weekly and season-long prizes</p>
                </div>
                
                <div className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 p-6 rounded-2xl border border-blue-200 dark:border-blue-800">
                  <div className="flex items-center space-x-3 mb-3">
                    <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center">
                      <span className="text-2xl">📱</span>
                    </div>
                    <h3 className="font-semibold text-blue-800 dark:text-blue-200">Mobile Friendly</h3>
                  </div>
                  <p className="text-blue-700 dark:text-blue-300 text-sm">Make picks on the go with our mobile app</p>
                </div>
              </div>
            </div>
            
            <div className="flex justify-center">
              <div className="w-full max-w-md">
                <AuthForm />
              </div>
            </div>
          </div>
        </div>

        {/* Features Section */}
        <section id="features" className="py-20 bg-white dark:bg-gray-900">
          <div className="container mx-auto px-4">
            <div className="text-center mb-16">
              <h3 className="text-4xl font-bold text-gray-900 dark:text-white mb-4">
                Perfect for Friends & Family
              </h3>
              <p className="text-xl text-gray-600 dark:text-gray-300 max-w-2xl mx-auto">
                A simple, fun way to compete with your loved ones during the NFL season
              </p>
            </div>
            
            <div className="grid md:grid-cols-3 gap-8">
              <div className="text-center space-y-6 p-8 rounded-2xl bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/10 dark:to-indigo-900/10 border border-blue-200 dark:border-blue-800">
                <div className="w-20 h-20 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl flex items-center justify-center mx-auto shadow-lg">
                  <span className="text-3xl">⚡</span>
                </div>
                <h4 className="text-2xl font-semibold text-gray-900 dark:text-white">Real-time Updates</h4>
                <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
                  Live scores and standings update automatically as games finish. Never miss a moment of the action.
                </p>
              </div>
              
              <div className="text-center space-y-6 p-8 rounded-2xl bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/10 dark:to-emerald-900/10 border border-green-200 dark:border-green-800">
                <div className="w-20 h-20 bg-gradient-to-br from-green-500 to-emerald-600 rounded-2xl flex items-center justify-center mx-auto shadow-lg">
                  <span className="text-3xl">🔒</span>
                </div>
                <h4 className="text-2xl font-semibold text-gray-900 dark:text-white">Secure & Fair</h4>
                <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
                  Picks lock at kickoff ensuring a fair and competitive environment for all participants.
                </p>
              </div>
              
              <div className="text-center space-y-6 p-8 rounded-2xl bg-gradient-to-br from-purple-50 to-violet-50 dark:from-purple-900/10 dark:to-violet-900/10 border border-purple-200 dark:border-purple-800">
                <div className="w-20 h-20 bg-gradient-to-br from-purple-500 to-violet-600 rounded-2xl flex items-center justify-center mx-auto shadow-lg">
                  <span className="text-3xl">👥</span>
                </div>
                <h4 className="text-2xl font-semibold text-gray-900 dark:text-white">Social Features</h4>
                <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
                  Create private pools with friends, family, or coworkers. Build your own community.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* How It Works */}
        <section id="how-it-works" className="py-20 bg-gray-50 dark:bg-gray-800">
          <div className="container mx-auto px-4">
            <div className="text-center mb-16">
              <h3 className="text-4xl font-bold text-gray-900 dark:text-white mb-4">
                How It Works
              </h3>
              <p className="text-xl text-gray-600 dark:text-gray-300 max-w-2xl mx-auto">
                Get started in minutes with our simple 4-step process
              </p>
            </div>
            
            <div className="grid md:grid-cols-4 gap-8">
              <div className="text-center space-y-4">
                <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full flex items-center justify-center mx-auto shadow-lg">
                  <span className="text-2xl font-bold text-white">1</span>
                </div>
                <h4 className="text-xl font-semibold text-gray-900 dark:text-white">Create Pool</h4>
                <p className="text-gray-600 dark:text-gray-300">
                  Set up your confidence pool and invite participants
                </p>
              </div>
              
              <div className="text-center space-y-4">
                <div className="w-16 h-16 bg-gradient-to-br from-green-500 to-emerald-600 rounded-full flex items-center justify-center mx-auto shadow-lg">
                  <span className="text-2xl font-bold text-white">2</span>
                </div>
                <h4 className="text-xl font-semibold text-gray-900 dark:text-white">Make Picks</h4>
                <p className="text-gray-600 dark:text-gray-300">
                  Pick winners and assign confidence points (1-16)
                </p>
              </div>
              
              <div className="text-center space-y-4">
                <div className="w-16 h-16 bg-gradient-to-br from-purple-500 to-violet-600 rounded-full flex items-center justify-center mx-auto shadow-lg">
                  <span className="text-2xl font-bold text-white">3</span>
                </div>
                <h4 className="text-xl font-semibold text-gray-900 dark:text-white">Watch Games</h4>
                <p className="text-gray-600 dark:text-gray-300">
                  Follow live scores and see your picks in action
                </p>
              </div>
              
              <div className="text-center space-y-4">
                <div className="w-16 h-16 bg-gradient-to-br from-orange-500 to-red-600 rounded-full flex items-center justify-center mx-auto shadow-lg">
                  <span className="text-2xl font-bold text-white">4</span>
                </div>
                <h4 className="text-xl font-semibold text-gray-900 dark:text-white">Win Prizes</h4>
                <p className="text-gray-600 dark:text-gray-300">
                  Climb the leaderboard and claim your rewards
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Pricing Section */}
        <section id="pricing" className="py-20 bg-white dark:bg-gray-900">
          <div className="container mx-auto px-4">
            <div className="text-center mb-16">
              <h3 className="text-4xl font-bold text-gray-900 dark:text-white mb-4">
                Simple Pricing
              </h3>
              <p className="text-xl text-gray-600 dark:text-gray-300 max-w-2xl mx-auto">
                Choose the plan that works best for your group
              </p>
            </div>
            
            <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
              <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-200 dark:border-gray-700 p-8">
                <div className="text-center mb-8">
                  <h4 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Free</h4>
                  <div className="text-4xl font-bold text-blue-600 mb-2">$0</div>
                  <p className="text-gray-600 dark:text-gray-300">Perfect for small groups</p>
                </div>
                <ul className="space-y-4 mb-8">
                  <li className="flex items-center space-x-3">
                    <span className="text-green-500">✓</span>
                    <span className="text-gray-700 dark:text-gray-300">Up to 20 participants</span>
                  </li>
                  <li className="flex items-center space-x-3">
                    <span className="text-green-500">✓</span>
                    <span className="text-gray-700 dark:text-gray-300">Basic statistics</span>
                  </li>
                  <li className="flex items-center space-x-3">
                    <span className="text-green-500">✓</span>
                    <span className="text-gray-700 dark:text-gray-300">Mobile responsive</span>
                  </li>
                </ul>
                <button className="w-full btn-secondary">Get Started</button>
              </div>
              
              <div className="bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl shadow-xl p-8 text-white transform scale-105">
                <div className="text-center mb-8">
                  <h4 className="text-2xl font-bold mb-2">Pro</h4>
                  <div className="text-4xl font-bold mb-2">$29</div>
                  <p className="text-blue-100">Most popular choice</p>
                </div>
                <ul className="space-y-4 mb-8">
                  <li className="flex items-center space-x-3">
                    <span className="text-green-400">✓</span>
                    <span>Up to 100 participants</span>
                  </li>
                  <li className="flex items-center space-x-3">
                    <span className="text-green-400">✓</span>
                    <span>Advanced analytics</span>
                  </li>
                  <li className="flex items-center space-x-3">
                    <span className="text-green-400">✓</span>
                    <span>Custom branding</span>
                  </li>
                  <li className="flex items-center space-x-3">
                    <span className="text-green-400">✓</span>
                    <span>Priority support</span>
                  </li>
                </ul>
                <button className="w-full bg-white text-blue-600 font-semibold py-3 px-6 rounded-lg hover:bg-gray-100 transition-colors">Get Pro</button>
              </div>
              
              <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-200 dark:border-gray-700 p-8">
                <div className="text-center mb-8">
                  <h4 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Enterprise</h4>
                  <div className="text-4xl font-bold text-blue-600 mb-2">$99</div>
                  <p className="text-gray-600 dark:text-gray-300">For large organizations</p>
                </div>
                <ul className="space-y-4 mb-8">
                  <li className="flex items-center space-x-3">
                    <span className="text-green-500">✓</span>
                    <span className="text-gray-700 dark:text-gray-300">Unlimited participants</span>
                  </li>
                  <li className="flex items-center space-x-3">
                    <span className="text-green-500">✓</span>
                    <span className="text-gray-700 dark:text-gray-300">White-label solution</span>
                  </li>
                  <li className="flex items-center space-x-3">
                    <span className="text-green-500">✓</span>
                    <span className="text-gray-700 dark:text-gray-300">API access</span>
                  </li>
                  <li className="flex items-center space-x-3">
                    <span className="text-green-500">✓</span>
                    <span className="text-gray-700 dark:text-gray-300">Dedicated support</span>
                  </li>
                </ul>
                <button className="w-full btn-secondary">Contact Sales</button>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="bg-gray-900 text-white py-12">
        <div className="container mx-auto px-4">
          <div className="grid md:grid-cols-4 gap-8">
            <div className="space-y-4">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center">
                  <span className="text-white font-bold">🏈</span>
                </div>
                <h3 className="text-xl font-bold">NFL Confidence Pool</h3>
              </div>
              <p className="text-gray-400">
                The ultimate platform for NFL confidence pools. Compete with friends, track your picks, and win prizes.
              </p>
            </div>
            
            <div>
              <h4 className="font-semibold mb-4">Product</h4>
              <ul className="space-y-2 text-gray-400">
                <li><a href="#" className="hover:text-white transition-colors">Features</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Pricing</a></li>
                <li><a href="#" className="hover:text-white transition-colors">API</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Documentation</a></li>
              </ul>
            </div>
            
            <div>
              <h4 className="font-semibold mb-4">Company</h4>
              <ul className="space-y-2 text-gray-400">
                <li><a href="#" className="hover:text-white transition-colors">About</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Blog</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Careers</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Contact</a></li>
              </ul>
            </div>
            
            <div>
              <h4 className="font-semibold mb-4">Support</h4>
              <ul className="space-y-2 text-gray-400">
                <li><a href="#" className="hover:text-white transition-colors">Help Center</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Community</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Status</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Security</a></li>
              </ul>
            </div>
          </div>
          
          <div className="border-t border-gray-800 mt-8 pt-8 text-center text-gray-400">
            <p>&copy; 2024 NFL Confidence Pool. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  )
}
