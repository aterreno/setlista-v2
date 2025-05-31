import request from 'supertest';
import express from 'express';
import { createArtistRoutes } from '../../routes/artist-routes';
import { ArtistController } from '../../controllers/artist-controller';

// Mock the controller
const mockArtistController = {
  searchArtists: jest.fn((req: express.Request, res: express.Response) => {
    res.json({ artists: [] });
  }),
} as unknown as ArtistController;

describe('Artist Routes', () => {
  let app: express.Application;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    jest.clearAllMocks();
    
    // Apply the routes
    const artistRoutes = createArtistRoutes(mockArtistController);
    app.use('/api/artists', artistRoutes);
  });

  it('should handle GET /search route', async () => {
    const response = await request(app)
      .get('/api/artists/search')
      .query({ q: 'test artist' });
    
    expect(response.status).toBe(200);
    expect(mockArtistController.searchArtists).toHaveBeenCalled();
  });

  it('should return 404 for undefined artist routes', async () => {
    const response = await request(app).get('/api/artists/nonexistent');
    expect(response.status).toBe(404);
  });
});