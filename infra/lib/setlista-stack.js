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
        // Create SSL certificate for custom domain
        const certificate = new certificatemanager.Certificate(this, 'SetlistaCertificate', {
            domainName: 'setlista.terreno.dev',
            subjectAlternativeNames: ['api.setlista.terreno.dev'],
            validation: certificatemanager.CertificateValidation.fromDns(),
        });
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
exports.SetlistaStack = SetlistaStack;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic2V0bGlzdGEtc3RhY2suanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyJzZXRsaXN0YS1zdGFjay50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFBQSxpREFBbUM7QUFDbkMsdURBQXlDO0FBQ3pDLHVFQUF5RDtBQUN6RCw0RUFBOEQ7QUFDOUQsK0RBQWlEO0FBQ2pELHVFQUF5RDtBQUN6RCx5REFBMkM7QUFDM0MsK0VBQWlFO0FBQ2pFLHVGQUF5RTtBQUN6RSwyREFBNkM7QUFDN0MsMkNBQTZCO0FBRzdCLE1BQWEsYUFBYyxTQUFRLEdBQUcsQ0FBQyxLQUFLO0lBQzFDLFlBQVksS0FBZ0IsRUFBRSxFQUFVLEVBQUUsS0FBc0I7UUFDOUQsS0FBSyxDQUFDLEtBQUssRUFBRSxFQUFFLEVBQUUsS0FBSyxDQUFDLENBQUM7UUFFeEIsbUNBQW1DO1FBQ25DLE1BQU0sY0FBYyxHQUFHLElBQUksRUFBRSxDQUFDLE1BQU0sQ0FBQyxJQUFJLEVBQUUsZ0JBQWdCLEVBQUU7WUFDM0Qsb0JBQW9CLEVBQUUsWUFBWTtZQUNsQyxvQkFBb0IsRUFBRSxZQUFZLEVBQUUsY0FBYztZQUNsRCxnQkFBZ0IsRUFBRSxLQUFLO1lBQ3ZCLGlCQUFpQixFQUFFLEVBQUUsQ0FBQyxpQkFBaUIsQ0FBQyxTQUFTO1lBQ2pELGFBQWEsRUFBRSxHQUFHLENBQUMsYUFBYSxDQUFDLE9BQU8sRUFBRSw0QkFBNEI7WUFDdEUsaUJBQWlCLEVBQUUsSUFBSSxFQUFFLDRCQUE0QjtTQUN0RCxDQUFDLENBQUM7UUFFSCwrRUFBK0U7UUFDL0UsSUFBSSxZQUFxQyxDQUFDO1FBRTFDLDBCQUEwQjtRQUMxQixNQUFNLGVBQWUsR0FBRyxjQUFjLENBQUMsTUFBTSxDQUFDLGdCQUFnQixDQUM1RCxJQUFJLEVBQ0osaUJBQWlCLEVBQ2pCLDRCQUE0QixDQUM3QixDQUFDO1FBRUYsTUFBTSxlQUFlLEdBQUcsY0FBYyxDQUFDLE1BQU0s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QTRDO1NBQzFELENBQUMsQ0FBQztRQUVILElBQUksR0FBRyxDQUFDLFNBQVMsQ0FBQyxJQUFJLEVBQUUsUUFBUSxFQUFFO1lBQ2hDLEtBQUssRUFBRSxHQUFHLENBQUMsR0FBRztZQUNkLFdBQVcsRUFBRSx3QkFBd0I7U0FDdEMsQ0FBQyxDQUFDO1FBRUgsSUFBSSxHQUFHLENBQUMsU0FBUyxDQUFDLElBQUksRUFBRSxtQkFBbUIsRUFBRTtZQUMzQyxLQUFLLEVBQUUsZUFBZSxDQUFDLGNBQWM7WUFDckMsV0FBVyxFQUFFLHVDQUF1QztTQUNyRCxDQUFDLENBQUM7UUFFSCxJQUFJLEdBQUcsQ0FBQyxTQUFTLENBQUMsSUFBSSxFQUFFLG9CQUFvQixFQUFFO1lBQzVDLEtBQUssRUFBRSxXQUFXLGVBQWUsQ0FBQyxVQUFVLEVBQUU7WUFDOUMsV0FBVyxFQUFFLHdDQUF3QztTQUN0RCxDQUFDLENBQUM7SUFDTCxDQUFDO0NBQ0Y7QUFyTEQsc0NBcUxDIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0ICogYXMgY2RrIGZyb20gJ2F3cy1jZGstbGliJztcbmltcG9ydCAqIGFzIHMzIGZyb20gJ2F3cy1jZGstbGliL2F3cy1zMyc7XG5pbXBvcnQgKiBhcyBjbG91ZGZyb250IGZyb20gJ2F3cy1jZGstbGliL2F3cy1jbG91ZGZyb250JztcbmltcG9ydCAqIGFzIG9yaWdpbnMgZnJvbSAnYXdzLWNkay1saWIvYXdzLWNsb3VkZnJvbnQtb3JpZ2lucyc7XG5pbXBvcnQgKiBhcyBsYW1iZGEgZnJvbSAnYXdzLWNkay1saWIvYXdzLWxhbWJkYSc7XG5pbXBvcnQgKiBhcyBhcGlnYXRld2F5IGZyb20gJ2F3cy1jZGstbGliL2F3cy1hcGlnYXRld2F5JztcbmltcG9ydCAqIGFzIGlhbSBmcm9tICdhd3MtY2RrLWxpYi9hd3MtaWFtJztcbmltcG9ydCAqIGFzIHNlY3JldHNtYW5hZ2VyIGZyb20gJ2F3cy1jZGstbGliL2F3cy1zZWNyZXRzbWFuYWdlcic7XG5pbXBvcnQgKiBhcyBjZXJ0aWZpY2F0ZW1hbmFnZXIgZnJvbSAnYXdzLWNkay1saWIvYXdzLWNlcnRpZmljYXRlbWFuYWdlcic7XG5pbXBvcnQgKiBhcyBsb2dzIGZyb20gJ2F3cy1jZGstbGliL2F3cy1sb2dzJztcbmltcG9ydCAqIGFzIHBhdGggZnJvbSAncGF0aCc7XG5pbXBvcnQgeyBDb25zdHJ1Y3QgfSBmcm9tICdjb25zdHJ1Y3RzJztcblxuZXhwb3J0IGNsYXNzIFNldGxpc3RhU3RhY2sgZXh0ZW5kcyBjZGsuU3RhY2sge1xuICBjb25zdHJ1Y3RvcihzY29wZTogQ29uc3RydWN0LCBpZDogc3RyaW5nLCBwcm9wcz86IGNkay5TdGFja1Byb3BzKSB7XG4gICAgc3VwZXIoc2NvcGUsIGlkLCBwcm9wcyk7XG5cbiAgICAvLyBDcmVhdGUgYSBidWNrZXQgZm9yIHRoZSBmcm9udGVuZFxuICAgIGNvbnN0IGZyb250ZW5kQnVja2V0ID0gbmV3IHMzLkJ1Y2tldCh0aGlzLCAnRnJvbnRlbmRCdWNrZXQnLCB7XG4gICAgICB3ZWJzaXRlSW5kZXhEb2N1bWVudDogJ2luZGV4Lmh0bWwnLFxuICAgICAgd2Vic2l0ZUVycm9yRG9jdW1lbnQ6ICdpbmRleC5odG1sJywgLy8gU1BBIHJvdXRpbmdcbiAgICAgIHB1YmxpY1JlYWRBY2Nlc3M6IGZhbHNlLFxuICAgICAgYmxvY2tQdWJsaWNBY2Nlc3M6IHMzLkJsb2NrUHVibGljQWNjZXNzLkJMT0NLX0FMTCxcbiAgICAgIHJlbW92YWxQb2xpY3k6IGNkay5SZW1vdmFsUG9saWN5LkRFU1RST1ksIC8vIEZvciBkZXYvdGVzdCBlbnZpcm9ubWVudHNcbiAgICAgIGF1dG9EZWxldGVPYmplY3RzOiB0cnVlLCAvLyBGb3IgZGV2L3Rlc3QgZW52aXJvbm1lbnRzXG4gICAgfSk7XG5cbiAgICAvLyBDbG91ZEZyb250IGRpc3RyaWJ1dGlvbiBmb3IgdGhlIGZyb250ZW5kICh3aWxsIGJlIGNyZWF0ZWQgYWZ0ZXIgQVBJIEdhdGV3YXkpXG4gICAgbGV0IGRpc3RyaWJ1dGlvbjogY2xvdWRmcm9udC5EaXN0cmlidXRpb247XG5cbiAgICAvLyBJbXBvcnQgZXhpc3Rpbmcgc2VjcmV0c1xuICAgIGNvbnN0IHNldGxpc3RGbUFwaUtleSA9IHNlY3JldHNtYW5hZ2VyLlNlY3JldC5mcm9tU2VjcmV0TmFtZVYyKFxuICAgICAgdGhpcywgXG4gICAgICAnU2V0bGlzdEZtQXBpS2V5JywgXG4gICAgICAnc2V0bGlzdGEvc2V0bGlzdGZtLWFwaS1rZXknXG4gICAgKTtcblxuICAgIGNvbnN0IHNwb3RpZnlDbGllbnRJZCA9IHNlY3JldHNtYW5hZ2VyLlNlY3JldC5mcm9tU2VjcmV0TmFtZVYyKFxuICAgICAgdGhpcywgXG4gICAgICAnU3BvdGlmeUNsaWVudElkJywgXG4gICAgICAnc2V0bGlzdGEvc3BvdGlmeS1jbGllbnQtaWQnXG4gICAgKTtcblxuICAgIGNvbnN0IHNwb3RpZnlDbGllbnRTZWNyZXQgPSBzZWNyZXRzbWFuYWdlci5TZWNyZXQuZnJvbVNlY3JldE5hbWVWMihcbiAgICAgIHRoaXMsIFxuICAgICAgJ1Nwb3RpZnlDbGllbnRTZWNyZXQnLCBcbiAgICAgICdzZXRsaXN0YS9zcG90aWZ5LWNsaWVudC1zZWNyZXQnXG4gICAgKTtcblxuICAgIC8vIENyZWF0ZSBTU0wgY2VydGlmaWNhdGUgZm9yIGN1c3RvbSBkb21haW5cbiAgICBjb25zdCBjZXJ0aWZpY2F0ZSA9IG5ldyBjZXJ0aWZpY2F0ZW1hbmFnZXIuQ2VydGlmaWNhdGUodGhpcywgJ1NldGxpc3RhQ2VydGlmaWNhdGUnLCB7XG4gICAgICBkb21haW5OYW1lOiAnc2V0bGlzdGEudGVycmVuby5kZXYnLFxuICAgICAgc3ViamVjdEFsdGVybmF0aXZlTmFtZXM6IFsnYXBpLnNldGxpc3RhLnRlcnJlbm8uZGV2J10sXG4gICAgICB2YWxpZGF0aW9uOiBjZXJ0aWZpY2F0ZW1hbmFnZXIuQ2VydGlmaWNhdGVWYWxpZGF0aW9uLmZyb21EbnMoKSxcbiAgICB9KTtcblxuICAgIC8vIENyZWF0ZSBMYW1iZGEgZnVuY3Rpb24gZm9yIHRoZSBiYWNrZW5kXG4gICAgY29uc3QgYXBpRnVuY3Rpb24gPSBuZXcgbGFtYmRhLkZ1bmN0aW9uKHRoaXMsICdBcGlGdW5jdGlvbicsIHtcbiAgICAgIHJ1bnRpbWU6IGxhbWJkYS5SdW50aW1lLk5PREVKU18xOF9YLFxuICAgICAgaGFuZGxlcjogJ2Rpc3QvbGFtYmRhLmxhbWJkYUhhbmRsZXInLFxuICAgICAgY29kZTogbGFtYmRhLkNvZGUuZnJvbUFzc2V0KHBhdGguam9pbihfX2Rpcm5hbWUsICcuLi8uLi9iYWNrZW5kJykpLFxuICAgICAgZW52aXJvbm1lbnQ6IHtcbiAgICAgICAgTk9ERV9FTlY6ICdwcm9kdWN0aW9uJyxcbiAgICAgIH0sXG4gICAgICB0aW1lb3V0OiBjZGsuRHVyYXRpb24uc2Vjb25kcygzMCksXG4gICAgICBtZW1vcnlTaXplOiAyNTYsXG4gICAgICBsb2dSZXRlbnRpb246IGxvZ3MuUmV0ZW50aW9uRGF5cy5PTkVfV0VFSyxcbiAgICB9KTtcblxuICAgIC8vIEdyYW50IHBlcm1pc3Npb25zIHRvIGFjY2VzcyBzZWNyZXRzXG4gICAgc2V0bGlzdEZtQXBpS2V5LmdyYW50UmVhZChhcGlGdW5jdGlvbik7XG4gICAgc3BvdGlmeUNsaWVudElkLmdyYW50UmVhZChhcGlGdW5jdGlvbik7XG4gICAgc3BvdGlmeUNsaWVudFNlY3JldC5ncmFudFJlYWQoYXBpRnVuY3Rpb24pO1xuXG4gICAgLy8gQ3JlYXRlIEFQSSBHYXRld2F5XG4gICAgY29uc3QgYXBpID0gbmV3IGFwaWdhdGV3YXkuUmVzdEFwaSh0aGlzLCAnU2V0bGlzdGFBcGknLCB7XG4gICAgICBkZXNjcmlwdGlvbjogJ1NldGxpc3RhIEFQSScsXG4gICAgICBkZXBsb3lPcHRpb25zOiB7XG4gICAgICAgIHN0YWdlTmFtZTogJ3Byb2QnLFxuICAgICAgICBsb2dnaW5nTGV2ZWw6IGFwaWdhdGV3YXkuTWV0aG9kTG9nZ2luZ0xldmVsLklORk8sXG4gICAgICAgIGRhdGFUcmFjZUVuYWJsZWQ6IHRydWUsXG4gICAgICB9LFxuICAgICAgZGVmYXVsdENvcnNQcmVmbGlnaHRPcHRpb25zOiB7XG4gICAgICAgIGFsbG93T3JpZ2luczogYXBpZ2F0ZXdheS5Db3JzLkFMTF9PUklHSU5TLFxuICAgICAgICBhbGxvd01ldGhvZHM6IGFwaWdhdGV3YXkuQ29ycy5BTExfTUVUSE9EUyxcbiAgICAgIH0sXG4gICAgfSk7XG5cbiAgICAvLyBDcmVhdGUgQVBJIEdhdGV3YXkgcmVzb3VyY2VzXG4gICAgY29uc3QgYXBpUmVzb3VyY2UgPSBhcGkucm9vdC5hZGRSZXNvdXJjZSgnYXBpJyk7XG4gICAgXG4gICAgLy8gQWRkIHByb3h5IHJlc291cmNlIHRvIExhbWJkYVxuICAgIGNvbnN0IHByb3h5UmVzb3VyY2UgPSBhcGlSZXNvdXJjZS5hZGRQcm94eSh7XG4gICAgICBkZWZhdWx0SW50ZWdyYXRpb246IG5ldyBhcGlnYXRld2F5LkxhbWJkYUludGVncmF0aW9uKGFwaUZ1bmN0aW9uKSxcbiAgICAgIGFueU1ldGhvZDogdHJ1ZSxcbiAgICB9KTtcblxuICAgIC8vIE5vdyBjcmVhdGUgQ2xvdWRGcm9udCBkaXN0cmlidXRpb24gYWZ0ZXIgQVBJIEdhdGV3YXkgaXMgZGVmaW5lZFxuICAgIGRpc3RyaWJ1dGlvbiA9IG5ldyBjbG91ZGZyb250LkRpc3RyaWJ1dGlvbih0aGlzLCAnRGlzdHJpYnV0aW9uVjMnLCB7XG4gICAgICBjb21tZW50OiAnU2V0bGlzdGEgQ2xvdWRGcm9udCBEaXN0cmlidXRpb24gdjInLFxuICAgICAgZG9tYWluTmFtZXM6IFsnc2V0bGlzdGEudGVycmVuby5kZXYnXSxcbiAgICAgIGNlcnRpZmljYXRlOiBjZXJ0aWZpY2F0ZSxcbiAgICAgIGRlZmF1bHRCZWhhdmlvcjoge1xuICAgICAgICBvcmlnaW46IG9yaWdpbnMuUzNCdWNrZXRPcmlnaW4ud2l0aE9yaWdpbkFjY2Vzc0NvbnRyb2woZnJvbnRlbmRCdWNrZXQpLFxuICAgICAgICB2aWV3ZXJQcm90b2NvbFBvbGljeTogY2xvdWRmcm9udC5WaWV3ZXJQcm90b2NvbFBvbGljeS5SRURJUkVDVF9UT19IVFRQUyxcbiAgICAgICAgYWxsb3dlZE1ldGhvZHM6IGNsb3VkZnJvbnQuQWxsb3dlZE1ldGhvZHMuQUxMT1dfR0VUX0hFQURfT1BUSU9OUyxcbiAgICAgICAgY2FjaGVQb2xpY3k6IGNsb3VkZnJvbnQuQ2FjaGVQb2xpY3kuQ0FDSElOR19PUFRJTUlaRUQsXG4gICAgICB9LFxuICAgICAgYWRkaXRpb25hbEJlaGF2aW9yczoge1xuICAgICAgICAnL2FwaS8qJzoge1xuICAgICAgICAgIG9yaWdpbjogbmV3IG9yaWdpbnMuUmVzdEFwaU9yaWdpbihhcGkpLFxuICAgICAgICAgIHZpZXdlclByb3RvY29sUG9saWN5OiBjbG91ZGZyb250LlZpZXdlclByb3RvY29sUG9saWN5LlJFRElSRUNUX1RPX0hUVFBTLFxuICAgICAgICAgIGFsbG93ZWRNZXRob2RzOiBjbG91ZGZyb250LkFsbG93ZWRNZXRob2RzLkFMTE9XX0FMTCxcbiAgICAgICAgICBjYWNoZVBvbGljeTogY2xvdWRmcm9udC5DYWNoZVBvbGljeS5DQUNISU5HX0RJU0FCTEVELFxuICAgICAgICB9LFxuICAgICAgICAnL2F1dGgvKic6IHtcbiAgICAgICAgICBvcmlnaW46IG5ldyBvcmlnaW5zLlJlc3RBcGlPcmlnaW4oYXBpKSxcbiAgICAgICAgICB2aWV3ZXJQcm90b2NvbFBvbGljeTogY2xvdWRmcm9udC5WaWV3ZXJQcm90b2NvbFBvbGljeS5SRURJUkVDVF9UT19IVFRQUyxcbiAgICAgICAgICBhbGxvd2VkTWV0aG9kczogY2xvdWRmcm9udC5BbGxvd2VkTWV0aG9kcy5BTExPV19BTEwsXG4gICAgICAgICAgY2FjaGVQb2xpY3k6IGNsb3VkZnJvbnQuQ2FjaGVQb2xpY3kuQ0FDSElOR19ESVNBQkxFRCxcbiAgICAgICAgfSxcbiAgICAgIH0sXG4gICAgICBkZWZhdWx0Um9vdE9iamVjdDogJ2luZGV4Lmh0bWwnLFxuICAgICAgZXJyb3JSZXNwb25zZXM6IFtcbiAgICAgICAge1xuICAgICAgICAgIGh0dHBTdGF0dXM6IDQwNCxcbiAgICAgICAgICByZXNwb25zZUh0dHBTdGF0dXM6IDIwMCxcbiAgICAgICAgICByZXNwb25zZVBhZ2VQYXRoOiAnL2luZGV4Lmh0bWwnLFxuICAgICAgICB9LFxuICAgICAgXSxcbiAgICB9KTtcblxuICAgIC8vIEdyYW50IENsb3VkRnJvbnQgcGVybWlzc2lvbiB0byBhY2Nlc3MgdGhlIFMzIGJ1Y2tldFxuICAgIGNvbnN0IGJ1Y2tldFBvbGljeVN0YXRlbWVudCA9IG5ldyBpYW0uUG9saWN5U3RhdGVtZW50KHtcbiAgICAgIGFjdGlvbnM6IFsnczM6R2V0T2JqZWN0J10sXG4gICAgICByZXNvdXJjZXM6IFtgJHtmcm9udGVuZEJ1Y2tldC5idWNrZXRBcm59LypgXSxcbiAgICAgIHByaW5jaXBhbHM6IFtuZXcgaWFtLlNlcnZpY2VQcmluY2lwYWwoJ2Nsb3VkZnJvbnQuYW1hem9uYXdzLmNvbScpXSxcbiAgICAgIGNvbmRpdGlvbnM6IHtcbiAgICAgICAgU3RyaW5nRXF1YWxzOiB7XG4gICAgICAgICAgJ0FXUzpTb3VyY2VBcm4nOiBgYXJuOmF3czpjbG91ZGZyb250Ojoke3RoaXMuYWNjb3VudH06ZGlzdHJpYnV0aW9uLyR7ZGlzdHJpYnV0aW9uLmRpc3RyaWJ1dGlvbklkfWAsXG4gICAgICAgIH0sXG4gICAgICB9LFxuICAgIH0pO1xuXG4gICAgZnJvbnRlbmRCdWNrZXQuYWRkVG9SZXNvdXJjZVBvbGljeShidWNrZXRQb2xpY3lTdGF0ZW1lbnQpO1xuXG4gICAgLy8gQ3JlYXRlIGEgc2VwYXJhdGUgQ2xvdWRGcm9udCBkaXN0cmlidXRpb24gZm9yIHRoZSBBUEkgc3ViZG9tYWluXG4gICAgY29uc3QgYXBpRGlzdHJpYnV0aW9uID0gbmV3IGNsb3VkZnJvbnQuRGlzdHJpYnV0aW9uKHRoaXMsICdBcGlEaXN0cmlidXRpb24nLCB7XG4gICAgICBjb21tZW50OiAnU2V0bGlzdGEgQVBJIENsb3VkRnJvbnQgRGlzdHJpYnV0aW9uJyxcbiAgICAgIGRvbWFpbk5hbWVzOiBbJ2FwaS5zZXRsaXN0YS50ZXJyZW5vLmRldiddLFxuICAgICAgY2VydGlmaWNhdGU6IGNlcnRpZmljYXRlLFxuICAgICAgZGVmYXVsdEJlaGF2aW9yOiB7XG4gICAgICAgIG9yaWdpbjogbmV3IG9yaWdpbnMuUmVzdEFwaU9yaWdpbihhcGkpLFxuICAgICAgICB2aWV3ZXJQcm90b2NvbFBvbGljeTogY2xvdWRmcm9udC5WaWV3ZXJQcm90b2NvbFBvbGljeS5SRURJUkVDVF9UT19IVFRQUyxcbiAgICAgICAgYWxsb3dlZE1ldGhvZHM6IGNsb3VkZnJvbnQuQWxsb3dlZE1ldGhvZHMuQUxMT1dfQUxMLFxuICAgICAgICBjYWNoZVBvbGljeTogY2xvdWRmcm9udC5DYWNoZVBvbGljeS5DQUNISU5HX0RJU0FCTEVELFxuICAgICAgICBvcmlnaW5SZXF1ZXN0UG9saWN5OiBjbG91ZGZyb250Lk9yaWdpblJlcXVlc3RQb2xpY3kuQ09SU19TM19PUklHSU4sXG4gICAgICB9LFxuICAgIH0pO1xuXG4gICAgLy8gT3V0cHV0IHRoZSBDbG91ZEZyb250IGRvbWFpbiBzbyBTUE9USUZZX1JFRElSRUNUX1VSSSBjYW4gYmUgY29uZmlndXJlZCBtYW51YWxseSBpZiBuZWVkZWRcbiAgICAvLyBUaGUgTGFtYmRhIHdpbGwgY29uc3RydWN0IHRoZSByZWRpcmVjdCBVUkkgZHluYW1pY2FsbHkgdXNpbmcgdGhlIEhvc3QgaGVhZGVyXG5cbiAgICAvLyBPdXRwdXRzXG4gICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgJ0Nsb3VkRnJvbnRVUkwnLCB7XG4gICAgICB2YWx1ZTogYGh0dHBzOi8vJHtkaXN0cmlidXRpb24uZG9tYWluTmFtZX1gLFxuICAgICAgZGVzY3JpcHRpb246ICdVUkwgb2YgdGhlIENsb3VkRnJvbnQgZGlzdHJpYnV0aW9uJyxcbiAgICB9KTtcblxuICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsICdDbG91ZEZyb250RGlzdHJpYnV0aW9uSWQnLCB7XG4gICAgICB2YWx1ZTogZGlzdHJpYnV0aW9uLmRpc3RyaWJ1dGlvbklkLFxuICAgICAgZGVzY3JpcHRpb246ICdJRCBvZiB0aGUgQ2xvdWRGcm9udCBkaXN0cmlidXRpb24nLFxuICAgIH0pO1xuXG4gICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgJ0Zyb250ZW5kQnVja2V0TmFtZScsIHtcbiAgICAgIHZhbHVlOiBmcm9udGVuZEJ1Y2tldC5idWNrZXROYW1lLFxuICAgICAgZGVzY3JpcHRpb246ICdOYW1lIG9mIHRoZSBTMyBidWNrZXQgaG9zdGluZyB0aGUgZnJvbnRlbmQnLFxuICAgIH0pO1xuXG4gICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgJ0FwaVVSTCcsIHtcbiAgICAgIHZhbHVlOiBhcGkudXJsLFxuICAgICAgZGVzY3JpcHRpb246ICdVUkwgb2YgdGhlIEFQSSBHYXRld2F5JyxcbiAgICB9KTtcblxuICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsICdBcGlEaXN0cmlidXRpb25JZCcsIHtcbiAgICAgIHZhbHVlOiBhcGlEaXN0cmlidXRpb24uZGlzdHJpYnV0aW9uSWQsXG4gICAgICBkZXNjcmlwdGlvbjogJ0lEIG9mIHRoZSBBUEkgQ2xvdWRGcm9udCBkaXN0cmlidXRpb24nLFxuICAgIH0pO1xuXG4gICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgJ0FwaURpc3RyaWJ1dGlvblVSTCcsIHtcbiAgICAgIHZhbHVlOiBgaHR0cHM6Ly8ke2FwaURpc3RyaWJ1dGlvbi5kb21haW5OYW1lfWAsXG4gICAgICBkZXNjcmlwdGlvbjogJ1VSTCBvZiB0aGUgQVBJIENsb3VkRnJvbnQgZGlzdHJpYnV0aW9uJyxcbiAgICB9KTtcbiAgfVxufSJdfQ==