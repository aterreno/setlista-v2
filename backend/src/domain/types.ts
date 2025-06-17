export interface Artist {
  id: string;
  name: string;
  sortName: string;
  url?: string;
  mbid?: string; // Unique MusicBrainz ID for the artist, needed for setlist.fm API
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
    set: SetlistSet[];
  };
  url: string;
}

export enum SearchType {
  ARTIST = 'artist',
  VENUE = 'venue',
  CITY = 'city',
  FESTIVAL = 'festival'
}

export interface SearchResult<T> {
  type: string;
  itemsPerPage: number;
  page: number;
  total: number;
  items: T[];
  searchType?: SearchType; // Indicates what type of search was performed
  searchQuery?: string;   // The original search query
}

export interface SetlistSet {
  name?: string;
  encore?: number;
  song: Song[];
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: ApiError;
}

export interface ApiError {
  message: string;
  code: string;
  statusCode: number;
}

export interface HttpError extends Error {
  response?: {
    status: number;
    data: unknown;
  };
}