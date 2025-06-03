import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import logger from './utils/logger';
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
  logger.debug('Creating app');
  const app = express();

  logger.debug('Creating middleware');
  app.use(helmet());
  app.use(cors());
  app.use(express.json());
  
  logger.debug('Creating repositories');
  const setlistRepository = new SetlistRepositoryImpl();
  const spotifyRepository = new SpotifyRepositoryImpl();

  logger.debug('Creating services');
  const artistService = new ArtistService(setlistRepository);
  const setlistService = new SetlistService(setlistRepository);
  const spotifyService = new SpotifyService(spotifyRepository);

  logger.debug('Creating controllers');
  const artistController = new ArtistController(artistService);
  const setlistController = new SetlistController(setlistService);
  const spotifyController = new SpotifyController(spotifyService, setlistService);

  logger.debug('Creating /api routes');
  app.use('/api', createRoutes(artistController, setlistController, spotifyController));

  logger.debug('Creating /health route');
  app.get('/health', (_, res) => {
    res.json({ status: 'ok', env: {...process.env}, timestamp: new Date().toISOString()});
  });

  logger.debug('Setting up error handler');
  app.use(errorHandler);

  return app;
};