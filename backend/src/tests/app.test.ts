import request from 'supertest';

// Mock all dependencies
jest.mock('../config', () => ({
  config: {
    server: {
      port: 3001,
      nodeEnv: 'test'
    },
    logging: {
      level: 'info'
    },
    setlistFm: {
      baseUrl: 'https://api.setlist.fm/rest/1.0',
      apiKey: 'test-api-key'
    },
    spotify: {
      clientId: 'test-client-id',
      clientSecret: 'test-client-secret',
      redirectUri: 'http://localhost:3000/callback'
    }
  },
  validateConfig: jest.fn().mockResolvedValue(undefined)
}));

jest.mock('../routes', () => ({
  createRoutes: jest.fn(() => {
    const express = require('express');
    return express.Router();
  })
}));
jest.mock('../utils/logger');

describe('App', () => {
  let app: any;

  beforeEach(async () => {
    jest.clearAllMocks();
    jest.resetModules();
    
    // Import app after mocks are set up
    const appModule = await import('../app');
    app = appModule.createApp();
  });

  it('should create Express application', () => {
    expect(app).toBeDefined();
    expect(typeof app).toBe('function'); // Express app is a function
  });

  it('should handle CORS preflight requests', async () => {
    const response = await request(app)
      .options('/api/test')
      .set('Origin', 'http://localhost:3000')
      .set('Access-Control-Request-Method', 'GET');
    
    expect(response.status).toBe(204);
    expect(response.headers['access-control-allow-origin']).toBe('*');
  });

  it('should parse JSON bodies', async () => {
    // This will hit our catch-all route and return 404, but JSON parsing should work
    const response = await request(app)
      .post('/api/test')
      .send({ test: 'data' });
    
    // Should not error on JSON parsing (would be 400 if parsing failed)
    expect(response.status).toBe(404);
  });

  it('should handle health check endpoint', async () => {
    const response = await request(app).get('/health');
    
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ 
      status: 'ok'
    });
  });

  it('should return 404 for undefined routes', async () => {
    const response = await request(app).get('/nonexistent');
    expect(response.status).toBe(404);
  });

  it('should handle errors with error middleware', async () => {
    // Force an error by making a request that would trigger error handling
    const response = await request(app).get('/api/force-error');
    
    // Should handle the error gracefully
    expect(response.status).toBeGreaterThanOrEqual(400);
  });
});