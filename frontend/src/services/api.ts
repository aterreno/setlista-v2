import axios from 'axios';
import { Artist, SearchResult, Setlist, SpotifyPlaylist, SetlistWithSongs, HttpError } from '../types/index.ts';
import { API_CONFIG } from '../constants';

const API_URL = process.env.REACT_APP_API_URL || API_CONFIG.DEFAULT_BASE_URL;

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: API_CONFIG.TIMEOUT,
});

// Request interceptor for debugging
api.interceptors.request.use(
  (config) => {
    console.log(`Making API request to: ${config.baseURL}${config.url}`);
    return config;
  },
  (error) => {
    console.error('Request error:', error);
    return Promise.reject(error);
  }
);

// Response interceptor for better error handling
api.interceptors.response.use(
  (response) => response,
  (error: unknown) => {
    const httpError = error as HttpError;
    console.error('API Error:', httpError.response?.data || httpError.message);
    return Promise.reject(httpError);
  }
);

// Artists
export const searchArtists = async (name: string, page = 1): Promise<SearchResult<Artist>> => {
  const response = await api.get('/artists/search', {
    params: { name, page },
  });
  return response.data;
};

// Setlists
export const searchSetlists = async (query: string, page = 1): Promise<SearchResult<Setlist>> => {
  const response = await api.get('/setlists/search', {
    params: { q: query, page },
  });
  return response.data;
};

export const getArtistSetlists = async (artistId: string, page = 1): Promise<SearchResult<Setlist>> => {
  const response = await api.get(`/setlists/artist/${artistId}`, {
    params: { page },
  });
  return response.data;
};

export const getSetlistById = async (setlistId: string): Promise<SetlistWithSongs> => {
  const response = await api.get(`/setlists/${setlistId}`);
  return response.data;
};

// Spotify
export const getSpotifyAuthUrl = async (): Promise<{ authUrl: string }> => {
  const response = await api.get('/spotify/auth');
  return response.data;
};

export const createPlaylistFromSetlist = async (
  setlistId: string,
  accessToken: string
): Promise<{ playlist: SpotifyPlaylist }> => {
  const response = await api.post(`/spotify/playlist/setlist/${setlistId}`, {
    access_token: accessToken,
  });
  return response.data;
};