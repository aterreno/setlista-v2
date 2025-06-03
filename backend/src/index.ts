import { createApp } from './app';
import { config, validateConfig } from './config';
import logger from './utils/logger';

const startServer = async () => {
  try {
    // Validate environment variables
    validateConfig();

    const app = createApp();
    const port = config.server.port;

    app.listen(port, () => {
      logger.debug(`Server started on port ${port}`);
    });
  } catch (error) {
    logger.error('Failed to start server', { error });
    process.exit(1);
  }
};

// Start the server
startServer();