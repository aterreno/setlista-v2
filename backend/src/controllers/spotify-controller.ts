import { Request, Response } from 'express';
import { SpotifyService } from '../domain/services/spotify-service';
import { SetlistService } from '../domain/services/setlist-service';
import { HttpError } from '../domain/types';
import { config } from '../config';
import logger from '../utils/logger';

export class SpotifyController {
  constructor(
    private readonly spotifyService: SpotifyService,
    private readonly setlistService: SetlistService
  ) {}

  getAuthUrl = (_req: Request, res: Response): void => {
    try {
      const authUrl = this.spotifyService.getAuthorizationUrl();
      res.json({ authUrl });
    } catch (error: unknown) {
      const httpError = error as HttpError;
      logger.error('Error in getAuthUrl controller', { error: httpError });
      res.status(500).json({ error: 'Failed to get Spotify authorization URL' });
    }
  };

  handleCallback = async (req: Request, res: Response): Promise<void> => {
    try {
      const { code } = req.query;

      if (!code || typeof code !== 'string') {
        res.status(400).json({ error: 'Authorization code is required' });
        return;
      }

      const tokenData = await this.spotifyService.getAccessToken(code);
      
      // In a real application, you would store these tokens securely
      // For this demo, we'll send them back to the client
      // Determine frontend base URL
      const isProd = process.env.NODE_ENV === 'production' || (config && config.server && config.server.nodeEnv === 'production');
      const frontendBaseUrl = isProd ? 'https://setlista.terreno.dev' : 'http://localhost:3000';
      // Redirect to frontend callback page with tokens as query params
      const redirectUrl = `${frontendBaseUrl}/callback?access_token=${encodeURIComponent(tokenData.access_token)}&expires_in=${encodeURIComponent(tokenData.expires_in)}`;
      res.redirect(302, redirectUrl);
    } catch (error: unknown) {
      const httpError = error as HttpError;
      logger.error('Error in handleCallback controller', { error: httpError });
      res.status(500).json({ error: 'Failed to handle Spotify callback' });
    }
  };

  createPlaylist = async (req: Request, res: Response): Promise<void> => {
    try {
      const { setlistId } = req.params;
      const { access_token } = req.body;

      if (!setlistId) {
        res.status(400).json({ error: 'Setlist ID is required' });
        return;
      }

      if (!access_token) {
        res.status(400).json({ error: 'Spotify access token is required' });
        return;
      }

      const setlist = await this.setlistService.getSetlistById(setlistId);
      const songs = this.setlistService.extractSongsFromSetlist(setlist);

      if (songs.length === 0) {
        res.status(404).json({ error: 'No songs found in setlist' });
        return;
      }

      const playlist = await this.spotifyService.createPlaylistFromSongs(
        songs,
        setlist.artist.name,
        setlist.eventDate,
        setlist.venue.name,
        access_token
      );

      res.json({ playlist });
    } catch (error: unknown) {
      const httpError = error as HttpError;
      logger.error('Error in createPlaylist controller', { error: httpError });
      res.status(500).json({ error: 'Failed to create Spotify playlist' });
    }
  };
}