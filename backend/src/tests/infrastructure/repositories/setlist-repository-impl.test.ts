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

  describe('searchSetlists', () => {
    it('should use opensearch for intelligent suggestions', async () => {
      // Mock opensearch response
      mockedAxios.get.mockResolvedValueOnce({
        data: ['wainwright', ['Martha Wainwright', 'Rufus Wainwright']]
      });

      // Mock artist search response
      mockedAxios.get.mockResolvedValueOnce({
        data: {
          artist: [{
            mbid: 'artist1',
            name: 'Martha Wainwright'
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
            eventDate: '31-12-2023',
            artist: { name: 'Martha Wainwright' },
            venue: {
              name: 'Test Venue',
              city: { name: 'London', country: { name: 'UK' } }
            }
          }]
        }
      });

      const result = await repository.searchSetlists('wainwright');

      expect(mockedAxios.get).toHaveBeenCalledWith('https://www.setlist.fm/opensearch', {
        params: { query: 'wainwright' },
        timeout: 5000
      });
      expect(result.items).toHaveLength(1);
      expect(result.items[0].artist.name).toBe('Martha Wainwright');
    });

    it('should detect location queries and search by venue', async () => {
      // Mock opensearch response
      mockedAxios.get.mockResolvedValueOnce({
        data: ['london', ['London venues']]
      });

      // Mock venue search response
      mockedAxios.get.mockResolvedValueOnce({
        data: {
          venue: [{
            id: 'venue1',
            name: 'Royal Albert Hall'
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
            eventDate: '31-12-2023',
            artist: { name: 'Test Artist' },
            venue: {
              name: 'Royal Albert Hall',
              city: { name: 'London', country: { name: 'UK' } }
            }
          }]
        }
      });

      const result = await repository.searchSetlists('london');

      expect(mockedAxios.get).toHaveBeenCalledWith(
        'https://api.setlist.fm/rest/1.0/search/venues',
        expect.objectContaining({
          params: { name: 'london', p: 1 }
        })
      );
      expect(result.items).toHaveLength(1);
    });

    it('should handle opensearch failures gracefully', async () => {
      // Mock opensearch failure
      mockedAxios.get.mockRejectedValueOnce(new Error('Network error'));

      // Mock artist search response as fallback
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
            eventDate: '31-12-2023',
            artist: { name: 'Test Artist' },
            venue: {
              name: 'Test Venue',
              city: { name: 'Test City', country: { name: 'Test Country' } }
            }
          }]
        }
      });

      const result = await repository.searchSetlists('test');

      expect(result.items).toHaveLength(1);
    });

    it('should filter suggestions by relevance', async () => {
      // Mock opensearch response with irrelevant suggestions
      mockedAxios.get.mockResolvedValueOnce({
        data: ['wain', ['Wayne Newton', 'Martha Wainwright', 'Wayne Coyne']]
      });

      // Mock artist search for relevant suggestion
      mockedAxios.get.mockResolvedValueOnce({
        data: {
          artist: [{
            mbid: 'artist1',
            name: 'Martha Wainwright'
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
            eventDate: '31-12-2023',
            artist: { name: 'Martha Wainwright' },
            venue: {
              name: 'Test Venue',
              city: { name: 'Test City', country: { name: 'Test Country' } }
            }
          }]
        }
      });

      await repository.searchSetlists('wainwright');

      // Should only try the relevant suggestion (Martha Wainwright contains "wainwright")
      expect(mockedAxios.get).toHaveBeenCalledWith(
        'https://api.setlist.fm/rest/1.0/search/artists',
        expect.objectContaining({
          params: { artistName: 'Martha Wainwright', p: 1 }
        })
      );
    });

    it('should return empty results for 404 errors', async () => {
      // Mock opensearch response
      mockedAxios.get.mockResolvedValueOnce({
        data: ['nonexistent', ['nonexistent artist suggestion']]
      });

      // Mock artist search response (trying the suggestion)
      mockedAxios.get.mockResolvedValueOnce({
        data: { artist: [] }
      });

      // Mock fallback artist search that throws 404
      mockedAxios.get.mockRejectedValueOnce({
        response: { status: 404 }
      });

      const result = await repository.searchSetlists('nonexistent');

      expect(result.items).toHaveLength(0);
      expect(result.total).toBe(0);
    });

    it('should sort setlists by date descending (newest first)', async () => {
      // Mock opensearch response
      mockedAxios.get.mockResolvedValueOnce({
        data: ['test', ['Test Artist']]
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

      // Mock setlist response with multiple setlists
      mockedAxios.get.mockResolvedValueOnce({
        data: {
          type: 'setlists',
          itemsPerPage: 20,
          page: 1,
          total: 3,
          setlist: [
            {
              id: 'setlist1',
              eventDate: '01-01-2023',
              artist: { name: 'Test Artist' },
              venue: { name: 'Venue 1', city: { name: 'City 1', country: { name: 'Country 1' } } }
            },
            {
              id: 'setlist2',
              eventDate: '15-06-2023',
              artist: { name: 'Test Artist' },
              venue: { name: 'Venue 2', city: { name: 'City 2', country: { name: 'Country 2' } } }
            },
            {
              id: 'setlist3',
              eventDate: '10-03-2023',
              artist: { name: 'Test Artist' },
              venue: { name: 'Venue 3', city: { name: 'City 3', country: { name: 'Country 3' } } }
            }
          ]
        }
      });

      const result = await repository.searchSetlists('test');

      expect(result.items).toHaveLength(3);
      // Should be sorted newest first: 15-06-2023, 10-03-2023, 01-01-2023
      expect(result.items[0].eventDate).toBe('15-06-2023');
      expect(result.items[1].eventDate).toBe('10-03-2023');
      expect(result.items[2].eventDate).toBe('01-01-2023');
    });
  });

  describe('searchByVenue', () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('should search venues and return setlists sorted by date', async () => {
      // Mock opensearch response (empty to trigger venue search)
      mockedAxios.get.mockResolvedValueOnce({
        data: ['Royal Albert Hall', []]
      });

      // Mock venue search response
      mockedAxios.get.mockResolvedValueOnce({
        data: {
          venue: [{
            id: 'venue1',
            name: 'Royal Albert Hall'
          }]
        }
      });

      // Mock setlist response
      mockedAxios.get.mockResolvedValueOnce({
        data: {
          type: 'setlists',
          itemsPerPage: 20,
          page: 1,
          total: 2,
          setlist: [
            {
              id: 'setlist1',
              eventDate: '01-01-2023',
              artist: { name: 'Artist 1' },
              venue: { name: 'Royal Albert Hall', city: { name: 'London', country: { name: 'UK' } } }
            },
            {
              id: 'setlist2',
              eventDate: '15-06-2023',
              artist: { name: 'Artist 2' },
              venue: { name: 'Royal Albert Hall', city: { name: 'London', country: { name: 'UK' } } }
            }
          ]
        }
      });

      const result = await repository.searchSetlists('Royal Albert Hall');

      expect(mockedAxios.get).toHaveBeenCalledWith(
        'https://api.setlist.fm/rest/1.0/search/venues',
        expect.objectContaining({
          params: { name: 'Royal Albert Hall', p: 1 }
        })
      );

      expect(result.items).toHaveLength(2);
      // Should be sorted newest first
      expect(result.items[0].eventDate).toBe('15-06-2023');
      expect(result.items[1].eventDate).toBe('01-01-2023');
    });
  });

  describe('isLocationQuery', () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('should detect city names', async () => {
      const query = 'london';
      
      // Mock opensearch to trigger location detection
      mockedAxios.get.mockResolvedValueOnce({ data: [query, []] });
      
      // Mock venue search
      mockedAxios.get.mockResolvedValueOnce({ data: { venue: [] } });
      
      // Mock fallback artist search (since venue search returns empty)
      mockedAxios.get.mockResolvedValueOnce({ data: { artist: [] } });
      
      await repository.searchSetlists(query);
      
      // Should call venue search for location queries
      expect(mockedAxios.get).toHaveBeenCalledWith(
        'https://api.setlist.fm/rest/1.0/search/venues',
        expect.objectContaining({
          params: { name: query, p: 1 }
        })
      );
    });

    it('should detect venue-related terms', async () => {
      const query = 'madison square garden';
      
      // Mock opensearch
      mockedAxios.get.mockResolvedValueOnce({ data: [query, []] });
      
      // Mock venue search
      mockedAxios.get.mockResolvedValueOnce({ data: { venue: [] } });
      
      // Mock fallback artist search (since venue search returns empty)
      mockedAxios.get.mockResolvedValueOnce({ data: { artist: [] } });
      
      await repository.searchSetlists(query);
      
      // Should call venue search for venue-related queries
      expect(mockedAxios.get).toHaveBeenCalledWith(
        'https://api.setlist.fm/rest/1.0/search/venues',
        expect.objectContaining({
          params: { name: query, p: 1 }
        })
      );
    });
  });

  describe('getSetlistById', () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('should return setlist for valid ID', async () => {
      const mockSetlist = {
        id: 'setlist1',
        eventDate: '31-12-2023',
        artist: { name: 'Test Artist' },
        venue: { name: 'Test Venue', city: { name: 'Test City', country: { name: 'Test Country' } } }
      };

      mockedAxios.get.mockResolvedValueOnce({ data: mockSetlist });

      const result = await repository.getSetlistById('setlist1');

      expect(mockedAxios.get).toHaveBeenCalledWith(
        'https://api.setlist.fm/rest/1.0/setlist/setlist1',
        expect.objectContaining({
          headers: expect.objectContaining({
            'x-api-key': 'test-api-key'
          })
        })
      );
      expect(result.id).toBe('setlist1');
    });

    it('should throw error for API failures', async () => {
      mockedAxios.get.mockRejectedValueOnce(new Error('API Error'));

      await expect(repository.getSetlistById('invalid')).rejects.toThrow('Failed to get setlist');
    });
  });
});