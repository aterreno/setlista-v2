import axios from 'axios';
import { config } from '../../config';
import { Artist, SearchResult, Setlist, SearchType } from '../../domain/types';
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

      // Parallel search for artists, venues, and festivals
      const [artistSearchResult, venueSearchResult, festivalSearchResult] = await Promise.all([
        this.privateSearchByArtist(query, page).catch((error: any) => {
          logger.debug('Artist search failed or returned no results', { error: error.message });
          return this.getEmptySearchResult(page, SearchType.ARTIST);
        }),
        this.privateSearchByLocation(query, page).catch((error: any) => {
          logger.debug('Location search failed or returned no results', { error: error.message });
          return this.getEmptySearchResult(page, SearchType.VENUE);
        }),
        this.privateSearchByFestival(query, page).catch((error: any) => {
          logger.debug('Festival search failed or returned no results', { error: error.message });
          return this.getEmptySearchResult(page, SearchType.FESTIVAL);
        })
      ]);

      // Return results with the highest priority: artist > venue > festival
      if (artistSearchResult.total > 0) {
        logger.debug('Returning artist search results', { count: artistSearchResult.total });
        return {
          ...artistSearchResult,
          searchType: SearchType.ARTIST,
          searchQuery: query
        };
      }

      if (venueSearchResult.total > 0) {
        logger.debug('Returning venue search results', { count: venueSearchResult.total });
        return {
          ...venueSearchResult,
          searchType: venueSearchResult.searchType,
          searchQuery: query
        };
      }

      if (festivalSearchResult.total > 0) {
        logger.debug('Returning festival search results', { count: festivalSearchResult.total });
        return {
          ...festivalSearchResult,
          searchType: SearchType.FESTIVAL,
          searchQuery: query
        };
      }

      // No results found
      logger.debug('No search results found', { query });
      return this.getEmptySearchResult(page, SearchType.ARTIST, query);
    } catch (error: any) {
      logger.error('Error searching setlists', { error: error.message, query });
      return this.getEmptySearchResult(page, SearchType.ARTIST, query);
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
      // Only log as error if it's not a 404 (no results)
      if (error.response?.status === 404) {
        logger.debug('No artist found - API returned 404', { artistName });
      } else {
        logger.error('Error searching for artist', { error: error.message, artistName });
      }
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
        items: response.data.setlist || [],
        searchType: SearchType.ARTIST,
        searchQuery: artistName
      };
    } catch (error: any) {
      // Only log as error if it's not a 404 (no results)
      if (error.response?.status === 404) {
        logger.debug('No setlists found for artist - API returned 404', { artistName });
      } else {
        logger.error('Error searching setlists by artist', { error: error.message, artistName });
      }
      
      return this.getEmptySearchResult(page, SearchType.ARTIST, artistName);
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
        items: response.data.setlist || [],
        searchType: SearchType.ARTIST
      };
    } catch (error: any) {
      logger.error('Error getting artist setlists', { error: error.message, artistId });
      return this.getEmptySearchResult(page, SearchType.ARTIST);
    }
  }

  /**
   * Helper method to return consistent empty search results
   */
  private getEmptySearchResult(page: number, searchType: SearchType, searchQuery?: string): SearchResult<Setlist> {
    return {
      type: 'setlists',
      itemsPerPage: DEFAULT_PAGE_SIZE,
      page,
      total: 0,
      items: [],
      searchType,
      searchQuery
    };
  }

  /**
   * Search for setlists by artist name or MBID
   */
  private async privateSearchByArtist(query: string, page: number): Promise<SearchResult<Setlist>> {
    const artistData = await this.searchArtistByName(query);
    
    if (artistData) {
      logger.debug('Found artist match', { artistName: artistData.name, mbid: artistData.mbid });
      return this.searchSetlistsByArtist(artistData.name, page, artistData.mbid);
    }

    // No exact artist match found, try searching setlists directly with the query as artist name
    logger.debug('No exact artist match, trying direct setlist search', { query });
    return this.searchSetlistsByArtist(query, page);
  }

  /**
   * Search for setlists by location (venue name or city)
   */
  private async privateSearchByLocation(query: string, page: number): Promise<SearchResult<Setlist>> {
    try {
      // First try as venue name
      logger.debug('Searching by venue name', { query });
      const venueResponse = await axios.get(
        `${SetlistRepositoryImpl.baseUrl}/search/setlists`,
        {
          headers: this.getHeaders(),
          params: {
            venueName: query.trim(),
            p: page
          }
        }
      );

      if (venueResponse.data?.total > 0) {
        logger.debug('Found venue matches', { venue: query, count: venueResponse.data.total });
        return {
          type: venueResponse.data.type || 'setlists',
          itemsPerPage: venueResponse.data.itemsPerPage || DEFAULT_PAGE_SIZE,
          page: venueResponse.data.page || page,
          total: venueResponse.data.total || 0,
          items: venueResponse.data.setlist || [],
          searchType: SearchType.VENUE,
          searchQuery: query
        };
      }

      // If no venue matches, try as city name
      logger.debug('No venue matches, trying city name', { query });
      const cityResponse = await axios.get(
        `${SetlistRepositoryImpl.baseUrl}/search/setlists`,
        {
          headers: this.getHeaders(),
          params: {
            cityName: query.trim(),
            p: page
          }
        }
      );

      if (cityResponse.data?.total > 0) {
        logger.debug('Found city matches', { city: query, count: cityResponse.data.total });
        return {
          type: cityResponse.data.type || 'setlists',
          itemsPerPage: cityResponse.data.itemsPerPage || DEFAULT_PAGE_SIZE,
          page: cityResponse.data.page || page,
          total: cityResponse.data.total || 0,
          items: cityResponse.data.setlist || [],
          searchType: SearchType.CITY,
          searchQuery: query
        };
      }

      // No location matches found
      logger.debug('No location matches found', { query });
      return this.getEmptySearchResult(page, SearchType.VENUE, query);
    } catch (error: any) {
      // Only log as error if it's not a 404 (no results)
      if (error.response?.status === 404) {
        logger.debug('No location matches - API returned 404', { query });
      } else {
        logger.error('Error searching by location', { error: error.message, query });
      }
      
      return this.getEmptySearchResult(page, SearchType.VENUE, query);
    }
  }

  /**
   * Search for setlists by festival name
   */
  private async privateSearchByFestival(query: string, page: number): Promise<SearchResult<Setlist>> {
    try {
      logger.debug('Searching by festival name', { query });
      const response = await axios.get(
        `${SetlistRepositoryImpl.baseUrl}/search/setlists`,
        {
          headers: this.getHeaders(),
          params: {
            tourName: query.trim(), // festival names are stored as tour names in setlist.fm API
            p: page
          }
        }
      );

      if (response.data?.total > 0) {
        logger.debug('Found festival matches', { festival: query, count: response.data.total });
        return {
          type: response.data.type || 'setlists',
          itemsPerPage: response.data.itemsPerPage || DEFAULT_PAGE_SIZE,
          page: response.data.page || page,
          total: response.data.total || 0,
          items: response.data.setlist || [],
          searchType: SearchType.FESTIVAL,
          searchQuery: query
        };
      }

      // No festival matches found
      logger.debug('No festival matches found', { query });
      return this.getEmptySearchResult(page, SearchType.FESTIVAL, query);
    } catch (error: any) {
      // Only log as error if it's not a 404 (no results)
      if (error.response?.status === 404) {
        logger.debug('No festival matches - API returned 404', { query });
      } else {
        logger.error('Error searching by festival', { error: error.message, query });
      }
      
      return this.getEmptySearchResult(page, SearchType.FESTIVAL, query);
    }
  }
}