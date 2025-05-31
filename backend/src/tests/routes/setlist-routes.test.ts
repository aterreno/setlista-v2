import request from 'supertest';
import express from 'express';
import { createSetlistRoutes } from '../../routes/setlist-routes';
import { SetlistController } from '../../controllers/setlist-controller';

// Mock the controller
const mockSetlistController = {
  getArtistSetlists: jest.fn((req: express.Request, res: express.Response) => {
    res.json({ setlists: [] });
  }),
  
  getSetlistById: jest.fn((req: express.Request, res: express.Response) => {
    res.json({ setlist: {} });
  }),
  
  searchSetlists: jest.fn((req: express.Request, res: express.Response) => {
    res.json({ setlists: [] });
  }),
} as unknown as SetlistController;

describe('Setlist Routes', () => {
  let app: express.Application;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    jest.clearAllMocks();
    
    // Apply the routes
    const setlistRoutes = createSetlistRoutes(mockSetlistController);
    app.use('/api/setlists', setlistRoutes);
  });

  it('should handle GET /artist/:artistId route', async () => {
    const response = await request(app).get('/api/setlists/artist/123');
    
    expect(response.status).toBe(200);
    expect(mockSetlistController.getArtistSetlists).toHaveBeenCalled();
  });

  it('should handle GET /:setlistId route', async () => {
    const response = await request(app).get('/api/setlists/456');
    
    expect(response.status).toBe(200);
    expect(mockSetlistController.getSetlistById).toHaveBeenCalled();
  });

  it('should return 404 for undefined setlist routes', async () => {
    const response = await request(app).get('/api/setlists/nonexistent/path');
    expect(response.status).toBe(404);
  });
});