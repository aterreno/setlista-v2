import { SpotifyService } from '../../../domain/services/spotify-service';
import { SpotifyRepository, SpotifyTrack, SpotifyPlaylist } from '../../../domain/repositories/spotify-repository';
import { Song } from '../../../domain/types';

describe('SpotifyService', () => {
  let spotifyService: SpotifyService;
  let mockSpotifyRepository: jest.Mocked<SpotifyRepository>;

  beforeEach(() => {
    mockSpotifyRepository = {
      getAuthorizationUrl: jest.fn(),
      getAccessToken: jest.fn(),
      getUserProfile: jest.fn(),
      searchTracks: jest.fn(),
      createPlaylist: jest.fn(),
      addTracksToPlaylist: jest.fn(),
    } as jest.Mocked<SpotifyRepository>;

    spotifyService = new SpotifyService(mockSpotifyRepository);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getAuthorizationUrl', () => {
    it('should return authorization URL from repository', () => {
      const mockUrl = 'https://accounts.spotify.com/authorize?client_id=test';
      mockSpotifyRepository.getAuthorizationUrl.mockReturnValue(mockUrl);

      const result = spotifyService.getAuthorizationUrl();

      expect(mockSpotifyRepository.getAuthorizationUrl).toHaveBeenCalled();
      expect(result).toBe(mockUrl);
    });
  });

  describe('getAccessToken', () => {
    it('should return access token from repository', async () => {
      const mockTokenData = {
        access_token: 'mock-token',
        refresh_token: 'mock-refresh',
        expires_in: 3600,
      };
      mockSpotifyRepository.getAccessToken.mockResolvedValue(mockTokenData);

      const result = await spotifyService.getAccessToken('auth-code');

      expect(mockSpotifyRepository.getAccessToken).toHaveBeenCalledWith('auth-code');
      expect(result).toEqual(mockTokenData);
    });
  });

  describe('getUserProfile', () => {
    it('should return user profile from repository', async () => {
      const mockProfile = {
        id: 'user123',
        display_name: 'Test User',
        email: 'test@example.com',
      };
      mockSpotifyRepository.getUserProfile.mockResolvedValue(mockProfile);

      const result = await spotifyService.getUserProfile('access-token');

      expect(mockSpotifyRepository.getUserProfile).toHaveBeenCalledWith('access-token');
      expect(result).toEqual(mockProfile);
    });
  });

  describe('searchTrackForSong', () => {
    const mockSong: Song = { name: 'Test Song' };
    const mockAccessToken = 'access-token';
    const mockArtist = 'Test Artist';

    it('should return first track when found with track and artist query', async () => {
      const mockTracks: SpotifyTrack[] = [
        { id: 'track1', name: 'Test Song', uri: 'spotify:track:track1' } as SpotifyTrack,
      ];
      mockSpotifyRepository.searchTracks.mockResolvedValue(mockTracks);

      const result = await spotifyService.searchTrackForSong(mockSong, mockArtist, mockAccessToken);

      expect(mockSpotifyRepository.searchTracks).toHaveBeenCalledWith(
        'track:Test Song artist:Test Artist',
        mockAccessToken
      );
      expect(result).toBe(mockTracks[0]);
    });

    it('should try cover search when no tracks found and song has cover', async () => {
      const songWithCover: Song = { 
        name: 'Test Song', 
        cover: { name: 'Original Artist' } 
      };
      mockSpotifyRepository.searchTracks
        .mockResolvedValueOnce([]) // First search returns empty
        .mockResolvedValueOnce([{ id: 'track1' } as SpotifyTrack]); // Cover search returns track

      const result = await spotifyService.searchTrackForSong(songWithCover, mockArtist, mockAccessToken);

      expect(mockSpotifyRepository.searchTracks).toHaveBeenCalledTimes(2);
      expect(mockSpotifyRepository.searchTracks).toHaveBeenNthCalledWith(
        1,
        'track:Test Song artist:Test Artist',
        mockAccessToken
      );
      expect(mockSpotifyRepository.searchTracks).toHaveBeenNthCalledWith(
        2,
        'track:Test Song artist:Test Artist',
        mockAccessToken
      );
      expect(result).toEqual({ id: 'track1' });
    });

    it('should try track name only search as fallback', async () => {
      mockSpotifyRepository.searchTracks
        .mockResolvedValueOnce([]) // First search returns empty
        .mockResolvedValueOnce([{ id: 'track1' } as SpotifyTrack]); // Fallback search returns track

      const result = await spotifyService.searchTrackForSong(mockSong, mockArtist, mockAccessToken);

      expect(mockSpotifyRepository.searchTracks).toHaveBeenCalledTimes(2);
      expect(mockSpotifyRepository.searchTracks).toHaveBeenNthCalledWith(
        2,
        'track:Test Song',
        mockAccessToken
      );
      expect(result).toEqual({ id: 'track1' });
    });

    it('should return null when no tracks found in any search', async () => {
      mockSpotifyRepository.searchTracks.mockResolvedValue([]);

      const result = await spotifyService.searchTrackForSong(mockSong, mockArtist, mockAccessToken);

      expect(result).toBeNull();
    });

    it('should handle errors gracefully and return null', async () => {
      mockSpotifyRepository.searchTracks.mockRejectedValue(new Error('API error'));

      const result = await spotifyService.searchTrackForSong(mockSong, mockArtist, mockAccessToken);

      expect(result).toBeNull();
    });

    it('should retry on ETIMEDOUT error', async () => {
      const timeoutError = { code: 'ETIMEDOUT' };
      mockSpotifyRepository.searchTracks
        .mockRejectedValueOnce(timeoutError)
        .mockRejectedValueOnce(timeoutError)
        .mockResolvedValueOnce([{ id: 'track1' } as SpotifyTrack]);

      const result = await spotifyService.searchTrackForSong(mockSong, mockArtist, mockAccessToken);

      expect(mockSpotifyRepository.searchTracks).toHaveBeenCalledTimes(3);
      expect(result).toEqual({ id: 'track1' });
    });
  });

  describe('createPlaylistFromSongs', () => {
    const mockSongs: Song[] = [
      { name: 'Song 1' },
      { name: 'Song 2' },
    ];
    const mockArtistName = 'Test Artist';
    const mockConcertDate = '2023-12-31';
    const mockVenue = 'Test Venue';
    const mockAccessToken = 'access-token';

    it('should create playlist successfully', async () => {
      const mockUserProfile = { id: 'user123', display_name: 'Test User', email: 'test@example.com' };
      const mockPlaylist: SpotifyPlaylist = {
        id: 'playlist123',
        name: 'Test Artist @ Test Venue (2023-12-31)',
        external_urls: { spotify: 'https://open.spotify.com/playlist/playlist123' },
      } as SpotifyPlaylist;
      const mockTracks: SpotifyTrack[] = [
        { id: 'track1', uri: 'spotify:track:track1' } as SpotifyTrack,
        { id: 'track2', uri: 'spotify:track:track2' } as SpotifyTrack,
      ];

      mockSpotifyRepository.getUserProfile.mockResolvedValue(mockUserProfile);
      mockSpotifyRepository.createPlaylist.mockResolvedValue(mockPlaylist);
      mockSpotifyRepository.searchTracks.mockResolvedValue([mockTracks[0]]);
      mockSpotifyRepository.addTracksToPlaylist.mockResolvedValue();

      // Mock the searchTrackForSong method to return tracks
      jest.spyOn(spotifyService, 'searchTrackForSong')
        .mockResolvedValueOnce(mockTracks[0])
        .mockResolvedValueOnce(mockTracks[1]);

      const result = await spotifyService.createPlaylistFromSongs(
        mockSongs,
        mockArtistName,
        mockConcertDate,
        mockVenue,
        mockAccessToken
      );

      expect(mockSpotifyRepository.getUserProfile).toHaveBeenCalledWith(mockAccessToken);
      expect(mockSpotifyRepository.createPlaylist).toHaveBeenCalledWith(
        'user123',
        'Test Artist @ Test Venue (2023-12-31)',
        'Setlist from Test Artist\'s concert at Test Venue on 2023-12-31. Created with Setlista.',
        mockAccessToken
      );
      expect(mockSpotifyRepository.addTracksToPlaylist).toHaveBeenCalledWith(
        'playlist123',
        ['spotify:track:track1', 'spotify:track:track2'],
        mockAccessToken
      );
      expect(result).toBe(mockPlaylist);
    });

    it('should create playlist even when no tracks are found', async () => {
      const mockUserProfile = { id: 'user123', display_name: 'Test User', email: 'test@example.com' };
      const mockPlaylist: SpotifyPlaylist = {
        id: 'playlist123',
        name: 'Test Artist @ Test Venue (2023-12-31)',
      } as SpotifyPlaylist;

      mockSpotifyRepository.getUserProfile.mockResolvedValue(mockUserProfile);
      mockSpotifyRepository.createPlaylist.mockResolvedValue(mockPlaylist);
      jest.spyOn(spotifyService, 'searchTrackForSong').mockResolvedValue(null);

      const result = await spotifyService.createPlaylistFromSongs(
        mockSongs,
        mockArtistName,
        mockConcertDate,
        mockVenue,
        mockAccessToken
      );

      expect(mockSpotifyRepository.addTracksToPlaylist).not.toHaveBeenCalled();
      expect(result).toBe(mockPlaylist);
    });

    it('should process songs in batches', async () => {
      const manySongs: Song[] = Array.from({ length: 12 }, (_, i) => ({ name: `Song ${i + 1}` }));
      const mockUserProfile = { id: 'user123', display_name: 'Test User', email: 'test@example.com' };
      const mockPlaylist: SpotifyPlaylist = { id: 'playlist123' } as SpotifyPlaylist;
      const mockTrack: SpotifyTrack = { id: 'track1', uri: 'spotify:track:track1' } as SpotifyTrack;

      mockSpotifyRepository.getUserProfile.mockResolvedValue(mockUserProfile);
      mockSpotifyRepository.createPlaylist.mockResolvedValue(mockPlaylist);
      mockSpotifyRepository.addTracksToPlaylist.mockResolvedValue();
      jest.spyOn(spotifyService, 'searchTrackForSong').mockResolvedValue(mockTrack);

      await spotifyService.createPlaylistFromSongs(
        manySongs,
        mockArtistName,
        mockConcertDate,
        mockVenue,
        mockAccessToken
      );

      expect(spotifyService.searchTrackForSong).toHaveBeenCalledTimes(12);
      
      // Verify that all tracks were processed
      expect(mockSpotifyRepository.addTracksToPlaylist).toHaveBeenCalledWith(
        'playlist123',
        Array(12).fill('spotify:track:track1'),
        mockAccessToken
      );
    });
  });
});