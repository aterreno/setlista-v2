import { Artist, SearchResult } from '../types';
import { SetlistRepository } from '../repositories/setlist-repository';

export class ArtistService {
  constructor(private readonly setlistRepository: SetlistRepository) {}

  async searchArtists(name: string, page = 1): Promise<SearchResult<Artist>> {
    if (!name || name.trim() === '') {
      throw new Error('Artist name is required');
    }

    return this.setlistRepository.searchArtists(name, page);
  }
}