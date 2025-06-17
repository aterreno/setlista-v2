import { Song } from '../types';
import { SpotifyRepository, SpotifyTrack, SpotifyPlaylist } from '../repositories/spotify-repository';

export class SpotifyService {
  constructor(private readonly spotifyRepository: SpotifyRepository) {}

  getAuthorizationUrl(): string {
    return this.spotifyRepository.getAuthorizationUrl();
  }

  async getAccessToken(code: string): Promise<{
    access_token: string;
    refresh_token: string;
    expires_in: number;
  }> {
    return this.spotifyRepository.getAccessToken(code);
  }

  async getUserProfile(accessToken: string): Promise<{
    id: string;
    display_name: string;
    email: string;
  }> {
    return this.spotifyRepository.getUserProfile(accessToken);
  }

  async searchTrackForSong(song: Song, artist: string, accessToken: string): Promise<SpotifyTrack | null> {
    const maxRetries = 3;
    const retryDelay = 1000;

    const searchWithRetry = async (query: string): Promise<SpotifyTrack[]> => {
      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
          return await this.spotifyRepository.searchTracks(query, accessToken);
        } catch (error: any) {
          if (attempt === maxRetries || !error.code || error.code !== 'ETIMEDOUT') {
            throw error;
          }
          await new Promise(resolve => setTimeout(resolve, retryDelay * attempt));
        }
      }
      return [];
    };

    try {
      // First try: search with both track name and artist
      let query = `track:${song.name} artist:${artist}`;
      let tracks = await searchWithRetry(query);

      if (tracks.length > 0) {
        return tracks[0];
      }

      // Second try: search for covers by the performing artist (for covers)
      if (song.cover) {
        query = `track:${song.name} artist:${artist}`;
        tracks = await searchWithRetry(query);
        if (tracks.length > 0) {
          return tracks[0];
        }
      }

      // Third try: search just by track name (fallback for covers or obscure songs)
      query = `track:${song.name}`;
      tracks = await searchWithRetry(query);

      return tracks.length > 0 ? tracks[0] : null;
    } catch (_error) {
      return null;
    }
  }

  async createPlaylistFromSongs(
    songs: Song[],
    artistName: string,
    concertDate: string,
    venue: string,
    accessToken: string
  ): Promise<SpotifyPlaylist> {
    const userProfile = await this.getUserProfile(accessToken);
    
    const playlistName = `${artistName} @ ${venue} (${concertDate})`;
    const description = `Setlist from ${artistName}'s concert at ${venue} on ${concertDate}. Created with Setlista.`;

    const playlist = await this.spotifyRepository.createPlaylist(
      userProfile.id,
      playlistName,
      description,
      accessToken
    );

    // Search for each song on Spotify with concurrency limit
    const batchSize = 5;
    const tracks: (SpotifyTrack | null)[] = [];
    
    for (let i = 0; i < songs.length; i += batchSize) {
      const batch = songs.slice(i, i + batchSize);
      const batchPromises = batch.map((song) => 
        this.searchTrackForSong(song, artistName, accessToken)
      );
      
      const batchResults = await Promise.all(batchPromises);
      tracks.push(...batchResults);
      
      // Add delay between batches to avoid rate limiting
      if (i + batchSize < songs.length) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }
    
    // Filter out null results and get track URIs
    const trackUris = tracks
      .filter((track): track is SpotifyTrack => track !== null)
      .map((track) => track.uri);

    if (trackUris.length > 0) {
      await this.spotifyRepository.addTracksToPlaylist(
        playlist.id,
        trackUris,
        accessToken
      );
    }

    return playlist;
  }
}