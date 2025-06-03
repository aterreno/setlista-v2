import axios from 'axios';
import { config } from '../../config';
import { SpotifyRepository, SpotifyTrack, SpotifyPlaylist } from '../../domain/repositories/spotify-repository';
import { API_ENDPOINTS, TIMEOUTS, SPOTIFY_CONFIG } from '../../constants';
import logger from '../../utils/logger';

export class SpotifyRepositoryImpl implements SpotifyRepository {
  private readonly baseUrl = API_ENDPOINTS.SPOTIFY.BASE_URL;
  private readonly authUrl = API_ENDPOINTS.SPOTIFY.AUTH_URL;
  private readonly tokenUrl = API_ENDPOINTS.SPOTIFY.TOKEN_URL;

  private get clientId() { return config.spotify.clientId; }
  private get clientSecret() { return config.spotify.clientSecret; }
  private get redirectUri() { return config.spotify.redirectUri; }

  getAuthorizationUrl(): string {
    const scopes = SPOTIFY_CONFIG.SCOPES;

    const params = new URLSearchParams();
    params.append('client_id', this.clientId ?? '');
    params.append('response_type', 'code');
    params.append('redirect_uri', this.redirectUri ?? '');
    params.append('scope', scopes.join(' '));

    return `${this.authUrl}?${params.toString()}`;
  }

  async getAccessToken(code: string): Promise<{
    access_token: string;
    refresh_token: string;
    expires_in: number;
  }> {
    try {
      const params = new URLSearchParams();
      params.append('grant_type', 'authorization_code');
      params.append('code', code);
      params.append('redirect_uri', this.redirectUri ?? '');

      const auth = Buffer.from(`${this.clientId}:${this.clientSecret}`).toString(
        'base64'
      );

      const response = await axios.post(this.tokenUrl, params, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Authorization: `Basic ${auth}`,
        },
        timeout: TIMEOUTS.SPOTIFY_API,
      });

      return {
        access_token: response.data.access_token,
        refresh_token: response.data.refresh_token,
        expires_in: response.data.expires_in,
      };
    } catch (error) {
      logger.error('Error getting Spotify access token', { error });
      throw new Error('Failed to get Spotify access token');
    }
  }

  async getUserProfile(accessToken: string): Promise<{
    id: string;
    display_name: string;
    email: string;
  }> {
    try {
      const response = await axios.get(`${this.baseUrl}/me`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
        timeout: TIMEOUTS.SPOTIFY_API,
      });

      return {
        id: response.data.id,
        display_name: response.data.display_name,
        email: response.data.email,
      };
    } catch (error) {
      logger.error('Error getting Spotify user profile', { error });
      throw new Error('Failed to get Spotify user profile');
    }
  }

  async searchTracks(query: string, accessToken: string): Promise<SpotifyTrack[]> {
    try {
      const response = await axios.get(`${this.baseUrl}/search`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
        params: {
          q: query,
          type: 'track',
          limit: 5,
        },
        timeout: TIMEOUTS.SPOTIFY_API,
      });

      return response.data.tracks.items;
    } catch (error) {
      logger.error('Error searching Spotify tracks', { error, query });
      throw new Error('Failed to search Spotify tracks');
    }
  }

  async createPlaylist(
    userId: string,
    name: string,
    description: string,
    accessToken: string
  ): Promise<SpotifyPlaylist> {
    try {
      const response = await axios.post(
        `${this.baseUrl}/users/${userId}/playlists`,
        {
          name,
          description,
          public: false,
        },
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          timeout: TIMEOUTS.SPOTIFY_API,
        }
      );

      return response.data;
    } catch (error) {
      logger.error('Error creating Spotify playlist', { error, name });
      throw new Error('Failed to create Spotify playlist');
    }
  }

  async addTracksToPlaylist(
    playlistId: string,
    trackUris: string[],
    accessToken: string
  ): Promise<void> {
    try {
      await axios.post(
        `${this.baseUrl}/playlists/${playlistId}/tracks`,
        {
          uris: trackUris,
        },
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          timeout: TIMEOUTS.SPOTIFY_API,
        }
      );
    } catch (error) {
      logger.error('Error adding tracks to Spotify playlist', {
        error,
        playlistId,
      });
      throw new Error('Failed to add tracks to Spotify playlist');
    }
  }
}