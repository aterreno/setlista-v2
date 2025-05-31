import { Request, Response, NextFunction } from 'express';
import { errorHandler } from '../../middleware/error-handler';
import logger from '../../utils/logger';

jest.mock('../../utils/logger');

describe('errorHandler', () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockNext: NextFunction;

  beforeEach(() => {
    mockRequest = {
      path: '/test/path',
      method: 'GET',
    };
    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    mockNext = jest.fn();
    jest.clearAllMocks();
  });

  it('should handle error and return 500 status', () => {
    const error = new Error('Test error message');
    error.stack = 'Test stack trace';

    errorHandler(error, mockRequest as Request, mockResponse as Response, mockNext);

    expect(logger.error).toHaveBeenCalledWith('Uncaught exception', {
      error: 'Test error message',
      stack: 'Test stack trace',
      path: '/test/path',
      method: 'GET',
    });
    expect(mockResponse.status).toHaveBeenCalledWith(500);
    expect(mockResponse.json).toHaveBeenCalledWith({
      error: 'Internal server error',
    });
  });

  it('should handle error without stack trace', () => {
    const error = new Error('Test error message');
    error.stack = undefined;

    errorHandler(error, mockRequest as Request, mockResponse as Response, mockNext);

    expect(logger.error).toHaveBeenCalledWith('Uncaught exception', {
      error: 'Test error message',
      stack: undefined,
      path: '/test/path',
      method: 'GET',
    });
    expect(mockResponse.status).toHaveBeenCalledWith(500);
    expect(mockResponse.json).toHaveBeenCalledWith({
      error: 'Internal server error',
    });
  });

  it('should handle error with different HTTP method and path', () => {
    const customMockRequest = {
      method: 'POST',
      path: '/api/test',
    };
    const error = new Error('Another test error');

    errorHandler(error, customMockRequest as Request, mockResponse as Response, mockNext);

    expect(logger.error).toHaveBeenCalledWith('Uncaught exception', {
      error: 'Another test error',
      stack: error.stack,
      path: '/api/test',
      method: 'POST',
    });
  });
});