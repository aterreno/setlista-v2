import axios from 'axios';

// Define base URL for API calls - this should be configured in environment variables
// In local development, we'll call localhost:3001 where the backend is running
// In production, this will be the CloudFront URL or domain name
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

// Create axios instance with default config
const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Types
export interface Artist {
  mbid: string;
  name: string;
  sortName: string;
  url: string;
}

export interface Venue {
  name: string;
  city: {
    name: string;
    country: {
      name: string;
      code: string;
    };
  };
}

export interface Tour {
  name: string;
}

export interface Song {
  name: string;
  info?: string;
  tape?: boolean;
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
  tour?: Tour;
  sets?: {
    set: {
      name?: string;
      song: Song[];
    }[];
  };
}

export interface SearchResponse {
  type: string;
  itemsPerPage: number;
  page: number;
  total: number;
  items: Setlist[];
}

// API Functions
export const searchArtists = async (query: string) => {
  const response = await apiClient.get(`/api/artists/search?q=${encodeURIComponent(query)}`);
  return response.data;
};

export const searchSetlists = async (query: string, page = 1) => {
  const response = await apiClient.get(`/api/setlists/search?q=${encodeURIComponent(query)}&page=${page}`);
  return response.data as SearchResponse;
};

export const getArtistSetlists = async (artistId: string, page = 1) => {
  const response = await apiClient.get(`/api/setlists/artist/${artistId}?page=${page}`);
  return response.data as SearchResponse;
};

export interface SetlistDetailResponse {
  setlist: Setlist;
  songs: any[];
}

export const getSetlistById = async (setlistId: string) => {
  const response = await apiClient.get(`/api/setlists/${setlistId}`);
  return response.data as SetlistDetailResponse;
};

// Spotify integration
export const getSpotifyAuthUrl = async () => {
  const response = await apiClient.get('/api/spotify/auth');
  return response.data.authUrl;
};

export const createSpotifyPlaylist = async (setlistId: string, token: string) => {
  const response = await apiClient.post(
    `/api/spotify/playlist/setlist/${setlistId}`, 
    {
      access_token: token // Send token in request body
    }
  );
  return response.data;
};

interface SpotifyCallbackResponse {
  accessToken: string;
  refreshToken?: string;
  expiresIn?: number;
  success: boolean;
}

export const handleSpotifyCallback = async (code: string, state: string): Promise<SpotifyCallbackResponse> => {
  // Backend expects query parameters, not a POST body
  const response = await apiClient.get(`/api/spotify/callback?code=${encodeURIComponent(code)}&state=${encodeURIComponent(state)}`);
  return response.data;
};
