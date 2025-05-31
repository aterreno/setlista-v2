import axios from 'axios';
import { SpotifyRepositoryImpl } from '../../../infrastructure/repositories/spotify-repository-impl';
import { config } from '../../../config';
import logger from '../../../utils/logger';

jest.mock('axios');
jest.mock('../../../utils/logger');

const mockedAxios = axios as jest.Mocked<typeof axios>;

// Mock the config module
jest.mock('../../../config', () => ({
  config: {
    server: {
      nodeEnv: 'test',
    },
    spotify: {
      clientId: 'test-client-id',
      clientSecret: 'test-client-secret',
      redirectUri: 'http://localhost:3000/callback',
    },
    logging: {
      level: 'info',
    },
  },
}));

describe('SpotifyRepositoryImpl', () => {
  let spotifyRepository: SpotifyRepositoryImpl;

  beforeEach(() => {
    spotifyRepository = new SpotifyRepositoryImpl();
    jest.clearAllMocks();
  });

  describe('getAuthorizationUrl', () => {
    it('should return correct authorization URL', () => {
      const url = spotifyRepository.getAuthorizationUrl();
      
      expect(url).toContain('https://accounts.spotify.com/authorize');
      expect(url).toContain('client_id=test-client-id');
      expect(url).toContain('response_type=code');
      expect(url).toContain('redirect_uri=http%3A%2F%2Flocalhost%3A3000%2Fcallback');
      expect(url).toContain('scope=user-read-private+user-read-email+playlist-modify-public+playlist-modify-private');
    });
  });

  describe('getAccessToken', () => {
    it('should get access token successfully', async () => {
      const mockResponse = {
        data: {
          access_token: 'test-access-token',
          refresh_token: 'test-refresh-token',
          expires_in: 3600,
        },
      };
      mockedAxios.post.mockResolvedValue(mockResponse);

      const result = await spotifyRepository.getAccessToken('auth-code');

      expect(mockedAxios.post).toHaveBeenCalledWith(
        'https://accounts.spotify.com/api/token',
        expect.any(URLSearchParams),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            Authorization: expect.stringContaining('Basic'),
          },
          timeout: 30000,
        }
      );
      expect(result).toEqual({
        access_token: 'test-access-token',
        refresh_token: 'test-refresh-token',
        expires_in: 3600,
      });
    });

    it('should handle error when getting access token', async () => {
      const error = new Error('API Error');
      mockedAxios.post.mockRejectedValue(error);

      await expect(spotifyRepository.getAccessToken('auth-code')).rejects.toThrow(
        'Failed to get Spotify access token'
      );
      expect(logger.error).toHaveBeenCalledWith('Error getting Spotify access token', { error });
    });
  });

  describe('getUserProfile', () => {
    it('should get user profile successfully', async () => {
      const mockResponse = {
        data: {
          id: 'user123',
          display_name: 'Test User',
          email: 'test@example.com',
        },
      };
      mockedAxios.get.mockResolvedValue(mockResponse);

      const result = await spotifyRepository.getUserProfile('access-token');

      expect(mockedAxios.get).toHaveBeenCalledWith(
        'https://api.spotify.com/v1/me',
        {
          headers: {
            Authorization: 'Bearer access-token',
          },
          timeout: 30000,
        }
      );
      expect(result).toEqual({
        id: 'user123',
        display_name: 'Test User',
        email: 'test@example.com',
      });
    });

    it('should handle error when getting user profile', async () => {
      const error = new Error('API Error');
      mockedAxios.get.mockRejectedValue(error);

      await expect(spotifyRepository.getUserProfile('access-token')).rejects.toThrow(
        'Failed to get Spotify user profile'
      );
      expect(logger.error).toHaveBeenCalledWith('Error getting Spotify user profile', { error });
    });
  });

  describe('searchTracks', () => {
    it('should search tracks successfully', async () => {
      const mockResponse = {
        data: {
          tracks: {
            items: [
              { id: 'track1', name: 'Test Song', uri: 'spotify:track:track1' },
              { id: 'track2', name: 'Another Song', uri: 'spotify:track:track2' },
            ],
          },
        },
      };
      mockedAxios.get.mockResolvedValue(mockResponse);

      const result = await spotifyRepository.searchTracks('test query', 'access-token');

      expect(mockedAxios.get).toHaveBeenCalledWith(
        'https://api.spotify.com/v1/search',
        {
          headers: {
            Authorization: 'Bearer access-token',
          },
          params: {
            q: 'test query',
            type: 'track',
            limit: 5,
          },
          timeout: 30000,
        }
      );
      expect(result).toEqual(mockResponse.data.tracks.items);
    });

    it('should handle error when searching tracks', async () => {
      const error = new Error('API Error');
      mockedAxios.get.mockRejectedValue(error);

      await expect(spotifyRepository.searchTracks('test query', 'access-token')).rejects.toThrow(
        'Failed to search Spotify tracks'
      );
      expect(logger.error).toHaveBeenCalledWith('Error searching Spotify tracks', {
        error,
        query: 'test query',
      });
    });
  });

  describe('createPlaylist', () => {
    it('should create playlist successfully', async () => {
      const mockResponse = {
        data: {
          id: 'playlist123',
          name: 'Test Playlist',
          external_urls: { spotify: 'https://open.spotify.com/playlist/playlist123' },
        },
      };
      mockedAxios.post.mockResolvedValue(mockResponse);

      const result = await spotifyRepository.createPlaylist(
        'user123',
        'Test Playlist',
        'Test Description',
        'access-token'
      );

      expect(mockedAxios.post).toHaveBeenCalledWith(
        'https://api.spotify.com/v1/users/user123/playlists',
        {
          name: 'Test Playlist',
          description: 'Test Description',
          public: false,
        },
        {
          headers: {
            Authorization: 'Bearer access-token',
            'Content-Type': 'application/json',
          },
          timeout: 30000,
        }
      );
      expect(result).toEqual(mockResponse.data);
    });

    it('should handle error when creating playlist', async () => {
      const error = new Error('API Error');
      mockedAxios.post.mockRejectedValue(error);

      await expect(
        spotifyRepository.createPlaylist('user123', 'Test Playlist', 'Test Description', 'access-token')
      ).rejects.toThrow('Failed to create Spotify playlist');
      expect(logger.error).toHaveBeenCalledWith('Error creating Spotify playlist', {
        error,
        name: 'Test Playlist',
      });
    });
  });

  describe('addTracksToPlaylist', () => {
    it('should add tracks to playlist successfully', async () => {
      mockedAxios.post.mockResolvedValue({ data: {} });

      await spotifyRepository.addTracksToPlaylist(
        'playlist123',
        ['spotify:track:track1', 'spotify:track:track2'],
        'access-token'
      );

      expect(mockedAxios.post).toHaveBeenCalledWith(
        'https://api.spotify.com/v1/playlists/playlist123/tracks',
        {
          uris: ['spotify:track:track1', 'spotify:track:track2'],
        },
        {
          headers: {
            Authorization: 'Bearer access-token',
            'Content-Type': 'application/json',
          },
          timeout: 30000,
        }
      );
    });

    it('should handle error when adding tracks to playlist', async () => {
      const error = new Error('API Error');
      mockedAxios.post.mockRejectedValue(error);

      await expect(
        spotifyRepository.addTracksToPlaylist(
          'playlist123',
          ['spotify:track:track1'],
          'access-token'
        )
      ).rejects.toThrow('Failed to add tracks to Spotify playlist');
      expect(logger.error).toHaveBeenCalledWith('Error adding tracks to Spotify playlist', {
        error,
        playlistId: 'playlist123',
      });
    });
  });
});