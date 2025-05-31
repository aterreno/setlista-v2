import { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';

// Mock serverless-http
const mockHandler = jest.fn().mockResolvedValue({
  statusCode: 200,
  body: JSON.stringify({ message: 'success' })
} as APIGatewayProxyResult);

const mockServerlessHttp = jest.fn(() => mockHandler);

jest.mock('serverless-http', () => mockServerlessHttp);

// Mock the app
jest.mock('../app', () => ({
  createApp: jest.fn(() => 'mock-app')
}));

// Mock config validation and config object
jest.mock('../config', () => ({
  validateConfig: jest.fn().mockResolvedValue(undefined),
  config: {
    logging: {
      level: 'info'
    },
    server: {
      nodeEnv: 'test'
    }
  }
}));

describe('Lambda Handler', () => {
  let handler: any;
  let mockEvent: APIGatewayProxyEvent;
  let mockContext: Context;

  beforeEach(async () => {
    jest.clearAllMocks();
    jest.resetModules();
    
    // Import handler after mocks are set up
    const lambdaModule = await import('../lambda');
    handler = lambdaModule.lambdaHandler;
    
    // Create mock event and context
    mockEvent = {
      httpMethod: 'GET',
      path: '/api/test',
      headers: {},
      queryStringParameters: null,
      body: null,
      isBase64Encoded: false,
      pathParameters: null,
      stageVariables: null,
      requestContext: {} as any,
      multiValueHeaders: {},
      multiValueQueryStringParameters: null,
      resource: ''
    };
    
    mockContext = {
      callbackWaitsForEmptyEventLoop: false,
      functionName: 'test-function',
      functionVersion: '1',
      invokedFunctionArn: 'arn:aws:lambda:us-east-1:123456789012:function:test',
      memoryLimitInMB: '128',
      awsRequestId: 'test-request-id',
      logGroupName: '/aws/lambda/test',
      logStreamName: 'test-stream',
      getRemainingTimeInMillis: () => 30000,
      done: jest.fn(),
      fail: jest.fn(),
      succeed: jest.fn()
    };
  });

  it('should create serverless handler with Express app', async () => {
    await handler(mockEvent, mockContext);
    
    expect(mockServerlessHttp).toHaveBeenCalledWith('mock-app');
  });

  it('should handle Lambda events', async () => {
    const result = await handler(mockEvent, mockContext);
    
    expect(mockHandler).toHaveBeenCalledWith(mockEvent, mockContext);
    
    expect(result).toEqual({
      statusCode: 200,
      body: JSON.stringify({ message: 'success' })
    });
  });

  it('should handle different HTTP methods', async () => {
    const postEvent = { ...mockEvent, httpMethod: 'POST' };
    
    await handler(postEvent, mockContext);
    
    expect(mockHandler).toHaveBeenCalledWith(postEvent, mockContext);
  });

  it('should handle events with body', async () => {
    const eventWithBody = {
      ...mockEvent,
      httpMethod: 'POST',
      body: JSON.stringify({ test: 'data' })
    };
    
    await handler(eventWithBody, mockContext);
    
    expect(mockHandler).toHaveBeenCalledWith(eventWithBody, mockContext);
  });

  it('should handle errors gracefully', async () => {
    // Mock an error in the handler
    mockHandler.mockRejectedValueOnce(new Error('Handler error'));
    
    const result = await handler(mockEvent, mockContext);
    
    expect(result).toEqual({
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        error: 'Internal server error',
      }),
    });
  });
});