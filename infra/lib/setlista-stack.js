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
        // Create custom OriginRequestPolicy for API Gateway
        const apiGatewayOriginRequestPolicy = this.createApiGatewayOriginRequestPolicy(this);
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
                    originRequestPolicy: apiGatewayOriginRequestPolicy,
                },
                '/auth/*': {
                    origin: new origins.RestApiOrigin(api, {
                        originPath: '/prod',
                    }),
                    viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
                    allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL,
                    cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED,
                    originRequestPolicy: apiGatewayOriginRequestPolicy,
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
        // Create custom OriginRequestPolicy for API Gateway
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic2V0bGlzdGEtc3RhY2suanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyJzZXRsaXN0YS1zdGFjay50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFBQSxpREFBbUM7QUFDbkMsdURBQXlDO0FBQ3pDLHVFQUF5RDtBQUN6RCw0RUFBOEQ7QUFDOUQsK0RBQWlEO0FBQ2pELHVFQUF5RDtBQUN6RCx5REFBMkM7QUFDM0MsK0VBQWlFO0FBQ2pFLHVGQUF5RTtBQUN6RSwyREFBNkM7QUFFN0MsMkNBQTZCO0FBRzdCLE1BQWEsYUFBYyxTQUFRLEdBQUcsQ0FBQyxLQUFLO0lBQzFDLDhEQUE4RDtJQUN0RCxtQ0FBbUMsQ0FBQyxLQUFnQjtRQUMxRCxPQUFPLElBQUksVUFBVSxDQUFDLG1CQUFtQixDQUFDLEtBQUssRUFBRSwrQkFBK0IsRUFBRTtZQUNoRix1QkFBdUIsRUFBRSx1Q0FBdUM7WUFDaEUsT0FBTyxFQUFFLG1FQUFtRTtZQUM1RSxjQUFjLEVBQUUsVUFBVSxDQUFDLDJCQUEyQixDQUFDLElBQUksRUFBRSxFQUFFLHNCQUFzQjtZQUNyRixtQkFBbUIsRUFBRSxVQUFVLENBQUMsZ0NBQWdDLENBQUMsR0FBRyxFQUFFO1lBQ3RFLGNBQWMsRUFBRSxVQUFVLENBQUMsMkJBQTJCLENBQUMsR0FBRyxFQUFFO1NBQzdELENBQUMsQ0FBQztJQUNMLENBQUM7SUFFRCxZQUFZLEtBQWdCLEVBQUUsRUFBVSxFQUFFLEtBQXNCO1FBQzlELEtBQUssQ0FBQyxLQUFLLEVBQUUsRUFBRSxFQUFFLEtBQUssQ0FBQyxDQUFDO1FBRXhCLG1DQUFtQztRQUNuQyxNQUFNLGNBQWMsR0FBRyxJQUFJLEVBQUUsQ0FBQyxNQUFNLENBQUMsSUFBSSxFQUFFLGdCQUFnQixFQUFFO1lBQzNELG9CQUFvQixFQUFFLFlBQVk7WUFDbEMsb0JBQW9CLEVBQUUsWUFBWSxFQUFFLGNBQWM7WUFDbEQsZ0JBQWdCLEVBQUUsS0FB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Q2QsV0FBVyxFQUFFLHdCQUF3QjtTQUN0QyxDQUFDLENBQUM7UUFFSCxJQUFJLEdBQUcsQ0FBQyxTQUFTLENBQUMsSUFBSSxFQUFFLG1CQUFtQixFQUFFO1lBQzNDLEtBQUssRUFBRSxlQUFlLENBQUMsY0FBYztZQUNyQyxXQUFXLEVBQUUsdUNBQXVDO1NBQ3JELENBQUMsQ0FBQztRQUVILElBQUksR0FBRyxDQUFDLFNBQVMsQ0FBQyxJQUFJLEVBQUUsb0JBQW9CLEVBQUU7WUFDNUMsS0FBSyxFQUFFLFdBQVcsZUFBZSxDQUFDLFVBQVUsRUFBRTtZQUM5QyxXQUFXLEVBQUUsd0NBQXdDO1NBQ3RELENBQUMsQ0FBQztJQUNMLENBQUM7Q0FDRjtBQTlXRCxzQ0E4V0MiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgKiBhcyBjZGsgZnJvbSAnYXdzLWNkay1saWInO1xuaW1wb3J0ICogYXMgczMgZnJvbSAnYXdzLWNkay1saWIvYXdzLXMzJztcbmltcG9ydCAqIGFzIGNsb3VkZnJvbnQgZnJvbSAnYXdzLWNkay1saWIvYXdzLWNsb3VkZnJvbnQnO1xuaW1wb3J0ICogYXMgb3JpZ2lucyBmcm9tICdhd3MtY2RrLWxpYi9hd3MtY2xvdWRmcm9udC1vcmlnaW5zJztcbmltcG9ydCAqIGFzIGxhbWJkYSBmcm9tICdhd3MtY2RrLWxpYi9hd3MtbGFtYmRhJztcbmltcG9ydCAqIGFzIGFwaWdhdGV3YXkgZnJvbSAnYXdzLWNkay1saWIvYXdzLWFwaWdhdGV3YXknO1xuaW1wb3J0ICogYXMgaWFtIGZyb20gJ2F3cy1jZGstbGliL2F3cy1pYW0nO1xuaW1wb3J0ICogYXMgc2VjcmV0c21hbmFnZXIgZnJvbSAnYXdzLWNkay1saWIvYXdzLXNlY3JldHNtYW5hZ2VyJztcbmltcG9ydCAqIGFzIGNlcnRpZmljYXRlbWFuYWdlciBmcm9tICdhd3MtY2RrLWxpYi9hd3MtY2VydGlmaWNhdGVtYW5hZ2VyJztcbmltcG9ydCAqIGFzIGxvZ3MgZnJvbSAnYXdzLWNkay1saWIvYXdzLWxvZ3MnO1xuXG5pbXBvcnQgKiBhcyBwYXRoIGZyb20gJ3BhdGgnO1xuaW1wb3J0IHsgQ29uc3RydWN0IH0gZnJvbSAnY29uc3RydWN0cyc7XG5cbmV4cG9ydCBjbGFzcyBTZXRsaXN0YVN0YWNrIGV4dGVuZHMgY2RrLlN0YWNrIHtcbiAgLy8gQ3VzdG9tIE9yaWdpblJlcXVlc3RQb2xpY3kgZm9yIEFQSSBHYXRld2F5IChubyBIb3N0IGhlYWRlcilcbiAgcHJpdmF0ZSBjcmVhdGVBcGlHYXRld2F5T3JpZ2luUmVxdWVzdFBvbGljeShzY29wZTogQ29uc3RydWN0KTogY2xvdWRmcm9udC5PcmlnaW5SZXF1ZXN0UG9saWN5IHtcbiAgICByZXR1cm4gbmV3IGNsb3VkZnJvbnQuT3JpZ2luUmVxdWVzdFBvbGljeShzY29wZSwgJ0FwaUdhdGV3YXlPcmlnaW5SZXF1ZXN0UG9saWN5Jywge1xuICAgICAgb3JpZ2luUmVxdWVzdFBvbGljeU5hbWU6ICdTZXRsaXN0YUFwaUdhdGV3YXlPcmlnaW5SZXF1ZXN0UG9saWN5JyxcbiAgICAgIGNvbW1lbnQ6ICdQb2xpY3kgZm9yIENsb3VkRnJvbnQgLT4gQVBJIEdhdGV3YXkgKGRvIE5PVCBmb3J3YXJkIEhvc3QgaGVhZGVyKScsXG4gICAgICBoZWFkZXJCZWhhdmlvcjogY2xvdWRmcm9udC5PcmlnaW5SZXF1ZXN0SGVhZGVyQmVoYXZpb3Iubm9uZSgpLCAvLyBETyBOT1QgZm9yd2FyZCBIb3N0XG4gICAgICBxdWVyeVN0cmluZ0JlaGF2aW9yOiBjbG91ZGZyb250Lk9yaWdpblJlcXVlc3RRdWVyeVN0cmluZ0JlaGF2aW9yLmFsbCgpLFxuICAgICAgY29va2llQmVoYXZpb3I6IGNsb3VkZnJvbnQuT3JpZ2luUmVxdWVzdENvb2tpZUJlaGF2aW9yLmFsbCgpLFxuICAgIH0pO1xuICB9XG5cbiAgY29uc3RydWN0b3Ioc2NvcGU6IENvbnN0cnVjdCwgaWQ6IHN0cmluZywgcHJvcHM/OiBjZGsuU3RhY2tQcm9wcykge1xuICAgIHN1cGVyKHNjb3BlLCBpZCwgcHJvcHMpO1xuXG4gICAgLy8gQ3JlYXRlIGEgYnVja2V0IGZvciB0aGUgZnJvbnRlbmRcbiAgICBjb25zdCBmcm9udGVuZEJ1Y2tldCA9IG5ldyBzMy5CdWNrZXQodGhpcywgJ0Zyb250ZW5kQnVja2V0Jywge1xuICAgICAgd2Vic2l0ZUluZGV4RG9jdW1lbnQ6ICdpbmRleC5odG1sJyxcbiAgICAgIHdlYnNpdGVFcnJvckRvY3VtZW50OiAnaW5kZXguaHRtbCcsIC8vIFNQQSByb3V0aW5nXG4gICAgICBwdWJsaWNSZWFkQWNjZXNzOiBmYWxzZSxcbiAgICAgIGJsb2NrUHVibGljQWNjZXNzOiBzMy5CbG9ja1B1YmxpY0FjY2Vzcy5CTE9DS19BTEwsXG4gICAgICByZW1vdmFsUG9saWN5OiBjZGsuUmVtb3ZhbFBvbGljeS5ERVNUUk9ZLCAvLyBGb3IgZGV2L3Rlc3QgZW52aXJvbm1lbnRzXG4gICAgICBhdXRvRGVsZXRlT2JqZWN0czogdHJ1ZSwgLy8gRm9yIGRldi90ZXN0IGVudmlyb25tZW50c1xuICAgIH0pO1xuXG4gICAgLy8gQ2xvdWRGcm9udCBkaXN0cmlidXRpb24gZm9yIHRoZSBmcm9udGVuZCAod2lsbCBiZSBjcmVhdGVkIGFmdGVyIEFQSSBHYXRld2F5KVxuICAgIGxldCBkaXN0cmlidXRpb246IGNsb3VkZnJvbnQuRGlzdHJpYnV0aW9uO1xuXG4gICAgLy8gSW1wb3J0IGV4aXN0aW5nIHNlY3JldHNcbiAgICBjb25zdCBzZXRsaXN0Rm1BcGlLZXkgPSBzZWNyZXRzbWFuYWdlci5TZWNyZXQuZnJvbVNlY3JldE5hbWVWMihcbiAgICAgIHRoaXMsIFxuICAgICAgJ1NldGxpc3RGbUFwaUtleScsIFxuICAgICAgJ3NldGxpc3RhL3NldGxpc3RmbS1hcGkta2V5J1xuICAgICk7XG5cbiAgICBjb25zdCBzcG90aWZ5Q2xpZW50SWQgPSBzZWNyZXRzbWFuYWdlci5TZWNyZXQuZnJvbVNlY3JldE5hbWVWMihcbiAgICAgIHRoaXMsIFxuICAgICAgJ1Nwb3RpZnlDbGllbnRJZCcsIFxuICAgICAgJ3NldGxpc3RhL3Nwb3RpZnktY2xpZW50LWlkJ1xuICAgICk7XG5cbiAgICBjb25zdCBzcG90aWZ5Q2xpZW50U2VjcmV0ID0gc2VjcmV0c21hbmFnZXIuU2VjcmV0LmZyb21TZWNyZXROYW1lVjIoXG4gICAgICB0aGlzLCBcbiAgICAgICdTcG90aWZ5Q2xpZW50U2VjcmV0JywgXG4gICAgICAnc2V0bGlzdGEvc3BvdGlmeS1jbGllbnQtc2VjcmV0J1xuICAgICk7XG5cblxuICAgIGNvbnN0IHNwb3RpZnlSZWRpcmVjdFVyaSA9IHNlY3JldHNtYW5hZ2VyLlNlY3JldC5mcm9tU2VjcmV0TmFtZVYyKFxuICAgICAgdGhpcywgXG4gICAgICAnU3BvdGlmeVJlZGlyZWN0VXJpJywgXG4gICAgICAnc2V0bGlzdGEvc3BvdGlmeS1yZWRpcmVjdC11cmknXG4gICAgKTtcblxuICAgIC8vIENyZWF0ZSBTU0wgY2VydGlmaWNhdGUgZm9yIGN1c3RvbSBkb21haW5cbiAgICBjb25zdCBjZXJ0aWZpY2F0ZSA9IG5ldyBjZXJ0aWZpY2F0ZW1hbmFnZXIuQ2VydGlmaWNhdGUodGhpcywgJ1NldGxpc3RhQ2VydGlmaWNhdGUnLCB7XG4gICAgICBkb21haW5OYW1lOiAnc2V0bGlzdGEudGVycmVuby5kZXYnLFxuICAgICAgc3ViamVjdEFsdGVybmF0aXZlTmFtZXM6IFsnYXBpLnNldGxpc3RhLnRlcnJlbm8uZGV2J10sXG4gICAgICB2YWxpZGF0aW9uOiBjZXJ0aWZpY2F0ZW1hbmFnZXIuQ2VydGlmaWNhdGVWYWxpZGF0aW9uLmZyb21EbnMoKSxcbiAgICB9KTtcblxuICAgIC8vIENyZWF0ZSBMYW1iZGEgZnVuY3Rpb24gZm9yIHRoZSBiYWNrZW5kXG4gICAgY29uc3QgYXBpRnVuY3Rpb24gPSBuZXcgbGFtYmRhLkZ1bmN0aW9uKHRoaXMsICdBcGlGdW5jdGlvbicsIHtcbiAgICAgIHJ1bnRpbWU6IGxhbWJkYS5SdW50aW1lLk5PREVKU18yMl9YLFxuICAgICAgaGFuZGxlcjogJ2Rpc3QvbGFtYmRhLmxhbWJkYUhhbmRsZXInLFxuICAgICAgY29kZTogbGFtYmRhLkNvZGUuZnJvbUFzc2V0KHBhdGguam9pbihfX2Rpcm5hbWUsICcuLi8uLi9iYWNrZW5kJykpLFxuICAgICAgZW52aXJvbm1lbnQ6IHtcbiAgICAgICAgTk9ERV9FTlY6ICdwcm9kdWN0aW9uJyxcbiAgICAgIH0sXG4gICAgICB0aW1lb3V0OiBjZGsuRHVyYXRpb24uc2Vjb25kcygzMCksXG4gICAgICBtZW1vcnlTaXplOiAyNTYsXG4gICAgICBsb2dSZXRlbnRpb246IGxvZ3MuUmV0ZW50aW9uRGF5cy5PTkVfV0VFSyxcbiAgICB9KTtcblxuICAgIC8vIEdyYW50IHBlcm1pc3Npb25zIHRvIGFjY2VzcyBzZWNyZXRzXG4gICAgc2V0bGlzdEZtQXBpS2V5LmdyYW50UmVhZChhcGlGdW5jdGlvbik7XG4gICAgc3BvdGlmeUNsaWVudElkLmdyYW50UmVhZChhcGlGdW5jdGlvbik7XG4gICAgc3BvdGlmeUNsaWVudFNlY3JldC5ncmFudFJlYWQoYXBpRnVuY3Rpb24pO1xuICAgIHNwb3RpZnlSZWRpcmVjdFVyaS5ncmFudFJlYWQoYXBpRnVuY3Rpb24pO1xuXG4gICAgLy8gQ3JlYXRlIEFQSSBHYXRld2F5XG4gICAgY29uc3QgYXBpID0gbmV3IGFwaWdhdGV3YXkuUmVzdEFwaSh0aGlzLCAnU2V0bGlzdGFBcGknLCB7XG4gICAgICBkZXNjcmlwdGlvbjogJ1NldGxpc3RhIEFQSScsXG4gICAgICBkZXBsb3lPcHRpb25zOiB7XG4gICAgICAgIHN0YWdlTmFtZTogJ3Byb2QnLFxuICAgICAgICBsb2dnaW5nTGV2ZWw6IGFwaWdhdGV3YXkuTWV0aG9kTG9nZ2luZ0xldmVsLklORk8sXG4gICAgICAgIGRhdGFUcmFjZUVuYWJsZWQ6IHRydWUsXG4gICAgICB9LFxuICAgICAgZGVmYXVsdENvcnNQcmVmbGlnaHRPcHRpb25zOiB7XG4gICAgICAgIGFsbG93T3JpZ2luczogWydodHRwczovL3NldGxpc3RhLnRlcnJlbm8uZGV2J10sXG4gICAgICAgIGFsbG93TWV0aG9kczogWydHRVQnLCAnUE9TVCcsICdQVVQnLCAnREVMRVRFJywgJ09QVElPTlMnXSxcbiAgICAgICAgYWxsb3dIZWFkZXJzOiBbXG4gICAgICAgICAgJ0NvbnRlbnQtVHlwZScsXG4gICAgICAgICAgJ1gtQW16LURhdGUnLFxuICAgICAgICAgICdBdXRob3JpemF0aW9uJyxcbiAgICAgICAgICAnWC1BcGktS2V5JyxcbiAgICAgICAgICAnWC1BbXotU2VjdXJpdHktVG9rZW4nLFxuICAgICAgICAgICdPcmlnaW4nLFxuICAgICAgICAgICdBY2NlcHQnLFxuICAgICAgICAgICdBY2Nlc3MtQ29udHJvbC1BbGxvdy1PcmlnaW4nLFxuICAgICAgICAgICdBY2Nlc3MtQ29udHJvbC1BbGxvdy1IZWFkZXJzJyxcbiAgICAgICAgICAnQWNjZXNzLUNvbnRyb2wtQWxsb3ctTWV0aG9kcycsXG4gICAgICAgIF0sXG4gICAgICAgIGFsbG93Q3JlZGVudGlhbHM6IHRydWUsXG4gICAgICAgIG1heEFnZTogY2RrLkR1cmF0aW9uLmRheXMoMSksXG4gICAgICB9LFxuICAgIH0pO1xuXG4gICAgLy8gQ3JlYXRlIEFQSSBHYXRld2F5IHJlc291cmNlc1xuICAgIGNvbnN0IGFwaVJlc291cmNlID0gYXBpLnJvb3Q7XG4gICAgXG4gICAgLy8gQWRkIHByb3h5IHJlc291cmNlIHRvIExhbWJkYVxuICAgIGNvbnN0IHByb3h5UmVzb3VyY2UgPSBhcGlSZXNvdXJjZS5hZGRQcm94eSh7XG4gICAgICBkZWZhdWx0SW50ZWdyYXRpb246IG5ldyBhcGlnYXRld2F5LkxhbWJkYUludGVncmF0aW9uKGFwaUZ1bmN0aW9uLCB7XG4gICAgICAgIHByb3h5OiB0cnVlLFxuICAgICAgICBpbnRlZ3JhdGlvblJlc3BvbnNlczogW1xuICAgICAgICAgIHtcbiAgICAgICAgICAgIHN0YXR1c0NvZGU6ICcyMDAnLFxuICAgICAgICAgICAgcmVzcG9uc2VQYXJhbWV0ZXJzOiB7XG4gICAgICAgICAgICAgICdtZXRob2QucmVzcG9uc2UuaGVhZGVyLkFjY2Vzcy1Db250cm9sLUFsbG93LU9yaWdpbic6IFwiJ2h0dHBzOi8vc2V0bGlzdGEudGVycmVuby5kZXYnXCIsXG4gICAgICAgICAgICAgICdtZXRob2QucmVzcG9uc2UuaGVhZGVyLkFjY2Vzcy1Db250cm9sLUFsbG93LUhlYWRlcnMnOiBcIidDb250ZW50LVR5cGUsWC1BbXotRGF0ZSxBdXRob3JpemF0aW9uLFgtQXBpLUtleSxYLUFtei1TZWN1cml0eS1Ub2tlbixPcmlnaW4sQWNjZXB0J1wiLFxuICAgICAgICAgICAgICAnbWV0aG9kLnJlc3BvbnNlLmhlYWRlci5BY2Nlc3MtQ29udHJvbC1BbGxvdy1NZXRob2RzJzogXCInR0VULFBPU1QsUFVULERFTEVURSxPUFRJT05TJ1wiLFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICB9LFxuICAgICAgICBdLFxuICAgICAgfSksXG4gICAgICBhbnlNZXRob2Q6IHRydWUsXG4gICAgICBkZWZhdWx0TWV0aG9kT3B0aW9uczoge1xuICAgICAgICBtZXRob2RSZXNwb25zZXM6IFtcbiAgICAgICAgICB7XG4gICAgICAgICAgICBzdGF0dXNDb2RlOiAnMjAwJyxcbiAgICAgICAgICAgIHJlc3BvbnNlUGFyYW1ldGVyczoge1xuICAgICAgICAgICAgICAnbWV0aG9kLnJlc3BvbnNlLmhlYWRlci5BY2Nlc3MtQ29udHJvbC1BbGxvdy1PcmlnaW4nOiB0cnVlLFxuICAgICAgICAgICAgICAnbWV0aG9kLnJlc3BvbnNlLmhlYWRlci5BY2Nlc3MtQ29udHJvbC1BbGxvdy1IZWFkZXJzJzogdHJ1ZSxcbiAgICAgICAgICAgICAgJ21ldGhvZC5yZXNwb25zZS5oZWFkZXIuQWNjZXNzLUNvbnRyb2wtQWxsb3ctTWV0aG9kcyc6IHRydWUsXG4gICAgICAgICAgICB9LFxuICAgICAgICAgIH0sXG4gICAgICAgICAge1xuICAgICAgICAgICAgc3RhdHVzQ29kZTogJzQwMCcsXG4gICAgICAgICAgICByZXNwb25zZVBhcmFtZXRlcnM6IHtcbiAgICAgICAgICAgICAgJ21ldGhvZC5yZXNwb25zZS5oZWFkZXIuQWNjZXNzLUNvbnRyb2wtQWxsb3ctT3JpZ2luJzogdHJ1ZSxcbiAgICAgICAgICAgICAgJ21ldGhvZC5yZXNwb25zZS5oZWFkZXIuQWNjZXNzLUNvbnRyb2wtQWxsb3ctSGVhZGVycyc6IHRydWUsXG4gICAgICAgICAgICAgICdtZXRob2QucmVzcG9uc2UuaGVhZGVyLkFjY2Vzcy1Db250cm9sLUFsbG93LU1ldGhvZHMnOiB0cnVlLFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICB9LFxuICAgICAgICAgIHtcbiAgICAgICAgICAgIHN0YXR1c0NvZGU6ICc1MDAnLFxuICAgICAgICAgICAgcmVzcG9uc2VQYXJhbWV0ZXJzOiB7XG4gICAgICAgICAgICAgICdtZXRob2QucmVzcG9uc2UuaGVhZGVyLkFjY2Vzcy1Db250cm9sLUFsbG93LU9yaWdpbic6IHRydWUsXG4gICAgICAgICAgICAgICdtZXRob2QucmVzcG9uc2UuaGVhZGVyLkFjY2Vzcy1Db250cm9sLUFsbG93LUhlYWRlcnMnOiB0cnVlLFxuICAgICAgICAgICAgICAnbWV0aG9kLnJlc3BvbnNlLmhlYWRlci5BY2Nlc3MtQ29udHJvbC1BbGxvdy1NZXRob2RzJzogdHJ1ZSxcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgfSxcbiAgICAgICAgXSxcbiAgICAgIH0sXG4gICAgfSk7XG5cbiAgICAvLyBOb3cgY3JlYXRlIENsb3VkRnJvbnQgZGlzdHJpYnV0aW9uIGFmdGVyIEFQSSBHYXRld2F5IGlzIGRlZmluZWRcbiAgICAvLyBDcmVhdGUgY3VzdG9tIE9yaWdpblJlcXVlc3RQb2xpY3kgZm9yIEFQSSBHYXRld2F5XG4gICAgY29uc3QgYXBpR2F0ZXdheU9yaWdpblJlcXVlc3RQb2xpY3kgPSB0aGlzLmNyZWF0ZUFwaUdhdGV3YXlPcmlnaW5SZXF1ZXN0UG9saWN5KHRoaXMpO1xuXG4gICAgZGlzdHJpYnV0aW9uID0gbmV3IGNsb3VkZnJvbnQuRGlzdHJpYnV0aW9uKHRoaXMsICdEaXN0cmlidXRpb25WMycsIHtcbiAgICAgIGNvbW1lbnQ6ICdTZXRsaXN0YSBDbG91ZEZyb250IERpc3RyaWJ1dGlvbiB2MicsXG4gICAgICBkb21haW5OYW1lczogWydzZXRsaXN0YS50ZXJyZW5vLmRldiddLFxuICAgICAgY2VydGlmaWNhdGU6IGNlcnRpZmljYXRlLFxuICAgICAgZGVmYXVsdEJlaGF2aW9yOiB7XG4gICAgICAgIG9yaWdpbjogb3JpZ2lucy5TM0J1Y2tldE9yaWdpbi53aXRoT3JpZ2luQWNjZXNzQ29udHJvbChmcm9udGVuZEJ1Y2tldCksXG4gICAgICAgIHZpZXdlclByb3RvY29sUG9saWN5OiBjbG91ZGZyb250LlZpZXdlclByb3RvY29sUG9saWN5LlJFRElSRUNUX1RPX0hUVFBTLFxuICAgICAgICBhbGxvd2VkTWV0aG9kczogY2xvdWRmcm9udC5BbGxvd2VkTWV0aG9kcy5BTExPV19HRVRfSEVBRF9PUFRJT05TLFxuICAgICAgICBjYWNoZVBvbGljeTogY2xvdWRmcm9udC5DYWNoZVBvbGljeS5DQUNISU5HX09QVElNSVpFRCxcbiAgICAgIH0sXG4gICAgICBhZGRpdGlvbmFsQmVoYXZpb3JzOiB7XG4gICAgICAgICcvYXBpLyonOiB7XG4gICAgICAgICAgb3JpZ2luOiBuZXcgb3JpZ2lucy5SZXN0QXBpT3JpZ2luKGFwaSwge1xuICAgICAgICAgICAgb3JpZ2luUGF0aDogJy9wcm9kJyxcbiAgICAgICAgICB9KSxcbiAgICAgICAgICB2aWV3ZXJQcm90b2NvbFBvbGljeTogY2xvdWRmcm9udC5WaWV3ZXJQcm90b2NvbFBvbGljeS5SRURJUkVDVF9UT19IVFRQUyxcbiAgICAgICAgICBhbGxvd2VkTWV0aG9kczogY2xvdWRmcm9udC5BbGxvd2VkTWV0aG9kcy5BTExPV19BTEwsXG4gICAgICAgICAgY2FjaGVQb2xpY3k6IGNsb3VkZnJvbnQuQ2FjaGVQb2xpY3kuQ0FDSElOR19ESVNBQkxFRCxcbiAgICAgICAgICBvcmlnaW5SZXF1ZXN0UG9saWN5OiBhcGlHYXRld2F5T3JpZ2luUmVxdWVzdFBvbGljeSxcbiAgICAgICAgfSxcbiAgICAgICAgJy9hdXRoLyonOiB7XG4gICAgICAgICAgb3JpZ2luOiBuZXcgb3JpZ2lucy5SZXN0QXBpT3JpZ2luKGFwaSwge1xuICAgICAgICAgICAgb3JpZ2luUGF0aDogJy9wcm9kJyxcbiAgICAgICAgICB9KSxcbiAgICAgICAgICB2aWV3ZXJQcm90b2NvbFBvbGljeTogY2xvdWRmcm9udC5WaWV3ZXJQcm90b2NvbFBvbGljeS5SRURJUkVDVF9UT19IVFRQUyxcbiAgICAgICAgICBhbGxvd2VkTWV0aG9kczogY2xvdWRmcm9udC5BbGxvd2VkTWV0aG9kcy5BTExPV19BTEwsXG4gICAgICAgICAgY2FjaGVQb2xpY3k6IGNsb3VkZnJvbnQuQ2FjaGVQb2xpY3kuQ0FDSElOR19ESVNBQkxFRCxcbiAgICAgICAgICBvcmlnaW5SZXF1ZXN0UG9saWN5OiBhcGlHYXRld2F5T3JpZ2luUmVxdWVzdFBvbGljeSxcbiAgICAgICAgfSxcbiAgICAgIH0sXG4gICAgICBkZWZhdWx0Um9vdE9iamVjdDogJ2luZGV4Lmh0bWwnLFxuICAgICAgZXJyb3JSZXNwb25zZXM6IFtcbiAgICAgICAge1xuICAgICAgICAgIGh0dHBTdGF0dXM6IDQwNCxcbiAgICAgICAgICByZXNwb25zZUh0dHBTdGF0dXM6IDIwMCxcbiAgICAgICAgICByZXNwb25zZVBhZ2VQYXRoOiAnL2luZGV4Lmh0bWwnLFxuICAgICAgICB9LFxuICAgICAgXSxcbiAgICB9KTtcblxuICAgIC8vIEdyYW50IENsb3VkRnJvbnQgcGVybWlzc2lvbiB0byBhY2Nlc3MgdGhlIFMzIGJ1Y2tldFxuICAgIGNvbnN0IGJ1Y2tldFBvbGljeVN0YXRlbWVudCA9IG5ldyBpYW0uUG9saWN5U3RhdGVtZW50KHtcbiAgICAgIGFjdGlvbnM6IFsnczM6R2V0T2JqZWN0J10sXG4gICAgICByZXNvdXJjZXM6IFtgJHtmcm9udGVuZEJ1Y2tldC5idWNrZXRBcm59LypgXSxcbiAgICAgIHByaW5jaXBhbHM6IFtuZXcgaWFtLlNlcnZpY2VQcmluY2lwYWwoJ2Nsb3VkZnJvbnQuYW1hem9uYXdzLmNvbScpXSxcbiAgICAgIGNvbmRpdGlvbnM6IHtcbiAgICAgICAgU3RyaW5nRXF1YWxzOiB7XG4gICAgICAgICAgJ0FXUzpTb3VyY2VBcm4nOiBgYXJuOmF3czpjbG91ZGZyb250Ojoke3RoaXMuYWNjb3VudH06ZGlzdHJpYnV0aW9uLyR7ZGlzdHJpYnV0aW9uLmRpc3RyaWJ1dGlvbklkfWAsXG4gICAgICAgIH0sXG4gICAgICB9LFxuICAgIH0pO1xuXG4gICAgZnJvbnRlbmRCdWNrZXQuYWRkVG9SZXNvdXJjZVBvbGljeShidWNrZXRQb2xpY3lTdGF0ZW1lbnQpO1xuXG4gICAgICAgIC8vIENyZWF0ZSBjdXN0b20gT3JpZ2luUmVxdWVzdFBvbGljeSBmb3IgQVBJIEdhdGV3YXlcbiAgICBcblxuICAgIC8vIENyZWF0ZSBhIHNlcGFyYXRlIENsb3VkRnJvbnQgZGlzdHJpYnV0aW9uIGZvciB0aGUgQVBJIHN1YmRvbWFpblxuICAgIGNvbnN0IGFwaURpc3RyaWJ1dGlvbiA9IG5ldyBjbG91ZGZyb250LkRpc3RyaWJ1dGlvbih0aGlzLCAnQXBpRGlzdHJpYnV0aW9uJywge1xuICAgICAgY29tbWVudDogJ1NldGxpc3RhIEFQSSBDbG91ZEZyb250IERpc3RyaWJ1dGlvbicsXG4gICAgICBkb21haW5OYW1lczogWydhcGkuc2V0bGlzdGEudGVycmVuby5kZXYnXSxcbiAgICAgIGNlcnRpZmljYXRlOiBjZXJ0aWZpY2F0ZSxcbiAgICAgIGRlZmF1bHRCZWhhdmlvcjoge1xuICAgICAgICBvcmlnaW46IG5ldyBvcmlnaW5zLlJlc3RBcGlPcmlnaW4oYXBpKSxcbiAgICAgICAgdmlld2VyUHJvdG9jb2xQb2xpY3k6IGNsb3VkZnJvbnQuVmlld2VyUHJvdG9jb2xQb2xpY3kuUkVESVJFQ1RfVE9fSFRUUFMsXG4gICAgICAgIGFsbG93ZWRNZXRob2RzOiBjbG91ZGZyb250LkFsbG93ZWRNZXRob2RzLkFMTE9XX0FMTCxcbiAgICAgICAgY2FjaGVQb2xpY3k6IGNsb3VkZnJvbnQuQ2FjaGVQb2xpY3kuQ0FDSElOR19ESVNBQkxFRCxcbiAgICAgICAgb3JpZ2luUmVxdWVzdFBvbGljeTogYXBpR2F0ZXdheU9yaWdpblJlcXVlc3RQb2xpY3ksXG4gICAgICAgIHJlc3BvbnNlSGVhZGVyc1BvbGljeTogY2xvdWRmcm9udC5SZXNwb25zZUhlYWRlcnNQb2xpY3kuQ09SU19BTExPV19BTExfT1JJR0lOUyxcbiAgICAgICAgZnVuY3Rpb25Bc3NvY2lhdGlvbnM6IFtcbiAgICAgICAgICB7XG4gICAgICAgICAgICBmdW5jdGlvbjogbmV3IGNsb3VkZnJvbnQuRnVuY3Rpb24odGhpcywgJ1F1ZXJ5U3RyaW5nRnVuY3Rpb24nLCB7XG4gICAgICAgICAgICAgIGNvZGU6IGNsb3VkZnJvbnQuRnVuY3Rpb25Db2RlLmZyb21JbmxpbmUoYFxuICAgICAgICAgICAgICAgIGZ1bmN0aW9uIGhhbmRsZXIoZXZlbnQpIHtcbiAgICAgICAgICAgICAgICAgIHZhciByZXF1ZXN0ID0gZXZlbnQucmVxdWVzdDtcbiAgICAgICAgICAgICAgICAgIHZhciB1cmkgPSByZXF1ZXN0LnVyaTtcbiAgICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgICAgLy8gUmVtb3ZlIC9wcm9kIHByZWZpeCBpZiBwcmVzZW50XG4gICAgICAgICAgICAgICAgICBpZiAodXJpLnN0YXJ0c1dpdGgoJy9wcm9kLycpKSB7XG4gICAgICAgICAgICAgICAgICAgIHJlcXVlc3QudXJpID0gdXJpLnN1YnN0cmluZyg1KTtcbiAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgICAgLy8gRm9yd2FyZCBhbGwgcXVlcnkgcGFyYW1ldGVyc1xuICAgICAgICAgICAgICAgICAgaWYgKHJlcXVlc3QucXVlcnlzdHJpbmcpIHtcbiAgICAgICAgICAgICAgICAgICAgcmVxdWVzdC5xdWVyeXN0cmluZyA9IHJlcXVlc3QucXVlcnlzdHJpbmc7XG4gICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICAgIC8vIEFkZCBDT1JTIGhlYWRlcnMgZm9yIHByZWZsaWdodCByZXF1ZXN0c1xuICAgICAgICAgICAgICAgICAgaWYgKHJlcXVlc3QubWV0aG9kID09PSAnT1BUSU9OUycpIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgICAgICAgICAgICBzdGF0dXNDb2RlOiAyMDQsXG4gICAgICAgICAgICAgICAgICAgICAgc3RhdHVzRGVzY3JpcHRpb246ICdObyBDb250ZW50JyxcbiAgICAgICAgICAgICAgICAgICAgICBoZWFkZXJzOiB7XG4gICAgICAgICAgICAgICAgICAgICAgICAnYWNjZXNzLWNvbnRyb2wtYWxsb3ctb3JpZ2luJzogeyB2YWx1ZTogJ2h0dHBzOi8vc2V0bGlzdGEudGVycmVuby5kZXYnIH0sXG4gICAgICAgICAgICAgICAgICAgICAgICAnYWNjZXNzLWNvbnRyb2wtYWxsb3ctbWV0aG9kcyc6IHsgdmFsdWU6ICdHRVQsSEVBRCxPUFRJT05TLFBPU1QsUFVUJyB9LFxuICAgICAgICAgICAgICAgICAgICAgICAgJ2FjY2Vzcy1jb250cm9sLWFsbG93LWhlYWRlcnMnOiB7IHZhbHVlOiAnQ29udGVudC1UeXBlLFgtQW16LURhdGUsQXV0aG9yaXphdGlvbixYLUFwaS1LZXksWC1BbXotU2VjdXJpdHktVG9rZW4sT3JpZ2luLEFjY2VwdCcgfSxcbiAgICAgICAgICAgICAgICAgICAgICAgICdhY2Nlc3MtY29udHJvbC1tYXgtYWdlJzogeyB2YWx1ZTogJzg2NDAwJyB9XG4gICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICB9O1xuICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgICByZXR1cm4gcmVxdWVzdDtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIGApLFxuICAgICAgICAgICAgfSksXG4gICAgICAgICAgICBldmVudFR5cGU6IGNsb3VkZnJvbnQuRnVuY3Rpb25FdmVudFR5cGUuVklFV0VSX1JFUVVFU1QsXG4gICAgICAgICAgfSxcbiAgICAgICAgXSxcbiAgICAgIH0sXG4gICAgICBhZGRpdGlvbmFsQmVoYXZpb3JzOiB7XG4gICAgICAgICcvYXBpLyonOiB7XG4gICAgICAgICAgb3JpZ2luOiBuZXcgb3JpZ2lucy5SZXN0QXBpT3JpZ2luKGFwaSwge1xuICAgICAgICAgICAgb3JpZ2luUGF0aDogJy9wcm9kJyxcbiAgICAgICAgICAgIFxuICAgICAgICAgIH0pLFxuICAgICAgICAgIHZpZXdlclByb3RvY29sUG9saWN5OiBjbG91ZGZyb250LlZpZXdlclByb3RvY29sUG9saWN5LlJFRElSRUNUX1RPX0hUVFBTLFxuICAgICAgICAgIGFsbG93ZWRNZXRob2RzOiBjbG91ZGZyb250LkFsbG93ZWRNZXRob2RzLkFMTE9XX0FMTCxcbiAgICAgICAgICBjYWNoZVBvbGljeTogY2xvdWRmcm9udC5DYWNoZVBvbGljeS5DQUNISU5HX0RJU0FCTEVELFxuICAgICAgICAgIG9yaWdpblJlcXVlc3RQb2xpY3k6IGFwaUdhdGV3YXlPcmlnaW5SZXF1ZXN0UG9saWN5LFxuICAgICAgICAgIHJlc3BvbnNlSGVhZGVyc1BvbGljeTogY2xvdWRmcm9udC5SZXNwb25zZUhlYWRlcnNQb2xpY3kuQ09SU19BTExPV19BTExfT1JJR0lOUyxcbiAgICAgICAgfSxcbiAgICAgICAgJy9hdXRoLyonOiB7XG4gICAgICAgICAgb3JpZ2luOiBuZXcgb3JpZ2lucy5SZXN0QXBpT3JpZ2luKGFwaSwge1xuICAgICAgICAgICAgb3JpZ2luUGF0aDogJy9wcm9kJyxcbiAgICAgICAgICAgIFxuICAgICAgICAgIH0pLFxuICAgICAgICAgIHZpZXdlclByb3RvY29sUG9saWN5OiBjbG91ZGZyb250LlZpZXdlclByb3RvY29sUG9saWN5LlJFRElSRUNUX1RPX0hUVFBTLFxuICAgICAgICAgIGFsbG93ZWRNZXRob2RzOiBjbG91ZGZyb250LkFsbG93ZWRNZXRob2RzLkFMTE9XX0FMTCxcbiAgICAgICAgICBjYWNoZVBvbGljeTogY2xvdWRmcm9udC5DYWNoZVBvbGljeS5DQUNISU5HX0RJU0FCTEVELFxuICAgICAgICAgIG9yaWdpblJlcXVlc3RQb2xpY3k6IGFwaUdhdGV3YXlPcmlnaW5SZXF1ZXN0UG9saWN5LFxuICAgICAgICAgIHJlc3BvbnNlSGVhZGVyc1BvbGljeTogY2xvdWRmcm9udC5SZXNwb25zZUhlYWRlcnNQb2xpY3kuQ09SU19BTExPV19BTExfT1JJR0lOUyxcbiAgICAgICAgfSxcbiAgICAgICAgJy9wcm9kLyonOiB7XG4gICAgICAgICAgb3JpZ2luOiBuZXcgb3JpZ2lucy5SZXN0QXBpT3JpZ2luKGFwaSwge1xuICAgICAgICAgICAgb3JpZ2luUGF0aDogJy9wcm9kJyxcbiAgICAgICAgICAgIFxuICAgICAgICAgIH0pLFxuICAgICAgICAgIHZpZXdlclByb3RvY29sUG9saWN5OiBjbG91ZGZyb250LlZpZXdlclByb3RvY29sUG9saWN5LlJFRElSRUNUX1RPX0hUVFBTLFxuICAgICAgICAgIGFsbG93ZWRNZXRob2RzOiBjbG91ZGZyb250LkFsbG93ZWRNZXRob2RzLkFMTE9XX0FMTCxcbiAgICAgICAgICBjYWNoZVBvbGljeTogY2xvdWRmcm9udC5DYWNoZVBvbGljeS5DQUNISU5HX0RJU0FCTEVELFxuICAgICAgICAgIG9yaWdpblJlcXVlc3RQb2xpY3k6IGFwaUdhdGV3YXlPcmlnaW5SZXF1ZXN0UG9saWN5LFxuICAgICAgICAgIHJlc3BvbnNlSGVhZGVyc1BvbGljeTogY2xvdWRmcm9udC5SZXNwb25zZUhlYWRlcnNQb2xpY3kuQ09SU19BTExPV19BTExfT1JJR0lOUyxcbiAgICAgICAgfSxcbiAgICAgICAgJy9zcG90aWZ5LyonOiB7XG4gICAgICAgICAgb3JpZ2luOiBuZXcgb3JpZ2lucy5SZXN0QXBpT3JpZ2luKGFwaSwge1xuICAgICAgICAgICAgb3JpZ2luUGF0aDogJy9wcm9kJyxcbiAgICAgICAgICAgIFxuICAgICAgICAgIH0pLFxuICAgICAgICAgIHZpZXdlclByb3RvY29sUG9saWN5OiBjbG91ZGZyb250LlZpZXdlclByb3RvY29sUG9saWN5LlJFRElSRUNUX1RPX0hUVFBTLFxuICAgICAgICAgIGFsbG93ZWRNZXRob2RzOiBjbG91ZGZyb250LkFsbG93ZWRNZXRob2RzLkFMTE9XX0FMTCxcbiAgICAgICAgICBjYWNoZVBvbGljeTogY2xvdWRmcm9udC5DYWNoZVBvbGljeS5DQUNISU5HX0RJU0FCTEVELFxuICAgICAgICAgIG9yaWdpblJlcXVlc3RQb2xpY3k6IGFwaUdhdGV3YXlPcmlnaW5SZXF1ZXN0UG9saWN5LFxuICAgICAgICAgIHJlc3BvbnNlSGVhZGVyc1BvbGljeTogY2xvdWRmcm9udC5SZXNwb25zZUhlYWRlcnNQb2xpY3kuQ09SU19BTExPV19BTExfT1JJR0lOUyxcbiAgICAgICAgfSxcbiAgICAgIH0sXG4gICAgICBsb2dCdWNrZXQ6IG5ldyBzMy5CdWNrZXQodGhpcywgJ0FwaUNsb3VkRnJvbnRMb2dzJywge1xuICAgICAgICByZW1vdmFsUG9saWN5OiBjZGsuUmVtb3ZhbFBvbGljeS5SRVRBSU4sXG4gICAgICAgIGVuY3J5cHRpb246IHMzLkJ1Y2tldEVuY3J5cHRpb24uUzNfTUFOQUdFRCxcbiAgICAgICAgYmxvY2tQdWJsaWNBY2Nlc3M6IHMzLkJsb2NrUHVibGljQWNjZXNzLkJMT0NLX0FMTCxcbiAgICAgICAgdmVyc2lvbmVkOiB0cnVlLFxuICAgICAgICBvYmplY3RPd25lcnNoaXA6IHMzLk9iamVjdE93bmVyc2hpcC5CVUNLRVRfT1dORVJfUFJFRkVSUkVELFxuICAgICAgICBsaWZlY3ljbGVSdWxlczogW1xuICAgICAgICAgIHtcbiAgICAgICAgICAgIGV4cGlyYXRpb246IGNkay5EdXJhdGlvbi5kYXlzKDkwKSwgLy8gS2VlcCBsb2dzIGZvciA5MCBkYXlzXG4gICAgICAgICAgfSxcbiAgICAgICAgXSxcbiAgICAgIH0pLFxuICAgICAgbG9nRmlsZVByZWZpeDogJ2FwaS1jbG91ZGZyb250LWxvZ3MvJyxcbiAgICAgIGxvZ0luY2x1ZGVzQ29va2llczogdHJ1ZSxcbiAgICB9KTtcblxuICAgIC8vIE91dHB1dCB0aGUgQ2xvdWRGcm9udCBkb21haW4gc28gU1BPVElGWV9SRURJUkVDVF9VUkkgY2FuIGJlIGNvbmZpZ3VyZWQgbWFudWFsbHkgaWYgbmVlZGVkXG4gICAgLy8gVGhlIExhbWJkYSB3aWxsIGNvbnN0cnVjdCB0aGUgcmVkaXJlY3QgVVJJIGR5bmFtaWNhbGx5IHVzaW5nIHRoZSBIb3N0IGhlYWRlclxuXG4gICAgLy8gT3V0cHV0c1xuICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsICdDbG91ZEZyb250VVJMJywge1xuICAgICAgdmFsdWU6IGBodHRwczovLyR7ZGlzdHJpYnV0aW9uLmRvbWFpbk5hbWV9YCxcbiAgICAgIGRlc2NyaXB0aW9uOiAnVVJMIG9mIHRoZSBDbG91ZEZyb250IGRpc3RyaWJ1dGlvbicsXG4gICAgfSk7XG5cbiAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCAnQ2xvdWRGcm9udERpc3RyaWJ1dGlvbklkJywge1xuICAgICAgdmFsdWU6IGRpc3RyaWJ1dGlvbi5kaXN0cmlidXRpb25JZCxcbiAgICAgIGRlc2NyaXB0aW9uOiAnSUQgb2YgdGhlIENsb3VkRnJvbnQgZGlzdHJpYnV0aW9uJyxcbiAgICB9KTtcblxuICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsICdGcm9udGVuZEJ1Y2tldE5hbWUnLCB7XG4gICAgICB2YWx1ZTogZnJvbnRlbmRCdWNrZXQuYnVja2V0TmFtZSxcbiAgICAgIGRlc2NyaXB0aW9uOiAnTmFtZSBvZiB0aGUgUzMgYnVja2V0IGhvc3RpbmcgdGhlIGZyb250ZW5kJyxcbiAgICB9KTtcblxuICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsICdBcGlVUkwnLCB7XG4gICAgICB2YWx1ZTogYXBpLnVybCxcbiAgICAgIGRlc2NyaXB0aW9uOiAnVVJMIG9mIHRoZSBBUEkgR2F0ZXdheScsXG4gICAgfSk7XG5cbiAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCAnQXBpRGlzdHJpYnV0aW9uSWQnLCB7XG4gICAgICB2YWx1ZTogYXBpRGlzdHJpYnV0aW9uLmRpc3RyaWJ1dGlvbklkLFxuICAgICAgZGVzY3JpcHRpb246ICdJRCBvZiB0aGUgQVBJIENsb3VkRnJvbnQgZGlzdHJpYnV0aW9uJyxcbiAgICB9KTtcblxuICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsICdBcGlEaXN0cmlidXRpb25VUkwnLCB7XG4gICAgICB2YWx1ZTogYGh0dHBzOi8vJHthcGlEaXN0cmlidXRpb24uZG9tYWluTmFtZX1gLFxuICAgICAgZGVzY3JpcHRpb246ICdVUkwgb2YgdGhlIEFQSSBDbG91ZEZyb250IGRpc3RyaWJ1dGlvbicsXG4gICAgfSk7XG4gIH1cbn0iXX0=