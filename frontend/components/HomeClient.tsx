'use client';

import React, { useEffect } from 'react';
import { Search, Music, Headphones } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import HomeSearchForm from "@/components/HomeSearchForm";
import { useRouter } from 'next/navigation';
import { useAuth } from "@/hooks/useAuth";

export default function HomeClient() {
  const router = useRouter();
  const [authState, _, logout] = useAuth();

  // Check for pending setlist ID or saved search on mount
  useEffect(() => {
    try {
      // First check for pending setlist ID
      const pendingId = sessionStorage.getItem('pendingSetlistId');
      if (pendingId) {
        console.log('Found pending setlist ID:', pendingId);
        // Clear the stored ID
        sessionStorage.removeItem('pendingSetlistId');
        
        // Navigate to the setlist detail page
        router.push(`/setlist/?id=${pendingId}`);
        return;
      }
      
      // Then check if we came from a search page login
      const savedSearch = localStorage.getItem('setlista_search');
      if (savedSearch && authState.isAuthenticated) {
        console.log('Found saved search query, restoring search state:', savedSearch);
        
        // Clear the saved search to avoid repeated redirects
        localStorage.removeItem('setlista_search');
        
        // Navigate back to the search page with the saved query
        router.push(`/search?q=${encodeURIComponent(savedSearch)}`);
      }
    } catch (err) {
      console.error('Error checking for pending navigation:', err);
    }
  }, [router, authState.isAuthenticated]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      {/* Header */}
      <header className="border-b border-white/10 bg-black/20 backdrop-blur-sm">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center space-x-2">
            <Music className="h-8 w-8 text-green-400" />
            <span className="text-2xl font-bold text-white">setlista</span>
          </Link>
          {authState.isAuthenticated ? (
            <Button
              variant="outline"
              className="border-green-400 text-green-400 hover:bg-green-400 hover:text-black"
              onClick={() => logout()}
            >
              Logout
            </Button>
          ) : (
            <Link href="/auth/spotify">
              <Button
                variant="outline"
                className="border-green-400 text-green-400 hover:bg-green-400 hover:text-black"
              >
                <Headphones className="w-4 h-4 mr-2" />
                Login with Spotify
              </Button>
            </Link>
          )}
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
              <h3 className="text-xl font-semibold text-white mb-2">View Setlists</h3>
              <p className="text-gray-400">
                Browse complete song lists from concerts, including covers and special performances.
              </p>
            </div>
            <div className="bg-white/5 backdrop-blur-sm rounded-xl p-6 border border-white/10">
              <div className="w-12 h-12 bg-green-500/20 rounded-lg flex items-center justify-center mx-auto mb-4">
                <Headphones className="w-6 h-6 text-green-400" />
              </div>
              <h3 className="text-xl font-semibold text-white mb-2">Create Playlists</h3>
              <p className="text-gray-400">
                Convert any setlist to a Spotify playlist with one click and listen to the concert experience.
              </p>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-white/10 py-6 bg-black/20 backdrop-blur-sm">
        <div className="container mx-auto px-4 text-center text-gray-500 text-sm">
          <p>© 2025 setlista. Powered by setlist.fm and Spotify. Not affiliated with either service.</p>
        </div>
      </footer>
    </div>
  );
}
