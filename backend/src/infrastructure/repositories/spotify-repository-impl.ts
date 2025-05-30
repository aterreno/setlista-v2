import axios from 'axios';
import { config } from '../../config';
import { SpotifyRepository, SpotifyTrack, SpotifyPlaylist } from '../../domain/repositories/spotify-repository';
import logger from '../../utils/logger';

export class SpotifyRepositoryImpl implements SpotifyRepository {
  private readonly clientId = config.spotify.clientId;
  private readonly clientSecret = config.spotify.clientSecret;
  private readonly redirectUri = config.spotify.redirectUri;
  private readonly baseUrl = 'https://api.spotify.com/v1';
  private readonly authUrl = 'https://accounts.spotify.com/authorize';
  private readonly tokenUrl = 'https://accounts.spotify.com/api/token';

  getAuthorizationUrl(): string {
    const scopes = [
      'user-read-private',
      'user-read-email',
      'playlist-modify-public',
      'playlist-modify-private',
    ];

    const params = new URLSearchParams({
      client_id: this.clientId,
      response_type: 'code',
      redirect_uri: this.redirectUri,
      scope: scopes.join(' '),
    });

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
      params.append('redirect_uri', this.redirectUri);

      const auth = Buffer.from(`${this.clientId}:${this.clientSecret}`).toString(
        'base64'
      );

      const response = await axios.post(this.tokenUrl, params, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Authorization: `Basic ${auth}`,
        },
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