import { Request, Response } from 'express';
import { SetlistService } from '../domain/services/setlist-service';
import { HttpError } from '../domain/types';
import { SEARCH_CONFIG, VALIDATION } from '../constants';
import logger from '../utils/logger';

export class SetlistController {
  constructor(private readonly setlistService: SetlistService) {}

  searchSetlists = async (req: Request, res: Response): Promise<void> => {
    try {
      const { q } = req.query;
      const page = req.query.page ? parseInt(req.query.page as string, 10) : 1;

      if (!q || typeof q !== 'string') {
        res.status(400).json({ error: 'Search query is required' });
        return;
      }

      // Validate search query to prevent malicious input (allow URLs and normal text)
      if (q.length > SEARCH_CONFIG.MAX_QUERY_LENGTH || VALIDATION.MALICIOUS_CHARS_REGEX.test(q)) {
        res.status(400).json({ error: 'Invalid search query format' });
        return;
      }

      const result = await this.setlistService.searchSetlists(q, page);
      res.json(result);
    } catch (error: unknown) {
      const httpError = error as HttpError;
      logger.error('Error in searchSetlists controller', { error: httpError });
      
      if (httpError.response?.status === 404) {
        res.status(404).json({ error: 'No setlists found' });
      } else if (httpError.response?.status === 400) {
        res.status(400).json({ error: 'Invalid search parameters' });
      } else {
        res.status(500).json({ error: 'Failed to search for setlists' });
      }
    }
  };

  getArtistSetlists = async (req: Request, res: Response): Promise<void> => {
    try {
      const { artistId } = req.params;
      const page = req.query.page ? parseInt(req.query.page as string, 10) : 1;

      logger.info('getArtistSetlists called', { artistId, page });

      if (!artistId || typeof artistId !== 'string' || artistId.trim() === '' || artistId === 'undefined') {
        logger.warn('Artist ID validation failed: missing, empty, or undefined', { artistId });
        res.status(400).json({ error: 'Artist ID is required' });
        return;
      }

      // Validate artistId format (should be alphanumeric with possible hyphens/underscores)
      if (!VALIDATION.ID_REGEX.test(artistId)) {
        logger.warn('Artist ID validation failed: invalid format', { artistId });
        res.status(400).json({ error: 'Invalid artist ID format' });
        return;
      }

      const result = await this.setlistService.getArtistSetlists(artistId, page);
      res.json(result);
    } catch (error: unknown) {
      const httpError = error as HttpError;
      logger.error('Error in getArtistSetlists controller', { error: httpError });
      
      if (httpError.response?.status === 400) {
        res.status(400).json({ error: 'Invalid artist ID or parameters' });
      } else if (httpError.response?.status === 404) {
        res.status(404).json({ error: 'Artist not found or no setlists available' });
      } else {
        res.status(500).json({ error: 'Failed to get artist setlists' });
      }
    }
  };

  getSetlistById = async (req: Request, res: Response): Promise<void> => {
    try {
      const { setlistId } = req.params;

      if (!setlistId || typeof setlistId !== 'string' || setlistId.trim() === '') {
        res.status(400).json({ error: 'Setlist ID is required' });
        return;
      }

      // Validate setlistId format
      if (!VALIDATION.ID_REGEX.test(setlistId)) {
        res.status(400).json({ error: 'Invalid setlist ID format' });
        return;
      }

      const setlist = await this.setlistService.getSetlistById(setlistId);
      const songs = this.setlistService.extractSongsFromSetlist(setlist);

      res.json({
        setlist,
        songs,
      });
    } catch (error: unknown) {
      const httpError = error as HttpError;
      logger.error('Error in getSetlistById controller', { error: httpError });
      
      if (httpError.response?.status === 404) {
        res.status(404).json({ error: 'Setlist not found' });
      } else if (httpError.response?.status === 400) {
        res.status(400).json({ error: 'Invalid setlist ID' });
      } else {
        res.status(500).json({ error: 'Failed to get setlist' });
      }
    }
  };
}