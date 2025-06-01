import { Request, Response } from 'express';
import { SetlistController } from '../../controllers/setlist-controller';
import { SetlistService } from '../../domain/services/setlist-service';
import { HttpError } from '../../domain/types';

jest.mock('../../utils/logger');

describe('SetlistController', () => {
  let setlistController: SetlistController;
  let mockSetlistService: jest.Mocked<SetlistService>;
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;

  beforeEach(() => {
    mockSetlistService = {
      searchSetlists: jest.fn(),
      getArtistSetlists: jest.fn(),
      getSetlistById: jest.fn(),
      extractSongsFromSetlist: jest.fn(),
    } as unknown as jest.Mocked<SetlistService>;

    setlistController = new SetlistController(mockSetlistService);

    mockRequest = {};
    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('searchSetlists', () => {
    beforeEach(() => {
      mockRequest.query = {};
    });

    it('should search setlists successfully', async () => {
      const mockResult = { type: 'setlist', items: [], total: 0, page: 1, itemsPerPage: 20 };
      mockRequest.query = { q: 'radiohead', page: '1' };
      mockSetlistService.searchSetlists.mockResolvedValue(mockResult);

      await setlistController.searchSetlists(mockRequest as Request, mockResponse as Response);

      expect(mockSetlistService.searchSetlists).toHaveBeenCalledWith('radiohead', 1);
      expect(mockResponse.json).toHaveBeenCalledWith(mockResult);
    });

    it('should default to page 1 when page is not provided', async () => {
      const mockResult = { type: 'setlist', items: [], total: 0, page: 1, itemsPerPage: 20 };
      mockRequest.query = { q: 'radiohead' };
      mockSetlistService.searchSetlists.mockResolvedValue(mockResult);

      await setlistController.searchSetlists(mockRequest as Request, mockResponse as Response);

      expect(mockSetlistService.searchSetlists).toHaveBeenCalledWith('radiohead', 1);
    });

    it('should return 400 when search query is missing', async () => {
      mockRequest.query = {};

      await setlistController.searchSetlists(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({ error: 'Search query is required' });
    });

    it('should return 400 when search query is not a string', async () => {
      mockRequest.query = { q: 123 as any };

      await setlistController.searchSetlists(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({ error: 'Search query is required' });
    });

    it('should return 400 when search query is too long', async () => {
      mockRequest.query = { q: 'a'.repeat(201) };

      await setlistController.searchSetlists(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({ error: 'Invalid search query format' });
    });

    it('should return 400 when search query contains malicious characters', async () => {
      mockRequest.query = { q: 'test;drop table' };

      await setlistController.searchSetlists(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({ error: 'Invalid search query format' });
    });

    it('should handle 404 error from service', async () => {
      mockRequest.query = { q: 'radiohead' };
      const error = { response: { status: 404 } } as HttpError;
      mockSetlistService.searchSetlists.mockRejectedValue(error);

      await setlistController.searchSetlists(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(404);
      expect(mockResponse.json).toHaveBeenCalledWith({ error: 'No setlists found' });
    });

    it('should handle 400 error from service', async () => {
      mockRequest.query = { q: 'radiohead' };
      const error = { response: { status: 400 } } as HttpError;
      mockSetlistService.searchSetlists.mockRejectedValue(error);

      await setlistController.searchSetlists(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({ error: 'Invalid search parameters' });
    });

    it('should handle 500 error from service', async () => {
      mockRequest.query = { q: 'radiohead' };
      const error = { response: { status: 500 } } as HttpError;
      mockSetlistService.searchSetlists.mockRejectedValue(error);

      await setlistController.searchSetlists(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith({ error: 'Failed to search for setlists' });
    });
  });

  describe('getArtistSetlists', () => {
    beforeEach(() => {
      mockRequest.params = {};
      mockRequest.query = {};
    });

    it('should get artist setlists successfully', async () => {
      const mockResult = { type: 'setlist', items: [], total: 0, page: 1, itemsPerPage: 20 };
      mockRequest.params = { artistId: 'test-artist' };
      mockRequest.query = { page: '2' };
      mockSetlistService.getArtistSetlists.mockResolvedValue(mockResult);

      await setlistController.getArtistSetlists(mockRequest as Request, mockResponse as Response);

      expect(mockSetlistService.getArtistSetlists).toHaveBeenCalledWith('test-artist', 2);
      expect(mockResponse.json).toHaveBeenCalledWith(mockResult);
    });

    it('should default to page 1 when page is not provided', async () => {
      const mockResult = { type: 'setlist', items: [], total: 0, page: 1, itemsPerPage: 20 };
      mockRequest.params = { artistId: 'test-artist' };
      mockSetlistService.getArtistSetlists.mockResolvedValue(mockResult);

      await setlistController.getArtistSetlists(mockRequest as Request, mockResponse as Response);

      expect(mockSetlistService.getArtistSetlists).toHaveBeenCalledWith('test-artist', 1);
    });

    it('should return 400 when artist ID is missing', async () => {
      mockRequest.params = {};

      await setlistController.getArtistSetlists(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({ error: 'Artist ID is required' });
    });

    it('should return 400 when artist ID is empty string', async () => {
      mockRequest.params = { artistId: '' };

      await setlistController.getArtistSetlists(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({ error: 'Artist ID is required' });
    });

    it('should return 400 when artist ID is "undefined"', async () => {
      mockRequest.params = { artistId: 'undefined' };

      await setlistController.getArtistSetlists(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({ error: 'Artist ID is required' });
    });

    it('should return 400 when artist ID has invalid format', async () => {
      mockRequest.params = { artistId: 'invalid@id' };

      await setlistController.getArtistSetlists(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({ error: 'Invalid artist ID format' });
    });

    it('should handle 404 error from service', async () => {
      mockRequest.params = { artistId: 'test-artist' };
      const error = { response: { status: 404 } } as HttpError;
      mockSetlistService.getArtistSetlists.mockRejectedValue(error);

      await setlistController.getArtistSetlists(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(404);
      expect(mockResponse.json).toHaveBeenCalledWith({ error: 'Artist not found or no setlists available' });
    });
  });

  describe('getSetlistById', () => {
    beforeEach(() => {
      mockRequest.params = {};
    });

    it('should get setlist by ID successfully', async () => {
      const mockSetlist = { id: 'test-id', artist: { name: 'Test Artist' } };
      const mockSongs = [{ name: 'Song 1' }, { name: 'Song 2' }];
      mockRequest.params = { setlistId: 'test-id' };
      mockSetlistService.getSetlistById.mockResolvedValue(mockSetlist as any);
      mockSetlistService.extractSongsFromSetlist.mockReturnValue(mockSongs as any);

      await setlistController.getSetlistById(mockRequest as Request, mockResponse as Response);

      expect(mockSetlistService.getSetlistById).toHaveBeenCalledWith('test-id');
      expect(mockSetlistService.extractSongsFromSetlist).toHaveBeenCalledWith(mockSetlist);
      expect(mockResponse.json).toHaveBeenCalledWith({
        setlist: mockSetlist,
        songs: mockSongs,
      });
    });

    it('should return 400 when setlist ID is missing', async () => {
      mockRequest.params = {};

      await setlistController.getSetlistById(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({ error: 'Setlist ID is required' });
    });

    it('should return 400 when setlist ID is empty', async () => {
      mockRequest.params = { setlistId: '' };

      await setlistController.getSetlistById(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({ error: 'Setlist ID is required' });
    });

    it('should return 400 when setlist ID has invalid format', async () => {
      mockRequest.params = { setlistId: 'invalid@id' };

      await setlistController.getSetlistById(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({ error: 'Invalid setlist ID format' });
    });

    it('should handle 404 error from service', async () => {
      mockRequest.params = { setlistId: 'test-id' };
      const error = { response: { status: 404 } } as HttpError;
      mockSetlistService.getSetlistById.mockRejectedValue(error);

      await setlistController.getSetlistById(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(404);
      expect(mockResponse.json).toHaveBeenCalledWith({ error: 'Setlist not found' });
    });
  });
});