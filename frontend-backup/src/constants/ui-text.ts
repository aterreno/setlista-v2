// UI Text Constants - Move to i18n system later
export const UI_TEXT = {
  SEARCH: {
    PLACEHOLDER: 'Enter artist name or artist + city',
    INSTRUCTIONS: 'Create a playlist on spotify by searching for your favorite artists and their recent concerts.',
    HINT: 'Type at least 3 characters to search...',
    NO_RESULTS: 'No concerts or artists found for "{query}". Try a different search term.',
    LOADING: '🎵 Searching for concerts...',
    ERROR: 'Error searching for concerts. Please try again.',
  },
  SETLISTS: {
    LOADING: '🎤 Loading setlists...',
    ERROR: 'Error loading setlists. Please try again.',
    NO_RESULTS: 'No setlists found for this artist.',
    RECENT_CONCERTS: 'Recent Concerts',
  },
  BUTTONS: {
    VIEW_SETLIST: 'View Setlist',
    CREATE_PLAYLIST: 'Create Spotify Playlist',
    LOGIN_SPOTIFY: 'Login with Spotify',
    PREVIOUS: 'Previous',
    NEXT: 'Next',
  },
  SPOTIFY: {
    LOGIN_MESSAGE: 'Login to Spotify to create playlists from setlists',
    CREATING_PLAYLIST: 'Creating Spotify playlist...',
    PLAYLIST_CREATED: 'Playlist created successfully!',
    ERROR: 'Error creating Spotify playlist. Please try again.',
  },
  NAVIGATION: {
    PAGE_INFO: 'Page {current} of {total}',
  },
  LABELS: {
    TOUR: 'Tour: {tourName}',
    DATE: 'Date',
    VENUE: 'Venue',
    CITY: 'City',
    COUNTRY: 'Country',
  },
} as const;

// Helper function to replace placeholders in text
export function formatText(text: string, replacements: Record<string, string | number>): string {
  return Object.entries(replacements).reduce(
    (result, [key, value]) => result.replace(`{${key}}`, String(value)),
    text
  );
}