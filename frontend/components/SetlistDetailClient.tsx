'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Calendar, MapPin, Music, Plus, ExternalLink, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import Link from "next/link";
import { getSetlistById, createSpotifyPlaylist, SetlistDetailResponse } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/components/ui/use-toast";

interface SetlistDetailClientProps {
  id: string;
}

export default function SetlistDetailClient({ id }: SetlistDetailClientProps) {
  const [setlistData, setSetlistData] = useState<SetlistDetailResponse | null>(null);
  const [songs, setSongs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [creatingPlaylist, setCreatingPlaylist] = useState(false);
  const [playlistUrl, setPlaylistUrl] = useState<string | null>(null);
  const router = useRouter();
  const [authState, /* unused login */, logout] = useAuth();
  const { toast } = useToast();

  // Fetch setlist detail on mount
  useEffect(() => {
    async function fetchSetlist() {
      setLoading(true);
      setError('');
      
      try {
        const data = await getSetlistById(id);
        setSetlistData(data);
        setSongs(data.songs || []);
      } catch (err) {
        console.error('Error fetching setlist:', err);
        setError('Failed to load setlist details. Please try again.');
      } finally {
        setLoading(false);
      }
    }

    fetchSetlist();
  }, [id]);

  // Format date
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

  // Get songs - now directly from API response
  const getSongs = () => {
    return songs;
  };

  // Create Spotify playlist
  const handleCreatePlaylist = async () => {
    if (!authState.isAuthenticated || !setlistData?.setlist) return;
    
    setCreatingPlaylist(true);
    try {
      const response = await createSpotifyPlaylist(
        setlistData.setlist.id,
        authState.accessToken as string
      );
      
      toast({
        title: "Playlist created!",
        description: "Your Spotify playlist has been created successfully.",
        variant: "default",
      });
      
      // Save playlist URL but don't auto-open
      if (response.playlist?.external_urls?.spotify) {
        setPlaylistUrl(response.playlist.external_urls.spotify);
      }
    } catch (err) {
      console.error('Error creating playlist:', err);
      toast({
        title: "Failed to create playlist",
        description: "There was an error creating your Spotify playlist. Please try again.",
        variant: "destructive",
      });
    } finally {
      setCreatingPlaylist(false);
    }
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
                Login with Spotify
              </Button>
            </Link>
          )}
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        {/* Back Button */}
        <div className="flex items-center space-x-4 mb-8">
          <Button
            variant="ghost"
            size="sm"
            className="text-gray-400 hover:text-white"
            onClick={() => router.back()}
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
        </div>

        {loading && (
          <div className="flex justify-center items-center h-64">
            <Loader2 className="w-8 h-8 text-green-400 animate-spin" />
          </div>
        )}

        {error && (
          <Alert variant="destructive" className="mb-6">
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {setlistData?.setlist && (
          <div className="mb-8">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6">
              <div>
                <h1 className="text-3xl font-bold text-white mb-3">
                {setlistData.setlist.artist?.name || 'Unknown Artist'}
              </h1>
                <div className="flex items-center space-x-4 text-gray-400 text-md">
                  <div className="flex items-center">
                    <Calendar className="w-5 h-5 mr-1 text-green-400" />
                    {setlistData.setlist.eventDate ? formatDate(setlistData.setlist.eventDate) : 'Unknown Date'}
                  </div>
                  <div className="flex items-center">
                    <MapPin className="w-5 h-5 mr-1 text-green-400" />
                    {setlistData.setlist.venue?.name || 'Unknown Venue'}, 
                    {setlistData.setlist.venue?.city?.name || 'Unknown City'}, 
                    {setlistData.setlist.venue?.city?.country?.name || 'Unknown Country'}
                  </div>
                </div>
                {setlistData.setlist.tour?.name && (
                  <Badge variant="secondary" className="mt-3 bg-purple-500/20 text-purple-300 border-purple-500/30">
                    {setlistData.setlist.tour.name}
                  </Badge>
                )}
              </div>

              <div className="mt-4 md:mt-0">
                {authState.isAuthenticated ? (
                  playlistUrl ? (
                    <Button
                      size="lg"
                      className="bg-green-500 hover:bg-green-600 text-white font-semibold"
                      asChild
                    >
                      <a 
                        href={playlistUrl} 
                        target="_blank" 
                        rel="noopener noreferrer"
                      >
                        <ExternalLink className="w-4 h-4 mr-2" />
                        Open in Spotify
                      </a>
                    </Button>
                  ) : (
                    <Button
                      size="lg"
                      className="bg-green-500 hover:bg-green-600 text-black font-semibold"
                      onClick={handleCreatePlaylist}
                      disabled={creatingPlaylist}
                    >
                      {creatingPlaylist ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Creating...
                        </>
                      ) : (
                        <>
                          <Plus className="w-4 h-4 mr-2" />
                          Create Spotify Playlist
                        </>
                      )}
                    </Button>
                  )
                ) : (
                  <Link href="/auth/spotify">
                    <Button
                      size="lg"
                      className="bg-green-500 hover:bg-green-600 text-black font-semibold"
                    >
                      <Music className="w-4 h-4 mr-2" />
                      Login to Create Playlist
                    </Button>
                  </Link>
                )}
              </div>
            </div>

            {/* Removed duplicate button */}

            <Card className="bg-white/5 backdrop-blur-sm border-white/10">
              <CardHeader>
                <CardTitle className="text-white text-xl flex items-center">
                  <Music className="w-5 h-5 mr-2 text-green-400" />
                  Complete Setlist {getSongs().length > 0 && `(${getSongs().length} Songs)`}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {getSongs().length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {getSongs().map((song, index) => (
                      <div
                        key={index}
                        className="flex items-center p-3 bg-white/5 rounded-lg border border-white/10"
                      >
                        <span className="text-green-400 font-mono text-lg w-8">
                          {(index + 1).toString().padStart(2, "0")}
                        </span>
                        <div>
                          <div className="text-white">{song?.name || 'Untitled Song'}</div>
                          {song?.cover && (
                            <div className="text-sm text-gray-400">
                              Cover of {song.cover?.name || 'Unknown Artist'}
                            </div>
                          )}
                          {song?.tape && (
                            <Badge variant="outline" className="mt-1 text-xs">
                              Tape
                            </Badge>
                          )}
                          {song?.info && (
                            <div className="text-xs text-gray-500 mt-1">
                              {song.info}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center text-gray-400 py-8">
                    No songs available for this setlist
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </main>
    </div>
  );
}
