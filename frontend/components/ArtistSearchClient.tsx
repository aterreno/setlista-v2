'use client';

import React, { useState, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Calendar, MapPin, Music, Plus, ExternalLink, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/use-toast";
import { Input } from "@/components/ui/input";
import Link from "next/link";
import { searchSetlists, Setlist, createSpotifyPlaylist, SearchType } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";

export default function ArtistSearchClient() {
  const [searchTerm, setSearchTerm] = useState('');
  const [results, setResults] = useState<Setlist[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [itemsPerPage, setItemsPerPage] = useState(20);
  const [searchType, setSearchType] = useState<SearchType>('artist');
  const [creatingPlaylist, setCreatingPlaylist] = useState<Record<string, boolean>>({});
  const [playlistUrls, setPlaylistUrls] = useState<Record<string, string>>({});
  const { toast } = useToast();
  const searchParams = useSearchParams();
  const router = useRouter();
  const [authState, _login, logout] = useAuth();
  
  // Function to get the full URL for the current search
  const getFullSearchUrl = () => {
    if (typeof window !== 'undefined') {
      return `${window.location.origin}/search?q=${encodeURIComponent(searchTerm)}`;
    }
    return `/search?q=${encodeURIComponent(searchTerm)}`;
  };

  // Get query from URL params
  useEffect(() => {
    const query = searchParams.get('q');
    console.log(`URL query parameter: "${query}", length: ${query?.length || 0}`);
    
    if (query) {
      setSearchTerm(query);
      // Force search even for 2-character queries like "U2"
      if (query.length >= 2) {
        // Skip normal length validation by using this special function
        performSearchNoValidation(query);
      } else if (query.length === 1) {
        toast({
          title: "Search term too short",
          description: "Please enter at least 2 characters to search.",
          variant: "destructive"
        });
      }
    }
  }, [searchParams, toast]);
  
  // Special version of performSearch that skips length validation
  // Used specifically for URL parameters
  const performSearchNoValidation = async (query: string, pageNum = 1) => {
    setLoading(true);
    setError('');
    
    try {
      console.log(`Executing search with query: "${query}"`);
      const response = await searchSetlists(query, pageNum);
      setResults(response.items);
      setTotal(response.total);
      setItemsPerPage(response.itemsPerPage);
      setPage(pageNum);
      // Set the search type from the response
      if (response.searchType) {
        setSearchType(response.searchType);
      } else {
        setSearchType('artist'); // Default to artist if not specified
      }
    } catch (err) {
      console.error('Search error:', err);
      setError('An error occurred while searching. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Perform the search
  const performSearch = async (query: string, pageNum = 1) => {
    if (query.length < 2) return; // Allow 2-character searches (e.g., "U2")
    
    setLoading(true);
    setError('');
    
    try {
      const response = await searchSetlists(query, pageNum);
      setResults(response.items);
      setTotal(response.total);
      setItemsPerPage(response.itemsPerPage);
      setPage(pageNum);
      // Set the search type from the response
      if (response.searchType) {
        setSearchType(response.searchType);
      } else {
        setSearchType('artist'); // Default to artist if not specified
      }
    } catch (err) {
      console.error('Search error:', err);
      setError('An error occurred while searching. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Handle form submission
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchTerm.trim().length >= 2) { // Allow 2-character searches (e.g., "U2")
      router.push(`/search?q=${encodeURIComponent(searchTerm)}`);
    } else if (searchTerm.trim().length === 1) {
      toast({
        title: "Search term too short",
        description: "Please enter at least 2 characters to search.",
        variant: "destructive"
      });
    }
  };

  // Handle creating a Spotify playlist
  const handleCreatePlaylist = async (setlistId: string) => {
    if (!authState.isAuthenticated || !authState.accessToken) {
      toast({
        title: "Not logged in",
        description: "Please login with Spotify to create playlists",
        variant: "destructive"
      });
      return;
    }

    try {
      setCreatingPlaylist(prev => ({ ...prev, [setlistId]: true }));
      
      const response = await createSpotifyPlaylist(setlistId, authState.accessToken);
      
      if (response?.playlist?.external_urls?.spotify) {
        setPlaylistUrls(prev => ({ ...prev, [setlistId]: response.playlist.external_urls.spotify }));
        toast({
          title: "Playlist created!",
          description: "Your Spotify playlist has been created successfully."
        });
      } else {
        throw new Error("Playlist URL not found in response");
      }
    } catch (error) {
      console.error("Error creating playlist:", error);
      toast({
        title: "Error creating playlist",
        description: "There was a problem creating your Spotify playlist. Please try again.",
        variant: "destructive"
      });
    } finally {
      setCreatingPlaylist(prev => ({ ...prev, [setlistId]: false }));
    }
  };

  // Handle load more
  const handleLoadMore = () => {
    if (page < Math.ceil(total / itemsPerPage)) {
      performSearch(searchTerm, page + 1);
    }
  };

  // Format date (YYYY-MM-DD to locale date)
  const formatDate = (dateString: string) => {
    // Convert from "dd-MM-yyyy" to a Date object
    const parts = dateString.split('-');
    if (parts.length !== 3) return dateString;
    
    const day = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1; // Months are 0-indexed in JS Date
    const year = parseInt(parts[2], 10);
    
    const date = new Date(year, month, day);
    
    return date.toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'long', 
      day: 'numeric'
    });
  };

  // Get songs from setlist sets
  const getSongs = (setlist: Setlist) => {
    if (!setlist.sets || !setlist.sets.set || setlist.sets.set.length === 0) {
      return [];
    }
    
    const songs: any[] = [];
    setlist.sets.set.forEach(set => {
      if (set.song) {
        if (Array.isArray(set.song)) {
          songs.push(...set.song);
        } else {
          songs.push(set.song);
        }
      }
    });
    
    return songs;
  };

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
              onClick={() => logout()}
              variant="outline" 
              className="border-green-400 text-green-400 hover:bg-green-400 hover:text-black"
            >
              Log Out
            </Button>
          ) : (
            <Link href="/auth/spotify">
              <Button 
                variant="outline" 
                className="border-green-400 text-green-400 hover:bg-green-400 hover:text-black"
              >
                Login with Spotify
              </Button>
            </Link>
          )}
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        {/* Search Form */}
        <form onSubmit={handleSubmit} className="mb-8">
          <div className="relative max-w-2xl mx-auto">
            <Input
              type="text"
              placeholder="Search for an artist..."
              className="w-full h-16 text-lg pl-6 pr-16 bg-white/10 border-white/20 text-white placeholder:text-gray-400 focus:border-green-400 focus:ring-green-400"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              minLength={2}
              required
            />
            <Button
              type="submit"
              size="lg"
              className="absolute right-2 top-2 h-12 px-6 bg-green-500 hover:bg-green-600 text-black font-semibold"
              disabled={loading}
            >
              {loading ? 'Searching...' : 'Search'}
            </Button>
          </div>
        </form>

        {/* Search Results */}
        {error && (
          <div className="bg-red-500/20 text-red-300 p-4 rounded-lg mb-6">
            {error}
          </div>
        )}

        {results.length > 0 && (
          <>
            <div className="mb-8">
              <h1 className="text-4xl font-bold text-white mb-2">
                {searchType === 'artist' && (
                  <>Concerts by <span className="text-green-400">{results[0].artist.name}</span></>
                )}
                {searchType === 'venue' && (
                  <>Concerts at <span className="text-green-400">{results[0].venue.name}</span></>
                )}
                {searchType === 'city' && (
                  <>Concerts in <span className="text-green-400">{results[0].venue.city.name}, {results[0].venue.city.country.name}</span></>
                )}
                {searchType === 'festival' && (
                  <>Concerts at <span className="text-green-400">{searchTerm}</span> festival</>
                )}
              </h1>
              <p className="text-gray-400">Found {total} concerts with setlists</p>
            </div>

            {/* Concert Cards */}
            <div className="grid gap-6">
              {results.map((setlist) => (
                <Card
                  key={setlist.id}
                  className="bg-white/5 backdrop-blur-sm border-white/10 hover:bg-white/10 transition-colors"
                >
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle className="text-white text-xl mb-2">{setlist.venue.name}</CardTitle>
                        <div className="flex items-center space-x-4 text-gray-400 text-sm">
                          <div className="flex items-center">
                            <MapPin className="w-4 h-4 mr-1" />
                            {setlist.venue.city.name}, {setlist.venue.city.country.name}
                          </div>
                          <div className="flex items-center">
                            <Calendar className="w-4 h-4 mr-1" />
                            {formatDate(setlist.eventDate)}
                          </div>
                        </div>
                        {setlist.tour && (
                          <Badge variant="secondary" className="mt-2 bg-purple-500/20 text-purple-300 border-purple-500/30">
                            {setlist.tour.name}
                          </Badge>
                        )}
                      </div>
                      <div className="flex space-x-2">
                        {authState.isAuthenticated ? (
                          playlistUrls[setlist.id] ? (
                            <Button
                              size="sm"
                              className="bg-green-500 hover:bg-green-600 text-white font-semibold"
                              asChild
                            >
                              <a 
                                href={playlistUrls[setlist.id]}
                                target="_blank"
                                rel="noopener noreferrer"
                              >
                                <ExternalLink className="w-4 h-4 mr-2" />
                                Open in Spotify
                              </a>
                            </Button>
                          ) : (
                            <Button 
                              size="sm" 
                              className="bg-green-500 hover:bg-green-600 text-black font-semibold"
                              onClick={() => handleCreatePlaylist(setlist.id)}
                              disabled={creatingPlaylist[setlist.id]}
                            >
                              {creatingPlaylist[setlist.id] ? (
                                <>
                                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                  Creating...
                                </>
                              ) : (
                                <>
                                  <Plus className="w-4 h-4 mr-2" />
                                  Create Playlist
                                </>
                              )}
                            </Button>
                          )
                        ) : (
                          <Button 
                            size="sm" 
                            className="bg-green-500 hover:bg-green-600 text-black font-semibold"
                            onClick={() => {
                              // Save current search directly to localStorage before redirect
                              if (typeof window !== 'undefined') {
                                window.localStorage.setItem('setlista_search', searchTerm);
                                console.log(`Search state saved: ${searchTerm}`);
                              }
                              // Redirect to Spotify login
                              window.location.href = '/auth/spotify';
                            }}
                          >
                            <Music className="w-4 h-4 mr-2" />
                            Login for Playlist
                          </Button>
                        )}
                        <Link href={`/setlist/?id=${setlist.id}`}>
                          <Button variant="outline" size="sm" className="border-white/20 text-gray-400 hover:text-white">
                            <ExternalLink className="w-4 h-4" />
                          </Button>
                        </Link>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {setlist.sets && setlist.sets.set && setlist.sets.set.length > 0 ? (
                      <div>
                        <h4 className="text-white font-semibold mb-3 flex items-center">
                          <Music className="w-4 h-4 mr-2 text-green-400" />
                          Setlist ({getSongs(setlist).length} songs)
                        </h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                          {getSongs(setlist).slice(0, 12).map((song, index) => (
                            <div key={index} className="flex items-center space-x-2 text-gray-300 text-sm py-1">
                              <span className="text-green-400 font-mono text-xs w-6">
                                {(index + 1).toString().padStart(2, "0")}
                              </span>
                              <span>
                                {song.cover ? `${song.name} (${song.cover.name})` : song.name}
                              </span>
                            </div>
                          ))}
                          {getSongs(setlist).length > 12 && (
                            <div className="text-gray-500 text-sm py-1 col-span-full">
                              + {getSongs(setlist).length - 12} more songs
                            </div>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div className="text-gray-500 italic">No setlist information available</div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Load More */}
            {page < Math.ceil(total / itemsPerPage) && (
              <div className="text-center mt-12">
                <Button 
                  variant="outline" 
                  className="border-white/20 text-gray-400 hover:text-white"
                  onClick={handleLoadMore}
                  disabled={loading}
                >
                  {loading ? 'Loading...' : 'Load More Concerts'}
                </Button>
              </div>
            )}
          </>
        )}

        {searchTerm && !loading && results.length === 0 && (
          <div className="text-center py-12">
            <div className="text-4xl mb-4">🎵</div>
            <h3 className="text-white text-xl mb-2">No concerts found</h3>
            <p className="text-gray-400">
              We couldn't find any concerts for "{searchTerm}". Try a different search term.
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
