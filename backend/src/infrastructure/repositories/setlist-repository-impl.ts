import axios from 'axios';
import { config } from '../../config';
import { Artist, SearchResult, Setlist } from '../../domain/types';
import { SetlistRepository } from '../../domain/repositories/setlist-repository';
import logger from '../../utils/logger';

export class SetlistRepositoryImpl implements SetlistRepository {
  private readonly baseUrl = config.setlistFm.baseUrl;
  private readonly apiKey = config.setlistFm.apiKey;

  private getHeaders() {
    return {
      'x-api-key': this.apiKey,
      'Accept': 'application/json',
    };
  }

  async searchArtists(artistName: string, page = 1): Promise<SearchResult<Artist>> {
    try {
      const response = await axios.get(
        `${this.baseUrl}/search/artists`,
        {
          headers: this.getHeaders(),
          params: {
            artistName,
            p: page,
          },
        }
      );

      const result = {
        type: response.data.type,
        itemsPerPage: response.data.itemsPerPage,
        page: response.data.page,
        total: response.data.total,
        items: response.data.artist || [],
      };
      
      logger.info('searchArtists response', { 
        totalArtists: result.items.length,
        firstArtist: result.items[0] || null,
        firstArtistFields: result.items[0] ? Object.keys(result.items[0]) : []
      });
      
      return result;
    } catch (error) {
      logger.error('Error searching for artists', { error, artistName });
      throw new Error('Failed to search for artists');
    }
  }

  async getArtistSetlists(artistId: string, page = 1): Promise<SearchResult<Setlist>> {
    try {
      const response = await axios.get(
        `${this.baseUrl}/artist/${artistId}/setlists`,
        {
          headers: this.getHeaders(),
          params: {
            p: page,
          },
        }
      );

      return {
        type: response.data.type,
        itemsPerPage: response.data.itemsPerPage,
        page: response.data.page,
        total: response.data.total,
        items: response.data.setlist || [],
      };
    } catch (error) {
      logger.error('Error getting artist setlists', { error, artistId });
      throw new Error('Failed to get artist setlists');
    }
  }

  async searchSetlists(query: string, page = 1): Promise<SearchResult<Setlist>> {
    try {
      // First, use the opensearch to get intelligent suggestions
      const suggestions = await this.getSearchSuggestions(query);
      logger.info('Search suggestions received', { query, suggestions });

      // Check if this is a location-only search
      const isLocationSearch = this.isLocationQuery(query);
      
      if (isLocationSearch) {
        logger.info('Detected location search, trying venue search first', { query });
        try {
          const venueResult = await this.searchByVenue(query, page);
          if (venueResult.items.length > 0) {
            return venueResult;
          }
        } catch (error) {
          logger.warn('Venue search failed for location', { query, error: (error as Error).message });
        }
      }

      // Try to execute the best suggestion, but only if it's relevant to the query and not a pure location search
      if (suggestions.length > 0 && !isLocationSearch) {
        const relevantSuggestions = suggestions.filter(suggestion => {
          const queryWords = query.toLowerCase().split(/\s+/);
          const suggestionLower = suggestion.toLowerCase();
          // Only use suggestions that contain most words from the original query
          return queryWords.some(word => word.length > 2 && suggestionLower.includes(word));
        });

        logger.info('Filtered relevant suggestions', { 
          original: suggestions.length, 
          relevant: relevantSuggestions.length,
          relevantSuggestions 
        });

        for (const suggestion of relevantSuggestions.slice(0, 3)) { // Try top 3 relevant suggestions
          try {
            const result = await this.executeSearchSuggestion(suggestion, page);
            if (result.items.length > 0) {
              logger.info('Found results with relevant suggestion', { suggestion, count: result.items.length });
              return result;
            }
          } catch (error) {
            logger.warn('Relevant suggestion failed', { suggestion, error: (error as Error).message });
            continue;
          }
        }
      }

      // Fallback to original search logic
      logger.info('Falling back to original search logic', { query });

      // Just try simple artist search with the original query
      return this.searchArtistByName(query, page);
    } catch (error: any) {
      logger.error('Error searching for setlists', { error: error.message, query });
      
      // If we get 404, return empty results
      if (error.response?.status === 404) {
        return {
          type: 'setlists',
          itemsPerPage: 20,
          page: page,
          total: 0,
          items: [],
        };
      }
      
      throw new Error('Failed to search for setlists');
    }
  }

  private async getSetlistsFromArtists(artists: any[], originalQuery: string, artistQuery: string, page: number): Promise<SearchResult<any>> {
    // Try multiple artists until we find one with setlists
    let allSetlists: any[] = [];
    let usedArtist: any = null;
    
    // Sort artists by relevance first
    const sortedArtists = artists.sort((a, b) => {
      // 1. Exact matches first
      const exactMatchA = a.name.toLowerCase() === artistQuery.toLowerCase() ? 100 : 0;
      const exactMatchB = b.name.toLowerCase() === artistQuery.toLowerCase() ? 100 : 0;
      if (exactMatchA !== exactMatchB) return exactMatchB - exactMatchA;
      
      // 2. Solo artists (no &, feat., or commas) over collaborations
      const isSoloA = !a.name.includes('&') && !a.name.includes('feat.') && !a.name.includes(',') ? 50 : 0;
      const isSoloB = !b.name.includes('&') && !b.name.includes('feat.') && !b.name.includes(',') ? 50 : 0;
      if (isSoloA !== isSoloB) return (isSoloB + exactMatchB) - (isSoloA + exactMatchA);
      
      // 3. Name starts with query
      const startsWithA = a.name.toLowerCase().startsWith(artistQuery.toLowerCase()) ? 25 : 0;
      const startsWithB = b.name.toLowerCase().startsWith(artistQuery.toLowerCase()) ? 25 : 0;
      if (startsWithA !== startsWithB) return (startsWithB + isSoloB) - (startsWithA + isSoloA);
      
      // 4. Contains query
      const containsA = a.name.toLowerCase().includes(artistQuery.toLowerCase()) ? 10 : 0;
      const containsB = b.name.toLowerCase().includes(artistQuery.toLowerCase()) ? 10 : 0;
      return (containsB + startsWithB + isSoloB) - (containsA + startsWithA + isSoloA);
    });

    // Try each artist until we find one with setlists
    for (const artist of sortedArtists.slice(0, 5)) { // Try up to 5 artists
      try {
        logger.info('Trying artist for setlists', { 
          artist: artist.name,
          mbid: artist.mbid
        });

        const setlistResponse = await axios.get(
          `${this.baseUrl}/artist/${artist.mbid}/setlists`,
          {
            headers: this.getHeaders(),
            params: {
              p: page,
            },
          }
        );
        
        const setlists = setlistResponse.data.setlist || [];
        if (setlists.length > 0) {
          allSetlists = setlists;
          usedArtist = artist;
          logger.info('Found setlists for artist', { 
            artist: artist.name,
            setlistCount: setlists.length
          });
          break; // Found setlists, stop trying other artists
        } else {
          logger.info('Artist has no setlists', { artist: artist.name });
        }
      } catch (error: any) {
        if (error.response?.status === 404) {
          logger.info('Artist has no setlists (404)', { artist: artist.name });
          continue; // Try next artist
        } else {
          logger.warn('Error getting setlists for artist', { 
            artist: artist.name, 
            error: error.message 
          });
          continue; // Try next artist
        }
      }
    }

    // If no artist had setlists, return empty result
    if (allSetlists.length === 0) {
      logger.info('No setlists found for any matching artists', { 
        originalQuery,
        artistCount: artists.length 
      });
      return {
        type: 'setlists',
        itemsPerPage: 20,
        page: page,
        total: 0,
        items: [],
      };
    }

    // Now work with the setlists we found
    let setlists = allSetlists;

    // Extract venue/location terms from original query for filtering
    const venueTerms = originalQuery.toLowerCase()
      .replace(artistQuery.toLowerCase(), '') // Remove artist name
      .split(/\s+/)
      .filter(word => word.length > 2 && !['setlist', 'at', 'the', 'and', 'in', 'on'].includes(word));

    logger.info('Extracted venue terms for filtering', { venueTerms });

    // Sort setlists by relevance and recency
    setlists = setlists.sort((a: any, b: any) => {
        // Parse dates (format: dd-mm-yyyy)
        const parseDate = (dateStr: string) => {
          const [day, month, year] = dateStr.split('-').map(Number);
          return new Date(year, month - 1, day);
        };

        const dateA = parseDate(a.eventDate);
        const dateB = parseDate(b.eventDate);

        // First priority: venue/location match
        const getVenueMatchScore = (setlist: any) => {
          const venueText = `${setlist.venue.name} ${setlist.venue.city.name} ${setlist.venue.city.country.name}`.toLowerCase();
          return venueTerms.reduce((score, term) => {
            return score + (venueText.includes(term) ? 1 : 0);
          }, 0);
        };

        const venueScoreA = getVenueMatchScore(a);
        const venueScoreB = getVenueMatchScore(b);

        if (venueScoreA !== venueScoreB) {
          return venueScoreB - venueScoreA; // Higher venue match first
        }

        // Second priority: more recent dates (always prioritize newer)
        const dateDiff = dateB.getTime() - dateA.getTime();
        if (venueScoreA === 0 && venueScoreB === 0) {
          // If no venue matches, sort by date descending (newest first)
          return dateDiff;
        }

        // Third priority: setlists with more songs (indicates complete/better data)
        const getSongCount = (setlist: any) => {
          if (!setlist.sets?.set) return 0;
          return setlist.sets.set.reduce((total: number, set: any) => {
            return total + (set.song?.length || 0);
          }, 0);
        };

        const songsA = getSongCount(a);
        const songsB = getSongCount(b);
        
        if (songsA !== songsB) {
          return songsB - songsA; // More songs first
        }

        // Fourth priority: exact artist name match over partial matches
        const exactMatchA = a.artist.name.toLowerCase() === artistQuery.toLowerCase() ? 1 : 0;
        const exactMatchB = b.artist.name.toLowerCase() === artistQuery.toLowerCase() ? 1 : 0;
        
        if (exactMatchA !== exactMatchB) {
          return exactMatchB - exactMatchA;
        }

        // Final fallback: recent date (newest first)
        return dateB.getTime() - dateA.getTime();
      });

      const result = {
        type: 'setlists',
        itemsPerPage: 20,
        page: page,
        total: setlists.length,
        items: setlists,
      };

    logger.info('Successfully retrieved and sorted setlists', { 
      originalQuery,
      artistUsed: usedArtist?.name,
      totalSetlists: result.items.length,
      firstSetlistDate: result.items[0]?.eventDate,
      firstSetlistSongs: result.items[0]?.sets?.set?.reduce((total: number, set: any) => total + (set.song?.length || 0), 0) || 0
    });

    return result;
  }

  private isLocationQuery(query: string): boolean {
    const queryLower = query.toLowerCase().trim();
    const words = queryLower.split(/\s+/);
    
    // Common city names and location indicators
    const cityNames = [
      'london', 'manchester', 'birmingham', 'liverpool', 'leeds', 'glasgow', 'edinburgh', 'bristol', 'brighton',
      'new york', 'los angeles', 'chicago', 'boston', 'san francisco', 'seattle', 'portland', 'austin', 'denver',
      'paris', 'berlin', 'madrid', 'rome', 'amsterdam', 'barcelona', 'vienna', 'prague', 'dublin', 'stockholm',
      'toronto', 'montreal', 'vancouver', 'sydney', 'melbourne', 'tokyo', 'osaka'
    ];
    
    // If it's a known city (single or multi-word)
    if (cityNames.includes(queryLower)) {
      return true;
    }
    
    // If query contains location indicators
    const locationIndicators = ['city', 'venue', 'stadium', 'arena', 'hall', 'center', 'centre', 'theatre', 'theater', 'garden'];
    if (words.some(word => locationIndicators.includes(word))) {
      return true;
    }
    
    return false;
  }

  private async getSearchSuggestions(query: string): Promise<string[]> {
    try {
      const response = await axios.get('https://www.setlist.fm/opensearch', {
        params: { query },
        timeout: 5000,
      });
      
      // Response format: [query, [suggestions]]
      if (Array.isArray(response.data) && response.data.length >= 2 && Array.isArray(response.data[1])) {
        return response.data[1];
      }
      return [];
    } catch (error) {
      logger.warn('Failed to get search suggestions', { query, error: (error as Error).message });
      return [];
    }
  }

  private async executeSearchSuggestion(suggestion: string, page: number): Promise<SearchResult<any>> {
    // Parse suggestion format
    if (suggestion.startsWith('artist:(')) {
      // Format: "artist:(pulp) tour:(2011-2012 reunion tour)" or "artist:(pulp)"
      const match = suggestion.match(/^artist:\(([^)]+)\)/);
      if (match) {
        const artistName = match[1];
        return this.searchArtistByName(artistName, page);
      }
    }
    
    // For all other formats, try as artist name first
    return this.searchArtistByName(suggestion, page);
  }

  private async searchArtistByName(artistName: string, page: number): Promise<SearchResult<any>> {
    try {
      const artistSearchResponse = await axios.get(
        `${this.baseUrl}/search/artists`,
        {
          headers: this.getHeaders(),
          params: {
            artistName,
            p: 1,
          },
        }
      );

      const artists = artistSearchResponse.data.artist || [];
      if (artists.length === 0) {
        return {
          type: 'setlists',
          itemsPerPage: 20,
          page: page,
          total: 0,
          items: [],
        };
      }

      return this.getSetlistsFromArtists(artists, artistName, artistName, page);
    } catch (error: any) {
      // Return empty results for any error (including 404)
      return {
        type: 'setlists',
        itemsPerPage: 20,
        page: page,
        total: 0,
        items: [],
      };
    }
  }

  private async searchByVenue(query: string, page: number): Promise<SearchResult<any>> {
    try {
      // Search for venues matching the query
      const venueSearchResponse = await axios.get(
        `${this.baseUrl}/search/venues`,
        {
          headers: this.getHeaders(),
          params: {
            name: query,
            p: 1,
          },
        }
      );

      const venues = venueSearchResponse.data.venue || [];
      logger.info('Found venues for query', { query, venueCount: venues.length });

      if (venues.length === 0) {
        return {
          type: 'setlists',
          itemsPerPage: 20,
          page: page,
          total: 0,
          items: [],
        };
      }

      // Sort venues by relevance
      const sortedVenues = venues.sort((a: any, b: any) => {
        // 1. Exact name match first
        const exactMatchA = a.name.toLowerCase() === query.toLowerCase() ? 100 : 0;
        const exactMatchB = b.name.toLowerCase() === query.toLowerCase() ? 100 : 0;
        if (exactMatchA !== exactMatchB) return exactMatchB - exactMatchA;
        
        // 2. Name starts with query
        const startsWithA = a.name.toLowerCase().startsWith(query.toLowerCase()) ? 50 : 0;
        const startsWithB = b.name.toLowerCase().startsWith(query.toLowerCase()) ? 50 : 0;
        if (startsWithA !== startsWithB) return startsWithB - startsWithA;
        
        // 3. Contains all words from query
        const queryWords = query.toLowerCase().split(/\s+/);
        const containsAllA = queryWords.every(word => a.name.toLowerCase().includes(word)) ? 25 : 0;
        const containsAllB = queryWords.every(word => b.name.toLowerCase().includes(word)) ? 25 : 0;
        return containsAllB - containsAllA;
      });

      // Get setlists for the best matching venue
      const firstVenue = sortedVenues[0];
      const setlistResponse = await axios.get(
        `${this.baseUrl}/search/setlists`,
        {
          headers: this.getHeaders(),
          params: {
            venueId: firstVenue.id,
            p: page,
          },
        }
      );

      const setlists = setlistResponse.data.setlist || [];
      
      // Sort by date descending (newest first)
      setlists.sort((a: any, b: any) => {
        const parseDate = (dateStr: string) => {
          const [day, month, year] = dateStr.split('-').map(Number);
          return new Date(year, month - 1, day);
        };
        const dateA = parseDate(a.eventDate);
        const dateB = parseDate(b.eventDate);
        return dateB.getTime() - dateA.getTime();
      });

      logger.info('Found setlists for venue', { 
        venue: firstVenue.name,
        setlistCount: setlists.length 
      });

      return {
        type: setlistResponse.data.type || 'setlists',
        itemsPerPage: setlistResponse.data.itemsPerPage || 20,
        page: setlistResponse.data.page || page,
        total: setlistResponse.data.total || 0,
        items: setlists,
      };
    } catch (error: any) {
      logger.error('Error searching by venue', { error: error.message, query });
      return {
        type: 'setlists',
        itemsPerPage: 20,
        page: page,
        total: 0,
        items: [],
      };
    }
  }

  async getSetlistById(setlistId: string): Promise<Setlist> {
    try {
      const response = await axios.get(
        `${this.baseUrl}/setlist/${setlistId}`,
        {
          headers: this.getHeaders(),
        }
      );

      return response.data;
    } catch (error) {
      logger.error('Error getting setlist by ID', { error, setlistId });
      throw new Error('Failed to get setlist');
    }
  }
}