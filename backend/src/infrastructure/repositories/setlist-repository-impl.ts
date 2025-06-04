import axios from 'axios';
import { config } from '../../config';
import { Artist, SearchResult, Setlist } from '../../domain/types';
import { SetlistRepository } from '../../domain/repositories/setlist-repository';
import logger from '../../utils/logger';

const DEFAULT_PAGE_SIZE = 20;

export class SetlistRepositoryImpl implements SetlistRepository {
  private static get baseUrl(): string { return config.setlistFm?.baseUrl || ''; }
  private static get apiKey(): string { return config.setlistFm?.apiKey || ''; }

  private getHeaders() {
    return {
      'x-api-key': SetlistRepositoryImpl.apiKey,
      'Accept': 'application/json'
    };
  }

  async getSetlistById(setlistId: string): Promise<Setlist> {
    try {
      logger.debug('Getting setlist by id', { setlistId });
      const response = await axios.get(
        `${SetlistRepositoryImpl.baseUrl}/setlist/${setlistId}`,
        { headers: this.getHeaders() }
      );
      return response.data;
    } catch (error: any) {
      logger.error('Error getting setlist by id', { error, setlistId });
      throw error;
    }
  }

  async searchSetlists(query: string, page = 1): Promise<SearchResult<Setlist>> {
    try {
      logger.debug('Searching setlists', { query, page });


      const artistData = await this.searchArtistByName(query);
      
      if (artistData) {
        logger.debug('Found artist match', { artistName: artistData.name, mbid: artistData.mbid });
        return this.searchSetlistsByArtist(artistData.name, page, artistData.mbid);
      }

      logger.debug('No artist found, using direct search', { query });
      return this.searchSetlistsByArtist(query, page);
    } catch (error: any) {
      logger.error('Error searching setlists', { error, query });
      return {
        type: 'setlists',
        itemsPerPage: DEFAULT_PAGE_SIZE,
        page,
        total: 0,
        items: []
      };
    }
  }

  private async searchArtistByName(artistName: string): Promise<{ name: string; mbid: string } | null> {
    try {
      logger.debug('Searching for artist', { artistName });
      
      const response = await axios.get(
        `${SetlistRepositoryImpl.baseUrl}/search/artists`,
        {
          headers: this.getHeaders(),
          params: {
            artistName: artistName.trim(),
            p: 1,
            sort: 'relevance'
          }
        }
      );

      if (response.data && response.data.artist && response.data.artist.length > 0) {
        const artist = response.data.artist[0];
        if (artist.mbid) {
          return {
            name: artist.name,
            mbid: artist.mbid
          };
        }
      }
      
      logger.debug('No artist found with that name', { artistName });
      return null;
    } catch (error: any) {
      logger.error('Error searching for artist', { error, artistName });
      return null;
    }
  }

  private async searchSetlistsByArtist(artistName: string, page: number, artistMbid?: string): Promise<SearchResult<Setlist>> {
    try {
      const params: Record<string, any> = {
        p: page
      };
      
      if (artistMbid) {
        params.artistMbid = artistMbid;
        logger.debug(`Using MBID for ${artistName}`, { artistName, artistMbid });
      } else {
        params.artistName = artistName;
      }
      
      const response = await axios.get(
        `${SetlistRepositoryImpl.baseUrl}/search/setlists`,
        {
          headers: this.getHeaders(),
          params
        }
      );

      logger.debug('Got search setlists by artist', { artistName, artistMbid, resultsCount: response.data?.total || 0 });

      return {
        type: response.data.type || 'setlists',
        itemsPerPage: response.data.itemsPerPage || DEFAULT_PAGE_SIZE,
        page: response.data.page || page,
        total: response.data.total || 0,
        items: response.data.setlist || []
      };
    } catch (error: any) {
      logger.error('Error searching setlists by artist', { error, artistName });
      return {
        type: 'setlists',
        itemsPerPage: DEFAULT_PAGE_SIZE,
        page,
        total: 0,
        items: []
      };
    }
  }

  async searchArtists(artistName: string, page = 1): Promise<SearchResult<Artist>> {
    try {
      const response = await axios.get(
        `${SetlistRepositoryImpl.baseUrl}/search/artists`,
        {
          headers: this.getHeaders(),
          params: {
            artistName,
            p: page
          }
        }
      );

      return {
        type: response.data.type || 'artists',
        itemsPerPage: response.data.itemsPerPage || DEFAULT_PAGE_SIZE,
        page: response.data.page || page,
        total: response.data.total || 0,
        items: response.data.artist || []
      };
    } catch (error: any) {
      logger.error('Error searching artists', { error, artistName });
      return {
        type: 'artists',
        itemsPerPage: DEFAULT_PAGE_SIZE,
        page,
        total: 0,
        items: []
      };
    }
  }

  async getArtistSetlists(artistId: string, page = 1): Promise<SearchResult<Setlist>> {
    try {
      const response = await axios.get(
        `${SetlistRepositoryImpl.baseUrl}/artist/${artistId}/setlists`,
        {
          headers: this.getHeaders(),
          params: {
            p: page
          }
        }
      );

      return {
        type: response.data.type || 'setlists',
        itemsPerPage: response.data.itemsPerPage || DEFAULT_PAGE_SIZE,
        page: response.data.page || page,
        total: response.data.total || 0,
        items: response.data.setlist || []
      };
    } catch (error: any) {
      logger.error('Error getting artist setlists', { error, artistId });
      return {
        type: 'setlists',
        itemsPerPage: DEFAULT_PAGE_SIZE,
        page,
        total: 0,
        items: []
      };
    }
  }
} 