"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.SetlistaStack = void 0;
const cdk = __importStar(require("aws-cdk-lib"));
const s3 = __importStar(require("aws-cdk-lib/aws-s3"));
const cloudfront = __importStar(require("aws-cdk-lib/aws-cloudfront"));
const origins = __importStar(require("aws-cdk-lib/aws-cloudfront-origins"));
const lambda = __importStar(require("aws-cdk-lib/aws-lambda"));
const apigateway = __importStar(require("aws-cdk-lib/aws-apigateway"));
const iam = __importStar(require("aws-cdk-lib/aws-iam"));
const secretsmanager = __importStar(require("aws-cdk-lib/aws-secretsmanager"));
const certificatemanager = __importStar(require("aws-cdk-lib/aws-certificatemanager"));
const logs = __importStar(require("aws-cdk-lib/aws-logs"));
const kinesis = __importStar(require("aws-cdk-lib/aws-kinesis"));
const path = __importStar(require("path"));
class SetlistaStack extends cdk.Stack {
    constructor(scope, id, props) {
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
        let distribution;
        // Import existing secrets
        const setlistFmApiKey = secretsmanager.Secret.fromSecretNameV2(this, 'SetlistFmApiKey', 'setlista/setlistfm-api-key');
        const spotifyClientId = secretsmanager.Secret.fromSecretNameV2(this, 'SpotifyClientId', 'setlista/spotify-client-id');
        const spotifyClientSecret = secretsmanager.Secret.fromSecretNameV2(this, 'SpotifyClientSecret', 'setlista/spotify-client-secret');
        const spotifyRedirectUri = secretsmanager.Secret.fromSecretNameV2(this, 'SpotifyRedirectUri', 'setlista/spotify-redirect-uri');
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
                    origin: new origins.RestApiOrigin(api, {
                        originPath: '/prod',
                    }),
                    viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
                    allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL,
                    cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED,
                    originRequestPolicy: cloudfront.OriginRequestPolicy.ALL_VIEWER,
                },
                '/auth/*': {
                    origin: new origins.RestApiOrigin(api, {
                        originPath: '/prod',
                    }),
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
        // Create Kinesis stream for real-time logs
        const realTimeLogStream = new kinesis.Stream(this, 'ApiCloudFrontRealTimeLogs', {
            streamMode: kinesis.StreamMode.ON_DEMAND,
            retentionPeriod: cdk.Duration.hours(24),
        });
        // Create IAM role for CloudFront to write to Kinesis
        const realTimeLogRole = new iam.Role(this, 'ApiCloudFrontRealTimeLogRole', {
            assumedBy: new iam.ServicePrincipal('cloudfront.amazonaws.com'),
            managedPolicies: [
                iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaBasicExecutionRole'),
            ],
            inlinePolicies: {
                KinesisWrite: new iam.PolicyDocument({
                    statements: [
                        new iam.PolicyStatement({
                            actions: [
                                'kinesis:DescribeStreamSummary',
                                'kinesis:DescribeStream',
                                'kinesis:PutRecord',
                                'kinesis:PutRecords',
                            ],
                            resources: [realTimeLogStream.streamArn],
                        }),
                    ],
                }),
            },
        });
        // Create real-time log configuration
        const realTimeLogConfig = new cloudfront.CfnRealtimeLogConfig(this, 'ApiCloudFrontRealTimeLogConfig', {
            name: 'ApiCloudFrontRealTimeLogs',
            samplingRate: 100, // Log 100% of requests
            fields: [
                'timestamp',
                'c-ip',
                'time-to-first-byte',
                'sc-status',
                'sc-bytes',
                'cs-method',
                'cs-protocol',
                'cs-host',
                'cs-protocol-version',
                'cs-user-agent',
                'cs-referer',
                'cs-cookie',
                'x-edge-location',
                'x-edge-request-id',
                'x-host-header',
                'cs-uri-stem',
                'cs-uri-query',
                'sc-content-type',
                'sc-content-len',
                'sc-range-start',
                'sc-range-end',
                'c-port',
                'time-taken',
                'x-forwarded-for',
                'ssl-protocol',
                'ssl-cipher',
                'x-edge-response-result-type',
                'x-edge-detailed-result-type',
                'fle-status',
                'fle-encrypted-fields'
            ],
            endPoints: [{
                    streamType: 'Kinesis',
                    kinesisStreamConfig: {
                        streamArn: realTimeLogStream.streamArn,
                        roleArn: realTimeLogRole.roleArn,
                    },
                }],
        });
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
                originRequestPolicy: cloudfront.OriginRequestPolicy.ALL_VIEWER_AND_CLOUDFRONT_2022,
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
                  
                  // Forward all query parameters
                  if (request.querystring) {
                    request.querystring = request.querystring;
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
                    origin: new origins.RestApiOrigin(api),
                    viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
                    allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL,
                    cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED,
                    originRequestPolicy: cloudfront.OriginRequestPolicy.ALL_VIEWER_AND_CLOUDFRONT_2022,
                    responseHeadersPolicy: cloudfront.ResponseHeadersPolicy.CORS_ALLOW_ALL_ORIGINS,
                },
                '/auth/*': {
                    origin: new origins.RestApiOrigin(api),
                    viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
                    allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL,
                    cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED,
                    originRequestPolicy: cloudfront.OriginRequestPolicy.ALL_VIEWER_AND_CLOUDFRONT_2022,
                    responseHeadersPolicy: cloudfront.ResponseHeadersPolicy.CORS_ALLOW_ALL_ORIGINS,
                },
                '/prod/*': {
                    origin: new origins.RestApiOrigin(api),
                    viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
                    allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL,
                    cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED,
                    originRequestPolicy: cloudfront.OriginRequestPolicy.ALL_VIEWER_AND_CLOUDFRONT_2022,
                    responseHeadersPolicy: cloudfront.ResponseHeadersPolicy.CORS_ALLOW_ALL_ORIGINS,
                },
                '/spotify/*': {
                    origin: new origins.RestApiOrigin(api),
                    viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
                    allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL,
                    cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED,
                    originRequestPolicy: cloudfront.OriginRequestPolicy.ALL_VIEWER_AND_CLOUDFRONT_2022,
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
exports.SetlistaStack = SetlistaStack;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic2V0bGlzdGEtc3RhY2suanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyJzZXRsaXN0YS1zdGFjay50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFBQSxpREFBbUM7QUFDbkMsdURBQXlDO0FBQ3pDLHVFQUF5RDtBQUN6RCw0RUFBOEQ7QUFDOUQsK0RBQWlEO0FBQ2pELHVFQUF5RDtBQUN6RCx5REFBMkM7QUFDM0MsK0VBQWlFO0FBQ2pFLHVGQUF5RTtBQUN6RSwyREFBNkM7QUFDN0MsaUVBQW1EO0FBQ25ELDJDQUE2QjtBQUc3QixNQUFhLGFBQWMsU0FBUSxHQUFHLENBQUMsS0FBSztJQUMxQyxZQUFZLEtBQWdCLEVBQUUsRUFBVSxFQUFFLEtBQXNCO1FBQzlELEtBQUssQ0FBQyxLQUFLLEVBQUUsRUFBRSxFQUFFLEtBQUssQ0FBQyxDQUFDO1FBRXhCLG1DQUFtQztRQUNuQyxNQUFNLGNBQWMsR0FBRyxJQUFJLEVBQUUsQ0FBQyxNQUFNLENBQUMsSUFBSSxFQUFFLGdCQUFnQixFQUFFO1lBQzNELG9CQUFvQixFQUFFLFlBQVk7WUFDbEMsb0JBQW9CLEVBQUUsWUFBWSxFQUFFLGNBQWM7WUFDbEQsZ0JBQWdCLEVBQUUsS0FBSztZQUN2QixpQkFBaUIsRUFBRSxFQUFFLENBQUMsaUJBQWlCLENBQUMsU0FBUztZQUNqRCxhQUFhLEVBQUUsR0FBRyxDQUFDLGFBQWEsQ0FBQyxPQUFPLEVBQUUsNEJBQTRCO1lBQ3RFLGlCQUFpQixFQUFFLElBQUksRUFBRSw0QkFBNEI7U0FDdEQsQ0FBQyxDQUFDO1FBRUgsK0VBQStFO1FBQy9FLElBQUksWUFBcUMsQ0FBQztRQUUxQywwQkFBMEI7UUFDMUIsTUFBTSxlQUFlLEdBQUcsY0FBYyxDQUFDLE1BQU0sQ0FBQyxnQkFBZ0IsQ0FDNUQsSUFBSSxFQUNKLGlCQUFpQixFQUNqQiw0QkFBNEIsQ0FDN0IsQ0FBQztRQUVGLE1BQU0sZUFBZSxHQUFHLGNBQWMsQ0FBQyxNQUFNLENBQUMsZ0JBQWdCLENBQzVELElBQUksRUFDSixpQkFBaUIsRUFDakIsNEJBQTRCLENBQzdCLENBQUM7UUFFRixNQUFNLG1CQUFtQixHQUFHLGNBQWMsQ0FBQyxNQUFNLENBQUMsZ0JBQWdCLENBQ2hFLElBQUksRUFDSixxQkFBcUIsRUFDckIsZ0NBQWdDLENBQ2pDLENBQUM7UUFHRixNQUFNLGtCQUFrQixHQUFHLGNBQWMsQ0FBQyxNQUFNLENBQUMsZ0JBQWdCLENBQy9ELElBQUksRUFDSixvQkFBb0IsRUFDcEIsK0JBQStCLENBQ2hDLENBQUM7UUFFRiwyQ0FBMkM7UUFDM0MsTUFBTSxXQUFXLEdBQUcsSUFBSSxrQkFBa0IsQ0FBQyxXQUFXLENBQUMsSUFBSSxFQUFFLHFCQUFxQixFQUFFO1lBQ2xGLFVBQVUsRUFBRSxzQkFBc0I7WUFDbEMsdUJBQXVCLEVBQUUsQ0FBQywwQkFBMEIsQ0FBQztZQUNyRCxVQUFVLEVBQUUsa0JBQWtCLENBQUMscUJBQXFCLENBQUMsT0FBTyxFQUFFO1NBQy9ELENBQUMsQ0FBQztRQUVILHlDQUF5QztRQUN6QyxNQUFNLFdBQVcsR0FBRyxJQUFJLE1BQU0sQ0FBQyxRQUFRLENBQUMsSUFBSSxFQUFFLGFBQWEsRUFBRTtZQUMzRCxPQUFPLEVBQUUsTUFBTSxDQUFDLE9BQU8sQ0FBQyxXQUFXO1lBQ25DLE9BQU8sRUFBRSwyQkFBMkI7WUFDcEMsSUFBSSxFQUFFLE1BQU0sQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsU0FBUyxFQUFFLGVBQWUsQ0FBQyxDQUFDO1lBQ2xFLFdBQVcsRUFBRTtnQkFDWCxRQUFRLEVBQUUsWUFBWTthQUN2QjtZQUNELE9BQU8sRUFBRSxHQUFHLENBQUMsUUFBUSxDQUFDLE9BQU8sQ0FBQyxFQUFFLENBQUM7WUFDakMsVUFBVSxFQUFFLEdBQUc7WUFDZixZQUFZLEVBQUUsSUFBSSxDQUFDLGFBQWEsQ0FBQyxRQUFRO1NBQzFDLENBQUMsQ0FBQztRQUVILHNDQUFzQztRQUN0QyxlQUFlLENBQUMsU0FBUyxDQUFDLFdBQVcsQ0FBQyxDQUFDO1FBQ3ZDLGVBQWUsQ0FBQyxTQUFTLENBQUMsV0FBVyxDQUFDLENBQUM7UUFDdkMsbUJBQW1CLENBQUMsU0FBUyxDQUFDLFdBQVcsQ0FBQyxDQUFDO1FBQzNDLGtCQUFrQixDQUFDLFNBQVMsQ0FBQyxXQUFXLENBQUMsQ0FBQztRQUUxQyxxQkFBcUI7UUFDckIsTUFBTSxHQUFHLEdBQUcsSUFBSSxVQUFVLENBQUMsT0FBTyxDQUFDLElBQUksRUFBRSxhQUFhLEVBQUU7WUFDdEQsV0FBVyxFQUFFLGNBQWM7WUFDM0IsYUFBYSxFQUFFO2dCQUNiLFNBQVMsRUFBRSxNQUFNO2dCQUNqQixZQUFZLEVBQUUsVUFBVSxDQUFDLGtCQUFrQixDQUFDLElBQUk7Z0JBQ2hELGdCQUFnQixFQUFFLElBQUk7YUFDdkI7WUFDRCwyQkFBMkIsRUFBRTtnQkFDM0IsWUFBWSxFQUFFLENBQUMsOEJBQThCLENBQUM7Z0JBQzlDLFlBQVksRUFBRSxDQUFDLEtBQUssRUFBRSxNQUFNLEVBQUUsS0FBSyxFQUFFLFFBQVEsRUFBRSxTQUFTLENBQUM7Z0JBQ3pELFlBQVksRUFBRTtvQkFDWixjQUFjO29CQUNkLFlBQVk7b0JBQ1osZUFBZTtvQkFDZixXQUFXO29CQUNYLHNCQUFzQjtvQkFDdEIsUUFBUTtvQkFDUixRQUFRO29CQUNSLDZCQUE2QjtvQkFDN0IsOEJBQThCO29CQUM5Qiw4QkFBOEI7aUJBQy9CO2dCQUNELGdCQUFnQixFQUFFLElBQUk7Z0JBQ3RCLE1BQU0sRUFBRSxHQUFHLENBQUMsUUFBUSxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUM7YUFDN0I7U0FDRixDQUFDLENBQUM7UUFFSCwrQkFBK0I7UUFDL0IsTUFBTSxXQUFXLEdBQUcsR0FBRyxDQUFDLElBQUksQ0FBQztRQUU3QiwrQkFBK0I7UUFDL0IsTUFBTSxhQUFhLEdBQUcsV0FBVyxDQUFDLFFBQVEsQ0FBQztZQUN6QyxrQkFBa0IsRUFBRSxJQUFJLFVBQVUsQ0FBQyxpQkFBaUIsQ0FBQyxXQUFXLEVBQUU7Z0JBQ2hFLEtBQUssRUFBRSxJQUFJO2dCQUNYLG9CQUFvQixFQUFFO29CQUNwQjt3QkFDRSxVQUFVLEVBQUUsS0FBSzt3QkFDakIsa0JBQWtCLEVBQUU7NEJBQ2xCLG9EQUFvRCxFQUFFLGdDQUFnQzs0QkFDdEYscURBQXFELEVBQUUsc0ZBQXNGOzRCQUM3SSxxREFBcUQsRUFBRSwrQkFBK0I7eUJBQ3ZGO3FCQUNGO2lCQUNGO2FBQ0YsQ0FBQztZQUNGLFNBQVMsRUFBRSxJQUFJO1lBQ2Ysb0JBQW9CLEVBQUU7Z0JBQ3BCLGVBQWUsRUFBRTtvQkFDZjt3QkFDRSxVQUFVLEVBQUUsS0FBSzt3QkFDakIsa0JBQWtCLEVBQUU7NEJBQ2xCLG9EQUFvRCxFQUFFLElBQUk7NEJBQzFELHFEQUFxRCxFQUFFLElBQUk7NEJBQzNELHFEQUFxRCxFQUFFLElBQUk7eUJBQzVEO3FCQUNGO29CQUNEO3dCQUNFLFVBQVUsRUFBRSxLQUFLO3dCQUNqQixrQkFBa0IsRUFBRTs0QkFDbEIsb0RBQW9ELEVBQUUsSUFBSTs0QkFDMUQscURBQXFELEVBQUUsSUFBSTs0QkFDM0QscURBQXFELEVBQUUsSUFBSTt5QkFDNUQ7cUJBQ0Y7b0JBQ0Q7d0JBQ0UsVUFBVSxFQUFFLEtBQUs7d0JBQ2pCLGtCQUFrQixFQUFFOzRCQUNsQixvREFBb0QsRUFBRSxJQUFJOzRCQUMxRCxxREFBcUQsRUFBRSxJQUFJOzRCQUMzRCxxREFBcUQsRUFBRSxJQUFJO3lCQUM1RDtxQkFDRjtpQkFDRjthQUNGO1NBQ0YsQ0FBQyxDQUFDO1FBRUgsa0VBQWtFO1FBQ2xFLFlBQVksR0FBRyxJQUFJLFVBQVUsQ0FBQyxZQUFZLENBQUMsSUFBSSxFQUFFLGdCQUFnQixFQUFFO1lBQ2pFLE9BQU8sRUFBRSxxQ0FBcUM7WUFDOUMsV0FBVyxFQUFFLENBQUMsc0JBQXNCLENBQUM7WUFDckMsV0FBVyxFQUFFLFdBQVc7WUFDeEIsZUFBZSxFQUFFO2dCQUNmLE1BQU0sRUFBRSxPQUFPLENBQUMsY0FBYyxDQUFDLHVCQUF1QixDQUFDLGNBQWMsQ0FBQztnQkFDdEUsb0JBQW9CLEVBQUUsVUFBVSxDQUFDLG9CQUFvQixDQUFDLGlCQUFpQjtnQkFDdkUsY0FBYyxFQUFFLFVBQVUsQ0FBQyxjQUFjLENBQUMsc0JBQXNCO2dCQUNoRSxXQUFXLEVBQUUsVUFBVSxDQUFDLFdBQVcsQ0FBQyxpQkFBaUI7YUFDdEQ7WUFDRCxtQkFBbUIsRUFBRTtnQkFDbkIsUUFBUSxFQUFFO29CQUNSLE1BQU0sRUFBRSxJQUFJLE9BQU8sQ0FBQyxhQUFhLENBQUMsR0FBRyxFQUFFO3dCQUNyQyxVQUFVLEVBQUUsT0FBTztxQkFDcEIsQ0FBQztvQkFDRixvQkFBb0IsRUFBRSxVQUFVLENBQUMsb0JBQW9CLENBQUMsaUJBQWlCO29CQUN2RSxjQUFjLEVBQUUsVUFBVSxDQUFDLGNBQWMsQ0FBQyxTQUFTO29CQUNuRCxXQUFXLEVBQUUsVUFBVSxDQUFDLFdBQVcsQ0FBQyxnQkFBZ0I7b0JBQ3BELG1CQUFtQixFQUFFLFVBQVUsQ0FBQyxtQkFBbUIsQ0FBQyxVQUFVO2lCQUMvRDtnQkFDRCxTQUFTLEVBQUU7b0JBQ1QsTUFBTSxFQUFFLElBQUksT0FBTyxDQUFDLGFBQWEsQ0FBQyxHQUFHLEVBQUU7d0JBQ3JDLFVBQVUsRUFBRSxPQUFPO3FCQUNwQixDQUFDO29CQUNGLG9CQUFvQixFQUFFLFVBQVUsQ0FBQyxvQkFBb0IsQ0FBQyxpQkFBaUI7b0JBQ3ZFLGNBQWMsRUFBRSxVQUFVLENBQUMsY0FBYyxDQUFDLFNBQVM7b0JBQ25ELFdBQVcsRUFBRSxVQUFVLENBQUMsV0FBVyxDQUFDLGdCQUFnQjtvQkFDcEQsbUJBQW1CLEVBQUUsVUFBVSxDQUFDLG1CQUFtQixDQUFDLFVBQVU7aUJBQy9EO2FBQ0Y7WUFDRCxpQkFBaUIsRUFBRSxZQUFZO1lBQy9CLGNBQWMsRUFBRTtnQkFDZDtvQkFDRSxVQUFVLEVBQUUsR0FBRztvQkFDZixrQkFBa0IsRUFBRSxHQUFHO29CQUN2QixnQkFBZ0IsRUFBRSxhQUFhO2lCQUNoQzthQUNGO1NBQ0YsQ0FBQyxDQUFDO1FBRUgsc0RBQXNEO1FBQ3RELE1BQU0scUJBQXFCLEdBQUcsSUFBSSxHQUFHLENBQUMsZUFBZSxDQUFDO1lBQ3BELE9BQU8sRUFBRSxDQUFDLGNBQWMsQ0FBQztZQUN6QixTQUFTLEVBQUUsQ0FBQyxHQUFHLGNBQWMsQ0FBQyxTQUFTLElBQUksQ0FBQztZQUM1QyxVQUFVLEVBQUUsQ0FBQyxJQUFJLEdBQUcsQ0FBQyxnQkFBZ0IsQ0FBQywwQkFBMEIsQ0FBQyxDQUFDO1lBQ2xFLFVBQVUsRUFBRTtnQkFDVixZQUFZLEVBQUU7b0JBQ1osZUFBZSxFQUFFLHVCQUF1QixJQUFJLENBQUMsT0FBTyxpQkFBaUIsWUFBWSxDQUFDLGNBQWMsRUFBRTtpQkFDbkc7YUFDRjtTQUNGLENBQUMsQ0FBQztRQUVILGNBQWMsQ0FBQyxtQkFBbUIsQ0FBQyxxQkFBcUIsQ0FBQyxDQUFDO1FBRTFELDJDQUEyQztRQUMzQyxNQUFNLGlCQUFpQixHQUFHLElBQUksT0FBTyxDQUFDLE1BQU0sQ0FBQyxJQUFJLEVBQUUsMkJBQTJCLEVBQUU7WUFDOUUsVUFBVSxFQUFFLE9BQU8sQ0FBQyxVQUFVLENBQUMsU0FBUztZQUN4QyxlQUFlLEVBQUUsR0FBRyxDQUFDLFFBQVEsQ0FBQyxLQUFLLENBQUMsRUFBRSxDQUFDO1NBQ3hDLENBQUMsQ0FBQztRQUVILHFEQUFxRDtRQUNyRCxNQUFNLGVBQWUsR0FBRyxJQUFJLEdBQUcsQ0FBQyxJQUFJLENBQUMsSUFBSSxFQUFFLDhCQUE4QixFQUFFO1lBQ3pFLFNBQVMsRUFBRSxJQUFJLEdBQUcsQ0FBQyxnQkFBZ0IsQ0FBQywwQkFBMEIsQ0FBQztZQUMvRCxlQUFlLEVBQUU7Z0JBQ2YsR0FBRyxDQUFDLGFBQWEsQ0FBQyx3QkFBd0IsQ0FBQywwQ0FBMEMsQ0FBQzthQUN2RjtZQUNELGNBQWMsRUFBRTtnQkFDZCxZQUFZLEVBQUUsSUFBSSxHQUFHLENBQUMsY0FBYyxDQUFDO29CQUNuQyxVQUFVLEVBQUU7d0JBQ1YsSUFBSSxHQUFHLENBQUMsZUFBZSxDQUFDOzRCQUN0QixPQUFPLEVBQUU7Z0NBQ1AsK0JBQStCO2dDQUMvQix3QkFBd0I7Z0NBQ3hCLG1CQUFtQjtnQ0FDbkIsb0JBQW9COzZCQUNyQjs0QkFDRCxTQUFTLEVBQUUsQ0FBQyxpQkFBaUIsQ0FBQyxTQUFTLENBQUM7eUJBQ3pDLENBQUM7cUJBQ0g7aUJBQ0YsQ0FBQzthQUNIO1NBQ0YsQ0FBQyxDQUFDO1FBRUgscUNBQXFDO1FBQ3JDLE1BQU0saUJBQWlCLEdBQUcsSUFBSSxVQUFVLENBQUMsb0JBQW9CLENBQUMsSUFBSSxFQUFFLGdDQUFnQyxFQUFFO1lBQ3BHLElBQUksRUFBRSwyQkFBMkI7WUFDakMsWUFBWSxFQUFFLEdBQUcsRUFBRSx1QkFBdUI7WUFDMUMsTUFBTSxFQUFFO2dCQUNOLFdBQVc7Z0JBQ1gsTUFBTTtnQkFDTixvQkFBb0I7Z0JBQ3BCLFdBQVc7Z0JBQ1gsVUFBVTtnQkFDVixXQUFXO2dCQUNYLGFBQWE7Z0JBQ2IsU0FBUztnQkFDVCxxQkFBcUI7Z0JBQ3JCLGVBQWU7Z0JBQ2YsWUFBWTtnQkFDWixXQUFXO2dCQUNYLGlCQUFpQjtnQkFDakIsbUJBQW1CO2dCQUNuQixlQUFlO2dCQUNmLGFBQWE7Z0JBQ2IsY0FBYztnQkFDZCxpQkFBaUI7Z0JBQ2pCLGdCQUFnQjtnQkFDaEIsZ0JBQWdCO2dCQUNoQixjQUFjO2dCQUNkLFFBQVE7Z0JBQ1IsWUFBWTtnQkFDWixpQkFBaUI7Z0JBQ2pCLGNBQWM7Z0JBQ2QsWUFBWTtnQkFDWiw2QkFBNkI7Z0JBQzdCLDZCQUE2QjtnQkFDN0IsWUFBWTtnQkFDWixzQkFBc0I7YUFDdkI7WUFDRCxTQUFTLEVBQUUsQ0FBQztvQkFDVixVQUFVLEVBQUUsU0FBUztvQkFDckIsbUJBQW1CLEVBQUU7d0JBQ25CLFNBQVMsRUFBRSxpQkFBaUIsQ0FBQyxTQUFTO3dCQUN0QyxPQUFPLEVBQUUsZUFBZSxDQUFDLE9BQU87cUJBQ2pDO2lCQUNGLENBQUM7U0FDSCxDQUFDLENBQUM7UUFFSCxrRUFBa0U7UUFDbEUsTUFBTSxlQUFlLEdBQUcsSUFBSSxVQUFVLENBQUMsWUFBWSxDQUFDLElBQUksRUFBRSxpQkFBaUIsRUFBRTtZQUMzRSxPQUFPLEVBQUUsc0NBQXNDO1lBQy9DLFdBQVcsRUFBRSxDQUFDLDBCQUEwQixDQUFDO1lBQ3pDLFdBQVcsRUFBRSxXQUFXO1lBQ3hCLGVBQWUsRUFBRTtnQkFDZixNQUFNLEVBQUUsSUFBSSxPQUFPLENBQUMsYUFBYSxDQUFDLEdBQUcsQ0FBQztnQkFDdEMsb0JBQW9CLEVBQUUsVUFBVSxDQUFDLG9CQUFvQixDQUFDLGlCQUFpQjtnQkFDdkUsY0FBYyxFQUFFLFVBQVUsQ0FBQyxjQUFjLENBQUMsU0FBUztnQkFDbkQsV0FBVyxFQUFFLFVBQVUsQ0FBQyxXQUFXLENBQUMsZ0JBQWdCO2dCQUNwRCxtQkFBbUIsRUFBRSxVQUFVLENBQUMsbUJBQW1CLENBQUMsOEJBQThCO2dCQUNsRixxQkFBcUIsRUFBRSxVQUFVLENBQUMscUJBQXFCLENBQUMsc0JBQXNCO2dCQUM5RSxvQkFBb0IsRUFBRTtvQkFDcEI7d0JBQ0UsUUFBUSxFQUFFLElBQUksVUFBVSxDQUFDLFFBQVEsQ0FBQyxJQUFJLEVBQUUscUJBQXFCLEVBQUU7NEJBQzdELElBQUksRUFBRSxVQUFVLENBQUMsWUFBWSxDQUFDLFVBQVUsQ0FBQzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztlQStCeEMsQ0FBQzt5QkFDSCxDQUFDO3dCQUNGLFNBQVMsRUFBRSxVQUFVLENBQUMsaUJBQWlCLENBQUMsY0FBYztxQkFDdkQ7aUJBQ0Y7YUFDRjtZQUNELG1CQUFtQixFQUFFO2dCQUNuQixRQUFRLEVBQUU7b0JBQ1IsTUFBTSxFQUFFLElBQUksT0FBTyxDQUFDLGFBQWEsQ0FBQyxHQUFHLENBQUM7b0JBQ3RDLG9CQUFvQixFQUFFLFVBQVUsQ0FBQyxvQkFBb0IsQ0FBQyxpQkFBaUI7b0JBQ3ZFLGNBQWMsRUFBRSxVQUFVLENBQUMsY0FBYyxDQUFDLFNBQVM7b0JBQ25ELFdBQVcsRUFBRSxVQUFVLENBQUMsV0FBVyxDQUFDLGdCQUFnQjtvQkFDcEQsbUJBQW1CLEVBQUUsVUFBVSxDQUFDLG1CQUFtQixDQUFDLDhCQUE4QjtvQkFDbEYscUJBQXFCLEVBQUUsVUFBVSxDQUFDLHFCQUFxQixDQUFDLHNCQUFzQjtpQkFDL0U7Z0JBQ0QsU0FBUyxFQUFFO29CQUNULE1BQU0sRUFBRSxJQUFJLE9BQU8sQ0FBQyxhQUFhLENBQUMsR0FBRyxDQUFDO29CQUN0QyxvQkFBb0IsRUFBRSxVQUFVLENBQUMsb0JBQW9CLENBQUMsaUJBQWlCO29CQUN2RSxjQUFjLEVBQUUsVUFBVSxDQUFDLGNBQWMsQ0FBQyxTQUFTO29CQUNuRCxXQUFXLEVBQUUsVUFBVSxDQUFDLFdBQVcsQ0FBQyxnQkFBZ0I7b0JBQ3BELG1CQUFtQixFQUFFLFVBQVUsQ0FBQyxtQkFBbUIsQ0FBQyw4QkFBOEI7b0JBQ2xGLHFCQUFxQixFQUFFLFVBQVUsQ0FBQyxxQkFBcUIsQ0FBQyxzQkFBc0I7aUJBQy9FO2dCQUNELFNBQVMsRUFBRTtvQkFDVCxNQUFNLEVBQUUsSUFBSSxPQUFPLENBQUMsYUFBYSxDQUFDLEdBQUcsQ0FBQztvQkFDdEMsb0JBQW9CLEVBQUUsVUFBVSxDQUFDLG9CQUFvQixDQUFDLGlCQUFpQjtvQkFDdkUsY0FBYyxFQUFFLFVBQVUsQ0FBQyxjQUFjLENBQUMsU0FBUztvQkFDbkQsV0FBVyxFQUFFLFVBQVUsQ0FBQyxXQUFXLENBQUMsZ0JBQWdCO29CQUNwRCxtQkFBbUIsRUFBRSxVQUFVLENBQUMsbUJBQW1CLENBQUMsOEJBQThCO29CQUNsRixxQkFBcUIsRUFBRSxVQUFVLENBQUMscUJBQXFCLENBQUMsc0JBQXNCO2lCQUMvRTtnQkFDRCxZQUFZLEVBQUU7b0JBQ1osTUFBTSxFQUFFLElBQUksT0FBTyxDQUFDLGFBQWEsQ0FBQyxHQUFHLENBQUM7b0JBQ3RDLG9CQUFvQixFQUFFLFVBQVUsQ0FBQyxvQkFBb0IsQ0FBQyxpQkFBaUI7b0JBQ3ZFLGNBQWMsRUFBRSxVQUFVLENBQUMsY0FBYyxDQUFDLFNBQVM7b0JBQ25ELFdBQVcsRUFBRSxVQUFVLENBQUMsV0FBVyxDQUFDLGdCQUFnQjtvQkFDcEQsbUJBQW1CLEVBQUUsVUFBVSxDQUFDLG1CQUFtQixDQUFDLDhCQUE4QjtvQkFDbEYscUJBQXFCLEVBQUUsVUFBVSxDQUFDLHFCQUFxQixDQUFDLHNCQUFzQjtpQkFDL0U7YUFDRjtZQUNELFNBQVMsRUFBRSxJQUFJLEVBQUUsQ0FBQyxNQUFNLENBQUMsSUFBSSxFQUFFLG1CQUFtQixFQUFFO2dCQUNsRCxhQUFhLEVBQUUsR0FBRyxDQUFDLGFBQWEsQ0FBQyxNQUFNO2dCQUN2QyxVQUFVLEVBQUUsRUFBRSxDQUFDLGdCQUFnQixDQUFDLFVBQVU7Z0JBQzFDLGlCQUFpQixFQUFFLEVBQUUsQ0FBQyxpQkFBaUIsQ0FBQyxTQUFTO2dCQUNqRCxTQUFTLEVBQUUsSUFBSTtnQkFDZixlQUFlLEVBQUUsRUFBRSxDQUFDLGVBQWUsQ0FBQyxzQkFBc0I7Z0JBQzFELGNBQWMsRUFBRTtvQkFDZDt3QkFDRSxVQUFVLEVBQUUsR0FBRyxDQUFDLFFBQVEsQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUFDLEVBQUUsd0JBQXdCO3FCQUM1RDtpQkFDRjthQUNGLENBQUM7WUFDRixhQUFhLEVBQUUsc0JBQXNCO1lBQ3JDLGtCQUFrQixFQUFFLElBQUk7U0FDekIsQ0FBQyxDQUFDO1FBRUgsNEZBQTRGO1FBQzVGLCtFQUErRTtRQUUvRSxVQUFVO1FBQ1YsSUFBSSxHQUFHLENBQUMsU0FBUyxDQUFDLElBQUksRUFBRSxlQUFlLEVBQUU7WUFDdkMsS0FBSyxFQUFFLFdBQVcsWUFBWSxDQUFDLFVBQVUsRUFBRTtZQUMzQyxXQUFXLEVBQUUsb0NBQW9DO1NBQ2xELENBQUMsQ0FBQztRQUVILElBQUksR0FBRyxDQUFDLFNBQVMsQ0FBQyxJQUFJLEVBQUUsMEJBQTBCLEVBQUU7WUFDbEQsS0FBSyxFQUFFLFlBQVksQ0FBQyxjQUFjO1lBQ2xDLFdBQVcsRUFBRSxtQ0FBbUM7U0FDakQsQ0FBQyxDQUFDO1FBRUgsSUFBSSxHQUFHLENBQUMsU0FBUyxDQUFDLElBQUksRUFBRSxvQkFBb0IsRUFBRTtZQUM1QyxLQUFLLEVBQUUsY0FBYyxDQUFDLFVBQVU7WUFDaEMsV0FBVyxFQUFFLDRDQUE0QztTQUMxRCxDQUFDLENBQUM7UUFFSCxJQUFJLEdBQUcsQ0FBQyxTQUFTLENBQUMsSUFBSSxFQUFFLFFBQVEsRUFBRTtZQUNoQyxLQUFLLEVBQUUsR0FBRyxDQUFDLEdBQUc7WUFDZCxXQUFXLEVBQUUsd0JBQXdCO1NBQ3RDLENBQUMsQ0FBQztRQUVILElBQUksR0FBRyxDQUFDLFNBQVMsQ0FBQyxJQUFJLEVBQUUsbUJBQW1CLEVBQUU7WUFDM0MsS0FBSyxFQUFFLGVBQWUsQ0FBQyxjQUFjO1lBQ3JDLFdBQVcsRUFBRSx1Q0FBdUM7U0FDckQsQ0FBQyxDQUFDO1FBRUgsSUFBSSxHQUFHLENBQUMsU0FBUyxDQUFDLElBQUksRUFBRSxvQkFBb0IsRUFBRTtZQUM1QyxLQUFLLEVBQUUsV0FBVyxlQUFlLENBQUMsVUFBVSxFQUFFO1lBQzlDLFdBQVcsRUFBRSx3Q0FBd0M7U0FDdEQsQ0FBQyxDQUFDO0lBQ0wsQ0FBQztDQUNGO0FBM1pELHNDQTJaQyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCAqIGFzIGNkayBmcm9tICdhd3MtY2RrLWxpYic7XG5pbXBvcnQgKiBhcyBzMyBmcm9tICdhd3MtY2RrLWxpYi9hd3MtczMnO1xuaW1wb3J0ICogYXMgY2xvdWRmcm9udCBmcm9tICdhd3MtY2RrLWxpYi9hd3MtY2xvdWRmcm9udCc7XG5pbXBvcnQgKiBhcyBvcmlnaW5zIGZyb20gJ2F3cy1jZGstbGliL2F3cy1jbG91ZGZyb250LW9yaWdpbnMnO1xuaW1wb3J0ICogYXMgbGFtYmRhIGZyb20gJ2F3cy1jZGstbGliL2F3cy1sYW1iZGEnO1xuaW1wb3J0ICogYXMgYXBpZ2F0ZXdheSBmcm9tICdhd3MtY2RrLWxpYi9hd3MtYXBpZ2F0ZXdheSc7XG5pbXBvcnQgKiBhcyBpYW0gZnJvbSAnYXdzLWNkay1saWIvYXdzLWlhbSc7XG5pbXBvcnQgKiBhcyBzZWNyZXRzbWFuYWdlciBmcm9tICdhd3MtY2RrLWxpYi9hd3Mtc2VjcmV0c21hbmFnZXInO1xuaW1wb3J0ICogYXMgY2VydGlmaWNhdGVtYW5hZ2VyIGZyb20gJ2F3cy1jZGstbGliL2F3cy1jZXJ0aWZpY2F0ZW1hbmFnZXInO1xuaW1wb3J0ICogYXMgbG9ncyBmcm9tICdhd3MtY2RrLWxpYi9hd3MtbG9ncyc7XG5pbXBvcnQgKiBhcyBraW5lc2lzIGZyb20gJ2F3cy1jZGstbGliL2F3cy1raW5lc2lzJztcbmltcG9ydCAqIGFzIHBhdGggZnJvbSAncGF0aCc7XG5pbXBvcnQgeyBDb25zdHJ1Y3QgfSBmcm9tICdjb25zdHJ1Y3RzJztcblxuZXhwb3J0IGNsYXNzIFNldGxpc3RhU3RhY2sgZXh0ZW5kcyBjZGsuU3RhY2sge1xuICBjb25zdHJ1Y3RvcihzY29wZTogQ29uc3RydWN0LCBpZDogc3RyaW5nLCBwcm9wcz86IGNkay5TdGFja1Byb3BzKSB7XG4gICAgc3VwZXIoc2NvcGUsIGlkLCBwcm9wcyk7XG5cbiAgICAvLyBDcmVhdGUgYSBidWNrZXQgZm9yIHRoZSBmcm9udGVuZFxuICAgIGNvbnN0IGZyb250ZW5kQnVja2V0ID0gbmV3IHMzLkJ1Y2tldCh0aGlzLCAnRnJvbnRlbmRCdWNrZXQnLCB7XG4gICAgICB3ZWJzaXRlSW5kZXhEb2N1bWVudDogJ2luZGV4Lmh0bWwnLFxuICAgICAgd2Vic2l0ZUVycm9yRG9jdW1lbnQ6ICdpbmRleC5odG1sJywgLy8gU1BBIHJvdXRpbmdcbiAgICAgIHB1YmxpY1JlYWRBY2Nlc3M6IGZhbHNlLFxuICAgICAgYmxvY2tQdWJsaWNBY2Nlc3M6IHMzLkJsb2NrUHVibGljQWNjZXNzLkJMT0NLX0FMTCxcbiAgICAgIHJlbW92YWxQb2xpY3k6IGNkay5SZW1vdmFsUG9saWN5LkRFU1RST1ksIC8vIEZvciBkZXYvdGVzdCBlbnZpcm9ubWVudHNcbiAgICAgIGF1dG9EZWxldGVPYmplY3RzOiB0cnVlLCAvLyBGb3IgZGV2L3Rlc3QgZW52aXJvbm1lbnRzXG4gICAgfSk7XG5cbiAgICAvLyBDbG91ZEZyb250IGRpc3RyaWJ1dGlvbiBmb3IgdGhlIGZyb250ZW5kICh3aWxsIGJlIGNyZWF0ZWQgYWZ0ZXIgQVBJIEdhdGV3YXkpXG4gICAgbGV0IGRpc3RyaWJ1dGlvbjogY2xvdWRmcm9udC5EaXN0cmlidXRpb247XG5cbiAgICAvLyBJbXBvcnQgZXhpc3Rpbmcgc2VjcmV0c1xuICAgIGNvbnN0IHNldGxpc3RGbUFwaUtleSA9IHNlY3JldHNtYW5hZ2VyLlNlY3JldC5mcm9tU2VjcmV0TmFtZVYyKFxuICAgICAgdGhpcywgXG4gICAgICAnU2V0bGlzdEZtQXBpS2V5JywgXG4gICAgICAnc2V0bGlzdGEvc2V0bGlzdGZtLWFwaS1rZXknXG4gICAgKTtcblxuICAgIGNvbnN0IHNwb3RpZnlDbGllbnRJZCA9IHNlY3JldHNtYW5hZ2VyLlNlY3JldC5mcm9tU2VjcmV0TmFtZVYyKFxuICAgICAgdGhpcywgXG4gICAgICAnU3BvdGlmeUNsaWVudElkJywgXG4gICAgICAnc2V0bGlzdGEvc3BvdGlmeS1jbGllbnQtaWQnXG4gICAgKTtcblxuICAgIGNvbnN0IHNwb3RpZnlDbGllbnRTZWNyZXQgPSBzZWNyZXRzbWFuYWdlci5TZWNyZXQuZnJvbVNlY3JldE5hbWVWMihcbiAgICAgIHRoaXMsIFxuICAgICAgJ1Nwb3RpZnlDbGllbnRTZWNyZXQnLCBcbiAgICAgICdzZXRsaXN0YS9zcG90aWZ5LWNsaWVudC1zZWNyZXQnXG4gICAgKTtcblxuXG4gICAgY29uc3Qgc3BvdGlmeVJlZGlyZWN0VXJpID0gc2VjcmV0c21hbmFnZXIuU2VjcmV0LmZyb21TZWNyZXROYW1lVjIoXG4gICAgICB0aGlzLCBcbiAgICAgICdTcG90aWZ5UmVkaXJlY3RVcmknLCBcbiAgICAgICdzZXRsaXN0YS9zcG90aWZ5LXJlZGlyZWN0LXVyaSdcbiAgICApO1xuXG4gICAgLy8gQ3JlYXRlIFNTTCBjZXJ0aWZpY2F0ZSBmb3IgY3VzdG9tIGRvbWFpblxuICAgIGNvbnN0IGNlcnRpZmljYXRlID0gbmV3IGNlcnRpZmljYXRlbWFuYWdlci5DZXJ0aWZpY2F0ZSh0aGlzLCAnU2V0bGlzdGFDZXJ0aWZpY2F0ZScsIHtcbiAgICAgIGRvbWFpbk5hbWU6ICdzZXRsaXN0YS50ZXJyZW5vLmRldicsXG4gICAgICBzdWJqZWN0QWx0ZXJuYXRpdmVOYW1lczogWydhcGkuc2V0bGlzdGEudGVycmVuby5kZXYnXSxcbiAgICAgIHZhbGlkYXRpb246IGNlcnRpZmljYXRlbWFuYWdlci5DZXJ0aWZpY2F0ZVZhbGlkYXRpb24uZnJvbURucygpLFxuICAgIH0pO1xuXG4gICAgLy8gQ3JlYXRlIExhbWJkYSBmdW5jdGlvbiBmb3IgdGhlIGJhY2tlbmRcbiAgICBjb25zdCBhcGlGdW5jdGlvbiA9IG5ldyBsYW1iZGEuRnVuY3Rpb24odGhpcywgJ0FwaUZ1bmN0aW9uJywge1xuICAgICAgcnVudGltZTogbGFtYmRhLlJ1bnRpbWUuTk9ERUpTXzIyX1gsXG4gICAgICBoYW5kbGVyOiAnZGlzdC9sYW1iZGEubGFtYmRhSGFuZGxlcicsXG4gICAgICBjb2RlOiBsYW1iZGEuQ29kZS5mcm9tQXNzZXQocGF0aC5qb2luKF9fZGlybmFtZSwgJy4uLy4uL2JhY2tlbmQnKSksXG4gICAgICBlbnZpcm9ubWVudDoge1xuICAgICAgICBOT0RFX0VOVjogJ3Byb2R1Y3Rpb24nLFxuICAgICAgfSxcbiAgICAgIHRpbWVvdXQ6IGNkay5EdXJhdGlvbi5zZWNvbmRzKDMwKSxcbiAgICAgIG1lbW9yeVNpemU6IDI1NixcbiAgICAgIGxvZ1JldGVudGlvbjogbG9ncy5SZXRlbnRpb25EYXlzLk9ORV9XRUVLLFxuICAgIH0pO1xuXG4gICAgLy8gR3JhbnQgcGVybWlzc2lvbnMgdG8gYWNjZXNzIHNlY3JldHNcbiAgICBzZXRsaXN0Rm1BcGlLZXkuZ3JhbnRSZWFkKGFwaUZ1bmN0aW9uKTtcbiAgICBzcG90aWZ5Q2xpZW50SWQuZ3JhbnRSZWFkKGFwaUZ1bmN0aW9uKTtcbiAgICBzcG90aWZ5Q2xpZW50U2VjcmV0LmdyYW50UmVhZChhcGlGdW5jdGlvbik7XG4gICAgc3BvdGlmeVJlZGlyZWN0VXJpLmdyYW50UmVhZChhcGlGdW5jdGlvbik7XG5cbiAgICAvLyBDcmVhdGUgQVBJIEdhdGV3YXlcbiAgICBjb25zdCBhcGkgPSBuZXcgYXBpZ2F0ZXdheS5SZXN0QXBpKHRoaXMsICdTZXRsaXN0YUFwaScsIHtcbiAgICAgIGRlc2NyaXB0aW9uOiAnU2V0bGlzdGEgQVBJJyxcbiAgICAgIGRlcGxveU9wdGlvbnM6IHtcbiAgICAgICAgc3RhZ2VOYW1lOiAncHJvZCcsXG4gICAgICAgIGxvZ2dpbmdMZXZlbDogYXBpZ2F0ZXdheS5NZXRob2RMb2dnaW5nTGV2ZWwuSU5GTyxcbiAgICAgICAgZGF0YVRyYWNlRW5hYmxlZDogdHJ1ZSxcbiAgICAgIH0sXG4gICAgICBkZWZhdWx0Q29yc1ByZWZsaWdodE9wdGlvbnM6IHtcbiAgICAgICAgYWxsb3dPcmlnaW5zOiBbJ2h0dHBzOi8vc2V0bGlzdGEudGVycmVuby5kZXYnXSxcbiAgICAgICAgYWxsb3dNZXRob2RzOiBbJ0dFVCcsICdQT1NUJywgJ1BVVCcsICdERUxFVEUnLCAnT1BUSU9OUyddLFxuICAgICAgICBhbGxvd0hlYWRlcnM6IFtcbiAgICAgICAgICAnQ29udGVudC1UeXBlJyxcbiAgICAgICAgICAnWC1BbXotRGF0ZScsXG4gICAgICAgICAgJ0F1dGhvcml6YXRpb24nLFxuICAgICAgICAgICdYLUFwaS1LZXknLFxuICAgICAgICAgICdYLUFtei1TZWN1cml0eS1Ub2tlbicsXG4gICAgICAgICAgJ09yaWdpbicsXG4gICAgICAgICAgJ0FjY2VwdCcsXG4gICAgICAgICAgJ0FjY2Vzcy1Db250cm9sLUFsbG93LU9yaWdpbicsXG4gICAgICAgICAgJ0FjY2Vzcy1Db250cm9sLUFsbG93LUhlYWRlcnMnLFxuICAgICAgICAgICdBY2Nlc3MtQ29udHJvbC1BbGxvdy1NZXRob2RzJyxcbiAgICAgICAgXSxcbiAgICAgICAgYWxsb3dDcmVkZW50aWFsczogdHJ1ZSxcbiAgICAgICAgbWF4QWdlOiBjZGsuRHVyYXRpb24uZGF5cygxKSxcbiAgICAgIH0sXG4gICAgfSk7XG5cbiAgICAvLyBDcmVhdGUgQVBJIEdhdGV3YXkgcmVzb3VyY2VzXG4gICAgY29uc3QgYXBpUmVzb3VyY2UgPSBhcGkucm9vdDtcbiAgICBcbiAgICAvLyBBZGQgcHJveHkgcmVzb3VyY2UgdG8gTGFtYmRhXG4gICAgY29uc3QgcHJveHlSZXNvdXJjZSA9IGFwaVJlc291cmNlLmFkZFByb3h5KHtcbiAgICAgIGRlZmF1bHRJbnRlZ3JhdGlvbjogbmV3IGFwaWdhdGV3YXkuTGFtYmRhSW50ZWdyYXRpb24oYXBpRnVuY3Rpb24sIHtcbiAgICAgICAgcHJveHk6IHRydWUsXG4gICAgICAgIGludGVncmF0aW9uUmVzcG9uc2VzOiBbXG4gICAgICAgICAge1xuICAgICAgICAgICAgc3RhdHVzQ29kZTogJzIwMCcsXG4gICAgICAgICAgICByZXNwb25zZVBhcmFtZXRlcnM6IHtcbiAgICAgICAgICAgICAgJ21ldGhvZC5yZXNwb25zZS5oZWFkZXIuQWNjZXNzLUNvbnRyb2wtQWxsb3ctT3JpZ2luJzogXCInaHR0cHM6Ly9zZXRsaXN0YS50ZXJyZW5vLmRldidcIixcbiAgICAgICAgICAgICAgJ21ldGhvZC5yZXNwb25zZS5oZWFkZXIuQWNjZXNzLUNvbnRyb2wtQWxsb3ctSGVhZGVycyc6IFwiJ0NvbnRlbnQtVHlwZSxYLUFtei1EYXRlLEF1dGhvcml6YXRpb24sWC1BcGktS2V5LFgtQW16LVNlY3VyaXR5LVRva2VuLE9yaWdpbixBY2NlcHQnXCIsXG4gICAgICAgICAgICAgICdtZXRob2QucmVzcG9uc2UuaGVhZGVyLkFjY2Vzcy1Db250cm9sLUFsbG93LU1ldGhvZHMnOiBcIidHRVQsUE9TVCxQVVQsREVMRVRFLE9QVElPTlMnXCIsXG4gICAgICAgICAgICB9LFxuICAgICAgICAgIH0sXG4gICAgICAgIF0sXG4gICAgICB9KSxcbiAgICAgIGFueU1ldGhvZDogdHJ1ZSxcbiAgICAgIGRlZmF1bHRNZXRob2RPcHRpb25zOiB7XG4gICAgICAgIG1ldGhvZFJlc3BvbnNlczogW1xuICAgICAgICAgIHtcbiAgICAgICAgICAgIHN0YXR1c0NvZGU6ICcyMDAnLFxuICAgICAgICAgICAgcmVzcG9uc2VQYXJhbWV0ZXJzOiB7XG4gICAgICAgICAgICAgICdtZXRob2QucmVzcG9uc2UuaGVhZGVyLkFjY2Vzcy1Db250cm9sLUFsbG93LU9yaWdpbic6IHRydWUsXG4gICAgICAgICAgICAgICdtZXRob2QucmVzcG9uc2UuaGVhZGVyLkFjY2Vzcy1Db250cm9sLUFsbG93LUhlYWRlcnMnOiB0cnVlLFxuICAgICAgICAgICAgICAnbWV0aG9kLnJlc3BvbnNlLmhlYWRlci5BY2Nlc3MtQ29udHJvbC1BbGxvdy1NZXRob2RzJzogdHJ1ZSxcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgfSxcbiAgICAgICAgICB7XG4gICAgICAgICAgICBzdGF0dXNDb2RlOiAnNDAwJyxcbiAgICAgICAgICAgIHJlc3BvbnNlUGFyYW1ldGVyczoge1xuICAgICAgICAgICAgICAnbWV0aG9kLnJlc3BvbnNlLmhlYWRlci5BY2Nlc3MtQ29udHJvbC1BbGxvdy1PcmlnaW4nOiB0cnVlLFxuICAgICAgICAgICAgICAnbWV0aG9kLnJlc3BvbnNlLmhlYWRlci5BY2Nlc3MtQ29udHJvbC1BbGxvdy1IZWFkZXJzJzogdHJ1ZSxcbiAgICAgICAgICAgICAgJ21ldGhvZC5yZXNwb25zZS5oZWFkZXIuQWNjZXNzLUNvbnRyb2wtQWxsb3ctTWV0aG9kcyc6IHRydWUsXG4gICAgICAgICAgICB9LFxuICAgICAgICAgIH0sXG4gICAgICAgICAge1xuICAgICAgICAgICAgc3RhdHVzQ29kZTogJzUwMCcsXG4gICAgICAgICAgICByZXNwb25zZVBhcmFtZXRlcnM6IHtcbiAgICAgICAgICAgICAgJ21ldGhvZC5yZXNwb25zZS5oZWFkZXIuQWNjZXNzLUNvbnRyb2wtQWxsb3ctT3JpZ2luJzogdHJ1ZSxcbiAgICAgICAgICAgICAgJ21ldGhvZC5yZXNwb25zZS5oZWFkZXIuQWNjZXNzLUNvbnRyb2wtQWxsb3ctSGVhZGVycyc6IHRydWUsXG4gICAgICAgICAgICAgICdtZXRob2QucmVzcG9uc2UuaGVhZGVyLkFjY2Vzcy1Db250cm9sLUFsbG93LU1ldGhvZHMnOiB0cnVlLFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICB9LFxuICAgICAgICBdLFxuICAgICAgfSxcbiAgICB9KTtcblxuICAgIC8vIE5vdyBjcmVhdGUgQ2xvdWRGcm9udCBkaXN0cmlidXRpb24gYWZ0ZXIgQVBJIEdhdGV3YXkgaXMgZGVmaW5lZFxuICAgIGRpc3RyaWJ1dGlvbiA9IG5ldyBjbG91ZGZyb250LkRpc3RyaWJ1dGlvbih0aGlzLCAnRGlzdHJpYnV0aW9uVjMnLCB7XG4gICAgICBjb21tZW50OiAnU2V0bGlzdGEgQ2xvdWRGcm9udCBEaXN0cmlidXRpb24gdjInLFxuICAgICAgZG9tYWluTmFtZXM6IFsnc2V0bGlzdGEudGVycmVuby5kZXYnXSxcbiAgICAgIGNlcnRpZmljYXRlOiBjZXJ0aWZpY2F0ZSxcbiAgICAgIGRlZmF1bHRCZWhhdmlvcjoge1xuICAgICAgICBvcmlnaW46IG9yaWdpbnMuUzNCdWNrZXRPcmlnaW4ud2l0aE9yaWdpbkFjY2Vzc0NvbnRyb2woZnJvbnRlbmRCdWNrZXQpLFxuICAgICAgICB2aWV3ZXJQcm90b2NvbFBvbGljeTogY2xvdWRmcm9udC5WaWV3ZXJQcm90b2NvbFBvbGljeS5SRURJUkVDVF9UT19IVFRQUyxcbiAgICAgICAgYWxsb3dlZE1ldGhvZHM6IGNsb3VkZnJvbnQuQWxsb3dlZE1ldGhvZHMuQUxMT1dfR0VUX0hFQURfT1BUSU9OUyxcbiAgICAgICAgY2FjaGVQb2xpY3k6IGNsb3VkZnJvbnQuQ2FjaGVQb2xpY3kuQ0FDSElOR19PUFRJTUlaRUQsXG4gICAgICB9LFxuICAgICAgYWRkaXRpb25hbEJlaGF2aW9yczoge1xuICAgICAgICAnL2FwaS8qJzoge1xuICAgICAgICAgIG9yaWdpbjogbmV3IG9yaWdpbnMuUmVzdEFwaU9yaWdpbihhcGksIHtcbiAgICAgICAgICAgIG9yaWdpblBhdGg6ICcvcHJvZCcsXG4gICAgICAgICAgfSksXG4gICAgICAgICAgdmlld2VyUHJvdG9jb2xQb2xpY3k6IGNsb3VkZnJvbnQuVmlld2VyUHJvdG9jb2xQb2xpY3kuUkVESVJFQ1RfVE9fSFRUUFMsXG4gICAgICAgICAgYWxsb3dlZE1ldGhvZHM6IGNsb3VkZnJvbnQuQWxsb3dlZE1ldGhvZHMuQUxMT1dfQUxMLFxuICAgICAgICAgIGNhY2hlUG9saWN5OiBjbG91ZGZyb250LkNhY2hlUG9saWN5LkNBQ0hJTkdfRElTQUJMRUQsXG4gICAgICAgICAgb3JpZ2luUmVxdWVzdFBvbGljeTogY2xvdWRmcm9udC5PcmlnaW5SZXF1ZXN0UG9saWN5LkFMTF9WSUVXRVIsXG4gICAgICAgIH0sXG4gICAgICAgICcvYXV0aC8qJzoge1xuICAgICAgICAgIG9yaWdpbjogbmV3IG9yaWdpbnMuUmVzdEFwaU9yaWdpbihhcGksIHtcbiAgICAgICAgICAgIG9yaWdpblBhdGg6ICcvcHJvZCcsXG4gICAgICAgICAgfSksXG4gICAgICAgICAgdmlld2VyUHJvdG9jb2xQb2xpY3k6IGNsb3VkZnJvbnQuVmlld2VyUHJvdG9jb2xQb2xpY3kuUkVESVJFQ1RfVE9fSFRUUFMsXG4gICAgICAgICAgYWxsb3dlZE1ldGhvZHM6IGNsb3VkZnJvbnQuQWxsb3dlZE1ldGhvZHMuQUxMT1dfQUxMLFxuICAgICAgICAgIGNhY2hlUG9saWN5OiBjbG91ZGZyb250LkNhY2hlUG9saWN5LkNBQ0hJTkdfRElTQUJMRUQsXG4gICAgICAgICAgb3JpZ2luUmVxdWVzdFBvbGljeTogY2xvdWRmcm9udC5PcmlnaW5SZXF1ZXN0UG9saWN5LkFMTF9WSUVXRVIsXG4gICAgICAgIH0sXG4gICAgICB9LFxuICAgICAgZGVmYXVsdFJvb3RPYmplY3Q6ICdpbmRleC5odG1sJyxcbiAgICAgIGVycm9yUmVzcG9uc2VzOiBbXG4gICAgICAgIHtcbiAgICAgICAgICBodHRwU3RhdHVzOiA0MDQsXG4gICAgICAgICAgcmVzcG9uc2VIdHRwU3RhdHVzOiAyMDAsXG4gICAgICAgICAgcmVzcG9uc2VQYWdlUGF0aDogJy9pbmRleC5odG1sJyxcbiAgICAgICAgfSxcbiAgICAgIF0sXG4gICAgfSk7XG5cbiAgICAvLyBHcmFudCBDbG91ZEZyb250IHBlcm1pc3Npb24gdG8gYWNjZXNzIHRoZSBTMyBidWNrZXRcbiAgICBjb25zdCBidWNrZXRQb2xpY3lTdGF0ZW1lbnQgPSBuZXcgaWFtLlBvbGljeVN0YXRlbWVudCh7XG4gICAgICBhY3Rpb25zOiBbJ3MzOkdldE9iamVjdCddLFxuICAgICAgcmVzb3VyY2VzOiBbYCR7ZnJvbnRlbmRCdWNrZXQuYnVja2V0QXJufS8qYF0sXG4gICAgICBwcmluY2lwYWxzOiBbbmV3IGlhbS5TZXJ2aWNlUHJpbmNpcGFsKCdjbG91ZGZyb250LmFtYXpvbmF3cy5jb20nKV0sXG4gICAgICBjb25kaXRpb25zOiB7XG4gICAgICAgIFN0cmluZ0VxdWFsczoge1xuICAgICAgICAgICdBV1M6U291cmNlQXJuJzogYGFybjphd3M6Y2xvdWRmcm9udDo6JHt0aGlzLmFjY291bnR9OmRpc3RyaWJ1dGlvbi8ke2Rpc3RyaWJ1dGlvbi5kaXN0cmlidXRpb25JZH1gLFxuICAgICAgICB9LFxuICAgICAgfSxcbiAgICB9KTtcblxuICAgIGZyb250ZW5kQnVja2V0LmFkZFRvUmVzb3VyY2VQb2xpY3koYnVja2V0UG9saWN5U3RhdGVtZW50KTtcblxuICAgIC8vIENyZWF0ZSBLaW5lc2lzIHN0cmVhbSBmb3IgcmVhbC10aW1lIGxvZ3NcbiAgICBjb25zdCByZWFsVGltZUxvZ1N0cmVhbSA9IG5ldyBraW5lc2lzLlN0cmVhbSh0aGlzLCAnQXBpQ2xvdWRGcm9udFJlYWxUaW1lTG9ncycsIHtcbiAgICAgIHN0cmVhbU1vZGU6IGtpbmVzaXMuU3RyZWFtTW9kZS5PTl9ERU1BTkQsXG4gICAgICByZXRlbnRpb25QZXJpb2Q6IGNkay5EdXJhdGlvbi5ob3VycygyNCksXG4gICAgfSk7XG5cbiAgICAvLyBDcmVhdGUgSUFNIHJvbGUgZm9yIENsb3VkRnJvbnQgdG8gd3JpdGUgdG8gS2luZXNpc1xuICAgIGNvbnN0IHJlYWxUaW1lTG9nUm9sZSA9IG5ldyBpYW0uUm9sZSh0aGlzLCAnQXBpQ2xvdWRGcm9udFJlYWxUaW1lTG9nUm9sZScsIHtcbiAgICAgIGFzc3VtZWRCeTogbmV3IGlhbS5TZXJ2aWNlUHJpbmNpcGFsKCdjbG91ZGZyb250LmFtYXpvbmF3cy5jb20nKSxcbiAgICAgIG1hbmFnZWRQb2xpY2llczogW1xuICAgICAgICBpYW0uTWFuYWdlZFBvbGljeS5mcm9tQXdzTWFuYWdlZFBvbGljeU5hbWUoJ3NlcnZpY2Utcm9sZS9BV1NMYW1iZGFCYXNpY0V4ZWN1dGlvblJvbGUnKSxcbiAgICAgIF0sXG4gICAgICBpbmxpbmVQb2xpY2llczoge1xuICAgICAgICBLaW5lc2lzV3JpdGU6IG5ldyBpYW0uUG9saWN5RG9jdW1lbnQoe1xuICAgICAgICAgIHN0YXRlbWVudHM6IFtcbiAgICAgICAgICAgIG5ldyBpYW0uUG9saWN5U3RhdGVtZW50KHtcbiAgICAgICAgICAgICAgYWN0aW9uczogW1xuICAgICAgICAgICAgICAgICdraW5lc2lzOkRlc2NyaWJlU3RyZWFtU3VtbWFyeScsXG4gICAgICAgICAgICAgICAgJ2tpbmVzaXM6RGVzY3JpYmVTdHJlYW0nLFxuICAgICAgICAgICAgICAgICdraW5lc2lzOlB1dFJlY29yZCcsXG4gICAgICAgICAgICAgICAgJ2tpbmVzaXM6UHV0UmVjb3JkcycsXG4gICAgICAgICAgICAgIF0sXG4gICAgICAgICAgICAgIHJlc291cmNlczogW3JlYWxUaW1lTG9nU3RyZWFtLnN0cmVhbUFybl0sXG4gICAgICAgICAgICB9KSxcbiAgICAgICAgICBdLFxuICAgICAgICB9KSxcbiAgICAgIH0sXG4gICAgfSk7XG5cbiAgICAvLyBDcmVhdGUgcmVhbC10aW1lIGxvZyBjb25maWd1cmF0aW9uXG4gICAgY29uc3QgcmVhbFRpbWVMb2dDb25maWcgPSBuZXcgY2xvdWRmcm9udC5DZm5SZWFsdGltZUxvZ0NvbmZpZyh0aGlzLCAnQXBpQ2xvdWRGcm9udFJlYWxUaW1lTG9nQ29uZmlnJywge1xuICAgICAgbmFtZTogJ0FwaUNsb3VkRnJvbnRSZWFsVGltZUxvZ3MnLFxuICAgICAgc2FtcGxpbmdSYXRlOiAxMDAsIC8vIExvZyAxMDAlIG9mIHJlcXVlc3RzXG4gICAgICBmaWVsZHM6IFtcbiAgICAgICAgJ3RpbWVzdGFtcCcsXG4gICAgICAgICdjLWlwJyxcbiAgICAgICAgJ3RpbWUtdG8tZmlyc3QtYnl0ZScsXG4gICAgICAgICdzYy1zdGF0dXMnLFxuICAgICAgICAnc2MtYnl0ZXMnLFxuICAgICAgICAnY3MtbWV0aG9kJyxcbiAgICAgICAgJ2NzLXByb3RvY29sJyxcbiAgICAgICAgJ2NzLWhvc3QnLFxuICAgICAgICAnY3MtcHJvdG9jb2wtdmVyc2lvbicsXG4gICAgICAgICdjcy11c2VyLWFnZW50JyxcbiAgICAgICAgJ2NzLXJlZmVyZXInLFxuICAgICAgICAnY3MtY29va2llJyxcbiAgICAgICAgJ3gtZWRnZS1sb2NhdGlvbicsXG4gICAgICAgICd4LWVkZ2UtcmVxdWVzdC1pZCcsXG4gICAgICAgICd4LWhvc3QtaGVhZGVyJyxcbiAgICAgICAgJ2NzLXVyaS1zdGVtJyxcbiAgICAgICAgJ2NzLXVyaS1xdWVyeScsXG4gICAgICAgICdzYy1jb250ZW50LXR5cGUnLFxuICAgICAgICAnc2MtY29udGVudC1sZW4nLFxuICAgICAgICAnc2MtcmFuZ2Utc3RhcnQnLFxuICAgICAgICAnc2MtcmFuZ2UtZW5kJyxcbiAgICAgICAgJ2MtcG9ydCcsXG4gICAgICAgICd0aW1lLXRha2VuJyxcbiAgICAgICAgJ3gtZm9yd2FyZGVkLWZvcicsXG4gICAgICAgICdzc2wtcHJvdG9jb2wnLFxuICAgICAgICAnc3NsLWNpcGhlcicsXG4gICAgICAgICd4LWVkZ2UtcmVzcG9uc2UtcmVzdWx0LXR5cGUnLFxuICAgICAgICAneC1lZGdlLWRldGFpbGVkLXJlc3VsdC10eXBlJyxcbiAgICAgICAgJ2ZsZS1zdGF0dXMnLFxuICAgICAgICAnZmxlLWVuY3J5cHRlZC1maWVsZHMnXG4gICAgICBdLFxuICAgICAgZW5kUG9pbnRzOiBbe1xuICAgICAgICBzdHJlYW1UeXBlOiAnS2luZXNpcycsXG4gICAgICAgIGtpbmVzaXNTdHJlYW1Db25maWc6IHtcbiAgICAgICAgICBzdHJlYW1Bcm46IHJlYWxUaW1lTG9nU3RyZWFtLnN0cmVhbUFybixcbiAgICAgICAgICByb2xlQXJuOiByZWFsVGltZUxvZ1JvbGUucm9sZUFybixcbiAgICAgICAgfSxcbiAgICAgIH1dLFxuICAgIH0pO1xuXG4gICAgLy8gQ3JlYXRlIGEgc2VwYXJhdGUgQ2xvdWRGcm9udCBkaXN0cmlidXRpb24gZm9yIHRoZSBBUEkgc3ViZG9tYWluXG4gICAgY29uc3QgYXBpRGlzdHJpYnV0aW9uID0gbmV3IGNsb3VkZnJvbnQuRGlzdHJpYnV0aW9uKHRoaXMsICdBcGlEaXN0cmlidXRpb24nLCB7XG4gICAgICBjb21tZW50OiAnU2V0bGlzdGEgQVBJIENsb3VkRnJvbnQgRGlzdHJpYnV0aW9uJyxcbiAgICAgIGRvbWFpbk5hbWVzOiBbJ2FwaS5zZXRsaXN0YS50ZXJyZW5vLmRldiddLFxuICAgICAgY2VydGlmaWNhdGU6IGNlcnRpZmljYXRlLFxuICAgICAgZGVmYXVsdEJlaGF2aW9yOiB7XG4gICAgICAgIG9yaWdpbjogbmV3IG9yaWdpbnMuUmVzdEFwaU9yaWdpbihhcGkpLFxuICAgICAgICB2aWV3ZXJQcm90b2NvbFBvbGljeTogY2xvdWRmcm9udC5WaWV3ZXJQcm90b2NvbFBvbGljeS5SRURJUkVDVF9UT19IVFRQUyxcbiAgICAgICAgYWxsb3dlZE1ldGhvZHM6IGNsb3VkZnJvbnQuQWxsb3dlZE1ldGhvZHMuQUxMT1dfQUxMLFxuICAgICAgICBjYWNoZVBvbGljeTogY2xvdWRmcm9udC5DYWNoZVBvbGljeS5DQUNISU5HX0RJU0FCTEVELFxuICAgICAgICBvcmlnaW5SZXF1ZXN0UG9saWN5OiBjbG91ZGZyb250Lk9yaWdpblJlcXVlc3RQb2xpY3kuQUxMX1ZJRVdFUl9BTkRfQ0xPVURGUk9OVF8yMDIyLFxuICAgICAgICByZXNwb25zZUhlYWRlcnNQb2xpY3k6IGNsb3VkZnJvbnQuUmVzcG9uc2VIZWFkZXJzUG9saWN5LkNPUlNfQUxMT1dfQUxMX09SSUdJTlMsXG4gICAgICAgIGZ1bmN0aW9uQXNzb2NpYXRpb25zOiBbXG4gICAgICAgICAge1xuICAgICAgICAgICAgZnVuY3Rpb246IG5ldyBjbG91ZGZyb250LkZ1bmN0aW9uKHRoaXMsICdRdWVyeVN0cmluZ0Z1bmN0aW9uJywge1xuICAgICAgICAgICAgICBjb2RlOiBjbG91ZGZyb250LkZ1bmN0aW9uQ29kZS5mcm9tSW5saW5lKGBcbiAgICAgICAgICAgICAgICBmdW5jdGlvbiBoYW5kbGVyKGV2ZW50KSB7XG4gICAgICAgICAgICAgICAgICB2YXIgcmVxdWVzdCA9IGV2ZW50LnJlcXVlc3Q7XG4gICAgICAgICAgICAgICAgICB2YXIgdXJpID0gcmVxdWVzdC51cmk7XG4gICAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICAgIC8vIFJlbW92ZSAvcHJvZCBwcmVmaXggaWYgcHJlc2VudFxuICAgICAgICAgICAgICAgICAgaWYgKHVyaS5zdGFydHNXaXRoKCcvcHJvZC8nKSkge1xuICAgICAgICAgICAgICAgICAgICByZXF1ZXN0LnVyaSA9IHVyaS5zdWJzdHJpbmcoNSk7XG4gICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICAgIC8vIEZvcndhcmQgYWxsIHF1ZXJ5IHBhcmFtZXRlcnNcbiAgICAgICAgICAgICAgICAgIGlmIChyZXF1ZXN0LnF1ZXJ5c3RyaW5nKSB7XG4gICAgICAgICAgICAgICAgICAgIHJlcXVlc3QucXVlcnlzdHJpbmcgPSByZXF1ZXN0LnF1ZXJ5c3RyaW5nO1xuICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgICAvLyBBZGQgQ09SUyBoZWFkZXJzIGZvciBwcmVmbGlnaHQgcmVxdWVzdHNcbiAgICAgICAgICAgICAgICAgIGlmIChyZXF1ZXN0Lm1ldGhvZCA9PT0gJ09QVElPTlMnKSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICAgICAgICAgICAgc3RhdHVzQ29kZTogMjA0LFxuICAgICAgICAgICAgICAgICAgICAgIHN0YXR1c0Rlc2NyaXB0aW9uOiAnTm8gQ29udGVudCcsXG4gICAgICAgICAgICAgICAgICAgICAgaGVhZGVyczoge1xuICAgICAgICAgICAgICAgICAgICAgICAgJ2FjY2Vzcy1jb250cm9sLWFsbG93LW9yaWdpbic6IHsgdmFsdWU6ICdodHRwczovL3NldGxpc3RhLnRlcnJlbm8uZGV2JyB9LFxuICAgICAgICAgICAgICAgICAgICAgICAgJ2FjY2Vzcy1jb250cm9sLWFsbG93LW1ldGhvZHMnOiB7IHZhbHVlOiAnR0VULEhFQUQsT1BUSU9OUyxQT1NULFBVVCcgfSxcbiAgICAgICAgICAgICAgICAgICAgICAgICdhY2Nlc3MtY29udHJvbC1hbGxvdy1oZWFkZXJzJzogeyB2YWx1ZTogJ0NvbnRlbnQtVHlwZSxYLUFtei1EYXRlLEF1dGhvcml6YXRpb24sWC1BcGktS2V5LFgtQW16LVNlY3VyaXR5LVRva2VuLE9yaWdpbixBY2NlcHQnIH0sXG4gICAgICAgICAgICAgICAgICAgICAgICAnYWNjZXNzLWNvbnRyb2wtbWF4LWFnZSc6IHsgdmFsdWU6ICc4NjQwMCcgfVxuICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgfTtcbiAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgICAgcmV0dXJuIHJlcXVlc3Q7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICBgKSxcbiAgICAgICAgICAgIH0pLFxuICAgICAgICAgICAgZXZlbnRUeXBlOiBjbG91ZGZyb250LkZ1bmN0aW9uRXZlbnRUeXBlLlZJRVdFUl9SRVFVRVNULFxuICAgICAgICAgIH0sXG4gICAgICAgIF0sXG4gICAgICB9LFxuICAgICAgYWRkaXRpb25hbEJlaGF2aW9yczoge1xuICAgICAgICAnL2FwaS8qJzoge1xuICAgICAgICAgIG9yaWdpbjogbmV3IG9yaWdpbnMuUmVzdEFwaU9yaWdpbihhcGkpLFxuICAgICAgICAgIHZpZXdlclByb3RvY29sUG9saWN5OiBjbG91ZGZyb250LlZpZXdlclByb3RvY29sUG9saWN5LlJFRElSRUNUX1RPX0hUVFBTLFxuICAgICAgICAgIGFsbG93ZWRNZXRob2RzOiBjbG91ZGZyb250LkFsbG93ZWRNZXRob2RzLkFMTE9XX0FMTCxcbiAgICAgICAgICBjYWNoZVBvbGljeTogY2xvdWRmcm9udC5DYWNoZVBvbGljeS5DQUNISU5HX0RJU0FCTEVELFxuICAgICAgICAgIG9yaWdpblJlcXVlc3RQb2xpY3k6IGNsb3VkZnJvbnQuT3JpZ2luUmVxdWVzdFBvbGljeS5BTExfVklFV0VSX0FORF9DTE9VREZST05UXzIwMjIsXG4gICAgICAgICAgcmVzcG9uc2VIZWFkZXJzUG9saWN5OiBjbG91ZGZyb250LlJlc3BvbnNlSGVhZGVyc1BvbGljeS5DT1JTX0FMTE9XX0FMTF9PUklHSU5TLFxuICAgICAgICB9LFxuICAgICAgICAnL2F1dGgvKic6IHtcbiAgICAgICAgICBvcmlnaW46IG5ldyBvcmlnaW5zLlJlc3RBcGlPcmlnaW4oYXBpKSxcbiAgICAgICAgICB2aWV3ZXJQcm90b2NvbFBvbGljeTogY2xvdWRmcm9udC5WaWV3ZXJQcm90b2NvbFBvbGljeS5SRURJUkVDVF9UT19IVFRQUyxcbiAgICAgICAgICBhbGxvd2VkTWV0aG9kczogY2xvdWRmcm9udC5BbGxvd2VkTWV0aG9kcy5BTExPV19BTEwsXG4gICAgICAgICAgY2FjaGVQb2xpY3k6IGNsb3VkZnJvbnQuQ2FjaGVQb2xpY3kuQ0FDSElOR19ESVNBQkxFRCxcbiAgICAgICAgICBvcmlnaW5SZXF1ZXN0UG9saWN5OiBjbG91ZGZyb250Lk9yaWdpblJlcXVlc3RQb2xpY3kuQUxMX1ZJRVdFUl9BTkRfQ0xPVURGUk9OVF8yMDIyLFxuICAgICAgICAgIHJlc3BvbnNlSGVhZGVyc1BvbGljeTogY2xvdWRmcm9udC5SZXNwb25zZUhlYWRlcnNQb2xpY3kuQ09SU19BTExPV19BTExfT1JJR0lOUyxcbiAgICAgICAgfSxcbiAgICAgICAgJy9wcm9kLyonOiB7XG4gICAgICAgICAgb3JpZ2luOiBuZXcgb3JpZ2lucy5SZXN0QXBpT3JpZ2luKGFwaSksXG4gICAgICAgICAgdmlld2VyUHJvdG9jb2xQb2xpY3k6IGNsb3VkZnJvbnQuVmlld2VyUHJvdG9jb2xQb2xpY3kuUkVESVJFQ1RfVE9fSFRUUFMsXG4gICAgICAgICAgYWxsb3dlZE1ldGhvZHM6IGNsb3VkZnJvbnQuQWxsb3dlZE1ldGhvZHMuQUxMT1dfQUxMLFxuICAgICAgICAgIGNhY2hlUG9saWN5OiBjbG91ZGZyb250LkNhY2hlUG9saWN5LkNBQ0hJTkdfRElTQUJMRUQsXG4gICAgICAgICAgb3JpZ2luUmVxdWVzdFBvbGljeTogY2xvdWRmcm9udC5PcmlnaW5SZXF1ZXN0UG9saWN5LkFMTF9WSUVXRVJfQU5EX0NMT1VERlJPTlRfMjAyMixcbiAgICAgICAgICByZXNwb25zZUhlYWRlcnNQb2xpY3k6IGNsb3VkZnJvbnQuUmVzcG9uc2VIZWFkZXJzUG9saWN5LkNPUlNfQUxMT1dfQUxMX09SSUdJTlMsXG4gICAgICAgIH0sXG4gICAgICAgICcvc3BvdGlmeS8qJzoge1xuICAgICAgICAgIG9yaWdpbjogbmV3IG9yaWdpbnMuUmVzdEFwaU9yaWdpbihhcGkpLFxuICAgICAgICAgIHZpZXdlclByb3RvY29sUG9saWN5OiBjbG91ZGZyb250LlZpZXdlclByb3RvY29sUG9saWN5LlJFRElSRUNUX1RPX0hUVFBTLFxuICAgICAgICAgIGFsbG93ZWRNZXRob2RzOiBjbG91ZGZyb250LkFsbG93ZWRNZXRob2RzLkFMTE9XX0FMTCxcbiAgICAgICAgICBjYWNoZVBvbGljeTogY2xvdWRmcm9udC5DYWNoZVBvbGljeS5DQUNISU5HX0RJU0FCTEVELFxuICAgICAgICAgIG9yaWdpblJlcXVlc3RQb2xpY3k6IGNsb3VkZnJvbnQuT3JpZ2luUmVxdWVzdFBvbGljeS5BTExfVklFV0VSX0FORF9DTE9VREZST05UXzIwMjIsXG4gICAgICAgICAgcmVzcG9uc2VIZWFkZXJzUG9saWN5OiBjbG91ZGZyb250LlJlc3BvbnNlSGVhZGVyc1BvbGljeS5DT1JTX0FMTE9XX0FMTF9PUklHSU5TLFxuICAgICAgICB9LFxuICAgICAgfSxcbiAgICAgIGxvZ0J1Y2tldDogbmV3IHMzLkJ1Y2tldCh0aGlzLCAnQXBpQ2xvdWRGcm9udExvZ3MnLCB7XG4gICAgICAgIHJlbW92YWxQb2xpY3k6IGNkay5SZW1vdmFsUG9saWN5LlJFVEFJTixcbiAgICAgICAgZW5jcnlwdGlvbjogczMuQnVja2V0RW5jcnlwdGlvbi5TM19NQU5BR0VELFxuICAgICAgICBibG9ja1B1YmxpY0FjY2VzczogczMuQmxvY2tQdWJsaWNBY2Nlc3MuQkxPQ0tfQUxMLFxuICAgICAgICB2ZXJzaW9uZWQ6IHRydWUsXG4gICAgICAgIG9iamVjdE93bmVyc2hpcDogczMuT2JqZWN0T3duZXJzaGlwLkJVQ0tFVF9PV05FUl9QUkVGRVJSRUQsXG4gICAgICAgIGxpZmVjeWNsZVJ1bGVzOiBbXG4gICAgICAgICAge1xuICAgICAgICAgICAgZXhwaXJhdGlvbjogY2RrLkR1cmF0aW9uLmRheXMoOTApLCAvLyBLZWVwIGxvZ3MgZm9yIDkwIGRheXNcbiAgICAgICAgICB9LFxuICAgICAgICBdLFxuICAgICAgfSksXG4gICAgICBsb2dGaWxlUHJlZml4OiAnYXBpLWNsb3VkZnJvbnQtbG9ncy8nLFxuICAgICAgbG9nSW5jbHVkZXNDb29raWVzOiB0cnVlLFxuICAgIH0pO1xuXG4gICAgLy8gT3V0cHV0IHRoZSBDbG91ZEZyb250IGRvbWFpbiBzbyBTUE9USUZZX1JFRElSRUNUX1VSSSBjYW4gYmUgY29uZmlndXJlZCBtYW51YWxseSBpZiBuZWVkZWRcbiAgICAvLyBUaGUgTGFtYmRhIHdpbGwgY29uc3RydWN0IHRoZSByZWRpcmVjdCBVUkkgZHluYW1pY2FsbHkgdXNpbmcgdGhlIEhvc3QgaGVhZGVyXG5cbiAgICAvLyBPdXRwdXRzXG4gICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgJ0Nsb3VkRnJvbnRVUkwnLCB7XG4gICAgICB2YWx1ZTogYGh0dHBzOi8vJHtkaXN0cmlidXRpb24uZG9tYWluTmFtZX1gLFxuICAgICAgZGVzY3JpcHRpb246ICdVUkwgb2YgdGhlIENsb3VkRnJvbnQgZGlzdHJpYnV0aW9uJyxcbiAgICB9KTtcblxuICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsICdDbG91ZEZyb250RGlzdHJpYnV0aW9uSWQnLCB7XG4gICAgICB2YWx1ZTogZGlzdHJpYnV0aW9uLmRpc3RyaWJ1dGlvbklkLFxuICAgICAgZGVzY3JpcHRpb246ICdJRCBvZiB0aGUgQ2xvdWRGcm9udCBkaXN0cmlidXRpb24nLFxuICAgIH0pO1xuXG4gICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgJ0Zyb250ZW5kQnVja2V0TmFtZScsIHtcbiAgICAgIHZhbHVlOiBmcm9udGVuZEJ1Y2tldC5idWNrZXROYW1lLFxuICAgICAgZGVzY3JpcHRpb246ICdOYW1lIG9mIHRoZSBTMyBidWNrZXQgaG9zdGluZyB0aGUgZnJvbnRlbmQnLFxuICAgIH0pO1xuXG4gICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgJ0FwaVVSTCcsIHtcbiAgICAgIHZhbHVlOiBhcGkudXJsLFxuICAgICAgZGVzY3JpcHRpb246ICdVUkwgb2YgdGhlIEFQSSBHYXRld2F5JyxcbiAgICB9KTtcblxuICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsICdBcGlEaXN0cmlidXRpb25JZCcsIHtcbiAgICAgIHZhbHVlOiBhcGlEaXN0cmlidXRpb24uZGlzdHJpYnV0aW9uSWQsXG4gICAgICBkZXNjcmlwdGlvbjogJ0lEIG9mIHRoZSBBUEkgQ2xvdWRGcm9udCBkaXN0cmlidXRpb24nLFxuICAgIH0pO1xuXG4gICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgJ0FwaURpc3RyaWJ1dGlvblVSTCcsIHtcbiAgICAgIHZhbHVlOiBgaHR0cHM6Ly8ke2FwaURpc3RyaWJ1dGlvbi5kb21haW5OYW1lfWAsXG4gICAgICBkZXNjcmlwdGlvbjogJ1VSTCBvZiB0aGUgQVBJIENsb3VkRnJvbnQgZGlzdHJpYnV0aW9uJyxcbiAgICB9KTtcbiAgfVxufSJdfQ==