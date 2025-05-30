import { Router } from 'express';
import { ArtistController } from '../controllers/artist-controller';

export const createArtistRoutes = (artistController: ArtistController) => {
  const router = Router();

  router.get('/search', artistController.searchArtists);

  return router;
};