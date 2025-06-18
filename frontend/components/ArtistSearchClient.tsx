'use client';

import React, { useState, useEffect, Suspense } from 'react';
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

// Loading component for Suspense fallback
function SearchLoading() {
  return (
    <main className="container mx-auto px-4 py-8">
      <div className="mb-12">
        <h1 className="text-3xl md:text-4xl font-bold text-white mb-6 text-center">
          Find Concert Setlists
        </h1>
        <div className="max-w-md mx-auto">
          <div className="flex items-center gap-2">
            <div className="relative flex-grow">
              <div className="h-10 w-full bg-white/10 border border-white/20 rounded-md animate-pulse"></div>
            </div>
            <div className="h-10 w-24 bg-green-500/30 rounded-md animate-pulse"></div>
          </div>
        </div>
      </div>
      
      <div className="flex flex-col items-center justify-center py-20">
        <Loader2 className="h-12 w-12 animate-spin text-green-500 mb-4" />
        <p className="text-white text-lg">Loading search results...</p>
      </div>
    </main>
  );
}

// Inner component that uses navigation hooks
function ArtistSearchInner() {
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
  const [authState, /* unused login */, logout] = useAuth();
  
  // NOTE: Sharing feature removed for now - will be reimplemented in future ticket
  // const getFullSearchUrl = () => {
  //   if (typeof window !== 'undefined') {
  //     return `${window.location.origin}/search?q=${encodeURIComponent(searchTerm)}`;
  //   }
  //   return `/search?q=${encodeURIComponent(searchTerm)}`;
  // };

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
    if (searchTerm.length < 2) {
      toast({
        title: "Search term too short",
        description: "Please enter at least 2 characters to search.",
        variant: "destructive"
      });
      return;
    }
    performSearch(searchTerm);
    router.push(`/search?q=${encodeURIComponent(searchTerm)}`);
  };
  
  // Handle creating a Spotify playlist
  const handleCreatePlaylist = async (setlistId: string) => {
    if (!authState.isAuthenticated || !authState.accessToken) {
      toast({
        title: "Not logged in",
        description: "Please log in with Spotify to create playlists.",
        variant: "destructive"
      });
      return;
    }

    setCreatingPlaylist(prev => ({ ...prev, [setlistId]: true }));
    
    try {
      // Pass the access token from auth state as required by the API
      const response = await createSpotifyPlaylist(setlistId, authState.accessToken);
      
      if (response.playlistUrl) {
        setPlaylistUrls(prev => ({ ...prev, [setlistId]: response.playlistUrl }));
        toast({
          title: "Playlist Created",
          description: "Spotify playlist has been created successfully!",
        });
      } else {
        throw new Error('No playlist URL returned');
      }
    } catch (error: unknown) {
      console.error('Error creating playlist:', error);
      
      // Proper type narrowing for the error object
      const err = error as { response?: { status?: number } };
      
      // Handle token expiration with safe property access
      if (err?.response?.status === 401) {
        toast({
          title: "Session Expired",
          description: "Your Spotify session has expired. Please log in again.",
          variant: "destructive"
        });
        logout();
      } else {
        toast({
          title: "Error",
          description: "Failed to create playlist. Please try again.",
          variant: "destructive"
        });
      }
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
    if (!dateString) return 'Unknown date';
    
    try {
      const date = new Date(dateString);
      
      // Check if date is valid
      if (isNaN(date.getTime())) {
        return dateString;
      }
      
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      });
    } catch (e) {
      return dateString;
    }
  };
  
  // Get songs from setlist sets
  const getSongs = (setlist: Setlist) => {
    const songs: any[] = [];
    
    if (setlist.sets && setlist.sets.set) {
      setlist.sets.set.forEach(set => {
        if (set.song) {
          songs.push(...set.song);
        }
      });
    }
    
    return songs;
  };
  
  return (
    <main className="container mx-auto px-4 py-8">
        <div className="mb-12">
          <h1 className="text-3xl md:text-4xl font-bold text-white mb-6 text-center">
            Find Concert Setlists
          </h1>
          
          <form onSubmit={handleSubmit} className="max-w-md mx-auto">
            <div className="flex items-center gap-2">
              <div className="relative flex-grow">
                <Input
                  type="text"
                  placeholder="Search by artist name..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="bg-white/10 border-white/20 text-white placeholder:text-gray-400 focus-visible:ring-green-500"
                />
              </div>
              <Button 
                type="submit" 
                className="bg-green-500 hover:bg-green-600 text-black font-semibold"
                disabled={loading}
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Search"}
              </Button>
            </div>
          </form>
        </div>

        {loading && results.length === 0 && (
          <div className="flex justify-center py-12">
            <Loader2 className="h-12 w-12 animate-spin text-green-500" />
          </div>
        )}

        {error && (
          <div className="max-w-md mx-auto p-4 bg-red-500/20 border border-red-500/30 rounded-lg text-white text-center">
            {error}
          </div>
        )}

        {!loading && results.length > 0 && (
          <>
            <div className="flex items-center justify-between mb-6">
              <div>
                <p className="text-gray-300">
                  <span className="font-bold text-white">{total}</span> {searchType === 'artist' ? 'concerts' : 'setlists'} found
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-6 md:gap-8 mb-12">
              {results.map((setlist) => (
                <Card key={setlist.id} className="bg-black/30 border-white/10 text-white overflow-hidden hover:border-green-500/50 transition-all mb-4">
                  <CardHeader className="pb-2">
                    <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-3">
                      <div>
                        <Badge className="bg-green-500/20 text-green-400 mb-2">
                          {setlist.eventDate ? formatDate(setlist.eventDate) : 'Unknown date'}
                        </Badge>
                        <CardTitle className="text-xl mb-1">{setlist.artist?.name || 'Unknown Artist'}</CardTitle>
                        <div className="flex items-center text-gray-400 text-sm mb-3">
                          <MapPin className="w-3 h-3 mr-1 flex-shrink-0" />
                          <span className="truncate">{setlist.venue?.name}, {setlist.venue?.city?.name}, {setlist.venue?.city?.country?.name || ''}</span>
                        </div>
                      </div>
                      <div className="flex flex-col xs:flex-row gap-2">
                        {playlistUrls[setlist.id] ? (
                          <Link href={playlistUrls[setlist.id]} target="_blank" rel="noopener noreferrer">
                            <Button size="sm" className="bg-green-500 hover:bg-green-600 text-black font-semibold whitespace-nowrap w-full xs:w-auto">
                              <Music className="w-4 h-4 mr-2" />
                              Open Playlist
                            </Button>
                          </Link>
                        ) : creatingPlaylist[setlist.id] ? (
                          <Button size="sm" className="bg-green-500/50 text-black font-semibold whitespace-nowrap w-full xs:w-auto" disabled>
                            <Loader2 className="w-4 h-4 animate-spin mr-2" />
                            Creating...
                          </Button>
                        ) : authState.isAuthenticated ? (
                          <Button 
                            size="sm" 
                            className="bg-green-500 hover:bg-green-600 text-black font-semibold whitespace-nowrap w-full xs:w-auto"
                            onClick={() => handleCreatePlaylist(setlist.id)}
                            disabled={!getSongs(setlist).length}
                          >
                            <Plus className="w-4 h-4 mr-2" />
                            Create Playlist
                          </Button>
                        ) : (
                          <Button 
                            size="sm" 
                            className="bg-green-500 hover:bg-green-600 text-black font-semibold whitespace-nowrap w-full xs:w-auto"
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
                          <Button variant="outline" size="sm" className="border-white/20 text-gray-400 hover:text-white w-full xs:w-auto mt-2 xs:mt-0">
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
  );
}

// Main exported component with internal Suspense boundary
// This ensures proper Suspense boundaries for navigation hooks
export default function ArtistSearchClient() {
  return (
    <Suspense fallback={<SearchLoading />}>
      <ArtistSearchInner />
    </Suspense>
  );
}
