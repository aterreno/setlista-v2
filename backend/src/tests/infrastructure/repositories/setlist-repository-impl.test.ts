import axios from 'axios';
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

      const result = await repository.searchSetlists('Test Artist');

      // Should have called search artists endpoint first
      expect(mockedAxios.get).toHaveBeenNthCalledWith(
        1,
        `${MOCK_BASE_URL}/search/artists`,
        expect.objectContaining({
          params: expect.objectContaining({
            artistName: 'Test Artist'
          })
        })
      );

      expect(mockedAxios.get).toHaveBeenNthCalledWith(
        2,
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
    });

    it('should fall back to direct search when artist is not found', async () => {
      mockedAxios.get.mockResolvedValueOnce({
        data: {}
      });

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

      // Should have called search artists endpoint first
      expect(mockedAxios.get).toHaveBeenNthCalledWith(
        1,
        `${MOCK_BASE_URL}/search/artists`,
        expect.anything()
      );

      expect(mockedAxios.get).toHaveBeenNthCalledWith(
        2,
        `${MOCK_BASE_URL}/search/setlists`,
        expect.objectContaining({
          params: expect.objectContaining({
            artistName: 'Test Artist',
            p: 1
          })
        })
      );

      expect(result.items).toHaveLength(1);
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
    });

    it('should handle error in setlist search and return empty result', async () => {
      // Mock artist search
      mockedAxios.get.mockResolvedValueOnce({
        data: {
          artist: [{
            mbid: 'artist123',
            name: 'Test Artist'
          }]
        }
      });

      mockedAxios.get.mockRejectedValueOnce(new Error('API error'));

      const result = await repository.searchSetlists('Test Artist');
      
      expect(result).toEqual({
        type: 'setlists',
        itemsPerPage: 20,
        page: 1,
        total: 0,
        items: []
      });
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
