import { Request, Response } from 'express';
import { SpotifyController } from '../../controllers/spotify-controller';
import { SpotifyService } from '../../domain/services/spotify-service';
import { SetlistService } from '../../domain/services/setlist-service';
import logger from '../../utils/logger';

jest.mock('../../utils/logger');

describe('SpotifyController', () => {
  let spotifyController: SpotifyController;
  let mockSpotifyService: jest.Mocked<SpotifyService>;
  let mockSetlistService: jest.Mocked<SetlistService>;
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;

  beforeEach(() => {
    mockSpotifyService = {
      getAuthorizationUrl: jest.fn(),
      getAccessToken: jest.fn(),
      getUserProfile: jest.fn(),
      createPlaylistFromSongs: jest.fn(),
      searchTrackForSong: jest.fn(),
    } as unknown as jest.Mocked<SpotifyService>;

    mockSetlistService = {
      searchSetlists: jest.fn(),
      getArtistSetlists: jest.fn(),
      getSetlistById: jest.fn(),
      extractSongsFromSetlist: jest.fn(),
    } as unknown as jest.Mocked<SetlistService>;

    spotifyController = new SpotifyController(mockSpotifyService, mockSetlistService);

    mockRequest = {};
    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getAuthUrl', () => {
    it('should return Spotify authorization URL successfully', () => {
      const mockAuthUrl = 'https://accounts.spotify.com/authorize?client_id=test';
      mockSpotifyService.getAuthorizationUrl.mockReturnValue(mockAuthUrl);

      spotifyController.getAuthUrl(mockRequest as Request, mockResponse as Response);

      expect(mockSpotifyService.getAuthorizationUrl).toHaveBeenCalled();
      expect(mockResponse.json).toHaveBeenCalledWith({ authUrl: mockAuthUrl });
    });

    it('should handle error from service', () => {
      const error = new Error('Spotify error');
      mockSpotifyService.getAuthorizationUrl.mockImplementation(() => {
        throw error;
      });

      spotifyController.getAuthUrl(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith({ error: 'Failed to get Spotify authorization URL' });
      expect(logger.error).toHaveBeenCalled();
    });
  });

  describe('handleCallback', () => {
    beforeEach(() => {
      mockRequest.query = {};
    });

    it('should handle Spotify callback successfully', async () => {
      const mockTokenData = {
        access_token: 'mock-access-token',
        refresh_token: 'mock-refresh-token',
        expires_in: 3600,
      };
      mockRequest.query = { code: 'mock-auth-code' };
      mockSpotifyService.getAccessToken.mockResolvedValue(mockTokenData);

      await spotifyController.handleCallback(mockRequest as Request, mockResponse as Response);

      expect(mockSpotifyService.getAccessToken).toHaveBeenCalledWith('mock-auth-code');
      expect(mockResponse.json).toHaveBeenCalledWith({
        access_token: 'mock-access-token',
        expires_in: 3600,
      });
    });

    it('should return 400 when authorization code is missing', async () => {
      mockRequest.query = {};

      await spotifyController.handleCallback(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({ error: 'Authorization code is required' });
    });

    it('should return 400 when authorization code is not a string', async () => {
      mockRequest.query = { code: 123 as any };

      await spotifyController.handleCallback(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({ error: 'Authorization code is required' });
    });

    it('should handle error from service', async () => {
      mockRequest.query = { code: 'mock-auth-code' };
      const error = new Error('Spotify API error');
      mockSpotifyService.getAccessToken.mockRejectedValue(error);

      await spotifyController.handleCallback(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith({ error: 'Failed to handle Spotify callback' });
      expect(logger.error).toHaveBeenCalled();
    });
  });

  describe('createPlaylist', () => {
    beforeEach(() => {
      mockRequest.params = {};
      mockRequest.body = {};
    });

    it('should create Spotify playlist successfully', async () => {
      const mockSetlist = {
        id: 'setlist-id',
        artist: { name: 'Test Artist' },
        eventDate: '2023-12-31',
        venue: { name: 'Test Venue' },
      };
      const mockSongs = [{ name: 'Song 1' }, { name: 'Song 2' }];
      const mockPlaylist = { id: 'playlist-id', name: 'Test Playlist' };

      mockRequest.params = { setlistId: 'setlist-id' };
      mockRequest.body = { access_token: 'mock-access-token' };
      mockSetlistService.getSetlistById.mockResolvedValue(mockSetlist as any);
      mockSetlistService.extractSongsFromSetlist.mockReturnValue(mockSongs as any);
      mockSpotifyService.createPlaylistFromSongs.mockResolvedValue(mockPlaylist as any);

      await spotifyController.createPlaylist(mockRequest as Request, mockResponse as Response);

      expect(mockSetlistService.getSetlistById).toHaveBeenCalledWith('setlist-id');
      expect(mockSetlistService.extractSongsFromSetlist).toHaveBeenCalledWith(mockSetlist);
      expect(mockSpotifyService.createPlaylistFromSongs).toHaveBeenCalledWith(
        mockSongs,
        'Test Artist',
        '2023-12-31',
        'Test Venue',
        'mock-access-token'
      );
      expect(mockResponse.json).toHaveBeenCalledWith({ playlist: mockPlaylist });
    });

    it('should return 400 when setlist ID is missing', async () => {
      mockRequest.params = {};
      mockRequest.body = { access_token: 'mock-access-token' };

      await spotifyController.createPlaylist(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({ error: 'Setlist ID is required' });
    });

    it('should return 400 when access token is missing', async () => {
      mockRequest.params = { setlistId: 'setlist-id' };
      mockRequest.body = {};

      await spotifyController.createPlaylist(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({ error: 'Spotify access token is required' });
    });

    it('should return 404 when no songs found in setlist', async () => {
      const mockSetlist = {
        id: 'setlist-id',
        artist: { name: 'Test Artist' },
        eventDate: '2023-12-31',
        venue: { name: 'Test Venue' },
      };

      mockRequest.params = { setlistId: 'setlist-id' };
      mockRequest.body = { access_token: 'mock-access-token' };
      mockSetlistService.getSetlistById.mockResolvedValue(mockSetlist as any);
      mockSetlistService.extractSongsFromSetlist.mockReturnValue([]);

      await spotifyController.createPlaylist(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(404);
      expect(mockResponse.json).toHaveBeenCalledWith({ error: 'No songs found in setlist' });
    });

    it('should handle error from setlist service', async () => {
      mockRequest.params = { setlistId: 'setlist-id' };
      mockRequest.body = { access_token: 'mock-access-token' };
      const error = new Error('Setlist not found');
      mockSetlistService.getSetlistById.mockRejectedValue(error);

      await spotifyController.createPlaylist(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith({ error: 'Failed to create Spotify playlist' });
      expect(logger.error).toHaveBeenCalled();
    });

    it('should handle error from spotify service', async () => {
      const mockSetlist = {
        id: 'setlist-id',
        artist: { name: 'Test Artist' },
        eventDate: '2023-12-31',
        venue: { name: 'Test Venue' },
      };
      const mockSongs = [{ name: 'Song 1' }];

      mockRequest.params = { setlistId: 'setlist-id' };
      mockRequest.body = { access_token: 'mock-access-token' };
      mockSetlistService.getSetlistById.mockResolvedValue(mockSetlist as any);
      mockSetlistService.extractSongsFromSetlist.mockReturnValue(mockSongs as any);
      const error = new Error('Spotify API error');
      mockSpotifyService.createPlaylistFromSongs.mockRejectedValue(error);

      await spotifyController.createPlaylist(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith({ error: 'Failed to create Spotify playlist' });
      expect(logger.error).toHaveBeenCalled();
    });
  });
});