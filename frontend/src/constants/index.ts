// API Configuration
export const API_CONFIG = {
  DEFAULT_BASE_URL: 'http://localhost:3001/api',
  TIMEOUT: 10000,
} as const;

// Search Configuration
export const SEARCH_CONFIG = {
  MIN_LENGTH: 3,
  DEBOUNCE_DELAY: 500,
} as const;

// Pagination
export const PAGINATION = {
  DEFAULT_ITEMS_PER_PAGE: 20,
} as const;

// Date Formatting
export const DATE_FORMAT_OPTIONS = {
  LONG_DATE: {
    year: 'numeric' as const,
    month: 'long' as const,
    day: 'numeric' as const,
  },
} as const;

// Validation
export const VALIDATION = {
  DATE_FORMATS: {
    DD_MM_YYYY: /^\d{2}-\d{2}-\d{4}$/,
    YYYY_MM_DD: /^\d{4}-\d{2}-\d{2}$/,
  },
} as const;