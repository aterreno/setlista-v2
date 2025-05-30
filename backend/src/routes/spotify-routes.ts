import { Router } from 'express';
import { SpotifyController } from '../controllers/spotify-controller';

export const createSpotifyRoutes = (spotifyController: SpotifyController) => {
  const router = Router();

  router.get('/auth', spotifyController.getAuthUrl);
  router.get('/callback', spotifyController.handleCallback);
  router.post('/playlist/setlist/:setlistId', spotifyController.createPlaylist);

  return router;
};