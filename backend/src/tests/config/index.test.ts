// Mock dotenv to prevent loading .env file
jest.mock('dotenv', () => ({
  config: jest.fn(),
}));

// Mock AWS SDK before any imports
const mockSend = jest.fn();

jest.mock('@aws-sdk/client-secrets-manager', () => {
  const MockSecretsManagerClient = jest.fn().mockImplementation(() => ({
    send: mockSend,
  }));
  
  return {
    SecretsManagerClient: MockSecretsManagerClient,
    GetSecretValueCommand: jest.fn().mockImplementation((params) => params),
  };
});

describe('Config', () => {
  let originalEnv: typeof process.env;
  let consoleSpy: jest.SpyInstance;

  beforeEach(() => {
    // Store original environment
    originalEnv = { ...process.env };
    
    // Mock console.error
    consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    
    // Reset modules to get fresh config
    jest.resetModules();
    jest.clearAllMocks();
  });

  afterEach(() => {
    // Restore original environment
    process.env = originalEnv;
    
    // Restore console
    consoleSpy.mockRestore();
  });

  describe('development environment', () => {
    beforeEach(() => {
      process.env.NODE_ENV = 'development';
      process.env.PORT = '4000';
      process.env.SETLIST_FM_API_KEY = 'test-setlist-key';
      process.env.SPOTIFY_CLIENT_ID = 'test-spotify-id';
      process.env.SPOTIFY_CLIENT_SECRET = 'test-spotify-secret';
      process.env.SPOTIFY_REDIRECT_URI = 'http://test.com/callback';
      process.env.LOG_LEVEL = 'debug';
    });

    it('should load configuration from environment variables', async () => {
      const { config } = await import('../../config/index');

      expect(config.server.port).toBe('4000');
      expect(config.server.nodeEnv).toBe('development');
      expect(config.setlistFm.apiKey).toBe('test-setlist-key');
      expect(config.setlistFm.baseUrl).toBe('https://api.setlist.fm/rest/1.0');
      expect(config.spotify.clientId).toBe('test-spotify-id');
      expect(config.spotify.clientSecret).toBe('test-spotify-secret');
      expect(config.spotify.redirectUri).toBe('http://test.com/callback');
      expect(config.logging.level).toBe('debug');
    });

    it('should use default values when environment variables are not set', async () => {
      // Clear all environment variables
      delete process.env.PORT;
      delete process.env.SETLIST_FM_API_KEY;
      delete process.env.SPOTIFY_CLIENT_ID;
      delete process.env.SPOTIFY_CLIENT_SECRET;
      delete process.env.SPOTIFY_REDIRECT_URI;
      delete process.env.LOG_LEVEL;

      const { config } = await import('../../config/index');

      expect(config.server.port).toBe(3001);
      expect(config.server.nodeEnv).toBe('development');
      expect(config.spotify.redirectUri).toBe('http://localhost:3000/api/spotify/callback');
      expect(config.logging.level).toBe('info');
    });

    it('should validate configuration successfully', async () => {
      const { validateConfig } = await import('../../config/index');
      await expect(validateConfig()).resolves.not.toThrow();
    });

    it('should throw error when required configuration is missing in development', async () => {
      // Clear required environment variables but keep NODE_ENV as development
      process.env.NODE_ENV = 'development';
      delete process.env.SETLIST_FM_API_KEY;
      delete process.env.SPOTIFY_CLIENT_ID;
      delete process.env.SPOTIFY_CLIENT_SECRET;

      const { validateConfig } = await import('../../config/index');

      await expect(validateConfig()).rejects.toThrow(
        'Missing required configuration'
      );
    });
  });

  describe('production environment', () => {
    it('should load secrets from AWS Secrets Manager', async () => {
      // Set production environment BEFORE importing
      process.env.NODE_ENV = 'production';
      delete process.env.SETLIST_FM_API_KEY;
      delete process.env.SPOTIFY_CLIENT_ID;
      delete process.env.SPOTIFY_CLIENT_SECRET;

      // Mock successful responses
      mockSend
        .mockResolvedValueOnce({ SecretString: 'secret-setlist-key' })
        .mockResolvedValueOnce({ SecretString: 'secret-spotify-id' })
        .mockResolvedValueOnce({ SecretString: 'secret-spotify-secret' });

      const { config, validateConfig } = await import('../../config/index');

      await expect(validateConfig()).resolves.not.toThrow();

      expect(mockSend).toHaveBeenCalledTimes(3);
      expect(config.setlistFm.apiKey).toBe('secret-setlist-key');
      expect(config.spotify.clientId).toBe('secret-spotify-id');
      expect(config.spotify.clientSecret).toBe('secret-spotify-secret');
    });

    it('should handle secrets manager errors', async () => {
      process.env.NODE_ENV = 'production';
      delete process.env.SETLIST_FM_API_KEY;
      delete process.env.SPOTIFY_CLIENT_ID;
      delete process.env.SPOTIFY_CLIENT_SECRET;

      const error = new Error('Secrets Manager error');
      mockSend.mockRejectedValue(error);

      const { validateConfig } = await import('../../config/index');

      await expect(validateConfig()).rejects.toThrow();
      expect(consoleSpy).toHaveBeenCalled();
    });

    it('should handle empty secret values', async () => {
      process.env.NODE_ENV = 'production';
      delete process.env.SETLIST_FM_API_KEY;
      delete process.env.SPOTIFY_CLIENT_ID;
      delete process.env.SPOTIFY_CLIENT_SECRET;

      mockSend
        .mockResolvedValueOnce({ SecretString: '' })
        .mockResolvedValueOnce({ SecretString: 'secret-spotify-id' })
        .mockResolvedValueOnce({ SecretString: 'secret-spotify-secret' });

      const { validateConfig } = await import('../../config/index');

      await expect(validateConfig()).rejects.toThrow(
        'Missing required configuration'
      );
    });

    it('should handle undefined SecretString', async () => {
      process.env.NODE_ENV = 'production';
      delete process.env.SETLIST_FM_API_KEY;
      delete process.env.SPOTIFY_CLIENT_ID;
      delete process.env.SPOTIFY_CLIENT_SECRET;

      mockSend
        .mockResolvedValueOnce({}) // No SecretString property
        .mockResolvedValueOnce({ SecretString: 'secret-spotify-id' })
        .mockResolvedValueOnce({ SecretString: 'secret-spotify-secret' });

      const { validateConfig } = await import('../../config/index');

      await expect(validateConfig()).rejects.toThrow(
        'Missing required configuration'
      );
    });
  });
});