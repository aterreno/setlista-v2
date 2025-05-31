# GitHub Actions Workflows

This directory contains the CI/CD workflows for the Setlista application.

## Workflows

### 1. CI (`ci.yml`)
- **Triggers**: Push to `main`/`develop`, pull requests to `main`
- **Purpose**: Runs tests and linting for frontend, backend, and infrastructure
- **Jobs**:
  - `test-frontend`: ESLint + React tests with coverage
  - `test-backend`: ESLint + TypeScript compilation + Jest tests with coverage
  - `test-infra`: CDK synth validation

### 2. Deploy Frontend (`deploy-frontend.yml`)
- **Triggers**: Push to `main` (frontend changes), manual workflow dispatch
- **Purpose**: Builds and deploys React app to S3 + CloudFront
- **Steps**: Test → Build → S3 Upload → CloudFront Invalidation

### 3. Deploy Backend (`deploy-backend.yml`)
- **Triggers**: Push to `main` (backend/infra changes), manual workflow dispatch
- **Purpose**: Builds and deploys Lambda functions via CDK
- **Steps**: Test → Build → CDK Deploy

## Required Secrets

Configure these in GitHub repository settings → Secrets and variables → Actions:

### AWS Credentials
- `AWS_ACCESS_KEY_ID`: AWS access key for deployments
- `AWS_SECRET_ACCESS_KEY`: AWS secret key for deployments

### Frontend Environment
- `REACT_APP_API_URL`: Backend API URL
- `REACT_APP_SPOTIFY_CLIENT_ID`: Spotify application client ID
- `REACT_APP_SPOTIFY_REDIRECT_URI`: Spotify OAuth redirect URI

### Backend Environment
- `SETLIST_FM_API_KEY`: Setlist.fm API key
- `SPOTIFY_CLIENT_ID`: Spotify application client ID (for backend)
- `SPOTIFY_CLIENT_SECRET`: Spotify application client secret

### Deployment Targets
- `S3_BUCKET_NAME`: S3 bucket for frontend hosting
- `CLOUDFRONT_DISTRIBUTION_ID`: CloudFront distribution ID for cache invalidation

## Local Testing with Act

Install [act](https://github.com/nektos/act) to test workflows locally:

```bash
# Install act (macOS)
brew install act

# Install act (Linux)
curl https://raw.githubusercontent.com/nektos/act/master/install.sh | sudo bash

# Install act (Windows)
choco install act-cli
```

### Test workflows locally:

```bash
# Test the CI workflow
act -j test-frontend
act -j test-backend
act -j test-infra

# Test full CI workflow
act push

# Test deployment workflows (requires secrets)
act -j deploy -s AWS_ACCESS_KEY_ID=your-key -s AWS_SECRET_ACCESS_KEY=your-secret

# List available jobs
act -l

# Dry run (don't actually execute)
act -n
```

### Create `.actrc` file for easier testing:

```bash
# .actrc
-P ubuntu-latest=ghcr.io/catthehacker/ubuntu:act-latest
--container-daemon-socket -
```

## Troubleshooting

### Common Issues

1. **Cache dependency path errors**: Ensure paths start with `./` relative to repository root
2. **Missing secrets**: Verify all required secrets are configured in GitHub
3. **CDK deployment failures**: Check AWS credentials and CDK bootstrap status
4. **Frontend build failures**: Verify environment variables are set correctly

### Debug Commands

```bash
# Check workflow syntax
act -n --workflows .github/workflows/

# Run with debug logging
act --verbose

# Use specific platform
act -P ubuntu-latest=node:18-bullseye
```