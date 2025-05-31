import { Request, Response } from 'express';
import { ArtistService } from '../domain/services/artist-service';
import { HttpError } from '../domain/types';
import logger from '../utils/logger';

export class ArtistController {
  constructor(private readonly artistService: ArtistService) {}

  searchArtists = async (req: Request, res: Response): Promise<void> => {
    try {
      const { name } = req.query;
      const page = req.query.page ? parseInt(req.query.page as string, 10) : 1;

      if (!name || typeof name !== 'string') {
        res.status(400).json({ error: 'Artist name is required' });
        return;
      }

      // Validate artist name to prevent malicious input (allow URLs and normal text)
      if (name.length > 200 || /[;|&$`{}[\]\\]/.test(name)) {
        res.status(400).json({ error: 'Invalid search query format' });
        return;
      }

      const result = await this.artistService.searchArtists(name, page);
      res.json(result);
    } catch (error: unknown) {
      const httpError = error as HttpError;
      logger.error('Error in searchArtists controller', { error: httpError });
      
      if (httpError.response?.status === 404) {
        res.status(404).json({ error: 'No artists found' });
      } else if (httpError.response?.status === 400) {
        res.status(400).json({ error: 'Invalid search parameters' });
      } else {
        res.status(500).json({ error: 'Failed to search for artists' });
      }
    }
  };
}