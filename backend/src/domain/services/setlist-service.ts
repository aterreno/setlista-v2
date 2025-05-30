import { SearchResult, Setlist, Song } from '../types';
import { SetlistRepository } from '../repositories/setlist-repository';

export class SetlistService {
  constructor(private readonly setlistRepository: SetlistRepository) {}

  async searchSetlists(query: string, page = 1): Promise<SearchResult<Setlist>> {
    if (!query || query.trim() === '') {
      throw new Error('Search query is required');
    }

    return this.setlistRepository.searchSetlists(query, page);
  }

  async getArtistSetlists(artistId: string, page = 1): Promise<SearchResult<Setlist>> {
    if (!artistId || artistId.trim() === '') {
      throw new Error('Artist ID is required');
    }

    return this.setlistRepository.getArtistSetlists(artistId, page);
  }

  async getSetlistById(setlistId: string): Promise<Setlist> {
    if (!setlistId || setlistId.trim() === '') {
      throw new Error('Setlist ID is required');
    }

    return this.setlistRepository.getSetlistById(setlistId);
  }

  extractSongsFromSetlist(setlist: Setlist): Song[] {
    const songs: Song[] = [];

    if (setlist.sets && setlist.sets.set) {
      for (const set of setlist.sets.set) {
        if (set.song) {
          songs.push(...set.song);
        }
      }
    }

    return songs;
  }
}