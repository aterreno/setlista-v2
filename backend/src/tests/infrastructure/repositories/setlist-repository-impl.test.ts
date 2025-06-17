import axios from 'axios';
import { SearchType } from '../../../domain/types';
import { SetlistRepositoryImpl } from '../../../infrastructure/repositories/setlist-repository-impl';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

jest.mock('../../../config', () => ({
  config: {
    setlistFm: {
      baseUrl: 'https://api.setlist.fm/rest/1.0',
      apiKey: 'test-api-key'
    }
  }
}));

jest.mock('../../../utils/logger', () => ({
  debug: jest.fn(),
  error: jest.fn()
}));

const MOCK_BASE_URL = 'https://api.setlist.fm/rest/1.0';

describe('SetlistRepositoryImpl', () => {
  let repository: SetlistRepositoryImpl;

  beforeEach(() => {
    repository = new SetlistRepositoryImpl();
    jest.clearAllMocks();
  });

  describe('getSetlistById', () => {
    it('should get setlist by ID successfully', async () => {
      const mockSetlist = {
        id: 'setlist123',
        artist: { name: 'Test Artist' },
        venue: { name: 'Test Venue' },
        eventDate: '01-01-2023',
        sets: { set: [] }
      };

      mockedAxios.get.mockResolvedValueOnce({ data: mockSetlist });

      const result = await repository.getSetlistById('setlist123');

      expect(mockedAxios.get).toHaveBeenCalledWith(
        `${MOCK_BASE_URL}/setlist/setlist123`,
        expect.objectContaining({
          headers: {
            'x-api-key': 'test-api-key',
            'Accept': 'application/json'
          }
        })
      );
      expect(result).toEqual(mockSetlist);
    });

    it('should propagate error when getting setlist by ID fails', async () => {
      const error = new Error('API error');
      mockedAxios.get.mockRejectedValueOnce(error);

      await expect(repository.getSetlistById('invalid-id')).rejects.toThrow();
    });
  });

  describe('searchSetlists', () => {
    it('should search setlists with artist MBID when artist is found', async () => {
      // Mock all potential search methods in parallel
      mockedAxios.get.mockImplementation((url, _config) => {
        if (url.includes('/search/artists')) {
          return Promise.resolve({
            data: {
              artist: [{
                mbid: 'artist123',
                name: 'Test Artist'
              }]
            }
          });
        } else if (url.includes('/search/setlists')) {
          return Promise.resolve({
            data: {
              type: 'setlists',
              itemsPerPage: 20,
              page: 1,
              total: 1,
              setlist: [{
                id: 'setlist1',
                artist: { name: 'Test Artist' },
                eventDate: '01-01-2023',
                venue: { name: 'Test Venue', city: { name: 'City' } },
                sets: { set: [] }
              }]
            }
          });
        }
        return Promise.reject(new Error('Unexpected URL'));
      });

      const result = await repository.searchSetlists('Test Artist');

      expect(mockedAxios.get).toHaveBeenCalledWith(
        `${MOCK_BASE_URL}/search/artists`,
        expect.objectContaining({
          params: expect.objectContaining({
            artistName: 'Test Artist'
          })
        })
      );

      expect(mockedAxios.get).toHaveBeenCalledWith(
        `${MOCK_BASE_URL}/search/setlists`,
        expect.objectContaining({
          params: expect.objectContaining({
            artistMbid: 'artist123',
            p: 1
          })
        })
      );

      expect(result.items).toHaveLength(1);
      expect(result.items[0].id).toBe('setlist1');
      expect(result.searchType).toBe(SearchType.ARTIST);
      expect(result.searchQuery).toBe('Test Artist');
    });

    it('should fall back to direct search when artist is not found', async () => {
      // For parallel search, we need to mock all potential API calls
      mockedAxios.get.mockImplementation((url, options) => {
        // 1. Artist search - no results
        if (url.includes('/search/artists')) {
          return Promise.resolve({ data: {} });
        } 
        // 2. Artist name search - has results
        else if (url.includes('/search/setlists') && options?.params?.artistName === 'Test Artist') {
          return Promise.resolve({
            data: {
              type: 'setlists',
              itemsPerPage: 20,
              page: 1,
              total: 1,
              setlist: [{
                id: 'setlist1',
                artist: { name: 'Test Artist' },
                eventDate: '01-01-2023',
                venue: { name: 'Test Venue', city: { name: 'City' } },
                sets: { set: [] }
              }]
            }
          });
        }
        // 3. All other searches (venue, city, festival) - no results
        else {
          return Promise.resolve({
            data: {
              total: 0,
              setlist: []
            }
          });
        }
      });

      const result = await repository.searchSetlists('Test Artist');

      // With parallel implementation, verify the correct endpoint was called
      expect(mockedAxios.get).toHaveBeenCalledWith(
        `${MOCK_BASE_URL}/search/artists`,
        expect.objectContaining({
          params: expect.objectContaining({
            artistName: 'Test Artist'
          })
        })
      );

      // Since it's parallel, the exact order of calls isn't predictable,
      // so we just verify that this call was made at some point
      expect(mockedAxios.get).toHaveBeenCalledWith(
        `${MOCK_BASE_URL}/search/setlists`,
        expect.objectContaining({
          params: expect.objectContaining({
            artistName: 'Test Artist',
            p: 1
          })
        })
      );

      expect(result.items).toHaveLength(1);
      expect(result.searchType).toBe(SearchType.ARTIST);
      expect(result.searchQuery).toBe('Test Artist');
    });

    it('should handle search with custom page', async () => {
      // Mock artist search
      mockedAxios.get.mockResolvedValueOnce({
        data: {
          artist: [{
            mbid: 'artist123',
            name: 'Test Artist'
          }]
        }
      });

      mockedAxios.get.mockResolvedValueOnce({
        data: {
          type: 'setlists',
          itemsPerPage: 20,
          page: 3,
          total: 50,
          setlist: []
        }
      });

      await repository.searchSetlists('Test Artist', 3);

      expect(mockedAxios.get).toHaveBeenNthCalledWith(
        2,
        `${MOCK_BASE_URL}/search/setlists`,
        expect.objectContaining({
          params: expect.objectContaining({
            p: 3
          })
        })
      );
    });

    it('should handle error in artist search without failing', async () => {
      mockedAxios.get.mockRejectedValueOnce(new Error('API error'));

      // Mock direct setlist search
      mockedAxios.get.mockResolvedValueOnce({
        data: {
          type: 'setlists',
          itemsPerPage: 20,
          page: 1,
          total: 1,
          setlist: [{
            id: 'setlist1',
            artist: { name: 'Test Artist' },
            eventDate: '01-01-2023',
            venue: { name: 'Test Venue' },
            sets: { set: [] }
          }]
        }
      });

      const result = await repository.searchSetlists('Test Artist');
      
      expect(result.items).toHaveLength(1);
      expect(result.searchType).toBe(SearchType.ARTIST);
      expect(result.searchQuery).toBe('Test Artist');
    });

    it('should handle error in setlist search and return empty result', async () => {
      // For the new parallel implementation, we need to mock all the requests
      // First, mock the artist search success but setlist search failure
      mockedAxios.get.mockImplementation((url, _config) => {
        if (url.includes('/search/artists')) {
          return Promise.resolve({
            data: {
              artist: [{
                mbid: 'artist123',
                name: 'Test Artist'
              }]
            }
          });
        } else if (url.includes('/search/setlists') && _config?.params?.artistMbid) {
          return Promise.reject(new Error('API error'));
        } else {
          // For all other requests (venue, city, festival), return empty results
          return Promise.resolve({
            data: {
              total: 0,
              setlist: []
            }
          });
        }
      });
      
      const result = await repository.searchSetlists('Test Artist');
      
      // Now we expect an empty result with the appropriate search type
      expect(result).toEqual({
        type: 'setlists',
        itemsPerPage: 20,
        page: 1,
        total: 0,
        items: [],
        searchType: SearchType.ARTIST,
        searchQuery: 'Test Artist'
      });
    });
    
    it('should find venue location results when no artist match but venue exists', async () => {
      // No artist match
      mockedAxios.get.mockResolvedValueOnce({
        data: {}
      });
      
      // Venue search results
      mockedAxios.get.mockResolvedValueOnce({
        data: {
          type: 'setlists',
          itemsPerPage: 20,
          page: 1,
          total: 2,
          setlist: [
            {
              id: 'venue-setlist1',
              artist: { name: 'Some Artist' },
              eventDate: '01-01-2023',
              venue: { name: 'Worthing Arena', city: { name: 'Worthing' } },
              sets: { set: [] }
            },
            {
              id: 'venue-setlist2',
              artist: { name: 'Another Artist' },
              eventDate: '02-01-2023',
              venue: { name: 'Worthing Arena', city: { name: 'Worthing' } },
              sets: { set: [] }
            }
          ]
        }
      });
      
      // Festival search (not needed as venue was found)
      mockedAxios.get.mockResolvedValueOnce({
        data: {
          total: 0,
          setlist: []
        }
      });

      const result = await repository.searchSetlists('Worthing');
      
      expect(mockedAxios.get).toHaveBeenCalledWith(
        `${MOCK_BASE_URL}/search/setlists`,
        expect.objectContaining({
          params: expect.objectContaining({
            venueName: 'Worthing'
          })
        })
      );
      
      expect(result.items).toHaveLength(2);
      expect(result.searchType).toBe(SearchType.VENUE);
      expect(result.searchQuery).toBe('Worthing');
    });
    
    it('should find city location results when venue search returns no results', async () => {
      // For parallel search, mock all potential API calls
      mockedAxios.get.mockImplementation((url, options) => {
        // Artist search - no results
        if (url.includes('/search/artists')) {
          return Promise.resolve({
            data: {
              total: 0,
              artist: []
            }
          });
        } 
        // Venue search - no results
        else if (url.includes('/search/setlists') && options?.params?.venueName === 'Worthing') {
          return Promise.resolve({
            data: {
              total: 0,
              setlist: []
            }
          });
        }
        // City search - has results
        else if (url.includes('/search/setlists') && options?.params?.cityName === 'Worthing') {
          return Promise.resolve({
            data: {
              type: 'setlists',
              itemsPerPage: 20,
              page: 1,
              total: 3,
              setlist: [
                { 
                  id: 'city-setlist1',
                  venue: { city: { name: 'Worthing' } }
                }
              ]
            }
          });
        }
        // All other searches (artist name, festival) - no results
        else {
          return Promise.resolve({
            data: {
              total: 0,
              setlist: []
            }
          });
        }
      });

      const result = await repository.searchSetlists('Worthing');
      
      // Verify the city search was called
      expect(mockedAxios.get).toHaveBeenCalledWith(
        `${MOCK_BASE_URL}/search/setlists`,
        expect.objectContaining({
          params: expect.objectContaining({
            cityName: 'Worthing'
          })
        })
      );
      
      expect(result.total).toBe(3);
      expect(result.searchType).toBe(SearchType.CITY);
      expect(result.searchQuery).toBe('Worthing');
    });
    
    it('should find festival results when no artist or location match', async () => {
      // For parallel search, mock all API calls
      mockedAxios.get.mockImplementation((url, options) => {
        // Artist search - no results
        if (url.includes('/search/artists')) {
          return Promise.resolve({
            data: {
              total: 0,
              artist: []
            }
          });
        } 
        // Venue search - no results
        else if (url.includes('/search/setlists') && options?.params?.venueName) {
          return Promise.resolve({
            data: {
              total: 0,
              setlist: []
            }
          });
        }
        // City search - no results
        else if (url.includes('/search/setlists') && options?.params?.cityName) {
          return Promise.resolve({
            data: {
              total: 0,
              setlist: []
            }
          });
        }
        // Festival/tour search - has results
        else if (url.includes('/search/setlists') && options?.params?.tourName === 'All Points East') {
          return Promise.resolve({
            data: {
              type: 'setlists',
              itemsPerPage: 20,
              page: 1,
              total: 5,
              setlist: [
                { 
                  id: 'festival-setlist1',
                  tour: { name: 'All Points East' }
                }
              ]
            }
          });
        }
        // All other searches - no results
        else {
          return Promise.resolve({
            data: {
              total: 0,
              setlist: []
            }
          });
        }
      });

      const result = await repository.searchSetlists('All Points East');
      
      // Verify the festival search was called
      expect(mockedAxios.get).toHaveBeenCalledWith(
        `${MOCK_BASE_URL}/search/setlists`,
        expect.objectContaining({
          params: expect.objectContaining({
            tourName: 'All Points East'
          })
        })
      );
      
      expect(result.total).toBe(5);
      expect(result.items[0].id).toBe('festival-setlist1');
      expect(result.items[0].tour?.name).toBe('All Points East');
      expect(result.searchType).toBe(SearchType.FESTIVAL);
      expect(result.searchQuery).toBe('All Points East');
    });
    
    it('should handle errors in all search types gracefully', async () => {
      // For the parallel implementation, all API calls will fail
      mockedAxios.get.mockRejectedValue(new Error('API error'));
      
      const result = await repository.searchSetlists('Something');
      
      // All searches fail, but we should get a properly formatted empty result
      // with the ARTIST search type as default
      expect(result).toEqual({
        type: 'setlists',
        itemsPerPage: 20,
        page: 1,
        total: 0,
        items: [],
        searchType: SearchType.ARTIST,
        searchQuery: 'Something'
      });
      
      // Verify we attempted to call the artist search endpoint
      expect(mockedAxios.get).toHaveBeenCalledWith(
        `${MOCK_BASE_URL}/search/artists`,
        expect.objectContaining({
          params: expect.objectContaining({
            artistName: 'Something'
          })
        })
      );
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
        `${MOCK_BASE_URL}/artist/artist123/setlists`,
        expect.objectContaining({
          params: {
            p: 1
          }
        })
      );

      expect(result.items.length).toBeGreaterThan(0);
      expect(result.items[0].id).toBe('setlist1');
    });

    it('should handle error and return empty result', async () => {
      mockedAxios.get.mockRejectedValueOnce(new Error('API Error'));

      const result = await repository.getArtistSetlists('artist123');
      
      expect(result).toHaveProperty('type');
      expect(result).toHaveProperty('itemsPerPage');
      expect(result).toHaveProperty('page');
      expect(result).toHaveProperty('total');
      expect(result).toHaveProperty('items');
    });
  });
});
