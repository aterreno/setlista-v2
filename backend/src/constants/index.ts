// API Configuration
export const API_ENDPOINTS = {
  SETLIST_FM: {
    BASE_URL: 'https://api.setlist.fm/rest/1.0',
    OPENSEARCH: 'https://www.setlist.fm/opensearch',
  },
  SPOTIFY: {
    BASE_URL: 'https://api.spotify.com/v1',
    AUTH_URL: 'https://accounts.spotify.com/authorize',
    TOKEN_URL: 'https://accounts.spotify.com/api/token',
  },
} as const;

// Timeouts (in milliseconds)
export const TIMEOUTS = {
  SPOTIFY_API: 30000,
  SETLIST_FM_API: 5000,
  DEFAULT_API: 10000,
} as const;

// Pagination
export const PAGINATION = {
  DEFAULT_ITEMS_PER_PAGE: 20,
  MAX_PAGES_TO_FETCH: 10,
} as const;

// Retry Configuration
export const RETRY_CONFIG = {
  MAX_RETRIES: 3,
  RETRY_DELAY: 1000,
  BATCH_SIZE: 5,
  BATCH_DELAY: 500,
} as const;

// Search Configuration
export const SEARCH_CONFIG = {
  MIN_SEARCH_LENGTH: 3,
  MAX_QUERY_LENGTH: 200,
  DEBOUNCE_DELAY: 500,
  MAX_ARTIST_ATTEMPTS: 5,
} as const;

// Validation
export const VALIDATION = {
  ID_REGEX: /^[a-zA-Z0-9\-_]+$/,
  MALICIOUS_CHARS_REGEX: /[;|&$`{}[\]\\]/,
  DATE_FORMATS: {
    DD_MM_YYYY: /^\d{2}-\d{2}-\d{4}$/,
    YYYY_MM_DD: /^\d{4}-\d{2}-\d{2}$/,
  },
} as const;

// Spotify Configuration
export const SPOTIFY_CONFIG = {
  SCOPES: [
    'user-read-private',
    'user-read-email',
    'playlist-modify-public',
    'playlist-modify-private',
  ],
  SEARCH_LIMIT: 5,
} as const;

// Server Configuration
export const SERVER_CONFIG = {
  DEFAULT_PORT: 3001,
  DEFAULT_LOG_LEVEL: 'info',
} as const;

// AWS Configuration
export const AWS_CONFIG = {
  DEFAULT_REGION: 'us-east-1',
  LAMBDA: {
    TIMEOUT_SECONDS: 30,
    MEMORY_SIZE: 256,
    RUNTIME: 'nodejs18.x',
    LOG_RETENTION_DAYS: 7,
  },
} as const;

// Text Filtering
export const TEXT_FILTERS = {
  VENUE_STOP_WORDS: ['setlist', 'at', 'the', 'and', 'in', 'on'] as readonly string[],
} as const;

// Date Formatting
export const DATE_FORMAT_OPTIONS = {
  LONG_DATE: {
    year: 'numeric' as const,
    month: 'long' as const,
    day: 'numeric' as const,
  },
} as const;

// Coverage Thresholds (for testing)
export const COVERAGE_THRESHOLDS = {
  BRANCHES: 60,
  FUNCTIONS: 80,
  LINES: 80,
  STATEMENTS: 80,
} as const;