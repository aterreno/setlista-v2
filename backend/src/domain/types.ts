export interface Artist {
  id: string;
  name: string;
  sortName: string;
  url?: string;
}

export interface Venue {
  id: string;
  name: string;
  city: {
    id: string;
    name: string;
    country: {
      code: string;
      name: string;
    };
  };
  url?: string;
}

export interface Song {
  name: string;
  info?: string;
  cover?: {
    name: string;
    mbid?: string;
  };
}

export interface Setlist {
  id: string;
  eventDate: string;
  artist: Artist;
  venue: Venue;
  tour?: {
    name: string;
  };
  sets: {
    set: Array<{
      name?: string;
      encore?: number;
      song: Song[];
    }>;
  };
  url: string;
}

export interface SearchResult<T> {
  type: string;
  itemsPerPage: number;
  page: number;
  total: number;
  items: T[];
}