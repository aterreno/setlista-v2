import axios from 'axios';
import { SetlistRepositoryImpl } from '../../../infrastructure/repositories/setlist-repository-impl';

// Mock axios
jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

// Mock config
jest.mock('../../../config', () => ({
  config: {
    setlistFm: {
      baseUrl: 'https://api.setlist.fm/rest/1.0',
      apiKey: 'test-api-key'
    }
  }
}));

// Mock logger
jest.mock('../../../utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn()
}));

describe('SetlistRepositoryImpl', () => {
  let repository: SetlistRepositoryImpl;

  beforeEach(() => {
    repository = new SetlistRepositoryImpl();
    jest.clearAllMocks();
  });

  describe('searchArtists', () => {
    it('should search for artists successfully', async () => {
      const mockResponse = {
        data: {
          type: 'artists',
          itemsPerPage: 20,
          page: 1,
          total: 1,
          artist: [{
            mbid: 'artist1',
            name: 'Test Artist',
            sortName: 'Test Artist'
          }]
        }
      };

      mockedAxios.get.mockResolvedValueOnce(mockResponse);

      const result = await repository.searchArtists('Test Artist');

      expect(mockedAxios.get).toHaveBeenCalledWith(
        'https://api.setlist.fm/rest/1.0/search/artists',
        {
          headers: {
            'x-api-key': 'test-api-key',
            'Accept': 'application/json'
          },
          params: {
            artistName: 'Test Artist',
            p: 1
          }
        }
      );

      expect(result).toEqual({
        type: 'artists',
        itemsPerPage: 20,
        page: 1,
        total: 1,
        items: [{
          mbid: 'artist1',
          name: 'Test Artist',
          sortName: 'Test Artist'
        }]
      });
    });

    it('should handle search artists with custom page', async () => {
      const mockResponse = {
        data: {
          type: 'artists',
          itemsPerPage: 20,
          page: 2,
          total: 50,
          artist: []
        }
      };

      mockedAxios.get.mockResolvedValueOnce(mockResponse);

      await repository.searchArtists('Test Artist', 2);

      expect(mockedAxios.get).toHaveBeenCalledWith(
        'https://api.setlist.fm/rest/1.0/search/artists',
        expect.objectContaining({
          params: {
            artistName: 'Test Artist',
            p: 2
          }
        })
      );
    });

    it('should handle empty artist results', async () => {
      const mockResponse = {
        data: {
          type: 'artists',
          itemsPerPage: 20,
          page: 1,
          total: 0,
          // No artist property when empty
        }
      };

      mockedAxios.get.mockResolvedValueOnce(mockResponse);

      const result = await repository.searchArtists('Nonexistent Artist');

      expect(result.items).toEqual([]);
    });

    it('should handle search artists error', async () => {
      mockedAxios.get.mockRejectedValueOnce(new Error('API Error'));

      await expect(repository.searchArtists('Test Artist'))
        .rejects.toThrow('Failed to search for artists');
    });
  });

  describe('getArtistSetlists', () => {
    it('should get artist setlists successfully', async () => {
      const mockResponse = {
        data: {
          type: 'setlists',
          itemsPerPage: 20,
          page: 1,
          total: 5,
          setlist: [{
            id: 'setlist1',
            versionId: 'version1',
            eventDate: '01-01-2023',
            artist: { name: 'Test Artist' },
            venue: { name: 'Test Venue' },
            sets: { set: [] }
          }]
        }
      };

      mockedAxios.get.mockResolvedValueOnce(mockResponse);

      const result = await repository.getArtistSetlists('artist123');

      expect(mockedAxios.get).toHaveBeenCalledWith(
        'https://api.setlist.fm/rest/1.0/artist/artist123/setlists',
        {
          headers: {
            'x-api-key': 'test-api-key',
            'Accept': 'application/json'
          },
          params: {
            p: 1
          }
        }
      );

      expect(result.items).toHaveLength(1);
      expect(result.items[0].id).toBe('setlist1');
    });

    it('should handle get artist setlists with custom page', async () => {
      const mockResponse = {
        data: {
          type: 'setlists',
          itemsPerPage: 20,
          page: 3,
          total: 100,
          setlist: []
        }
      };

      mockedAxios.get.mockResolvedValueOnce(mockResponse);

      await repository.getArtistSetlists('artist123', 3);

      expect(mockedAxios.get).toHaveBeenCalledWith(
        'https://api.setlist.fm/rest/1.0/artist/artist123/setlists',
        expect.objectContaining({
          params: {
            p: 3
          }
        })
      );
    });

    it('should handle empty setlist results', async () => {
      const mockResponse = {
        data: {
          type: 'setlists',
          itemsPerPage: 20,
          page: 1,
          total: 0,
          // No setlist property when empty
        }
      };

      mockedAxios.get.mockResolvedValueOnce(mockResponse);

      const result = await repository.getArtistSetlists('artist123');

      expect(result.items).toEqual([]);
    });

    it('should handle get artist setlists error', async () => {
      mockedAxios.get.mockRejectedValueOnce(new Error('API Error'));

      await expect(repository.getArtistSetlists('artist123'))
        .rejects.toThrow('Failed to get artist setlists');
    });
  });

  describe('searchSetlists', () => {
    it('should search setlists with suggestions', async () => {
      // Mock opensearch response
      mockedAxios.get.mockResolvedValueOnce({
        data: ['test', ['Test Artist', 'Another Test']]
      });

      // Mock artist search response
      mockedAxios.get.mockResolvedValueOnce({
        data: {
          artist: [{
            mbid: 'artist1',
            name: 'Test Artist'
          }]
        }
      });

      // Mock setlist response
      mockedAxios.get.mockResolvedValueOnce({
        data: {
          type: 'setlists',
          itemsPerPage: 20,
          page: 1,
          total: 1,
          setlist: [{
            id: 'setlist1',
            artist: { name: 'Test Artist' }
          }]
        }
      });

      const result = await repository.searchSetlists('Test Artist');

      expect(result.items).toHaveLength(1);
      expect(result.items[0].id).toBe('setlist1');
    });

    it('should handle location-based search', async () => {
      // Mock opensearch response
      mockedAxios.get.mockResolvedValueOnce({
        data: ['london', ['London', 'London UK']]
      });

      // Mock venue search response
      mockedAxios.get.mockResolvedValueOnce({
        data: {
          venue: [{
            id: 'venue1',
            name: 'Test Venue',
            city: { name: 'London' }
          }]
        }
      });

      // Mock setlist response for venue
      mockedAxios.get.mockResolvedValueOnce({
        data: {
          type: 'setlists',
          itemsPerPage: 20,
          page: 1,
          total: 1,
          setlist: [{
            id: 'setlist1',
            venue: { name: 'Test Venue' }
          }]
        }
      });

      const result = await repository.searchSetlists('London');

      expect(result.items).toHaveLength(1);
    });

    it('should fallback to artist search when suggestions fail', async () => {
      // Mock opensearch response
      mockedAxios.get.mockResolvedValueOnce({
        data: ['test', []]
      });

      // Mock artist search fallback
      mockedAxios.get.mockResolvedValueOnce({
        data: {
          artist: [{
            mbid: 'artist1',
            name: 'Test Artist'
          }]
        }
      });

      // Mock setlist response
      mockedAxios.get.mockResolvedValueOnce({
        data: {
          type: 'setlists',
          itemsPerPage: 20,
          page: 1,
          total: 1,
          setlist: [{
            id: 'setlist1',
            artist: { name: 'Test Artist' }
          }]
        }
      });

      const result = await repository.searchSetlists('Test Artist');

      expect(result.items).toHaveLength(1);
    });

    it('should handle 404 errors gracefully', async () => {
      // Mock opensearch response
      mockedAxios.get.mockResolvedValueOnce({
        data: ['test', []]
      });

      // Mock 404 error
      const error = new Error('Not found');
      (error as any).response = { status: 404 };
      mockedAxios.get.mockRejectedValueOnce(error);

      const result = await repository.searchSetlists('Nonexistent');

      expect(result).toEqual({
        type: 'setlists',
        itemsPerPage: 20,
        page: 1,
        total: 0,
        items: []
      });
    });

    it('should handle other API errors', async () => {
      // Mock 500 error for all axios calls
      const error = new Error('Server error');
      (error as any).response = { status: 500 };
      mockedAxios.get.mockRejectedValue(error);

      // searchSetlists is designed to never throw, it returns empty results on error
      const result = await repository.searchSetlists('Test');
      expect(result).toEqual({
        type: 'setlists',
        itemsPerPage: 20,
        page: 1,
        total: 0,
        items: []
      });
      
      // Reset mock for subsequent tests
      mockedAxios.get.mockReset();
    });

    it('should handle opensearch API failure', async () => {
      // Mock opensearch failure for all calls
      const error = new Error('Opensearch failed');
      (error as any).response = { status: 500 };
      mockedAxios.get.mockRejectedValue(error);

      // searchSetlists handles all failures gracefully and returns empty results
      const result = await repository.searchSetlists('Test');
      expect(result).toEqual({
        type: 'setlists',
        itemsPerPage: 20,
        page: 1,
        total: 0,
        items: []
      });
      
      // Reset mock for subsequent tests
      mockedAxios.get.mockReset();
    });
  });

  describe('getSetlistById', () => {
    it('should get setlist by ID successfully', async () => {
      const mockSetlist = {
        id: 'setlist123',
        versionId: 'version1',
        eventDate: '01-01-2023',
        artist: {
          mbid: 'artist1',
          name: 'Test Artist'
        },
        venue: {
          id: 'venue1',
          name: 'Test Venue',
          city: {
            name: 'Test City',
            country: { name: 'Test Country' }
          }
        },
        sets: {
          set: [{
            song: [{
              name: 'Test Song'
            }]
          }]
        }
      };

      mockedAxios.get.mockResolvedValueOnce({ data: mockSetlist });

      const result = await repository.getSetlistById('setlist123');

      expect(mockedAxios.get).toHaveBeenCalledWith(
        'https://api.setlist.fm/rest/1.0/setlist/setlist123',
        {
          headers: {
            'x-api-key': 'test-api-key',
            'Accept': 'application/json'
          }
        }
      );

      expect(result).toEqual(mockSetlist);
    });

    it('should handle get setlist by ID error', async () => {
      mockedAxios.get.mockRejectedValueOnce(new Error('Not found'));

      await expect(repository.getSetlistById('invalid-id'))
        .rejects.toThrow('Failed to get setlist');
    });
  });

  describe('private methods coverage', () => {
    beforeEach(() => {
      // Reset mocks for each test in this section
      jest.clearAllMocks();
      mockedAxios.get.mockReset();
    });

    it('should handle venue search with results', async () => {
      // Mock opensearch response for location
      mockedAxios.get.mockResolvedValueOnce({
        data: ['venue', ['Madison Square Garden']]
      });

      // Mock venue search response
      mockedAxios.get.mockResolvedValueOnce({
        data: {
          venue: [{
            id: 'venue1',
            name: 'Madison Square Garden',
            city: { name: 'New York' }
          }]
        }
      });

      // Mock setlist response for venue
      mockedAxios.get.mockResolvedValueOnce({
        data: {
          type: 'setlists',
          itemsPerPage: 20,
          page: 1,
          total: 5,
          setlist: [{
            id: 'setlist1',
            venue: { name: 'Madison Square Garden' }
          }]
        }
      });

      const result = await repository.searchSetlists('Madison Square Garden');

      expect(result.items).toHaveLength(1);
      expect(result.items[0].venue.name).toBe('Madison Square Garden');
    });

    it('should handle venue search failure and fallback', async () => {
      // Mock opensearch response for location
      mockedAxios.get.mockResolvedValueOnce({
        data: ['venue', ['Test Venue']]
      });

      // Mock venue search failure
      mockedAxios.get.mockRejectedValueOnce(new Error('Venue search failed'));

      // Mock fallback artist search
      mockedAxios.get.mockResolvedValueOnce({
        data: {
          artist: [{
            mbid: 'artist1',
            name: 'Test Artist'
          }]
        }
      });

      // Mock setlist response
      mockedAxios.get.mockResolvedValueOnce({
        data: {
          type: 'setlists',
          itemsPerPage: 20,
          page: 1,
          total: 1,
          setlist: [{
            id: 'setlist1',
            artist: { name: 'Test Artist' }
          }]
        }
      });

      const result = await repository.searchSetlists('Test Venue');

      expect(result.items).toHaveLength(1);
    });

    it('should handle multiple artist results and get their setlists', async () => {
      // Mock opensearch response
      mockedAxios.get.mockResolvedValueOnce({
        data: ['test', ['Test Artist']]
      });

      // Mock artist search with multiple results
      mockedAxios.get.mockResolvedValueOnce({
        data: {
          artist: [
            { mbid: 'artist1', name: 'Test Artist' },
            { mbid: 'artist2', name: 'Test Band' }
          ]
        }
      });

      // Mock setlist responses for each artist
      mockedAxios.get
        .mockResolvedValueOnce({
          data: {
            setlist: [{
              id: 'setlist1',
              artist: { name: 'Test Artist' }
            }]
          }
        })
        .mockResolvedValueOnce({
          data: {
            setlist: [{
              id: 'setlist2',
              artist: { name: 'Test Band' }
            }]
          }
        });

      const result = await repository.searchSetlists('Test Artist');

      // Method returns setlists from first artist that has them, not combined from all
      expect(result.items).toHaveLength(1);
      expect(result.items[0].id).toBe('setlist1');
    });

    it('should handle suggestion execution failure gracefully', async () => {
      // Mock opensearch response with multiple suggestions
      mockedAxios.get.mockResolvedValueOnce({
        data: ['test', ['Test Artist', 'Test Band']]
      });

      // Mock first suggestion failure
      mockedAxios.get.mockRejectedValueOnce(new Error('First suggestion failed'));

      // Mock second suggestion success
      mockedAxios.get.mockResolvedValueOnce({
        data: {
          artist: [{
            mbid: 'artist1',
            name: 'Test Band'
          }]
        }
      });

      // Mock setlist response
      mockedAxios.get.mockResolvedValueOnce({
        data: {
          setlist: [{
            id: 'setlist1',
            artist: { name: 'Test Band' }
          }]
        }
      });

      const result = await repository.searchSetlists('Test');

      expect(result.items).toHaveLength(1);
      expect(result.items[0].artist.name).toBe('Test Band');
    });
  });
});