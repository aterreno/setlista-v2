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
    const query = `track:${song.name} artist:${artist}`;
    const tracks = await this.spotifyRepository.searchTracks(query, accessToken);

    return tracks.length > 0 ? tracks[0] : null;
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

    // Search for each song on Spotify
    const trackPromises = songs.map((song) => 
      this.searchTrackForSong(song, artistName, accessToken)
    );
    
    const tracks = await Promise.all(trackPromises);
    
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