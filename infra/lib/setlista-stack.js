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
        // Import existing SSL certificate for custom domain
        const certificate = certificatemanager.Certificate.fromCertificateArn(this, 'SetlistaCertificate', 'arn:aws:acm:us-east-1:836481963552:certificate/ccba0ad1-f270-485b-8902-3a6276db8488');
        // Create Lambda function for the backend
        const apiFunction = new lambda.Function(this, 'ApiFunction', {
            runtime: lambda.Runtime.NODEJS_18_X,
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
                },
                '/auth/*': {
                    origin: new origins.RestApiOrigin(api),
                    viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
                    allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL,
                    cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED,
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
    }
}
exports.SetlistaStack = SetlistaStack;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic2V0bGlzdGEtc3RhY2suanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyJzZXRsaXN0YS1zdGFjay50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFBQSxpREFBbUM7QUFDbkMsdURBQXlDO0FBQ3pDLHVFQUF5RDtBQUN6RCw0RUFBOEQ7QUFDOUQsK0RBQWlEO0FBQ2pELHVFQUF5RDtBQUN6RCx5REFBMkM7QUFDM0MsK0VBQWlFO0FBQ2pFLHVGQUF5RTtBQUN6RSwyREFBNkM7QUFDN0MsMkNBQTZCO0FBRzdCLE1BQWEsYUFBYyxTQUFRLEdBQUcsQ0FBQyxLQUFLO0lBQzFDLFlBQVksS0FBZ0IsRUFBRSxFQUFVLEVBQUUsS0FBc0I7UUFDOUQsS0FBSyxDQUFDLEtBQUssRUFBRSxFQUFFLEVBQUUsS0FBSyxDQUFDLENBQUM7UUFFeEIsbUNBQW1DO1FBQ25DLE1BQU0sY0FBYyxHQUFHLElBQUksRUFBRSxDQUFDLE1BQU0sQ0FBQyxJQUFJLEVBQUUsZ0JBQWdCLEVBQUU7WUFDM0Qsb0JBQW9CLEVBQUUsWUFBWTtZQUNsQyxvQkFBb0IsRUFBRSxZQUFZLEVBQUUsY0FBYztZQUNsRCxnQkFBZ0IsRUFBRSxLQUFLO1lBQ3ZCLGlCQUFpQixFQUFFLEVBQUUsQ0FBQyxpQkFBaUIsQ0FBQyxTQUFTO1lBQ2pELGFBQWEsRUFBRSxHQUFHLENBQUMsYUFBYSxDQUFDLE9BQU8sRUFBRSw0QkFBNEI7WUFDdEUsaUJBQWlCLEVBQUUsSUFBSSxFQUFFLDRCQUE0QjtTQUN0RCxDQUFDLENBQUM7UUFFSCwrRUFBK0U7UUFDL0UsSUFBSSxZQUFxQyxDQUFDO1FBRTFDLDBCQUEwQjtRQUMxQixNQUFNLGVBQWUsR0FBRyxjQUFjLENBQUMsTUFBTSxDQUFDLGdCQUFnQixDQUM1RCxJQUFJLEVBQ0osaUJBQWlCLEVBQ2pCLDRCQUE0QixDQUM3QixDQUFDO1FBRUYsTUFBTSxlQUFlLEdBQUcsY0FBYyxDQUFDLE1BQU0s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UUFDNUYsK0VBQStFO1FBRS9FLFVBQVU7UUFDVixJQUFJLEdBQUcsQ0FBQyxTQUFTLENBQUMsSUFBSSxFQUFFLGVBQWUsRUFBRTtZQUN2QyxLQUFLLEVBQUUsV0FBVyxZQUFZLENBQUMsVUFBVSxFQUFFO1lBQzNDLFdBQVcsRUFBRSxvQ0FBb0M7U0FDbEQsQ0FBQyxDQUFDO1FBRUgsSUFBSSxHQUFHLENBQUMsU0FBUyxDQUFDLElBQUksRUFBRSwwQkFBMEIsRUFBRTtZQUNsRCxLQUFLLEVBQUUsWUFBWSxDQUFDLGNBQWM7WUFDbEMsV0FBVyxFQUFFLG1DQUFtQztTQUNqRCxDQUFDLENBQUM7UUFFSCxJQUFJLEdBQUcsQ0FBQyxTQUFTLENBQUMsSUFBSSxFQUFFLG9CQUFvQixFQUFFO1lBQzVDLEtBQUssRUFBRSxjQUFjLENBQUMsVUFBVTtZQUNoQyxXQUFXLEVBQUUsNENBQTRDO1NBQzFELENBQUMsQ0FBQztRQUVILElBQUksR0FBRyxDQUFDLFNBQVMsQ0FBQyxJQUFJLEVBQUUsUUFBUSxFQUFFO1lBQ2hDLEtBQUssRUFBRSxHQUFHLENBQUMsR0FBRztZQUNkLFdBQVcsRUFBRSx3QkFBd0I7U0FDdEMsQ0FBQyxDQUFDO0lBQ0wsQ0FBQztDQUNGO0FBN0pELHNDQTZKQyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCAqIGFzIGNkayBmcm9tICdhd3MtY2RrLWxpYic7XG5pbXBvcnQgKiBhcyBzMyBmcm9tICdhd3MtY2RrLWxpYi9hd3MtczMnO1xuaW1wb3J0ICogYXMgY2xvdWRmcm9udCBmcm9tICdhd3MtY2RrLWxpYi9hd3MtY2xvdWRmcm9udCc7XG5pbXBvcnQgKiBhcyBvcmlnaW5zIGZyb20gJ2F3cy1jZGstbGliL2F3cy1jbG91ZGZyb250LW9yaWdpbnMnO1xuaW1wb3J0ICogYXMgbGFtYmRhIGZyb20gJ2F3cy1jZGstbGliL2F3cy1sYW1iZGEnO1xuaW1wb3J0ICogYXMgYXBpZ2F0ZXdheSBmcm9tICdhd3MtY2RrLWxpYi9hd3MtYXBpZ2F0ZXdheSc7XG5pbXBvcnQgKiBhcyBpYW0gZnJvbSAnYXdzLWNkay1saWIvYXdzLWlhbSc7XG5pbXBvcnQgKiBhcyBzZWNyZXRzbWFuYWdlciBmcm9tICdhd3MtY2RrLWxpYi9hd3Mtc2VjcmV0c21hbmFnZXInO1xuaW1wb3J0ICogYXMgY2VydGlmaWNhdGVtYW5hZ2VyIGZyb20gJ2F3cy1jZGstbGliL2F3cy1jZXJ0aWZpY2F0ZW1hbmFnZXInO1xuaW1wb3J0ICogYXMgbG9ncyBmcm9tICdhd3MtY2RrLWxpYi9hd3MtbG9ncyc7XG5pbXBvcnQgKiBhcyBwYXRoIGZyb20gJ3BhdGgnO1xuaW1wb3J0IHsgQ29uc3RydWN0IH0gZnJvbSAnY29uc3RydWN0cyc7XG5cbmV4cG9ydCBjbGFzcyBTZXRsaXN0YVN0YWNrIGV4dGVuZHMgY2RrLlN0YWNrIHtcbiAgY29uc3RydWN0b3Ioc2NvcGU6IENvbnN0cnVjdCwgaWQ6IHN0cmluZywgcHJvcHM/OiBjZGsuU3RhY2tQcm9wcykge1xuICAgIHN1cGVyKHNjb3BlLCBpZCwgcHJvcHMpO1xuXG4gICAgLy8gQ3JlYXRlIGEgYnVja2V0IGZvciB0aGUgZnJvbnRlbmRcbiAgICBjb25zdCBmcm9udGVuZEJ1Y2tldCA9IG5ldyBzMy5CdWNrZXQodGhpcywgJ0Zyb250ZW5kQnVja2V0Jywge1xuICAgICAgd2Vic2l0ZUluZGV4RG9jdW1lbnQ6ICdpbmRleC5odG1sJyxcbiAgICAgIHdlYnNpdGVFcnJvckRvY3VtZW50OiAnaW5kZXguaHRtbCcsIC8vIFNQQSByb3V0aW5nXG4gICAgICBwdWJsaWNSZWFkQWNjZXNzOiBmYWxzZSxcbiAgICAgIGJsb2NrUHVibGljQWNjZXNzOiBzMy5CbG9ja1B1YmxpY0FjY2Vzcy5CTE9DS19BTEwsXG4gICAgICByZW1vdmFsUG9saWN5OiBjZGsuUmVtb3ZhbFBvbGljeS5ERVNUUk9ZLCAvLyBGb3IgZGV2L3Rlc3QgZW52aXJvbm1lbnRzXG4gICAgICBhdXRvRGVsZXRlT2JqZWN0czogdHJ1ZSwgLy8gRm9yIGRldi90ZXN0IGVudmlyb25tZW50c1xuICAgIH0pO1xuXG4gICAgLy8gQ2xvdWRGcm9udCBkaXN0cmlidXRpb24gZm9yIHRoZSBmcm9udGVuZCAod2lsbCBiZSBjcmVhdGVkIGFmdGVyIEFQSSBHYXRld2F5KVxuICAgIGxldCBkaXN0cmlidXRpb246IGNsb3VkZnJvbnQuRGlzdHJpYnV0aW9uO1xuXG4gICAgLy8gSW1wb3J0IGV4aXN0aW5nIHNlY3JldHNcbiAgICBjb25zdCBzZXRsaXN0Rm1BcGlLZXkgPSBzZWNyZXRzbWFuYWdlci5TZWNyZXQuZnJvbVNlY3JldE5hbWVWMihcbiAgICAgIHRoaXMsIFxuICAgICAgJ1NldGxpc3RGbUFwaUtleScsIFxuICAgICAgJ3NldGxpc3RhL3NldGxpc3RmbS1hcGkta2V5J1xuICAgICk7XG5cbiAgICBjb25zdCBzcG90aWZ5Q2xpZW50SWQgPSBzZWNyZXRzbWFuYWdlci5TZWNyZXQuZnJvbVNlY3JldE5hbWVWMihcbiAgICAgIHRoaXMsIFxuICAgICAgJ1Nwb3RpZnlDbGllbnRJZCcsIFxuICAgICAgJ3NldGxpc3RhL3Nwb3RpZnktY2xpZW50LWlkJ1xuICAgICk7XG5cbiAgICBjb25zdCBzcG90aWZ5Q2xpZW50U2VjcmV0ID0gc2VjcmV0c21hbmFnZXIuU2VjcmV0LmZyb21TZWNyZXROYW1lVjIoXG4gICAgICB0aGlzLCBcbiAgICAgICdTcG90aWZ5Q2xpZW50U2VjcmV0JywgXG4gICAgICAnc2V0bGlzdGEvc3BvdGlmeS1jbGllbnQtc2VjcmV0J1xuICAgICk7XG5cbiAgICAvLyBJbXBvcnQgZXhpc3RpbmcgU1NMIGNlcnRpZmljYXRlIGZvciBjdXN0b20gZG9tYWluXG4gICAgY29uc3QgY2VydGlmaWNhdGUgPSBjZXJ0aWZpY2F0ZW1hbmFnZXIuQ2VydGlmaWNhdGUuZnJvbUNlcnRpZmljYXRlQXJuKFxuICAgICAgdGhpcyxcbiAgICAgICdTZXRsaXN0YUNlcnRpZmljYXRlJyxcbiAgICAgICdhcm46YXdzOmFjbTp1cy1lYXN0LTE6ODM2NDgxOTYzNTUyOmNlcnRpZmljYXRlL2NjYmEwYWQxLWYyNzAtNDg1Yi04OTAyLTNhNjI3NmRiODQ4OCdcbiAgICApO1xuXG4gICAgLy8gQ3JlYXRlIExhbWJkYSBmdW5jdGlvbiBmb3IgdGhlIGJhY2tlbmRcbiAgICBjb25zdCBhcGlGdW5jdGlvbiA9IG5ldyBsYW1iZGEuRnVuY3Rpb24odGhpcywgJ0FwaUZ1bmN0aW9uJywge1xuICAgICAgcnVudGltZTogbGFtYmRhLlJ1bnRpbWUuTk9ERUpTXzE4X1gsXG4gICAgICBoYW5kbGVyOiAnZGlzdC9sYW1iZGEubGFtYmRhSGFuZGxlcicsXG4gICAgICBjb2RlOiBsYW1iZGEuQ29kZS5mcm9tQXNzZXQocGF0aC5qb2luKF9fZGlybmFtZSwgJy4uLy4uL2JhY2tlbmQnKSksXG4gICAgICBlbnZpcm9ubWVudDoge1xuICAgICAgICBOT0RFX0VOVjogJ3Byb2R1Y3Rpb24nLFxuICAgICAgfSxcbiAgICAgIHRpbWVvdXQ6IGNkay5EdXJhdGlvbi5zZWNvbmRzKDMwKSxcbiAgICAgIG1lbW9yeVNpemU6IDI1NixcbiAgICAgIGxvZ1JldGVudGlvbjogbG9ncy5SZXRlbnRpb25EYXlzLk9ORV9XRUVLLFxuICAgIH0pO1xuXG4gICAgLy8gR3JhbnQgcGVybWlzc2lvbnMgdG8gYWNjZXNzIHNlY3JldHNcbiAgICBzZXRsaXN0Rm1BcGlLZXkuZ3JhbnRSZWFkKGFwaUZ1bmN0aW9uKTtcbiAgICBzcG90aWZ5Q2xpZW50SWQuZ3JhbnRSZWFkKGFwaUZ1bmN0aW9uKTtcbiAgICBzcG90aWZ5Q2xpZW50U2VjcmV0LmdyYW50UmVhZChhcGlGdW5jdGlvbik7XG5cbiAgICAvLyBDcmVhdGUgQVBJIEdhdGV3YXlcbiAgICBjb25zdCBhcGkgPSBuZXcgYXBpZ2F0ZXdheS5SZXN0QXBpKHRoaXMsICdTZXRsaXN0YUFwaScsIHtcbiAgICAgIGRlc2NyaXB0aW9uOiAnU2V0bGlzdGEgQVBJJyxcbiAgICAgIGRlcGxveU9wdGlvbnM6IHtcbiAgICAgICAgc3RhZ2VOYW1lOiAncHJvZCcsXG4gICAgICAgIGxvZ2dpbmdMZXZlbDogYXBpZ2F0ZXdheS5NZXRob2RMb2dnaW5nTGV2ZWwuSU5GTyxcbiAgICAgICAgZGF0YVRyYWNlRW5hYmxlZDogdHJ1ZSxcbiAgICAgIH0sXG4gICAgICBkZWZhdWx0Q29yc1ByZWZsaWdodE9wdGlvbnM6IHtcbiAgICAgICAgYWxsb3dPcmlnaW5zOiBhcGlnYXRld2F5LkNvcnMuQUxMX09SSUdJTlMsXG4gICAgICAgIGFsbG93TWV0aG9kczogYXBpZ2F0ZXdheS5Db3JzLkFMTF9NRVRIT0RTLFxuICAgICAgfSxcbiAgICB9KTtcblxuICAgIC8vIENyZWF0ZSBBUEkgR2F0ZXdheSByZXNvdXJjZXNcbiAgICBjb25zdCBhcGlSZXNvdXJjZSA9IGFwaS5yb290LmFkZFJlc291cmNlKCdhcGknKTtcbiAgICBcbiAgICAvLyBBZGQgcHJveHkgcmVzb3VyY2UgdG8gTGFtYmRhXG4gICAgY29uc3QgcHJveHlSZXNvdXJjZSA9IGFwaVJlc291cmNlLmFkZFByb3h5KHtcbiAgICAgIGRlZmF1bHRJbnRlZ3JhdGlvbjogbmV3IGFwaWdhdGV3YXkuTGFtYmRhSW50ZWdyYXRpb24oYXBpRnVuY3Rpb24pLFxuICAgICAgYW55TWV0aG9kOiB0cnVlLFxuICAgIH0pO1xuXG4gICAgLy8gTm93IGNyZWF0ZSBDbG91ZEZyb250IGRpc3RyaWJ1dGlvbiBhZnRlciBBUEkgR2F0ZXdheSBpcyBkZWZpbmVkXG4gICAgZGlzdHJpYnV0aW9uID0gbmV3IGNsb3VkZnJvbnQuRGlzdHJpYnV0aW9uKHRoaXMsICdEaXN0cmlidXRpb25WMycsIHtcbiAgICAgIGNvbW1lbnQ6ICdTZXRsaXN0YSBDbG91ZEZyb250IERpc3RyaWJ1dGlvbiB2MicsXG4gICAgICBkb21haW5OYW1lczogWydzZXRsaXN0YS50ZXJyZW5vLmRldiddLFxuICAgICAgY2VydGlmaWNhdGU6IGNlcnRpZmljYXRlLFxuICAgICAgZGVmYXVsdEJlaGF2aW9yOiB7XG4gICAgICAgIG9yaWdpbjogb3JpZ2lucy5TM0J1Y2tldE9yaWdpbi53aXRoT3JpZ2luQWNjZXNzQ29udHJvbChmcm9udGVuZEJ1Y2tldCksXG4gICAgICAgIHZpZXdlclByb3RvY29sUG9saWN5OiBjbG91ZGZyb250LlZpZXdlclByb3RvY29sUG9saWN5LlJFRElSRUNUX1RPX0hUVFBTLFxuICAgICAgICBhbGxvd2VkTWV0aG9kczogY2xvdWRmcm9udC5BbGxvd2VkTWV0aG9kcy5BTExPV19HRVRfSEVBRF9PUFRJT05TLFxuICAgICAgICBjYWNoZVBvbGljeTogY2xvdWRmcm9udC5DYWNoZVBvbGljeS5DQUNISU5HX09QVElNSVpFRCxcbiAgICAgIH0sXG4gICAgICBhZGRpdGlvbmFsQmVoYXZpb3JzOiB7XG4gICAgICAgICcvYXBpLyonOiB7XG4gICAgICAgICAgb3JpZ2luOiBuZXcgb3JpZ2lucy5SZXN0QXBpT3JpZ2luKGFwaSksXG4gICAgICAgICAgdmlld2VyUHJvdG9jb2xQb2xpY3k6IGNsb3VkZnJvbnQuVmlld2VyUHJvdG9jb2xQb2xpY3kuUkVESVJFQ1RfVE9fSFRUUFMsXG4gICAgICAgICAgYWxsb3dlZE1ldGhvZHM6IGNsb3VkZnJvbnQuQWxsb3dlZE1ldGhvZHMuQUxMT1dfQUxMLFxuICAgICAgICAgIGNhY2hlUG9saWN5OiBjbG91ZGZyb250LkNhY2hlUG9saWN5LkNBQ0hJTkdfRElTQUJMRUQsXG4gICAgICAgIH0sXG4gICAgICAgICcvYXV0aC8qJzoge1xuICAgICAgICAgIG9yaWdpbjogbmV3IG9yaWdpbnMuUmVzdEFwaU9yaWdpbihhcGkpLFxuICAgICAgICAgIHZpZXdlclByb3RvY29sUG9saWN5OiBjbG91ZGZyb250LlZpZXdlclByb3RvY29sUG9saWN5LlJFRElSRUNUX1RPX0hUVFBTLFxuICAgICAgICAgIGFsbG93ZWRNZXRob2RzOiBjbG91ZGZyb250LkFsbG93ZWRNZXRob2RzLkFMTE9XX0FMTCxcbiAgICAgICAgICBjYWNoZVBvbGljeTogY2xvdWRmcm9udC5DYWNoZVBvbGljeS5DQUNISU5HX0RJU0FCTEVELFxuICAgICAgICB9LFxuICAgICAgfSxcbiAgICAgIGRlZmF1bHRSb290T2JqZWN0OiAnaW5kZXguaHRtbCcsXG4gICAgICBlcnJvclJlc3BvbnNlczogW1xuICAgICAgICB7XG4gICAgICAgICAgaHR0cFN0YXR1czogNDA0LFxuICAgICAgICAgIHJlc3BvbnNlSHR0cFN0YXR1czogMjAwLFxuICAgICAgICAgIHJlc3BvbnNlUGFnZVBhdGg6ICcvaW5kZXguaHRtbCcsXG4gICAgICAgIH0sXG4gICAgICBdLFxuICAgIH0pO1xuXG4gICAgLy8gR3JhbnQgQ2xvdWRGcm9udCBwZXJtaXNzaW9uIHRvIGFjY2VzcyB0aGUgUzMgYnVja2V0XG4gICAgY29uc3QgYnVja2V0UG9saWN5U3RhdGVtZW50ID0gbmV3IGlhbS5Qb2xpY3lTdGF0ZW1lbnQoe1xuICAgICAgYWN0aW9uczogWydzMzpHZXRPYmplY3QnXSxcbiAgICAgIHJlc291cmNlczogW2Ake2Zyb250ZW5kQnVja2V0LmJ1Y2tldEFybn0vKmBdLFxuICAgICAgcHJpbmNpcGFsczogW25ldyBpYW0uU2VydmljZVByaW5jaXBhbCgnY2xvdWRmcm9udC5hbWF6b25hd3MuY29tJyldLFxuICAgICAgY29uZGl0aW9uczoge1xuICAgICAgICBTdHJpbmdFcXVhbHM6IHtcbiAgICAgICAgICAnQVdTOlNvdXJjZUFybic6IGBhcm46YXdzOmNsb3VkZnJvbnQ6OiR7dGhpcy5hY2NvdW50fTpkaXN0cmlidXRpb24vJHtkaXN0cmlidXRpb24uZGlzdHJpYnV0aW9uSWR9YCxcbiAgICAgICAgfSxcbiAgICAgIH0sXG4gICAgfSk7XG5cbiAgICBmcm9udGVuZEJ1Y2tldC5hZGRUb1Jlc291cmNlUG9saWN5KGJ1Y2tldFBvbGljeVN0YXRlbWVudCk7XG5cbiAgICAvLyBPdXRwdXQgdGhlIENsb3VkRnJvbnQgZG9tYWluIHNvIFNQT1RJRllfUkVESVJFQ1RfVVJJIGNhbiBiZSBjb25maWd1cmVkIG1hbnVhbGx5IGlmIG5lZWRlZFxuICAgIC8vIFRoZSBMYW1iZGEgd2lsbCBjb25zdHJ1Y3QgdGhlIHJlZGlyZWN0IFVSSSBkeW5hbWljYWxseSB1c2luZyB0aGUgSG9zdCBoZWFkZXJcblxuICAgIC8vIE91dHB1dHNcbiAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCAnQ2xvdWRGcm9udFVSTCcsIHtcbiAgICAgIHZhbHVlOiBgaHR0cHM6Ly8ke2Rpc3RyaWJ1dGlvbi5kb21haW5OYW1lfWAsXG4gICAgICBkZXNjcmlwdGlvbjogJ1VSTCBvZiB0aGUgQ2xvdWRGcm9udCBkaXN0cmlidXRpb24nLFxuICAgIH0pO1xuXG4gICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgJ0Nsb3VkRnJvbnREaXN0cmlidXRpb25JZCcsIHtcbiAgICAgIHZhbHVlOiBkaXN0cmlidXRpb24uZGlzdHJpYnV0aW9uSWQsXG4gICAgICBkZXNjcmlwdGlvbjogJ0lEIG9mIHRoZSBDbG91ZEZyb250IGRpc3RyaWJ1dGlvbicsXG4gICAgfSk7XG5cbiAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCAnRnJvbnRlbmRCdWNrZXROYW1lJywge1xuICAgICAgdmFsdWU6IGZyb250ZW5kQnVja2V0LmJ1Y2tldE5hbWUsXG4gICAgICBkZXNjcmlwdGlvbjogJ05hbWUgb2YgdGhlIFMzIGJ1Y2tldCBob3N0aW5nIHRoZSBmcm9udGVuZCcsXG4gICAgfSk7XG5cbiAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCAnQXBpVVJMJywge1xuICAgICAgdmFsdWU6IGFwaS51cmwsXG4gICAgICBkZXNjcmlwdGlvbjogJ1VSTCBvZiB0aGUgQVBJIEdhdGV3YXknLFxuICAgIH0pO1xuICB9XG59Il19