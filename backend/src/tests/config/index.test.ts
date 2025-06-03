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
      delete process.env.SPOTIFY_REDIRECT_URI;

      // Mock successful responses
      mockSend
        .mockResolvedValueOnce({ SecretString: 'secret-setlist-key' })
        .mockResolvedValueOnce({ SecretString: 'secret-spotify-id' })
        .mockResolvedValueOnce({ SecretString: 'secret-spotify-secret' })
        .mockResolvedValueOnce({ SecretString: 'secret-spotify-redirect' });

      const { config, validateConfig } = await import('../../config/index');

      await expect(validateConfig()).resolves.not.toThrow();

      expect(mockSend).toHaveBeenCalledTimes(4);
      expect(config.setlistFm.apiKey).toBe('secret-setlist-key');
      expect(config.spotify.clientId).toBe('secret-spotify-id');
      expect(config.spotify.clientSecret).toBe('secret-spotify-secret');
      expect(config.spotify.redirectUri).toBe('secret-spotify-redirect');
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

  });
});