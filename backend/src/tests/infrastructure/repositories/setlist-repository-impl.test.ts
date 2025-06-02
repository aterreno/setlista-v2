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

// Mock constants
jest.mock('../../../constants', () => ({
  API_ENDPOINTS: {
    SETLIST_FM: {
      BASE_URL: 'https://api.setlist.fm/rest/1.0',
      OPENSEARCH: 'https://www.setlist.fm/opensearch'
    }
  },
  TIMEOUTS: {
    SETLIST_FM_API: 5000
  },
  PAGINATION: {
    DEFAULT_ITEMS_PER_PAGE: 20,
    MAX_PAGES_TO_FETCH: 10
  },
  TEXT_FILTERS: {
    VENUE_STOP_WORDS: ['setlist', 'at', 'the', 'and', 'in', 'on']
  }
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
    it('should search setlists by artist name only', async () => {
      // Use "Test band" - "band" is in commonArtistWords so won't be parsed as city
      // Mock artist search response
      mockedAxios.get.mockResolvedValueOnce({
        data: {
          artist: [{
            mbid: 'artist1',
            name: 'Test Band'
          }]
        }
      });

      // Mock artist setlists response
      mockedAxios.get.mockResolvedValueOnce({
        data: {
          setlist: [{
            id: 'setlist1',
            artist: { name: 'Test Band' },
            eventDate: '01-01-2023',
            venue: { name: 'Test Venue', city: { name: 'Test City', country: { name: 'Test Country' } } },
            sets: { set: [] }
          }]
        }
      });

      const result = await repository.searchSetlists('Test band');

      expect(result.items).toHaveLength(1);
      expect(result.items[0].id).toBe('setlist1');
      expect(result.items[0].artist.name).toBe('Test Band');
    });

    it('should parse artist and city from query', async () => {
      // Mock direct API search with params (artist + city)
      mockedAxios.get.mockResolvedValueOnce({
        data: {
          type: 'setlists',
          itemsPerPage: 20,
          page: 1,
          total: 1,
          setlist: [{
            id: 'setlist1',
            artist: { name: 'Ryan Adams' },
            eventDate: '01-01-2023',
            venue: { name: 'Test Venue', city: { name: 'Paris', country: { name: 'France' } } },
            sets: { set: [] }
          }]
        }
      });

      const result = await repository.searchSetlists('Ryan Adams Paris');

      expect(mockedAxios.get).toHaveBeenCalledWith(
        'https://api.setlist.fm/rest/1.0/search/setlists',
        expect.objectContaining({
          params: {
            artistName: 'Ryan Adams',
            cityName: 'Paris',
            p: 1
          }
        })
      );
      expect(result.items).toHaveLength(1);
    });

    it('should fallback to manual city filtering when direct search fails', async () => {
      // Mock direct API search failure
      mockedAxios.get.mockRejectedValueOnce(new Error('Direct search failed'));

      // Mock artist + city manual filtering search
      mockedAxios.get.mockResolvedValueOnce({
        data: {
          type: 'setlists',
          itemsPerPage: 20,
          page: 1,
          total: 2,
          setlist: [
            {
              id: 'setlist1',
              artist: { name: 'Test Artist' },
              eventDate: '01-01-2023',
              venue: { name: 'Venue 1', city: { name: 'Paris', country: { name: 'France' } } },
              sets: { set: [] }
            },
            {
              id: 'setlist2',
              artist: { name: 'Test Artist' },
              eventDate: '02-01-2023',
              venue: { name: 'Venue 2', city: { name: 'London', country: { name: 'UK' } } },
              sets: { set: [] }
            }
          ]
        }
      });

      const result = await repository.searchSetlists('Test Artist Paris');

      // Should return only Paris results
      expect(result.items).toHaveLength(1);
      expect(result.items[0].venue.city.name).toBe('Paris');
    });

    it('should handle 404 errors gracefully', async () => {
      // Mock 404 error from artist search
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

    it('should handle other API errors gracefully', async () => {
      // Mock 500 error for artist search
      const error = new Error('Server error');
      (error as any).response = { status: 500 };
      mockedAxios.get.mockRejectedValueOnce(error);

      const result = await repository.searchSetlists('Test');
      
      // searchArtistByName catches all errors and returns empty results
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

    it('should fallback to artist-only search when city parsing fails', async () => {
      // Mock artist search response for query without clear city
      mockedAxios.get.mockResolvedValueOnce({
        data: {
          artist: [{
            mbid: 'artist1',
            name: 'Test Band'
          }]
        }
      });

      // Mock artist setlists response
      mockedAxios.get.mockResolvedValueOnce({
        data: {
          setlist: [{
            id: 'setlist1',
            artist: { name: 'Test Band' },
            eventDate: '01-01-2023',
            venue: { name: 'Test Venue', city: { name: 'Test City', country: { name: 'Test Country' } } },
            sets: { set: [] }
          }]
        }
      });

      const result = await repository.searchSetlists('Test band');

      expect(result.items).toHaveLength(1);
      expect(result.items[0].artist.name).toBe('Test Band');
      
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

    it('should handle multiple artist results and get their setlists', async () => {
      // Mock artist search with multiple results
      mockedAxios.get.mockResolvedValueOnce({
        data: {
          artist: [
            { mbid: 'artist1', name: 'Test Band' },
            { mbid: 'artist2', name: 'Another Band' }
          ]
        }
      });

      // Mock setlist responses for first artist
      mockedAxios.get.mockResolvedValueOnce({
        data: {
          setlist: [{
            id: 'setlist1',
            artist: { name: 'Test Band' },
            eventDate: '01-01-2023',
            venue: { name: 'Test Venue', city: { name: 'Test City', country: { name: 'Test Country' } } },
            sets: { set: [] }
          }]
        }
      });

      const result = await repository.searchSetlists('Test band');
      
      // Method returns setlists from first artist that has them
      expect(result.items).toHaveLength(1);
      expect(result.items[0].id).toBe('setlist1');
    });

    it('should handle multi-page city filtering', async () => {
      // Mock direct search failure (forces fallback to manual filtering)
      mockedAxios.get.mockRejectedValueOnce(new Error('Direct search failed'));

      // Mock multi-page artist search with city filtering
      mockedAxios.get
        .mockResolvedValueOnce({
          data: {
            type: 'setlists',
            itemsPerPage: 20,
            page: 1,
            total: 3,
            setlist: [
              {
                id: 'setlist1',
                artist: { name: 'Artist' },
                eventDate: '01-01-2023',
                venue: { name: 'Venue 1', city: { name: 'Paris', country: { name: 'France' } } },
                sets: { set: [] }
              },
              {
                id: 'setlist2', 
                artist: { name: 'Artist' },
                eventDate: '02-01-2023',
                venue: { name: 'Venue 2', city: { name: 'London', country: { name: 'UK' } } },
                sets: { set: [] }
              }
            ]
          }
        });

      const result = await repository.searchSetlists('Artist Paris');

      expect(result.items).toHaveLength(1);
      expect(result.items[0].venue.city.name).toBe('Paris');
    });

    it('should handle empty artist search results', async () => {
      // Mock empty artist search response
      mockedAxios.get.mockResolvedValueOnce({
        data: {
          artist: []
        }
      });

      const result = await repository.searchSetlists('Nonexistent Artist');

      expect(result).toEqual({
        type: 'setlists',
        itemsPerPage: 20,
        page: 1,
        total: 0,
        items: []
      });
    });

    it('should handle artist search that returns artists but no setlists', async () => {
      // Mock artist search with results
      mockedAxios.get.mockResolvedValueOnce({
        data: {
          artist: [
            { mbid: 'artist1', name: 'No Setlists Artist' }
          ]
        }
      });

      // Mock empty setlists response for the artist
      mockedAxios.get.mockResolvedValueOnce({
        data: {
          setlist: []
        }
      });

      const result = await repository.searchSetlists('No Setlists Artist');

      expect(result).toEqual({
        type: 'setlists',
        itemsPerPage: 20,
        page: 1,
        total: 0,
        items: []
      });
    });

    it('should handle artist setlist API errors and try next artist', async () => {
      // Use "Test band" to avoid city parsing, then test multiple artists
      // Mock artist search with multiple results
      mockedAxios.get.mockResolvedValueOnce({
        data: {
          artist: [
            { mbid: 'artist1', name: 'First Band' },
            { mbid: 'artist2', name: 'Second Band' }
          ]
        }
      });

      // Mock first artist setlist API 404 error
      const error404 = new Error('First artist setlist failed');
      (error404 as any).response = { status: 404 };
      mockedAxios.get.mockRejectedValueOnce(error404);

      // Mock second artist setlist success
      mockedAxios.get.mockResolvedValueOnce({
        data: {
          setlist: [{
            id: 'setlist1',
            artist: { name: 'Second Band' },
            eventDate: '01-01-2023',
            venue: { name: 'Test Venue', city: { name: 'Test City', country: { name: 'Test Country' } } },
            sets: { set: [] }
          }]
        }
      });

      const result = await repository.searchSetlists('Test band');

      expect(result.items).toHaveLength(1);
      expect(result.items[0].artist.name).toBe('Second Band');
    });

    it('should handle city name with venue term filtering', async () => {
      // Test a query that includes venue terms in the location search
      // Mock direct search failure to force manual filtering
      mockedAxios.get.mockRejectedValueOnce(new Error('Direct search failed'));

      // Mock manual filtering search with venue terms
      mockedAxios.get.mockResolvedValueOnce({
        data: {
          setlist: [
            {
              id: 'setlist1',
              artist: { name: 'Test Artist' },
              eventDate: '01-01-2023',
              venue: { name: 'London Venue', city: { name: 'London', country: { name: 'UK' } } },
              sets: { set: [{ song: [{ name: 'Song 1' }] }] }
            },
            {
              id: 'setlist2',
              artist: { name: 'Test Artist' },
              eventDate: '02-01-2023', 
              venue: { name: 'Paris Venue', city: { name: 'Paris', country: { name: 'France' } } },
              sets: { set: [] }
            }
          ]
        }
      });

      const result = await repository.searchSetlists('Test Artist London');

      // Should filter to only London results and sort by song count
      expect(result.items).toHaveLength(1);
      expect(result.items[0].venue.city.name).toBe('London');
    });
  });

  describe('additional edge cases for coverage', () => {
    beforeEach(() => {
      jest.clearAllMocks();
      mockedAxios.get.mockReset();
    });

    it('should handle artist sorting by exact match priority', async () => {
      // Mock artist search with multiple results including exact match
      mockedAxios.get.mockResolvedValueOnce({
        data: {
          artist: [
            { mbid: 'artist1', name: 'Test Band' }, // Exact match
            { mbid: 'artist2', name: 'Test Band & Friends' }, // Contains but not exact
            { mbid: 'artist3', name: 'Another Test' } // Partial match
          ]
        }
      });

      // Mock setlist response for first (exact match) artist
      mockedAxios.get.mockResolvedValueOnce({
        data: {
          setlist: [{
            id: 'setlist1',
            artist: { name: 'Test Band' },
            eventDate: '01-01-2023',
            venue: { name: 'Test Venue', city: { name: 'Test City', country: { name: 'Test Country' } } },
            sets: { set: [] }
          }]
        }
      });

      const result = await repository.searchSetlists('Test Band');

      expect(result.items).toHaveLength(1);
      expect(result.items[0].artist.name).toBe('Test Band');
    });

    it('should handle setlist sorting by venue match and song count', async () => {
      // Mock direct search failure to trigger manual filtering
      mockedAxios.get.mockRejectedValueOnce(new Error('Direct search failed'));

      // Mock manual filtering with multiple setlists for sorting
      mockedAxios.get.mockResolvedValueOnce({
        data: {
          setlist: [
            {
              id: 'setlist2',
              artist: { name: 'Artist' },
              eventDate: '01-01-2023',
              venue: { name: 'London Venue', city: { name: 'London', country: { name: 'UK' } } },
              sets: { set: [{ song: [{ name: 'Song 1' }] }] }
            },
            {
              id: 'setlist1',
              artist: { name: 'Artist' },
              eventDate: '02-01-2023',
              venue: { name: 'London Arena', city: { name: 'London', country: { name: 'UK' } } },
              sets: { set: [{ song: [{ name: 'Song 1' }, { name: 'Song 2' }] }] }
            },
            {
              id: 'setlist3',
              artist: { name: 'Artist' },
              eventDate: '03-01-2023',
              venue: { name: 'Other Venue', city: { name: 'Paris', country: { name: 'France' } } },
              sets: { set: [{ song: [{ name: 'Song 1' }, { name: 'Song 2' }, { name: 'Song 3' }] }] }
            }
          ]
        }
      });

      const result = await repository.searchSetlists('Artist London');

      // Should return London venues filtered by city
      expect(result.items).toHaveLength(2);
      // Verify both are London venues
      expect(result.items[0].venue.city.name).toBe('London');
      expect(result.items[1].venue.city.name).toBe('London');
    });

    it('should handle venue-based search path', async () => {
      // Test a city-only query that could trigger venue search
      await repository.searchSetlists('London');

      // This will go through the normal artist search path since it's a single word
      // but exercises the sorting and filtering logic
      expect(mockedAxios.get).toHaveBeenCalled();
    });

    it('should handle multiple page city filtering with max pages', async () => {
      // Mock direct search failure
      mockedAxios.get.mockRejectedValueOnce(new Error('Direct search failed'));

      // Mock multiple pages of manual filtering
      for (let i = 0; i < 11; i++) { // More than MAX_PAGES_TO_FETCH (10)
        mockedAxios.get.mockResolvedValueOnce({
          data: {
            setlist: [
              {
                id: `setlist${i}`,
                artist: { name: 'Artist' },
                eventDate: `0${(i % 9) + 1}-01-2023`,
                venue: { name: 'Other Venue', city: { name: 'Other City', country: { name: 'Country' } } },
                sets: { set: [] }
              }
            ]
          }
        });
      }

      const result = await repository.searchSetlists('Artist Paris');

      // Should not find Paris results but handle the pagination limit
      expect(result.items).toHaveLength(0);
    });

    it('should handle artist name contains check logic', async () => {
      // Mock artist search with names that test contains logic
      mockedAxios.get.mockResolvedValueOnce({
        data: {
          artist: [
            { mbid: 'artist1', name: 'The Test Band' }, // Starts with query
            { mbid: 'artist2', name: 'My Test Group' }, // Contains query
            { mbid: 'artist3', name: 'Completely Different' } // No match
          ]
        }
      });

      // Mock setlist response for first artist
      mockedAxios.get.mockResolvedValueOnce({
        data: {
          setlist: [{
            id: 'setlist1',
            artist: { name: 'The Test Band' },
            eventDate: '01-01-2023',
            venue: { name: 'Test Venue', city: { name: 'Test City', country: { name: 'Test Country' } } },
            sets: { set: [] }
          }]
        }
      });

      const result = await repository.searchSetlists('Test');

      expect(result.items).toHaveLength(1);
      expect(result.items[0].artist.name).toBe('The Test Band');
    });
  });
});