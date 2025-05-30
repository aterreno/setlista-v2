import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { createRoutes } from './routes';
import { errorHandler } from './middleware/error-handler';
import { ArtistController } from './controllers/artist-controller';
import { SetlistController } from './controllers/setlist-controller';
import { SpotifyController } from './controllers/spotify-controller';
import { ArtistService } from './domain/services/artist-service';
import { SetlistService } from './domain/services/setlist-service';
import { SpotifyService } from './domain/services/spotify-service';
import { SetlistRepositoryImpl } from './infrastructure/repositories/setlist-repository-impl';
import { SpotifyRepositoryImpl } from './infrastructure/repositories/spotify-repository-impl';

export const createApp = () => {
  const app = express();

  // Middleware
  app.use(helmet());
  app.use(cors());
  app.use(express.json());

  // Repositories
  const setlistRepository = new SetlistRepositoryImpl();
  const spotifyRepository = new SpotifyRepositoryImpl();

  // Services
  const artistService = new ArtistService(setlistRepository);
  const setlistService = new SetlistService(setlistRepository);
  const spotifyService = new SpotifyService(spotifyRepository);

  // Controllers
  const artistController = new ArtistController(artistService);
  const setlistController = new SetlistController(setlistService);
  const spotifyController = new SpotifyController(spotifyService, setlistService);

  // Routes
  app.use('/api', createRoutes(artistController, setlistController, spotifyController));

  // Health check
  app.get('/health', (req, res) => {
    res.json({ status: 'ok' });
  });

  // Error handling
  app.use(errorHandler);

  return app;
};