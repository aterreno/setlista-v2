import dotenv from 'dotenv';
import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';

// Load environment variables from .env file
dotenv.config();

const isProduction = process.env.NODE_ENV === 'production';
const secretsClient = isProduction ? new SecretsManagerClient({ region: 'us-east-1' }) : null;

// Function to get secret from AWS Secrets Manager
async function getSecret(secretName: string): Promise<string> {
  if (!isProduction || !secretsClient) {
    return '';
  }

  try {
    const command = new GetSecretValueCommand({ SecretId: secretName });
    const response = await secretsClient.send(command);
    return response.SecretString || '';
  } catch (error) {
    console.error(`Error retrieving secret ${secretName}:`, error);
    throw error;
  }
}

// Configuration object - will be populated with secrets in production
const config = {
  server: {
    port: process.env.PORT || 3001,
    nodeEnv: process.env.NODE_ENV || 'development',
  },
  setlistFm: {
    apiKey: process.env.SETLIST_FM_API_KEY || '',
    baseUrl: 'https://api.setlist.fm/rest/1.0',
  },
  spotify: {
    clientId: process.env.SPOTIFY_CLIENT_ID || '',
    clientSecret: process.env.SPOTIFY_CLIENT_SECRET || '',
    redirectUri: process.env.SPOTIFY_REDIRECT_URI || 'http://localhost:3000/auth/callback',
  },
  logging: {
    level: process.env.LOG_LEVEL || 'info',
  },
};

// Load secrets from AWS Secrets Manager in production
async function loadSecrets() {
  if (isProduction) {
    try {
      config.setlistFm.apiKey = await getSecret('setlista/setlistfm-api-key');
      config.spotify.clientId = await getSecret('setlista/spotify-client-id');
      config.spotify.clientSecret = await getSecret('setlista/spotify-client-secret');
    } catch (error) {
      console.error('Error loading secrets:', error);
      throw error;
    }
  }
}

// Validate required configuration
const validateConfig = async () => {
  // Load secrets first if in production
  await loadSecrets();

  const requiredConfigs = [
    { key: 'setlistFm.apiKey', value: config.setlistFm.apiKey },
    { key: 'spotify.clientId', value: config.spotify.clientId },
    { key: 'spotify.clientSecret', value: config.spotify.clientSecret },
  ];

  const missingConfigs = requiredConfigs.filter(
    (configItem) => !configItem.value
  );

  if (missingConfigs.length > 0) {
    throw new Error(
      `Missing required configuration: ${missingConfigs.map(c => c.key).join(', ')}`
    );
  }
};

export { config, validateConfig };