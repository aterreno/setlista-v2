export interface SpotifyTrack {
  id: string;
  name: string;
  artists: { id: string; name: string }[];
  album: {
    id: string;
    name: string;
    images: { url: string; height: number; width: number }[];
  };
  uri: string;
}

export interface SpotifyPlaylist {
  id: string;
  name: string;
  description: string;
  external_urls: {
    spotify: string;
  };
}

export interface SpotifyRepository {
  searchTracks(query: string, accessToken: string): Promise<SpotifyTrack[]>;
  createPlaylist(
    userId: string,
    name: string,
    description: string,
    accessToken: string
  ): Promise<SpotifyPlaylist>;
  addTracksToPlaylist(
    playlistId: string,
    trackUris: string[],
    accessToken: string
  ): Promise<void>;
  getAuthorizationUrl(): string;
  getAccessToken(code: string): Promise<{
    access_token: string;
    refresh_token: string;
    expires_in: number;
  }>;
  getUserProfile(accessToken: string): Promise<{
    id: string;
    display_name: string;
    email: string;
  }>;
}