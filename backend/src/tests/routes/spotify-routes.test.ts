import request from 'supertest';
import express from 'express';
import { createSpotifyRoutes } from '../../routes/spotify-routes';
import { SpotifyController } from '../../controllers/spotify-controller';

// Mock the controller
const mockSpotifyController = {
  getAuthUrl: jest.fn((req: express.Request, res: express.Response) => {
    res.json({ authUrl: 'https://accounts.spotify.com/authorize' });
  }),
  
  handleCallback: jest.fn((req: express.Request, res: express.Response) => {
    res.json({ success: true });
  }),
  
  createPlaylist: jest.fn((req: express.Request, res: express.Response) => {
    res.json({ playlistId: '123' });
  }),
} as unknown as SpotifyController;

describe('Spotify Routes', () => {
  let app: express.Application;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    jest.clearAllMocks();
    
    // Apply the routes
    const spotifyRoutes = createSpotifyRoutes(mockSpotifyController);
    app.use('/api/spotify', spotifyRoutes);
  });

  it('should handle GET /auth route', async () => {
    const response = await request(app).get('/api/spotify/auth');
    
    expect(response.status).toBe(200);
    expect(mockSpotifyController.getAuthUrl).toHaveBeenCalled();
  });

  it('should handle GET /callback route', async () => {
    const response = await request(app)
      .get('/api/spotify/callback')
      .query({ code: 'auth_code' });
    
    expect(response.status).toBe(200);
    expect(mockSpotifyController.handleCallback).toHaveBeenCalled();
  });

  it('should handle POST /playlist route', async () => {
    const response = await request(app)
      .post('/api/spotify/playlist')
      .send({ songs: ['song1', 'song2'] });
    
    expect(response.status).toBe(200);
    expect(mockSpotifyController.createPlaylist).toHaveBeenCalled();
  });

  it('should return 404 for undefined spotify routes', async () => {
    const response = await request(app).get('/api/spotify/nonexistent');
    expect(response.status).toBe(404);
  });
});