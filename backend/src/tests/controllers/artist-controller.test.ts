import { Request, Response } from 'express';
import { ArtistController } from '../../controllers/artist-controller';
import { ArtistService } from '../../domain/services/artist-service';

// Mock the logger
jest.mock('../../utils/logger', () => ({
  error: jest.fn(),
  info: jest.fn(),
  warn: jest.fn()
}));

// Mock ArtistService
const mockArtistService = {
  searchArtists: jest.fn()
} as unknown as jest.Mocked<ArtistService>;

describe('ArtistController', () => {
  let controller: ArtistController;
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;

  beforeEach(() => {
    controller = new ArtistController(mockArtistService);
    mockRequest = {};
    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };
    jest.clearAllMocks();
  });

  describe('searchArtists', () => {
    it('should return artists for valid search query', async () => {
      const mockResult = {
        type: 'artists',
        itemsPerPage: 20,
        page: 1,
        total: 1,
        items: [{ id: '1', name: 'Test Artist', sortName: 'Artist, Test' }]
      };

      mockRequest.query = { name: 'Test Artist' };
      mockArtistService.searchArtists.mockResolvedValue(mockResult);

      await controller.searchArtists(mockRequest as Request, mockResponse as Response);

      expect(mockArtistService.searchArtists).toHaveBeenCalledWith('Test Artist', 1);
      expect(mockResponse.json).toHaveBeenCalledWith(mockResult);
    });

    it('should handle page parameter correctly', async () => {
      const mockResult = {
        type: 'artists',
        itemsPerPage: 20,
        page: 2,
        total: 1,
        items: [{ id: '1', name: 'Test Artist', sortName: 'Artist, Test' }]
      };

      mockRequest.query = { name: 'Test Artist', page: '2' };
      mockArtistService.searchArtists.mockResolvedValue(mockResult);

      await controller.searchArtists(mockRequest as Request, mockResponse as Response);

      expect(mockArtistService.searchArtists).toHaveBeenCalledWith('Test Artist', 2);
      expect(mockResponse.json).toHaveBeenCalledWith(mockResult);
    });

    it('should return 400 error when name is missing', async () => {
      mockRequest.query = {};

      await controller.searchArtists(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({ error: 'Artist name is required' });
    });

    it('should return 400 error when name is not a string', async () => {
      mockRequest.query = { name: 123 as any };

      await controller.searchArtists(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({ error: 'Artist name is required' });
    });

    it('should reject queries longer than 200 characters', async () => {
      const longQuery = 'a'.repeat(201);
      mockRequest.query = { name: longQuery };

      await controller.searchArtists(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({ error: 'Invalid search query format' });
    });

    it('should reject queries with dangerous characters (shell injection prevention)', async () => {
      const dangerousQueries = [
        'artist; rm -rf /',
        'artist | cat /etc/passwd',
        'artist & whoami',
        'artist$(id)',
        'artist`id`',
        'artist{id}',
        'artist[id]',
        'artist\\test'
      ];

      for (const query of dangerousQueries) {
        mockRequest.query = { name: query };

        await controller.searchArtists(mockRequest as Request, mockResponse as Response);

        expect(mockResponse.status).toHaveBeenCalledWith(400);
        expect(mockResponse.json).toHaveBeenCalledWith({ error: 'Invalid search query format' });
      }
    });

    it('should allow valid characters including URLs', async () => {
      const validQueries = [
        'Martha Wainwright',
        'Radiohead',
        'The Beatles',
        'AC/DC',
        'N.W.A',
        'Jay-Z',
        'https://example.com/artist',
        'artist@venue.com',
        'Test (Artist)',
        'Artist #1'
      ];

      const mockResult = {
        type: 'artists',
        itemsPerPage: 20,
        page: 1,
        total: 0,
        items: []
      };

      for (const query of validQueries) {
        mockRequest.query = { name: query };
        mockArtistService.searchArtists.mockResolvedValue(mockResult);

        await controller.searchArtists(mockRequest as Request, mockResponse as Response);

        expect(mockArtistService.searchArtists).toHaveBeenCalledWith(query, 1);
        expect(mockResponse.json).toHaveBeenCalledWith(mockResult);
      }
    });

    it('should handle 404 errors from service', async () => {
      mockRequest.query = { name: 'Nonexistent Artist' };
      const error = new Error('Not found') as any;
      error.response = { status: 404 };
      mockArtistService.searchArtists.mockRejectedValue(error);

      await controller.searchArtists(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(404);
      expect(mockResponse.json).toHaveBeenCalledWith({ error: 'No artists found' });
    });

    it('should handle 400 errors from service', async () => {
      mockRequest.query = { name: 'Invalid Query' };
      const error = new Error('Bad request') as any;
      error.response = { status: 400 };
      mockArtistService.searchArtists.mockRejectedValue(error);

      await controller.searchArtists(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({ error: 'Invalid search parameters' });
    });

    it('should handle 500 errors from service', async () => {
      mockRequest.query = { name: 'Test Artist' };
      const error = new Error('Internal server error');
      mockArtistService.searchArtists.mockRejectedValue(error);

      await controller.searchArtists(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith({ error: 'Failed to search for artists' });
    });

    it('should handle network errors gracefully', async () => {
      mockRequest.query = { name: 'Test Artist' };
      const networkError = new Error('Network timeout');
      mockArtistService.searchArtists.mockRejectedValue(networkError);

      await controller.searchArtists(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith({ error: 'Failed to search for artists' });
    });
  });
});