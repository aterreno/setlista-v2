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
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // Create a bucket for the frontend
    const frontendBucket = new s3.Bucket(this, 'FrontendBucket', {
      websiteIndexDocument: 'index.html',
      websiteErrorDocument: 'index.html', // SPA routing
      publicReadAccess: false,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
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
        allowOrigins: apigateway.Cors.ALL_ORIGINS,
        allowMethods: apigateway.Cors.ALL_METHODS,
      },
    });

    // Create API Gateway resources
    const apiResource = api.root.addResource('api');
    
    // Add proxy resource to Lambda
    const proxyResource = apiResource.addProxy({
      defaultIntegration: new apigateway.LambdaIntegration(apiFunction),
      anyMethod: true,
    });

    // Now create CloudFront distribution after API Gateway is defined
    distribution = new cloudfront.Distribution(this, 'DistributionV3', {
      comment: 'Setlista CloudFront Distribution v2',
      domainNames: ['setlista.terreno.dev'],
      certificate: certificate,
      defaultBehavior: {
        origin: origins.S3BucketOrigin.withOriginAccessControl(frontendBucket),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD_OPTIONS,
        cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
      },
      additionalBehaviors: {
        '/api/*': {
          origin: new origins.RestApiOrigin(api),
          viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
          allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL,
          cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED,
          originRequestPolicy: cloudfront.OriginRequestPolicy.ALL_VIEWER,
        },
        '/auth/*': {
          origin: new origins.RestApiOrigin(api),
          viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
          allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL,
          cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED,
          originRequestPolicy: cloudfront.OriginRequestPolicy.ALL_VIEWER,
        },
      },
      defaultRootObject: 'index.html',
      errorResponses: [
        {
          httpStatus: 404,
          responseHttpStatus: 200,
          responsePagePath: '/index.html',
        },
      ],
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
        originRequestPolicy: cloudfront.OriginRequestPolicy.CORS_S3_ORIGIN,
      },
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