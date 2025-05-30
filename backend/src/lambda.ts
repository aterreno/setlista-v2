import { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import serverless from 'serverless-http';
import { createApp } from './app';
import { validateConfig } from './config';
import logger from './utils/logger';

// Initialize the Express app
const app = createApp();

// Create a serverless handler
const handler = serverless(app);

// Lambda handler function
export const lambdaHandler = async (
  event: APIGatewayProxyEvent,
  context: Context
): Promise<APIGatewayProxyResult> => {
  try {
    // Validate config (async in production to load secrets)
    await validateConfig();

    // Log the incoming request
    logger.info('Lambda invocation', {
      requestId: context.awsRequestId,
      path: event.path,
      method: event.httpMethod,
    });

    // Handle the request with the Express app
    return await handler(event, context) as APIGatewayProxyResult;
  } catch (error) {
    // Log any errors
    logger.error('Lambda error', {
      error,
      requestId: context.awsRequestId,
    });

    // Return a 500 error
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        error: 'Internal server error',
      }),
    };
  }
};