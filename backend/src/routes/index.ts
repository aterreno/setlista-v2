import { Router } from 'express';
import { createArtistRoutes } from './artist-routes';
import { createSetlistRoutes } from './setlist-routes';
import { createSpotifyRoutes } from './spotify-routes';
import { ArtistController } from '../controllers/artist-controller';
import { SetlistController } from '../controllers/setlist-controller';
import { SpotifyController } from '../controllers/spotify-controller';

export const createRoutes = (
  artistController: ArtistController,
  setlistController: SetlistController,
  spotifyController: SpotifyController
) => {
  const router = Router();

  router.use('/artists', createArtistRoutes(artistController));
  router.use('/setlists', createSetlistRoutes(setlistController));
  router.use('/spotify', createSpotifyRoutes(spotifyController));
  router.use('/auth', createSpotifyRoutes(spotifyController));

  return router;
};