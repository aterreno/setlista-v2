import request from 'supertest';
import express from 'express';
import { createRoutes } from '../../routes/index';
import { ArtistController } from '../../controllers/artist-controller';
import { SetlistController } from '../../controllers/setlist-controller';
import { SpotifyController } from '../../controllers/spotify-controller';

// Mock controllers
const mockArtistController = {
  searchArtists: jest.fn((req: express.Request, res: express.Response) => {
    res.json({ message: 'artist routes' });
  }),
} as unknown as ArtistController;

const mockSetlistController = {
  getArtistSetlists: jest.fn((req: express.Request, res: express.Response) => {
    res.json({ message: 'setlist routes' });
  }),
  getSetlistDetails: jest.fn((req: express.Request, res: express.Response) => {
    res.json({ message: 'setlist details' });
  }),
} as unknown as SetlistController;

const mockSpotifyController = {
  getAuthUrl: jest.fn((req: express.Request, res: express.Response) => {
    res.json({ message: 'spotify routes' });
  }),
  handleCallback: jest.fn((req: express.Request, res: express.Response) => {
    res.json({ message: 'spotify callback' });
  }),
  createPlaylist: jest.fn((req: express.Request, res: express.Response) => {
    res.json({ message: 'create playlist' });
  }),
} as unknown as SpotifyController;

describe('Routes Index', () => {
  let app: express.Application;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    jest.clearAllMocks();
    
    // Apply the routes
    const routes = createRoutes(
      mockArtistController,
      mockSetlistController,
      mockSpotifyController
    );
    app.use('/api', routes);
  });

  it('should mount artist routes on /artists', async () => {
    const response = await request(app).get('/api/artists/search');
    expect(response.status).toBe(200);
    expect(mockArtistController.searchArtists).toHaveBeenCalled();
  });

  it('should mount setlist routes on /setlists', async () => {
    const response = await request(app).get('/api/setlists/artist/123');
    expect(response.status).toBe(200);
    expect(mockSetlistController.getArtistSetlists).toHaveBeenCalled();
  });

  it('should mount spotify routes on /spotify', async () => {
    const response = await request(app).get('/api/spotify/auth');
    expect(response.status).toBe(200);
    expect(mockSpotifyController.getAuthUrl).toHaveBeenCalled();
  });

  it('should return 404 for undefined routes', async () => {
    const response = await request(app).get('/api/nonexistent');
    expect(response.status).toBe(404);
  });
});