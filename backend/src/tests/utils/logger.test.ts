// Mock winston before importing logger
const mockLogger = {
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
  add: jest.fn(),
};

const mockFormat = {
  combine: jest.fn(() => 'combined-format'),
  timestamp: jest.fn(() => 'timestamp-format'),
  json: jest.fn(() => 'json-format'),
  colorize: jest.fn(() => 'colorize-format'),
  simple: jest.fn(() => 'simple-format'),
};

const mockTransports = {
  Console: jest.fn(() => 'console-transport'),
  File: jest.fn(() => 'file-transport'),
};

const mockCreateLogger = jest.fn(() => mockLogger);

jest.mock('winston', () => ({
  createLogger: mockCreateLogger,
  format: mockFormat,
  transports: mockTransports,
}));

// Mock config
jest.mock('../../config', () => ({
  config: {
    server: {
      nodeEnv: 'test'
    },
    logging: {
      level: 'info'
    }
  }
}));

describe('Logger', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetModules();
  });

  it('should create logger with correct configuration in development', async () => {
    // Import logger after mocks are set up
    const logger = await import('../../utils/logger');
    
    expect(mockCreateLogger).toHaveBeenCalledWith({
      level: 'info',
      format: 'combined-format',
      transports: [expect.any(Object)],
      defaultMeta: {
        service: 'setlista-backend'
      }
    });
    
    expect(mockFormat.combine).toHaveBeenCalled();
    expect(mockFormat.timestamp).toHaveBeenCalled();
    expect(mockFormat.json).toHaveBeenCalled();
    expect(logger.default).toBe(mockLogger);
  });

  it('should add file transport in production', async () => {
    // Reset modules and mock production environment
    jest.doMock('../../config', () => ({
      config: {
        server: {
          nodeEnv: 'production'
        },
        logging: {
          level: 'error'
        }
      }
    }));

    // Import logger with production config
    await import('../../utils/logger');
    
    expect(mockCreateLogger).toHaveBeenCalledWith({
      level: 'error',
      format: 'combined-format',
      transports: [expect.any(Object)],
      defaultMeta: {
        service: 'setlista-backend'
      }
    });
    
    // Should add file transport for production
    expect(mockLogger.add).toHaveBeenCalledTimes(2);
    expect(mockTransports.File).toHaveBeenCalledWith({
      filename: 'error.log',
      level: 'error'
    });
    expect(mockTransports.File).toHaveBeenCalledWith({
      filename: 'combined.log'
    });
  });

  it('should use console format with colorize in development', async () => {
    await import('../../utils/logger');
    
    expect(mockTransports.Console).toHaveBeenCalledWith({
      format: 'combined-format'
    });
    
    expect(mockFormat.combine).toHaveBeenCalledWith(
      'colorize-format',
      'simple-format'
    );
  });
});