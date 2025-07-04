import * as cdk from 'aws-cdk-lib';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import * as certificatemanager from 'aws-cdk-lib/aws-certificatemanager';
import * as logs from 'aws-cdk-lib/aws-logs';

import * as path from 'path';
import { Construct } from 'constructs';

export class SetlistaStack extends cdk.Stack {
  // Custom OriginRequestPolicy for API Gateway (no Host header)
  private createApiGatewayOriginRequestPolicy(scope: Construct): cloudfront.OriginRequestPolicy {
    return new cloudfront.OriginRequestPolicy(scope, 'ApiGatewayOriginRequestPolicy', {
      originRequestPolicyName: 'SetlistaApiGatewayOriginRequestPolicy',
      comment: 'Policy for CloudFront -> API Gateway (do NOT forward Host header)',
      headerBehavior: cloudfront.OriginRequestHeaderBehavior.none(), // DO NOT forward Host
      queryStringBehavior: cloudfront.OriginRequestQueryStringBehavior.all(),
      cookieBehavior: cloudfront.OriginRequestCookieBehavior.all(),
    });
  }

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // Create a bucket for the frontend
    const frontendBucket = new s3.Bucket(this, 'FrontendBucket', {
      websiteIndexDocument: 'index.html',
      websiteErrorDocument: 'index.html', // SPA routing
      publicReadAccess: true,
      blockPublicAccess: new s3.BlockPublicAccess({
        blockPublicAcls: false,
        ignorePublicAcls: false,
        blockPublicPolicy: false,
        restrictPublicBuckets: false,
      }),
      removalPolicy: cdk.RemovalPolicy.DESTROY, // For dev/test environments
      autoDeleteObjects: true, // For dev/test environments
    });

    // CloudFront distribution for the frontend (will be created after API Gateway)
    let distribution: cloudfront.Distribution;



    // Import existing secrets
    const setlistFmApiKey = secretsmanager.Secret.fromSecretNameV2(
      this, 
      'SetlistFmApiKey', 
      'setlista/setlistfm-api-key'
    );

    const spotifyClientId = secretsmanager.Secret.fromSecretNameV2(
      this, 
      'SpotifyClientId', 
      'setlista/spotify-client-id'
    );

    const spotifyClientSecret = secretsmanager.Secret.fromSecretNameV2(
      this, 
      'SpotifyClientSecret', 
      'setlista/spotify-client-secret'
    );


    const spotifyRedirectUri = secretsmanager.Secret.fromSecretNameV2(
      this, 
      'SpotifyRedirectUri', 
      'setlista/spotify-redirect-uri'
    );

    // Create SSL certificate for custom domain
    const certificate = new certificatemanager.Certificate(this, 'SetlistaCertificate', {
      domainName: 'setlista.terreno.dev',
      subjectAlternativeNames: ['api.setlista.terreno.dev'],
      validation: certificatemanager.CertificateValidation.fromDns(),
    });

    // CloudFront distribution for the frontend (SPA routing)
    distribution = new cloudfront.Distribution(this, 'FrontendDistribution', {
      defaultBehavior: {
        origin: new origins.S3StaticWebsiteOrigin(frontendBucket),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD_OPTIONS,
        cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
      },
      errorResponses: [
        {
          httpStatus: 403,
          responseHttpStatus: 200,
          responsePagePath: '/index.html',
          ttl: cdk.Duration.minutes(5),
        },
        {
          httpStatus: 404,
          responseHttpStatus: 200,
          responsePagePath: '/index.html',
          ttl: cdk.Duration.minutes(5),
        },
      ],      
      domainNames: ['setlista.terreno.dev'],
      certificate: certificate,
    });
    // Create Lambda function for the backend
    const apiFunction = new lambda.Function(this, 'ApiFunction', {
      runtime: lambda.Runtime.NODEJS_22_X,
      handler: 'dist/lambda.lambdaHandler',
      code: lambda.Code.fromAsset(path.join(__dirname, '../../backend')),
      environment: {
        NODE_ENV: 'production',
      },
      timeout: cdk.Duration.seconds(30),
      memorySize: 256,
      logRetention: logs.RetentionDays.ONE_WEEK,
    });

    // Grant permissions to access secrets
    setlistFmApiKey.grantRead(apiFunction);
    spotifyClientId.grantRead(apiFunction);
    spotifyClientSecret.grantRead(apiFunction);
    spotifyRedirectUri.grantRead(apiFunction);

    // Create API Gateway
    const api = new apigateway.RestApi(this, 'SetlistaApi', {
      description: 'Setlista API',
      deployOptions: {
        stageName: 'prod',
        loggingLevel: apigateway.MethodLoggingLevel.INFO,
        dataTraceEnabled: true,
      },
      defaultCorsPreflightOptions: {
        allowOrigins: ['https://setlista.terreno.dev'],
        allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
        allowHeaders: [
          'Content-Type',
          'X-Amz-Date',
          'Authorization',
          'X-Api-Key',
          'X-Amz-Security-Token',
          'Origin',
          'Accept',
          'Access-Control-Allow-Origin',
          'Access-Control-Allow-Headers',
          'Access-Control-Allow-Methods',
        ],
        allowCredentials: true,
        maxAge: cdk.Duration.days(1),
      },
    });

    // Create API Gateway resources
    const apiResource = api.root;
    
    // Add proxy resource to Lambda
    const proxyResource = apiResource.addProxy({
      defaultIntegration: new apigateway.LambdaIntegration(apiFunction, {
        proxy: true,
        integrationResponses: [
          {
            statusCode: '200',
            responseParameters: {
              'method.response.header.Access-Control-Allow-Origin': "'https://setlista.terreno.dev'",
              'method.response.header.Access-Control-Allow-Headers': "'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token,Origin,Accept'",
              'method.response.header.Access-Control-Allow-Methods': "'GET,POST,PUT,DELETE,OPTIONS'",
            },
          },
        ],
      }),
      anyMethod: true,
      defaultMethodOptions: {
        methodResponses: [
          {
            statusCode: '200',
            responseParameters: {
              'method.response.header.Access-Control-Allow-Origin': true,
              'method.response.header.Access-Control-Allow-Headers': true,
              'method.response.header.Access-Control-Allow-Methods': true,
            },
          },
          {
            statusCode: '400',
            responseParameters: {
              'method.response.header.Access-Control-Allow-Origin': true,
              'method.response.header.Access-Control-Allow-Headers': true,
              'method.response.header.Access-Control-Allow-Methods': true,
            },
          },
          {
            statusCode: '500',
            responseParameters: {
              'method.response.header.Access-Control-Allow-Origin': true,
              'method.response.header.Access-Control-Allow-Headers': true,
              'method.response.header.Access-Control-Allow-Methods': true,
            },
          },
        ],
      },
    });

    // Now create CloudFront distribution after API Gateway is defined
    // Create custom OriginRequestPolicy for API Gateway
    const apiGatewayOriginRequestPolicy = this.createApiGatewayOriginRequestPolicy(this);

    // Route /api/* from the frontend distribution (setlista.terreno.dev) to the API Gateway
    // This ensures that the main domain's /api/* paths are handled by the backend.
    distribution.addBehavior('/api/*', new origins.RestApiOrigin(api), {
      viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
      allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL,
      cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED,
      originRequestPolicy: apiGatewayOriginRequestPolicy, // Uses the policy defined above
      responseHeadersPolicy: cloudfront.ResponseHeadersPolicy.CORS_ALLOW_ALL_ORIGINS_WITH_PREFLIGHT, // Standard CORS policy with preflight
    });

    // Grant CloudFront permission to access the S3 bucket
    const bucketPolicyStatement = new iam.PolicyStatement({
      actions: ['s3:GetObject'],
      resources: [`${frontendBucket.bucketArn}/*`],
      principals: [new iam.ServicePrincipal('cloudfront.amazonaws.com')],
      conditions: {
        StringEquals: {
          'AWS:SourceArn': `arn:aws:cloudfront::${this.account}:distribution/${distribution.distributionId}`,
        },
      },
    });

    frontendBucket.addToResourcePolicy(bucketPolicyStatement);

    // Create a separate CloudFront distribution for the API subdomain
    const apiDistribution = new cloudfront.Distribution(this, 'ApiDistribution', {
      comment: 'Setlista API CloudFront Distribution',
      domainNames: ['api.setlista.terreno.dev'],
      certificate: certificate,
      defaultBehavior: {
        origin: new origins.RestApiOrigin(api),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL,
        cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED,
        originRequestPolicy: apiGatewayOriginRequestPolicy,
        responseHeadersPolicy: cloudfront.ResponseHeadersPolicy.CORS_ALLOW_ALL_ORIGINS,
        functionAssociations: [
          {
            function: new cloudfront.Function(this, 'QueryStringFunction', {
              code: cloudfront.FunctionCode.fromInline(`
                function handler(event) {
                  var request = event.request;
                  var uri = request.uri;
                  
                  // Remove /prod prefix if present
                  if (uri.startsWith('/prod/')) {
                    request.uri = uri.substring(5);
                  }
                  
                  // Add CORS headers for preflight requests
                  if (request.method === 'OPTIONS') {
                    return {
                      statusCode: 204,
                      statusDescription: 'No Content',
                      headers: {
                        'access-control-allow-origin': { value: 'https://setlista.terreno.dev' },
                        'access-control-allow-methods': { value: 'GET,HEAD,OPTIONS,POST,PUT' },
                        'access-control-allow-headers': { value: 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token,Origin,Accept' },
                        'access-control-max-age': { value: '86400' }
                      }
                    };
                  }
                  
                  return request;
                }
              `),
            }),
            eventType: cloudfront.FunctionEventType.VIEWER_REQUEST,
          },
        ],
      },
      additionalBehaviors: {
        '/api/*': {
          origin: new origins.RestApiOrigin(api, {
            originPath: '/prod',
            
          }),
          viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
          allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL,
          cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED,
          originRequestPolicy: apiGatewayOriginRequestPolicy,
          responseHeadersPolicy: cloudfront.ResponseHeadersPolicy.CORS_ALLOW_ALL_ORIGINS,
        },
        '/auth/*': {
          origin: new origins.RestApiOrigin(api, {
            originPath: '/prod',
            
          }),
          viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
          allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL,
          cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED,
          originRequestPolicy: apiGatewayOriginRequestPolicy,
          responseHeadersPolicy: cloudfront.ResponseHeadersPolicy.CORS_ALLOW_ALL_ORIGINS,
        },
        '/prod/*': {
          origin: new origins.RestApiOrigin(api, {
            originPath: '/prod',
            
          }),
          viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
          allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL,
          cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED,
          originRequestPolicy: apiGatewayOriginRequestPolicy,
          responseHeadersPolicy: cloudfront.ResponseHeadersPolicy.CORS_ALLOW_ALL_ORIGINS,
        },
        '/spotify/*': {
          origin: new origins.RestApiOrigin(api, {
            originPath: '/prod',
            
          }),
          viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
          allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL,
          cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED,
          originRequestPolicy: apiGatewayOriginRequestPolicy,
          responseHeadersPolicy: cloudfront.ResponseHeadersPolicy.CORS_ALLOW_ALL_ORIGINS,
        },
      },
      logBucket: new s3.Bucket(this, 'ApiCloudFrontLogs', {
        removalPolicy: cdk.RemovalPolicy.RETAIN,
        encryption: s3.BucketEncryption.S3_MANAGED,
        blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
        versioned: true,
        objectOwnership: s3.ObjectOwnership.BUCKET_OWNER_PREFERRED,
        lifecycleRules: [
          {
            expiration: cdk.Duration.days(90), // Keep logs for 90 days
          },
        ],
      }),
      logFilePrefix: 'api-cloudfront-logs/',
      logIncludesCookies: true,
    });

    // Output the CloudFront domain so SPOTIFY_REDIRECT_URI can be configured manually if needed
    // The Lambda will construct the redirect URI dynamically using the Host header

    // Outputs
    new cdk.CfnOutput(this, 'CloudFrontURL', {
      value: `https://${distribution.domainName}`,
      description: 'URL of the CloudFront distribution',
    });

    new cdk.CfnOutput(this, 'CloudFrontDistributionId', {
      value: distribution.distributionId,
      description: 'ID of the CloudFront distribution',
    });

    new cdk.CfnOutput(this, 'FrontendBucketName', {
      value: frontendBucket.bucketName,
      description: 'Name of the S3 bucket hosting the frontend',
    });

    new cdk.CfnOutput(this, 'ApiURL', {
      value: api.url,
      description: 'URL of the API Gateway',
    });

    new cdk.CfnOutput(this, 'ApiDistributionId', {
      value: apiDistribution.distributionId,
      description: 'ID of the API CloudFront distribution',
    });

    new cdk.CfnOutput(this, 'ApiDistributionURL', {
      value: `https://${apiDistribution.domainName}`,
      description: 'URL of the API CloudFront distribution',
    });
  }
}