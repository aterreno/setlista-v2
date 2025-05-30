import { ArtistService } from '../../../domain/services/artist-service';
import { SetlistRepository } from '../../../domain/repositories/setlist-repository';
import { Artist, SearchResult } from '../../../domain/types';

// Mock repository
class MockSetlistRepository implements SetlistRepository {
  private mockArtists: Artist[] = [
    {
      id: '123',
      name: 'Test Artist',
      sortName: 'Artist, Test',
      url: 'https://www.setlist.fm/setlists/test-artist-123.html',
    },
  ];

  async searchArtists(artistName: string, page = 1): Promise<SearchResult<Artist>> {
    const filteredArtists = this.mockArtists.filter((artist) =>
      artist.name.toLowerCase().includes(artistName.toLowerCase())
    );

    return {
      type: 'artists',
      itemsPerPage: 20,
      page,
      total: filteredArtists.length,
      items: filteredArtists,
    };
  }

  async getArtistSetlists() {
    return { type: 'setlists', itemsPerPage: 20, page: 1, total: 0, items: [] };
  }

  async searchSetlists(query: string, page = 1) {
    return { type: 'setlists', itemsPerPage: 20, page, total: 0, items: [] };
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async getSetlistById(_setlistId: string): Promise<any> {
    throw new Error('Not implemented for this test');
  }
}

describe('ArtistService', () => {
  let artistService: ArtistService;
  let mockRepository: SetlistRepository;

  beforeEach(() => {
    mockRepository = new MockSetlistRepository();
    artistService = new ArtistService(mockRepository);
  });

  describe('searchArtists', () => {
    it('should return artists matching the search term', async () => {
      const result = await artistService.searchArtists('Test');
      expect(result.items.length).toBe(1);
      expect(result.items[0].name).toBe('Test Artist');
    });

    it('should return empty array when no artists match', async () => {
      const result = await artistService.searchArtists('Unknown');
      expect(result.items.length).toBe(0);
    });

    it('should throw error when name is empty', async () => {
      await expect(artistService.searchArtists('')).rejects.toThrow('Artist name is required');
    });
  });
});