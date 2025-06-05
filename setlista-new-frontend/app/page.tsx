import { Search, Music, Headphones } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import Link from "next/link"
import HomeSearchForm from "@/components/HomeSearchForm"

export default function HomePage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      {/* Header */}
      <header className="border-b border-white/10 bg-black/20 backdrop-blur-sm">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center space-x-2">
            <Music className="h-8 w-8 text-green-400" />
            <span className="text-2xl font-bold text-white">setlista</span>
          </Link>
          <Link href="/auth/spotify">
            <Button variant="outline" className="border-green-400 text-green-400 hover:bg-green-400 hover:text-black">
              <Headphones className="w-4 h-4 mr-2" />
              Login with Spotify
            </Button>
          </Link>
        </div>
      </header>

      {/* Hero Section */}
      <main className="container mx-auto px-4 py-20">
        <div className="text-center max-w-4xl mx-auto">
          <h1 className="text-5xl md:text-7xl font-bold text-white mb-6 leading-tight">
            Find setlists for your
            <span className="text-green-400 block">favorite artists</span>
          </h1>
          <p className="text-xl text-gray-300 mb-12 max-w-2xl mx-auto">
            Search for concerts, discover setlists, and create Spotify playlists from your favorite live performances.
          </p>

          {/* Search Form */}
          <HomeSearchForm />

          {/* Features */}
          <div className="grid md:grid-cols-3 gap-8 text-center">
            <div className="bg-white/5 backdrop-blur-sm rounded-xl p-6 border border-white/10">
              <div className="w-12 h-12 bg-green-500/20 rounded-lg flex items-center justify-center mx-auto mb-4">
                <Search className="w-6 h-6 text-green-400" />
              </div>
              <h3 className="text-xl font-semibold text-white mb-2">Search Artists</h3>
              <p className="text-gray-400">
                Find concerts and setlists from your favorite artists using the setlist.fm database.
              </p>
            </div>
            <div className="bg-white/5 backdrop-blur-sm rounded-xl p-6 border border-white/10">
              <div className="w-12 h-12 bg-green-500/20 rounded-lg flex items-center justify-center mx-auto mb-4">
                <Music className="w-6 h-6 text-green-400" />
              </div>
              <h3 className="text-xl font-semibold text-white mb-2">Browse Setlists</h3>
              <p className="text-gray-400">Explore detailed setlists from live concerts and discover new songs.</p>
            </div>
            <div className="bg-white/5 backdrop-blur-sm rounded-xl p-6 border border-white/10">
              <div className="w-12 h-12 bg-green-500/20 rounded-lg flex items-center justify-center mx-auto mb-4">
                <Headphones className="w-6 h-6 text-green-400" />
              </div>
              <h3 className="text-xl font-semibold text-white mb-2">Create Playlists</h3>
              <p className="text-gray-400">Automatically generate Spotify playlists from concert setlists.</p>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-white/10 bg-black/20 backdrop-blur-sm mt-20">
        <div className="container mx-auto px-4 py-8 text-center text-gray-400">
          <p>&copy; 2024 Setlista. Powered by setlist.fm API and Spotify.</p>
        </div>
      </footer>
    </div>
  )
}
