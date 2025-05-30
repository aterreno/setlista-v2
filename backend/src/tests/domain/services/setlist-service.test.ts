import { SetlistService } from '../../../domain/services/setlist-service';
import { SetlistRepository } from '../../../domain/repositories/setlist-repository';
import { SearchResult, Setlist } from '../../../domain/types';

// Mock repository
class MockSetlistRepository implements SetlistRepository {
  private mockSetlist: Setlist = {
    id: 'abc123',
    eventDate: '2023-01-01',
    artist: {
      id: '123',
      name: 'Test Artist',
      sortName: 'Artist, Test',
    },
    venue: {
      id: 'venue1',
      name: 'Test Venue',
      city: {
        id: 'city1',
        name: 'Test City',
        country: {
          code: 'US',
          name: 'United States',
        },
      },
    },
    sets: {
      set: [
        {
          song: [
            { name: 'Song 1' },
            { name: 'Song 2' },
            { name: 'Song 3' },
          ],
        },
        {
          name: 'Encore',
          encore: 1,
          song: [
            { name: 'Song 4' },
            { name: 'Song 5' },
          ],
        },
      ],
    },
    url: 'https://www.setlist.fm/setlist/test-artist/2023/test-venue-test-city-abc123.html',
  };

  async searchArtists() {
    return { type: 'artists', itemsPerPage: 20, page: 1, total: 0, items: [] };
  }

  async searchSetlists(query: string, page = 1): Promise<SearchResult<Setlist>> {
    return {
      type: 'setlists',
      itemsPerPage: 20,
      page,
      total: 0,
      items: [],
    };
  }

  async getArtistSetlists(artistId: string, page = 1): Promise<SearchResult<Setlist>> {
    if (artistId === '123') {
      return {
        type: 'setlists',
        itemsPerPage: 20,
        page,
        total: 1,
        items: [this.mockSetlist],
      };
    }
    return {
      type: 'setlists',
      itemsPerPage: 20,
      page,
      total: 0,
      items: [],
    };
  }

  async getSetlistById(setlistId: string): Promise<Setlist> {
    if (setlistId === 'abc123') {
      return this.mockSetlist;
    }
    throw new Error('Setlist not found');
  }
}

describe('SetlistService', () => {
  let setlistService: SetlistService;
  let mockRepository: SetlistRepository;

  beforeEach(() => {
    mockRepository = new MockSetlistRepository();
    setlistService = new SetlistService(mockRepository);
  });

  describe('getArtistSetlists', () => {
    it('should return setlists for valid artist ID', async () => {
      const result = await setlistService.getArtistSetlists('123');
      expect(result.items.length).toBe(1);
      expect(result.items[0].artist.name).toBe('Test Artist');
    });

    it('should return empty array for unknown artist ID', async () => {
      const result = await setlistService.getArtistSetlists('unknown');
      expect(result.items.length).toBe(0);
    });

    it('should throw error when artist ID is empty', async () => {
      await expect(setlistService.getArtistSetlists('')).rejects.toThrow('Artist ID is required');
    });
  });

  describe('getSetlistById', () => {
    it('should return setlist for valid ID', async () => {
      const result = await setlistService.getSetlistById('abc123');
      expect(result.id).toBe('abc123');
      expect(result.artist.name).toBe('Test Artist');
    });

    it('should throw error for unknown setlist ID', async () => {
      await expect(setlistService.getSetlistById('unknown')).rejects.toThrow('Setlist not found');
    });

    it('should throw error when setlist ID is empty', async () => {
      await expect(setlistService.getSetlistById('')).rejects.toThrow('Setlist ID is required');
    });
  });

  describe('extractSongsFromSetlist', () => {
    it('should extract all songs from setlist', async () => {
      const setlist = await setlistService.getSetlistById('abc123');
      const songs = setlistService.extractSongsFromSetlist(setlist);
      
      expect(songs.length).toBe(5);
      expect(songs[0].name).toBe('Song 1');
      expect(songs[4].name).toBe('Song 5');
    });
  });
});