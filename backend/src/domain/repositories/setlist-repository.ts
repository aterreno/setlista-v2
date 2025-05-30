import { Artist, SearchResult, Setlist } from '../types';

export interface SetlistRepository {
  searchArtists(artistName: string, page?: number): Promise<SearchResult<Artist>>;
  searchSetlists(query: string, page?: number): Promise<SearchResult<Setlist>>;
  getArtistSetlists(artistId: string, page?: number): Promise<SearchResult<Setlist>>;
  getSetlistById(setlistId: string): Promise<Setlist>;
}