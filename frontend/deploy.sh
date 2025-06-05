#!/bin/bash

# Script for building and deploying the frontend to production from local machine

# Check if AWS CLI is installed
if ! command -v aws &> /dev/null; then
  echo "AWS CLI is required but not installed. Please install it first."
  exit 1
fi

# Set production environment variables for build
export NEXT_PUBLIC_API_URL=https://api.setlista.terreno.dev
# Note: No '/api' at the end - the API client will handle this

echo "Building with production API endpoint: $NEXT_PUBLIC_API_URL"

# Run the Next.js build process
npm run build

# Check if build was successful
if [ $? -ne 0 ]; then
  echo "Build failed. Aborting deployment."
  exit 1
fi

# Ask for confirmation before deploying
read -p "Build successful. Deploy to production? (y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
  echo "Deployment canceled."
  exit 1
fi

# Get S3 bucket name
read -p "Enter S3 bucket name (default: setlistastack-frontendbucketefe2e19c-xrgiygoshsb9): " S3_BUCKET
S3_BUCKET=${S3_BUCKET:-setlistastack-frontendbucketefe2e19c-xrgiygoshsb9}

# Get CloudFront distribution ID
read -p "Enter CloudFront distribution ID (default: E32ACMU1OP4ZBW): " CF_DISTRIBUTION_ID
CF_DISTRIBUTION_ID=${CF_DISTRIBUTION_ID:-E32ACMU1OP4ZBW}

# Deploy to S3
echo "Deploying to S3 bucket: $S3_BUCKET"
aws s3 sync out/ s3://$S3_BUCKET --delete

# Check if S3 deployment was successful
if [ $? -ne 0 ]; then
  echo "S3 deployment failed."
  exit 1
fi

# Create CloudFront invalidation
echo "Creating CloudFront invalidation for distribution: $CF_DISTRIBUTION_ID"
aws cloudfront create-invalidation --distribution-id $CF_DISTRIBUTION_ID --paths "/*"

echo "Deployment completed successfully!"
