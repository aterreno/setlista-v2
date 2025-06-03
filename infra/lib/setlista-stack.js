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
const path = __importStar(require("path"));
class SetlistaStack extends cdk.Stack {
    // Custom OriginRequestPolicy for API Gateway (no Host header)
    createApiGatewayOriginRequestPolicy(scope) {
        return new cloudfront.OriginRequestPolicy(scope, 'ApiGatewayOriginRequestPolicy', {
            originRequestPolicyName: 'SetlistaApiGatewayOriginRequestPolicy',
            comment: 'Policy for CloudFront -> API Gateway (do NOT forward Host header)',
            headerBehavior: cloudfront.OriginRequestHeaderBehavior.none(), // DO NOT forward Host
            queryStringBehavior: cloudfront.OriginRequestQueryStringBehavior.all(),
            cookieBehavior: cloudfront.OriginRequestCookieBehavior.all(),
        });
    }
    constructor(scope, id, props) {
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
exports.SetlistaStack = SetlistaStack;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic2V0bGlzdGEtc3RhY2suanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyJzZXRsaXN0YS1zdGFjay50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFBQSxpREFBbUM7QUFDbkMsdURBQXlDO0FBQ3pDLHVFQUF5RDtBQUN6RCw0RUFBOEQ7QUFDOUQsK0RBQWlEO0FBQ2pELHVFQUF5RDtBQUN6RCx5REFBMkM7QUFDM0MsK0VBQWlFO0FBQ2pFLHVGQUF5RTtBQUN6RSwyREFBNkM7QUFFN0MsMkNBQTZCO0FBRzdCLE1BQWEsYUFBYyxTQUFRLEdBQUcsQ0FBQyxLQUFLO0lBQzFDLDhEQUE4RDtJQUN0RCxtQ0FBbUMsQ0FBQyxLQUFnQjtRQUMxRCxPQUFPLElBQUksVUFBVSxDQUFDLG1CQUFtQixDQUFDLEtBQUssRUFBRSwrQkFBK0IsRUFBRTtZQUNoRix1QkFBdUIsRUFBRSx1Q0FBdUM7WUFDaEUsT0FBTyxFQUFFLG1FQUFtRTtZQUM1RSxjQUFjLEVBQUUsVUFBVSxDQUFDLDJCQUEyQixDQUFDLElBQUksRUFBRSxFQUFFLHNCQUFzQjtZQUNyRixtQkFBbUIsRUFBRSxVQUFVLENBQUMsZ0NBQWdDLENBQUMsR0FBRyxFQUFFO1lBQ3RFLGNBQWMsRUFBRSxVQUFVLENBQUMsMkJBQTJCLENBQUMsR0FBRyxFQUFFO1NBQzdELENBQUMsQ0FBQztJQUNMLENBQUM7SUFFRCxZQUFZLEtBQWdCLEVBQUUsRUFBVSxFQUFFLEtBQXNCO1FBQzlELEtBQUssQ0FBQyxLQUFLLEVBQUUsRUFBRSxFQUFFLEtBQUssQ0FBQyxDQUFDO1FBRXhCLG1DQUFtQztRQUNuQyxNQUFNLGNBQWMsR0FBRyxJQUFJLEVBQUUsQ0FBQyxNQUFNLENBQUMsSUFBSSxFQUFFLGdCQUFnQixFQUFFO1lBQzNELG9CQUFvQixFQUFFLFlBQVk7WUFDbEMsb0JBQW9CLEVBQUUsWUFBWSxFQUFFLGNBQWM7WUFDbEQsZ0JBQWdCLEVBQUUsSUFB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RCxzQ0FtV0MiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgKiBhcyBjZGsgZnJvbSAnYXdzLWNkay1saWInO1xuaW1wb3J0ICogYXMgczMgZnJvbSAnYXdzLWNkay1saWIvYXdzLXMzJztcbmltcG9ydCAqIGFzIGNsb3VkZnJvbnQgZnJvbSAnYXdzLWNkay1saWIvYXdzLWNsb3VkZnJvbnQnO1xuaW1wb3J0ICogYXMgb3JpZ2lucyBmcm9tICdhd3MtY2RrLWxpYi9hd3MtY2xvdWRmcm9udC1vcmlnaW5zJztcbmltcG9ydCAqIGFzIGxhbWJkYSBmcm9tICdhd3MtY2RrLWxpYi9hd3MtbGFtYmRhJztcbmltcG9ydCAqIGFzIGFwaWdhdGV3YXkgZnJvbSAnYXdzLWNkay1saWIvYXdzLWFwaWdhdGV3YXknO1xuaW1wb3J0ICogYXMgaWFtIGZyb20gJ2F3cy1jZGstbGliL2F3cy1pYW0nO1xuaW1wb3J0ICogYXMgc2VjcmV0c21hbmFnZXIgZnJvbSAnYXdzLWNkay1saWIvYXdzLXNlY3JldHNtYW5hZ2VyJztcbmltcG9ydCAqIGFzIGNlcnRpZmljYXRlbWFuYWdlciBmcm9tICdhd3MtY2RrLWxpYi9hd3MtY2VydGlmaWNhdGVtYW5hZ2VyJztcbmltcG9ydCAqIGFzIGxvZ3MgZnJvbSAnYXdzLWNkay1saWIvYXdzLWxvZ3MnO1xuXG5pbXBvcnQgKiBhcyBwYXRoIGZyb20gJ3BhdGgnO1xuaW1wb3J0IHsgQ29uc3RydWN0IH0gZnJvbSAnY29uc3RydWN0cyc7XG5cbmV4cG9ydCBjbGFzcyBTZXRsaXN0YVN0YWNrIGV4dGVuZHMgY2RrLlN0YWNrIHtcbiAgLy8gQ3VzdG9tIE9yaWdpblJlcXVlc3RQb2xpY3kgZm9yIEFQSSBHYXRld2F5IChubyBIb3N0IGhlYWRlcilcbiAgcHJpdmF0ZSBjcmVhdGVBcGlHYXRld2F5T3JpZ2luUmVxdWVzdFBvbGljeShzY29wZTogQ29uc3RydWN0KTogY2xvdWRmcm9udC5PcmlnaW5SZXF1ZXN0UG9saWN5IHtcbiAgICByZXR1cm4gbmV3IGNsb3VkZnJvbnQuT3JpZ2luUmVxdWVzdFBvbGljeShzY29wZSwgJ0FwaUdhdGV3YXlPcmlnaW5SZXF1ZXN0UG9saWN5Jywge1xuICAgICAgb3JpZ2luUmVxdWVzdFBvbGljeU5hbWU6ICdTZXRsaXN0YUFwaUdhdGV3YXlPcmlnaW5SZXF1ZXN0UG9saWN5JyxcbiAgICAgIGNvbW1lbnQ6ICdQb2xpY3kgZm9yIENsb3VkRnJvbnQgLT4gQVBJIEdhdGV3YXkgKGRvIE5PVCBmb3J3YXJkIEhvc3QgaGVhZGVyKScsXG4gICAgICBoZWFkZXJCZWhhdmlvcjogY2xvdWRmcm9udC5PcmlnaW5SZXF1ZXN0SGVhZGVyQmVoYXZpb3Iubm9uZSgpLCAvLyBETyBOT1QgZm9yd2FyZCBIb3N0XG4gICAgICBxdWVyeVN0cmluZ0JlaGF2aW9yOiBjbG91ZGZyb250Lk9yaWdpblJlcXVlc3RRdWVyeVN0cmluZ0JlaGF2aW9yLmFsbCgpLFxuICAgICAgY29va2llQmVoYXZpb3I6IGNsb3VkZnJvbnQuT3JpZ2luUmVxdWVzdENvb2tpZUJlaGF2aW9yLmFsbCgpLFxuICAgIH0pO1xuICB9XG5cbiAgY29uc3RydWN0b3Ioc2NvcGU6IENvbnN0cnVjdCwgaWQ6IHN0cmluZywgcHJvcHM/OiBjZGsuU3RhY2tQcm9wcykge1xuICAgIHN1cGVyKHNjb3BlLCBpZCwgcHJvcHMpO1xuXG4gICAgLy8gQ3JlYXRlIGEgYnVja2V0IGZvciB0aGUgZnJvbnRlbmRcbiAgICBjb25zdCBmcm9udGVuZEJ1Y2tldCA9IG5ldyBzMy5CdWNrZXQodGhpcywgJ0Zyb250ZW5kQnVja2V0Jywge1xuICAgICAgd2Vic2l0ZUluZGV4RG9jdW1lbnQ6ICdpbmRleC5odG1sJyxcbiAgICAgIHdlYnNpdGVFcnJvckRvY3VtZW50OiAnaW5kZXguaHRtbCcsIC8vIFNQQSByb3V0aW5nXG4gICAgICBwdWJsaWNSZWFkQWNjZXNzOiB0cnVlLFxuICAgICAgYmxvY2tQdWJsaWNBY2Nlc3M6IG5ldyBzMy5CbG9ja1B1YmxpY0FjY2Vzcyh7XG4gICAgICAgIGJsb2NrUHVibGljQWNsczogZmFsc2UsXG4gICAgICAgIGlnbm9yZVB1YmxpY0FjbHM6IGZhbHNlLFxuICAgICAgICBibG9ja1B1YmxpY1BvbGljeTogZmFsc2UsXG4gICAgICAgIHJlc3RyaWN0UHVibGljQnVja2V0czogZmFsc2UsXG4gICAgICB9KSxcbiAgICAgIHJlbW92YWxQb2xpY3k6IGNkay5SZW1vdmFsUG9saWN5LkRFU1RST1ksIC8vIEZvciBkZXYvdGVzdCBlbnZpcm9ubWVudHNcbiAgICAgIGF1dG9EZWxldGVPYmplY3RzOiB0cnVlLCAvLyBGb3IgZGV2L3Rlc3QgZW52aXJvbm1lbnRzXG4gICAgfSk7XG5cbiAgICAvLyBDbG91ZEZyb250IGRpc3RyaWJ1dGlvbiBmb3IgdGhlIGZyb250ZW5kICh3aWxsIGJlIGNyZWF0ZWQgYWZ0ZXIgQVBJIEdhdGV3YXkpXG4gICAgbGV0IGRpc3RyaWJ1dGlvbjogY2xvdWRmcm9udC5EaXN0cmlidXRpb247XG5cblxuXG4gICAgLy8gSW1wb3J0IGV4aXN0aW5nIHNlY3JldHNcbiAgICBjb25zdCBzZXRsaXN0Rm1BcGlLZXkgPSBzZWNyZXRzbWFuYWdlci5TZWNyZXQuZnJvbVNlY3JldE5hbWVWMihcbiAgICAgIHRoaXMsIFxuICAgICAgJ1NldGxpc3RGbUFwaUtleScsIFxuICAgICAgJ3NldGxpc3RhL3NldGxpc3RmbS1hcGkta2V5J1xuICAgICk7XG5cbiAgICBjb25zdCBzcG90aWZ5Q2xpZW50SWQgPSBzZWNyZXRzbWFuYWdlci5TZWNyZXQuZnJvbVNlY3JldE5hbWVWMihcbiAgICAgIHRoaXMsIFxuICAgICAgJ1Nwb3RpZnlDbGllbnRJZCcsIFxuICAgICAgJ3NldGxpc3RhL3Nwb3RpZnktY2xpZW50LWlkJ1xuICAgICk7XG5cbiAgICBjb25zdCBzcG90aWZ5Q2xpZW50U2VjcmV0ID0gc2VjcmV0c21hbmFnZXIuU2VjcmV0LmZyb21TZWNyZXROYW1lVjIoXG4gICAgICB0aGlzLCBcbiAgICAgICdTcG90aWZ5Q2xpZW50U2VjcmV0JywgXG4gICAgICAnc2V0bGlzdGEvc3BvdGlmeS1jbGllbnQtc2VjcmV0J1xuICAgICk7XG5cblxuICAgIGNvbnN0IHNwb3RpZnlSZWRpcmVjdFVyaSA9IHNlY3JldHNtYW5hZ2VyLlNlY3JldC5mcm9tU2VjcmV0TmFtZVYyKFxuICAgICAgdGhpcywgXG4gICAgICAnU3BvdGlmeVJlZGlyZWN0VXJpJywgXG4gICAgICAnc2V0bGlzdGEvc3BvdGlmeS1yZWRpcmVjdC11cmknXG4gICAgKTtcblxuICAgIC8vIENyZWF0ZSBTU0wgY2VydGlmaWNhdGUgZm9yIGN1c3RvbSBkb21haW5cbiAgICBjb25zdCBjZXJ0aWZpY2F0ZSA9IG5ldyBjZXJ0aWZpY2F0ZW1hbmFnZXIuQ2VydGlmaWNhdGUodGhpcywgJ1NldGxpc3RhQ2VydGlmaWNhdGUnLCB7XG4gICAgICBkb21haW5OYW1lOiAnc2V0bGlzdGEudGVycmVuby5kZXYnLFxuICAgICAgc3ViamVjdEFsdGVybmF0aXZlTmFtZXM6IFsnYXBpLnNldGxpc3RhLnRlcnJlbm8uZGV2J10sXG4gICAgICB2YWxpZGF0aW9uOiBjZXJ0aWZpY2F0ZW1hbmFnZXIuQ2VydGlmaWNhdGVWYWxpZGF0aW9uLmZyb21EbnMoKSxcbiAgICB9KTtcblxuICAgIC8vIENsb3VkRnJvbnQgZGlzdHJpYnV0aW9uIGZvciB0aGUgZnJvbnRlbmQgKFNQQSByb3V0aW5nKVxuICAgIGRpc3RyaWJ1dGlvbiA9IG5ldyBjbG91ZGZyb250LkRpc3RyaWJ1dGlvbih0aGlzLCAnRnJvbnRlbmREaXN0cmlidXRpb24nLCB7XG4gICAgICBkZWZhdWx0QmVoYXZpb3I6IHtcbiAgICAgICAgb3JpZ2luOiBuZXcgb3JpZ2lucy5TM1N0YXRpY1dlYnNpdGVPcmlnaW4oZnJvbnRlbmRCdWNrZXQpLFxuICAgICAgICB2aWV3ZXJQcm90b2NvbFBvbGljeTogY2xvdWRmcm9udC5WaWV3ZXJQcm90b2NvbFBvbGljeS5SRURJUkVDVF9UT19IVFRQUyxcbiAgICAgICAgYWxsb3dlZE1ldGhvZHM6IGNsb3VkZnJvbnQuQWxsb3dlZE1ldGhvZHMuQUxMT1dfR0VUX0hFQURfT1BUSU9OUyxcbiAgICAgICAgY2FjaGVQb2xpY3k6IGNsb3VkZnJvbnQuQ2FjaGVQb2xpY3kuQ0FDSElOR19PUFRJTUlaRUQsXG4gICAgICB9LFxuICAgICAgZXJyb3JSZXNwb25zZXM6IFtcbiAgICAgICAge1xuICAgICAgICAgIGh0dHBTdGF0dXM6IDQwMyxcbiAgICAgICAgICByZXNwb25zZUh0dHBTdGF0dXM6IDIwMCxcbiAgICAgICAgICByZXNwb25zZVBhZ2VQYXRoOiAnL2luZGV4Lmh0bWwnLFxuICAgICAgICAgIHR0bDogY2RrLkR1cmF0aW9uLm1pbnV0ZXMoNSksXG4gICAgICAgIH0sXG4gICAgICAgIHtcbiAgICAgICAgICBodHRwU3RhdHVzOiA0MDQsXG4gICAgICAgICAgcmVzcG9uc2VIdHRwU3RhdHVzOiAyMDAsXG4gICAgICAgICAgcmVzcG9uc2VQYWdlUGF0aDogJy9pbmRleC5odG1sJyxcbiAgICAgICAgICB0dGw6IGNkay5EdXJhdGlvbi5taW51dGVzKDUpLFxuICAgICAgICB9LFxuICAgICAgXSwgICAgICBcbiAgICAgIGRvbWFpbk5hbWVzOiBbJ3NldGxpc3RhLnRlcnJlbm8uZGV2J10sXG4gICAgICBjZXJ0aWZpY2F0ZTogY2VydGlmaWNhdGUsXG4gICAgfSk7XG4gICAgLy8gQ3JlYXRlIExhbWJkYSBmdW5jdGlvbiBmb3IgdGhlIGJhY2tlbmRcbiAgICBjb25zdCBhcGlGdW5jdGlvbiA9IG5ldyBsYW1iZGEuRnVuY3Rpb24odGhpcywgJ0FwaUZ1bmN0aW9uJywge1xuICAgICAgcnVudGltZTogbGFtYmRhLlJ1bnRpbWUuTk9ERUpTXzIyX1gsXG4gICAgICBoYW5kbGVyOiAnZGlzdC9sYW1iZGEubGFtYmRhSGFuZGxlcicsXG4gICAgICBjb2RlOiBsYW1iZGEuQ29kZS5mcm9tQXNzZXQocGF0aC5qb2luKF9fZGlybmFtZSwgJy4uLy4uL2JhY2tlbmQnKSksXG4gICAgICBlbnZpcm9ubWVudDoge1xuICAgICAgICBOT0RFX0VOVjogJ3Byb2R1Y3Rpb24nLFxuICAgICAgfSxcbiAgICAgIHRpbWVvdXQ6IGNkay5EdXJhdGlvbi5zZWNvbmRzKDMwKSxcbiAgICAgIG1lbW9yeVNpemU6IDI1NixcbiAgICAgIGxvZ1JldGVudGlvbjogbG9ncy5SZXRlbnRpb25EYXlzLk9ORV9XRUVLLFxuICAgIH0pO1xuXG4gICAgLy8gR3JhbnQgcGVybWlzc2lvbnMgdG8gYWNjZXNzIHNlY3JldHNcbiAgICBzZXRsaXN0Rm1BcGlLZXkuZ3JhbnRSZWFkKGFwaUZ1bmN0aW9uKTtcbiAgICBzcG90aWZ5Q2xpZW50SWQuZ3JhbnRSZWFkKGFwaUZ1bmN0aW9uKTtcbiAgICBzcG90aWZ5Q2xpZW50U2VjcmV0LmdyYW50UmVhZChhcGlGdW5jdGlvbik7XG4gICAgc3BvdGlmeVJlZGlyZWN0VXJpLmdyYW50UmVhZChhcGlGdW5jdGlvbik7XG5cbiAgICAvLyBDcmVhdGUgQVBJIEdhdGV3YXlcbiAgICBjb25zdCBhcGkgPSBuZXcgYXBpZ2F0ZXdheS5SZXN0QXBpKHRoaXMsICdTZXRsaXN0YUFwaScsIHtcbiAgICAgIGRlc2NyaXB0aW9uOiAnU2V0bGlzdGEgQVBJJyxcbiAgICAgIGRlcGxveU9wdGlvbnM6IHtcbiAgICAgICAgc3RhZ2VOYW1lOiAncHJvZCcsXG4gICAgICAgIGxvZ2dpbmdMZXZlbDogYXBpZ2F0ZXdheS5NZXRob2RMb2dnaW5nTGV2ZWwuSU5GTyxcbiAgICAgICAgZGF0YVRyYWNlRW5hYmxlZDogdHJ1ZSxcbiAgICAgIH0sXG4gICAgICBkZWZhdWx0Q29yc1ByZWZsaWdodE9wdGlvbnM6IHtcbiAgICAgICAgYWxsb3dPcmlnaW5zOiBbJ2h0dHBzOi8vc2V0bGlzdGEudGVycmVuby5kZXYnXSxcbiAgICAgICAgYWxsb3dNZXRob2RzOiBbJ0dFVCcsICdQT1NUJywgJ1BVVCcsICdERUxFVEUnLCAnT1BUSU9OUyddLFxuICAgICAgICBhbGxvd0hlYWRlcnM6IFtcbiAgICAgICAgICAnQ29udGVudC1UeXBlJyxcbiAgICAgICAgICAnWC1BbXotRGF0ZScsXG4gICAgICAgICAgJ0F1dGhvcml6YXRpb24nLFxuICAgICAgICAgICdYLUFwaS1LZXknLFxuICAgICAgICAgICdYLUFtei1TZWN1cml0eS1Ub2tlbicsXG4gICAgICAgICAgJ09yaWdpbicsXG4gICAgICAgICAgJ0FjY2VwdCcsXG4gICAgICAgICAgJ0FjY2Vzcy1Db250cm9sLUFsbG93LU9yaWdpbicsXG4gICAgICAgICAgJ0FjY2Vzcy1Db250cm9sLUFsbG93LUhlYWRlcnMnLFxuICAgICAgICAgICdBY2Nlc3MtQ29udHJvbC1BbGxvdy1NZXRob2RzJyxcbiAgICAgICAgXSxcbiAgICAgICAgYWxsb3dDcmVkZW50aWFsczogdHJ1ZSxcbiAgICAgICAgbWF4QWdlOiBjZGsuRHVyYXRpb24uZGF5cygxKSxcbiAgICAgIH0sXG4gICAgfSk7XG5cbiAgICAvLyBDcmVhdGUgQVBJIEdhdGV3YXkgcmVzb3VyY2VzXG4gICAgY29uc3QgYXBpUmVzb3VyY2UgPSBhcGkucm9vdDtcbiAgICBcbiAgICAvLyBBZGQgcHJveHkgcmVzb3VyY2UgdG8gTGFtYmRhXG4gICAgY29uc3QgcHJveHlSZXNvdXJjZSA9IGFwaVJlc291cmNlLmFkZFByb3h5KHtcbiAgICAgIGRlZmF1bHRJbnRlZ3JhdGlvbjogbmV3IGFwaWdhdGV3YXkuTGFtYmRhSW50ZWdyYXRpb24oYXBpRnVuY3Rpb24sIHtcbiAgICAgICAgcHJveHk6IHRydWUsXG4gICAgICAgIGludGVncmF0aW9uUmVzcG9uc2VzOiBbXG4gICAgICAgICAge1xuICAgICAgICAgICAgc3RhdHVzQ29kZTogJzIwMCcsXG4gICAgICAgICAgICByZXNwb25zZVBhcmFtZXRlcnM6IHtcbiAgICAgICAgICAgICAgJ21ldGhvZC5yZXNwb25zZS5oZWFkZXIuQWNjZXNzLUNvbnRyb2wtQWxsb3ctT3JpZ2luJzogXCInaHR0cHM6Ly9zZXRsaXN0YS50ZXJyZW5vLmRldidcIixcbiAgICAgICAgICAgICAgJ21ldGhvZC5yZXNwb25zZS5oZWFkZXIuQWNjZXNzLUNvbnRyb2wtQWxsb3ctSGVhZGVycyc6IFwiJ0NvbnRlbnQtVHlwZSxYLUFtei1EYXRlLEF1dGhvcml6YXRpb24sWC1BcGktS2V5LFgtQW16LVNlY3VyaXR5LVRva2VuLE9yaWdpbixBY2NlcHQnXCIsXG4gICAgICAgICAgICAgICdtZXRob2QucmVzcG9uc2UuaGVhZGVyLkFjY2Vzcy1Db250cm9sLUFsbG93LU1ldGhvZHMnOiBcIidHRVQsUE9TVCxQVVQsREVMRVRFLE9QVElPTlMnXCIsXG4gICAgICAgICAgICB9LFxuICAgICAgICAgIH0sXG4gICAgICAgIF0sXG4gICAgICB9KSxcbiAgICAgIGFueU1ldGhvZDogdHJ1ZSxcbiAgICAgIGRlZmF1bHRNZXRob2RPcHRpb25zOiB7XG4gICAgICAgIG1ldGhvZFJlc3BvbnNlczogW1xuICAgICAgICAgIHtcbiAgICAgICAgICAgIHN0YXR1c0NvZGU6ICcyMDAnLFxuICAgICAgICAgICAgcmVzcG9uc2VQYXJhbWV0ZXJzOiB7XG4gICAgICAgICAgICAgICdtZXRob2QucmVzcG9uc2UuaGVhZGVyLkFjY2Vzcy1Db250cm9sLUFsbG93LU9yaWdpbic6IHRydWUsXG4gICAgICAgICAgICAgICdtZXRob2QucmVzcG9uc2UuaGVhZGVyLkFjY2Vzcy1Db250cm9sLUFsbG93LUhlYWRlcnMnOiB0cnVlLFxuICAgICAgICAgICAgICAnbWV0aG9kLnJlc3BvbnNlLmhlYWRlci5BY2Nlc3MtQ29udHJvbC1BbGxvdy1NZXRob2RzJzogdHJ1ZSxcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgfSxcbiAgICAgICAgICB7XG4gICAgICAgICAgICBzdGF0dXNDb2RlOiAnNDAwJyxcbiAgICAgICAgICAgIHJlc3BvbnNlUGFyYW1ldGVyczoge1xuICAgICAgICAgICAgICAnbWV0aG9kLnJlc3BvbnNlLmhlYWRlci5BY2Nlc3MtQ29udHJvbC1BbGxvdy1PcmlnaW4nOiB0cnVlLFxuICAgICAgICAgICAgICAnbWV0aG9kLnJlc3BvbnNlLmhlYWRlci5BY2Nlc3MtQ29udHJvbC1BbGxvdy1IZWFkZXJzJzogdHJ1ZSxcbiAgICAgICAgICAgICAgJ21ldGhvZC5yZXNwb25zZS5oZWFkZXIuQWNjZXNzLUNvbnRyb2wtQWxsb3ctTWV0aG9kcyc6IHRydWUsXG4gICAgICAgICAgICB9LFxuICAgICAgICAgIH0sXG4gICAgICAgICAge1xuICAgICAgICAgICAgc3RhdHVzQ29kZTogJzUwMCcsXG4gICAgICAgICAgICByZXNwb25zZVBhcmFtZXRlcnM6IHtcbiAgICAgICAgICAgICAgJ21ldGhvZC5yZXNwb25zZS5oZWFkZXIuQWNjZXNzLUNvbnRyb2wtQWxsb3ctT3JpZ2luJzogdHJ1ZSxcbiAgICAgICAgICAgICAgJ21ldGhvZC5yZXNwb25zZS5oZWFkZXIuQWNjZXNzLUNvbnRyb2wtQWxsb3ctSGVhZGVycyc6IHRydWUsXG4gICAgICAgICAgICAgICdtZXRob2QucmVzcG9uc2UuaGVhZGVyLkFjY2Vzcy1Db250cm9sLUFsbG93LU1ldGhvZHMnOiB0cnVlLFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICB9LFxuICAgICAgICBdLFxuICAgICAgfSxcbiAgICB9KTtcblxuICAgIC8vIE5vdyBjcmVhdGUgQ2xvdWRGcm9udCBkaXN0cmlidXRpb24gYWZ0ZXIgQVBJIEdhdGV3YXkgaXMgZGVmaW5lZFxuICAgIC8vIENyZWF0ZSBjdXN0b20gT3JpZ2luUmVxdWVzdFBvbGljeSBmb3IgQVBJIEdhdGV3YXlcbiAgICBjb25zdCBhcGlHYXRld2F5T3JpZ2luUmVxdWVzdFBvbGljeSA9IHRoaXMuY3JlYXRlQXBpR2F0ZXdheU9yaWdpblJlcXVlc3RQb2xpY3kodGhpcyk7XG5cbiAgICAvLyBHcmFudCBDbG91ZEZyb250IHBlcm1pc3Npb24gdG8gYWNjZXNzIHRoZSBTMyBidWNrZXRcbiAgICBjb25zdCBidWNrZXRQb2xpY3lTdGF0ZW1lbnQgPSBuZXcgaWFtLlBvbGljeVN0YXRlbWVudCh7XG4gICAgICBhY3Rpb25zOiBbJ3MzOkdldE9iamVjdCddLFxuICAgICAgcmVzb3VyY2VzOiBbYCR7ZnJvbnRlbmRCdWNrZXQuYnVja2V0QXJufS8qYF0sXG4gICAgICBwcmluY2lwYWxzOiBbbmV3IGlhbS5TZXJ2aWNlUHJpbmNpcGFsKCdjbG91ZGZyb250LmFtYXpvbmF3cy5jb20nKV0sXG4gICAgICBjb25kaXRpb25zOiB7XG4gICAgICAgIFN0cmluZ0VxdWFsczoge1xuICAgICAgICAgICdBV1M6U291cmNlQXJuJzogYGFybjphd3M6Y2xvdWRmcm9udDo6JHt0aGlzLmFjY291bnR9OmRpc3RyaWJ1dGlvbi8ke2Rpc3RyaWJ1dGlvbi5kaXN0cmlidXRpb25JZH1gLFxuICAgICAgICB9LFxuICAgICAgfSxcbiAgICB9KTtcblxuICAgIGZyb250ZW5kQnVja2V0LmFkZFRvUmVzb3VyY2VQb2xpY3koYnVja2V0UG9saWN5U3RhdGVtZW50KTtcblxuICAgIC8vIENyZWF0ZSBhIHNlcGFyYXRlIENsb3VkRnJvbnQgZGlzdHJpYnV0aW9uIGZvciB0aGUgQVBJIHN1YmRvbWFpblxuICAgIGNvbnN0IGFwaURpc3RyaWJ1dGlvbiA9IG5ldyBjbG91ZGZyb250LkRpc3RyaWJ1dGlvbih0aGlzLCAnQXBpRGlzdHJpYnV0aW9uJywge1xuICAgICAgY29tbWVudDogJ1NldGxpc3RhIEFQSSBDbG91ZEZyb250IERpc3RyaWJ1dGlvbicsXG4gICAgICBkb21haW5OYW1lczogWydhcGkuc2V0bGlzdGEudGVycmVuby5kZXYnXSxcbiAgICAgIGNlcnRpZmljYXRlOiBjZXJ0aWZpY2F0ZSxcbiAgICAgIGRlZmF1bHRCZWhhdmlvcjoge1xuICAgICAgICBvcmlnaW46IG5ldyBvcmlnaW5zLlJlc3RBcGlPcmlnaW4oYXBpKSxcbiAgICAgICAgdmlld2VyUHJvdG9jb2xQb2xpY3k6IGNsb3VkZnJvbnQuVmlld2VyUHJvdG9jb2xQb2xpY3kuUkVESVJFQ1RfVE9fSFRUUFMsXG4gICAgICAgIGFsbG93ZWRNZXRob2RzOiBjbG91ZGZyb250LkFsbG93ZWRNZXRob2RzLkFMTE9XX0FMTCxcbiAgICAgICAgY2FjaGVQb2xpY3k6IGNsb3VkZnJvbnQuQ2FjaGVQb2xpY3kuQ0FDSElOR19ESVNBQkxFRCxcbiAgICAgICAgb3JpZ2luUmVxdWVzdFBvbGljeTogYXBpR2F0ZXdheU9yaWdpblJlcXVlc3RQb2xpY3ksXG4gICAgICAgIHJlc3BvbnNlSGVhZGVyc1BvbGljeTogY2xvdWRmcm9udC5SZXNwb25zZUhlYWRlcnNQb2xpY3kuQ09SU19BTExPV19BTExfT1JJR0lOUyxcbiAgICAgICAgZnVuY3Rpb25Bc3NvY2lhdGlvbnM6IFtcbiAgICAgICAgICB7XG4gICAgICAgICAgICBmdW5jdGlvbjogbmV3IGNsb3VkZnJvbnQuRnVuY3Rpb24odGhpcywgJ1F1ZXJ5U3RyaW5nRnVuY3Rpb24nLCB7XG4gICAgICAgICAgICAgIGNvZGU6IGNsb3VkZnJvbnQuRnVuY3Rpb25Db2RlLmZyb21JbmxpbmUoYFxuICAgICAgICAgICAgICAgIGZ1bmN0aW9uIGhhbmRsZXIoZXZlbnQpIHtcbiAgICAgICAgICAgICAgICAgIHZhciByZXF1ZXN0ID0gZXZlbnQucmVxdWVzdDtcbiAgICAgICAgICAgICAgICAgIHZhciB1cmkgPSByZXF1ZXN0LnVyaTtcbiAgICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgICAgLy8gUmVtb3ZlIC9wcm9kIHByZWZpeCBpZiBwcmVzZW50XG4gICAgICAgICAgICAgICAgICBpZiAodXJpLnN0YXJ0c1dpdGgoJy9wcm9kLycpKSB7XG4gICAgICAgICAgICAgICAgICAgIHJlcXVlc3QudXJpID0gdXJpLnN1YnN0cmluZyg1KTtcbiAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgICAgLy8gRm9yd2FyZCBhbGwgcXVlcnkgcGFyYW1ldGVyc1xuICAgICAgICAgICAgICAgICAgaWYgKHJlcXVlc3QucXVlcnlzdHJpbmcpIHtcbiAgICAgICAgICAgICAgICAgICAgcmVxdWVzdC5xdWVyeXN0cmluZyA9IHJlcXVlc3QucXVlcnlzdHJpbmc7XG4gICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICAgIC8vIEFkZCBDT1JTIGhlYWRlcnMgZm9yIHByZWZsaWdodCByZXF1ZXN0c1xuICAgICAgICAgICAgICAgICAgaWYgKHJlcXVlc3QubWV0aG9kID09PSAnT1BUSU9OUycpIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgICAgICAgICAgICBzdGF0dXNDb2RlOiAyMDQsXG4gICAgICAgICAgICAgICAgICAgICAgc3RhdHVzRGVzY3JpcHRpb246ICdObyBDb250ZW50JyxcbiAgICAgICAgICAgICAgICAgICAgICBoZWFkZXJzOiB7XG4gICAgICAgICAgICAgICAgICAgICAgICAnYWNjZXNzLWNvbnRyb2wtYWxsb3ctb3JpZ2luJzogeyB2YWx1ZTogJ2h0dHBzOi8vc2V0bGlzdGEudGVycmVuby5kZXYnIH0sXG4gICAgICAgICAgICAgICAgICAgICAgICAnYWNjZXNzLWNvbnRyb2wtYWxsb3ctbWV0aG9kcyc6IHsgdmFsdWU6ICdHRVQsSEVBRCxPUFRJT05TLFBPU1QsUFVUJyB9LFxuICAgICAgICAgICAgICAgICAgICAgICAgJ2FjY2Vzcy1jb250cm9sLWFsbG93LWhlYWRlcnMnOiB7IHZhbHVlOiAnQ29udGVudC1UeXBlLFgtQW16LURhdGUsQXV0aG9yaXphdGlvbixYLUFwaS1LZXksWC1BbXotU2VjdXJpdHktVG9rZW4sT3JpZ2luLEFjY2VwdCcgfSxcbiAgICAgICAgICAgICAgICAgICAgICAgICdhY2Nlc3MtY29udHJvbC1tYXgtYWdlJzogeyB2YWx1ZTogJzg2NDAwJyB9XG4gICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICB9O1xuICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgICByZXR1cm4gcmVxdWVzdDtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIGApLFxuICAgICAgICAgICAgfSksXG4gICAgICAgICAgICBldmVudFR5cGU6IGNsb3VkZnJvbnQuRnVuY3Rpb25FdmVudFR5cGUuVklFV0VSX1JFUVVFU1QsXG4gICAgICAgICAgfSxcbiAgICAgICAgXSxcbiAgICAgIH0sXG4gICAgICBhZGRpdGlvbmFsQmVoYXZpb3JzOiB7XG4gICAgICAgICcvYXBpLyonOiB7XG4gICAgICAgICAgb3JpZ2luOiBuZXcgb3JpZ2lucy5SZXN0QXBpT3JpZ2luKGFwaSwge1xuICAgICAgICAgICAgb3JpZ2luUGF0aDogJy9wcm9kJyxcbiAgICAgICAgICAgIFxuICAgICAgICAgIH0pLFxuICAgICAgICAgIHZpZXdlclByb3RvY29sUG9saWN5OiBjbG91ZGZyb250LlZpZXdlclByb3RvY29sUG9saWN5LlJFRElSRUNUX1RPX0hUVFBTLFxuICAgICAgICAgIGFsbG93ZWRNZXRob2RzOiBjbG91ZGZyb250LkFsbG93ZWRNZXRob2RzLkFMTE9XX0FMTCxcbiAgICAgICAgICBjYWNoZVBvbGljeTogY2xvdWRmcm9udC5DYWNoZVBvbGljeS5DQUNISU5HX0RJU0FCTEVELFxuICAgICAgICAgIG9yaWdpblJlcXVlc3RQb2xpY3k6IGFwaUdhdGV3YXlPcmlnaW5SZXF1ZXN0UG9saWN5LFxuICAgICAgICAgIHJlc3BvbnNlSGVhZGVyc1BvbGljeTogY2xvdWRmcm9udC5SZXNwb25zZUhlYWRlcnNQb2xpY3kuQ09SU19BTExPV19BTExfT1JJR0lOUyxcbiAgICAgICAgfSxcbiAgICAgICAgJy9hdXRoLyonOiB7XG4gICAgICAgICAgb3JpZ2luOiBuZXcgb3JpZ2lucy5SZXN0QXBpT3JpZ2luKGFwaSwge1xuICAgICAgICAgICAgb3JpZ2luUGF0aDogJy9wcm9kJyxcbiAgICAgICAgICAgIFxuICAgICAgICAgIH0pLFxuICAgICAgICAgIHZpZXdlclByb3RvY29sUG9saWN5OiBjbG91ZGZyb250LlZpZXdlclByb3RvY29sUG9saWN5LlJFRElSRUNUX1RPX0hUVFBTLFxuICAgICAgICAgIGFsbG93ZWRNZXRob2RzOiBjbG91ZGZyb250LkFsbG93ZWRNZXRob2RzLkFMTE9XX0FMTCxcbiAgICAgICAgICBjYWNoZVBvbGljeTogY2xvdWRmcm9udC5DYWNoZVBvbGljeS5DQUNISU5HX0RJU0FCTEVELFxuICAgICAgICAgIG9yaWdpblJlcXVlc3RQb2xpY3k6IGFwaUdhdGV3YXlPcmlnaW5SZXF1ZXN0UG9saWN5LFxuICAgICAgICAgIHJlc3BvbnNlSGVhZGVyc1BvbGljeTogY2xvdWRmcm9udC5SZXNwb25zZUhlYWRlcnNQb2xpY3kuQ09SU19BTExPV19BTExfT1JJR0lOUyxcbiAgICAgICAgfSxcbiAgICAgICAgJy9wcm9kLyonOiB7XG4gICAgICAgICAgb3JpZ2luOiBuZXcgb3JpZ2lucy5SZXN0QXBpT3JpZ2luKGFwaSwge1xuICAgICAgICAgICAgb3JpZ2luUGF0aDogJy9wcm9kJyxcbiAgICAgICAgICAgIFxuICAgICAgICAgIH0pLFxuICAgICAgICAgIHZpZXdlclByb3RvY29sUG9saWN5OiBjbG91ZGZyb250LlZpZXdlclByb3RvY29sUG9saWN5LlJFRElSRUNUX1RPX0hUVFBTLFxuICAgICAgICAgIGFsbG93ZWRNZXRob2RzOiBjbG91ZGZyb250LkFsbG93ZWRNZXRob2RzLkFMTE9XX0FMTCxcbiAgICAgICAgICBjYWNoZVBvbGljeTogY2xvdWRmcm9udC5DYWNoZVBvbGljeS5DQUNISU5HX0RJU0FCTEVELFxuICAgICAgICAgIG9yaWdpblJlcXVlc3RQb2xpY3k6IGFwaUdhdGV3YXlPcmlnaW5SZXF1ZXN0UG9saWN5LFxuICAgICAgICAgIHJlc3BvbnNlSGVhZGVyc1BvbGljeTogY2xvdWRmcm9udC5SZXNwb25zZUhlYWRlcnNQb2xpY3kuQ09SU19BTExPV19BTExfT1JJR0lOUyxcbiAgICAgICAgfSxcbiAgICAgICAgJy9zcG90aWZ5LyonOiB7XG4gICAgICAgICAgb3JpZ2luOiBuZXcgb3JpZ2lucy5SZXN0QXBpT3JpZ2luKGFwaSwge1xuICAgICAgICAgICAgb3JpZ2luUGF0aDogJy9wcm9kJyxcbiAgICAgICAgICAgIFxuICAgICAgICAgIH0pLFxuICAgICAgICAgIHZpZXdlclByb3RvY29sUG9saWN5OiBjbG91ZGZyb250LlZpZXdlclByb3RvY29sUG9saWN5LlJFRElSRUNUX1RPX0hUVFBTLFxuICAgICAgICAgIGFsbG93ZWRNZXRob2RzOiBjbG91ZGZyb250LkFsbG93ZWRNZXRob2RzLkFMTE9XX0FMTCxcbiAgICAgICAgICBjYWNoZVBvbGljeTogY2xvdWRmcm9udC5DYWNoZVBvbGljeS5DQUNISU5HX0RJU0FCTEVELFxuICAgICAgICAgIG9yaWdpblJlcXVlc3RQb2xpY3k6IGFwaUdhdGV3YXlPcmlnaW5SZXF1ZXN0UG9saWN5LFxuICAgICAgICAgIHJlc3BvbnNlSGVhZGVyc1BvbGljeTogY2xvdWRmcm9udC5SZXNwb25zZUhlYWRlcnNQb2xpY3kuQ09SU19BTExPV19BTExfT1JJR0lOUyxcbiAgICAgICAgfSxcbiAgICAgIH0sXG4gICAgICBsb2dCdWNrZXQ6IG5ldyBzMy5CdWNrZXQodGhpcywgJ0FwaUNsb3VkRnJvbnRMb2dzJywge1xuICAgICAgICByZW1vdmFsUG9saWN5OiBjZGsuUmVtb3ZhbFBvbGljeS5SRVRBSU4sXG4gICAgICAgIGVuY3J5cHRpb246IHMzLkJ1Y2tldEVuY3J5cHRpb24uUzNfTUFOQUdFRCxcbiAgICAgICAgYmxvY2tQdWJsaWNBY2Nlc3M6IHMzLkJsb2NrUHVibGljQWNjZXNzLkJMT0NLX0FMTCxcbiAgICAgICAgdmVyc2lvbmVkOiB0cnVlLFxuICAgICAgICBvYmplY3RPd25lcnNoaXA6IHMzLk9iamVjdE93bmVyc2hpcC5CVUNLRVRfT1dORVJfUFJFRkVSUkVELFxuICAgICAgICBsaWZlY3ljbGVSdWxlczogW1xuICAgICAgICAgIHtcbiAgICAgICAgICAgIGV4cGlyYXRpb246IGNkay5EdXJhdGlvbi5kYXlzKDkwKSwgLy8gS2VlcCBsb2dzIGZvciA5MCBkYXlzXG4gICAgICAgICAgfSxcbiAgICAgICAgXSxcbiAgICAgIH0pLFxuICAgICAgbG9nRmlsZVByZWZpeDogJ2FwaS1jbG91ZGZyb250LWxvZ3MvJyxcbiAgICAgIGxvZ0luY2x1ZGVzQ29va2llczogdHJ1ZSxcbiAgICB9KTtcblxuICAgIC8vIE91dHB1dCB0aGUgQ2xvdWRGcm9udCBkb21haW4gc28gU1BPVElGWV9SRURJUkVDVF9VUkkgY2FuIGJlIGNvbmZpZ3VyZWQgbWFudWFsbHkgaWYgbmVlZGVkXG4gICAgLy8gVGhlIExhbWJkYSB3aWxsIGNvbnN0cnVjdCB0aGUgcmVkaXJlY3QgVVJJIGR5bmFtaWNhbGx5IHVzaW5nIHRoZSBIb3N0IGhlYWRlclxuXG4gICAgLy8gT3V0cHV0c1xuICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsICdDbG91ZEZyb250VVJMJywge1xuICAgICAgdmFsdWU6IGBodHRwczovLyR7ZGlzdHJpYnV0aW9uLmRvbWFpbk5hbWV9YCxcbiAgICAgIGRlc2NyaXB0aW9uOiAnVVJMIG9mIHRoZSBDbG91ZEZyb250IGRpc3RyaWJ1dGlvbicsXG4gICAgfSk7XG5cbiAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCAnQ2xvdWRGcm9udERpc3RyaWJ1dGlvbklkJywge1xuICAgICAgdmFsdWU6IGRpc3RyaWJ1dGlvbi5kaXN0cmlidXRpb25JZCxcbiAgICAgIGRlc2NyaXB0aW9uOiAnSUQgb2YgdGhlIENsb3VkRnJvbnQgZGlzdHJpYnV0aW9uJyxcbiAgICB9KTtcblxuICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsICdGcm9udGVuZEJ1Y2tldE5hbWUnLCB7XG4gICAgICB2YWx1ZTogZnJvbnRlbmRCdWNrZXQuYnVja2V0TmFtZSxcbiAgICAgIGRlc2NyaXB0aW9uOiAnTmFtZSBvZiB0aGUgUzMgYnVja2V0IGhvc3RpbmcgdGhlIGZyb250ZW5kJyxcbiAgICB9KTtcblxuICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsICdBcGlVUkwnLCB7XG4gICAgICB2YWx1ZTogYXBpLnVybCxcbiAgICAgIGRlc2NyaXB0aW9uOiAnVVJMIG9mIHRoZSBBUEkgR2F0ZXdheScsXG4gICAgfSk7XG5cbiAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCAnQXBpRGlzdHJpYnV0aW9uSWQnLCB7XG4gICAgICB2YWx1ZTogYXBpRGlzdHJpYnV0aW9uLmRpc3RyaWJ1dGlvbklkLFxuICAgICAgZGVzY3JpcHRpb246ICdJRCBvZiB0aGUgQVBJIENsb3VkRnJvbnQgZGlzdHJpYnV0aW9uJyxcbiAgICB9KTtcblxuICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsICdBcGlEaXN0cmlidXRpb25VUkwnLCB7XG4gICAgICB2YWx1ZTogYGh0dHBzOi8vJHthcGlEaXN0cmlidXRpb24uZG9tYWluTmFtZX1gLFxuICAgICAgZGVzY3JpcHRpb246ICdVUkwgb2YgdGhlIEFQSSBDbG91ZEZyb250IGRpc3RyaWJ1dGlvbicsXG4gICAgfSk7XG4gIH1cbn0iXX0=