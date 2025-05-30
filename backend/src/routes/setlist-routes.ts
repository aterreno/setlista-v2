import { Router } from 'express';
import { SetlistController } from '../controllers/setlist-controller';

export const createSetlistRoutes = (setlistController: SetlistController) => {
  const router = Router();

  router.get('/search', setlistController.searchSetlists);
  router.get('/artist/:artistId', setlistController.getArtistSetlists);
  router.get('/:setlistId', setlistController.getSetlistById);

  return router;
};