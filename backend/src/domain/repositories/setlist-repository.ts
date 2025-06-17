import { Artist, SearchResult, Setlist } from '../types';

// Supported search types
export type SearchType = 'artist' | 'festival' | 'location';

export interface SetlistRepository {
  /**
   * Search for artists by name
   */
  searchArtists(artistName: string, page?: number): Promise<SearchResult<Artist>>;
  
  /**
   * Search for setlists with automatic type detection
   * Will search across artists, festivals, and locations and return the best matches
   */
  searchSetlists(query: string, page?: number): Promise<SearchResult<Setlist>>;
  
  /**
   * Get setlists for a specific artist by ID
   */
  getArtistSetlists(artistId: string, page?: number): Promise<SearchResult<Setlist>>;
  
  /**
   * Get a specific setlist by its ID
   */
  getSetlistById(setlistId: string): Promise<Setlist>;
}