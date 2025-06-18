# Setlista

A full-stack web application that allows users to search for artists on Setlist.fm, view their recent concerts, and create Spotify playlists from setlists.

## Features

- Search for artists using Setlist.fm API
- View recent concerts and setlists
- Create Spotify playlists from setlists with a single click
- Secure authentication with Spotify OAuth

## Tech Stack

- **Backend**: TypeScript, Node.js v22, Express
- **Frontend**: React 18, Next.js 14, TypeScript
- **Infrastructure**: AWS CDK (CloudFront, S3, Lambda, API Gateway)
- **Testing**: Jest, React Testing Library
- **CI/CD**: GitHub Actions

## Local Development

### Prerequisites

- Node.js (v22+)
- Docker
- AWS CLI (for deployment)
- Setlist.fm API key
- Spotify Developer account

### Setup

1. Clone the repository
2. **Install correct Node.js version**:
   
   **Option A: Using asdf (recommended)**
   ```bash
   # Install asdf plugins (if not already installed)
   asdf plugin add nodejs
   asdf plugin add npm
   
   # Install and use the project's defined versions
   asdf install
   ```
   
   **Option B: Using nvm**
   ```bash
   # Install and use the Node.js version specified in .nvmrc
   nvm install
   nvm use
   ```
   
   **Option C: Manual installation**
   - Install Node.js 22+ and npm 10.9.2+ manually

3. Create a `.env` file in both the `backend` and `frontend` directories (see `.env.example`)
4. Run `make setup` to install dependencies

### Running locally

```bash
# Start the full stack locally (Docker)
make dev

# Run backend only
make backend

# Run frontend only
make frontend

# Start frontend production server
make start-frontend

# Serve built static files
make serve-frontend
```

### Building

```bash
# Build all projects
make build-all

# Build backend only
make build-backend

# Build frontend only
make build-frontend

# Build infrastructure only
make build-infra
```

### Testing & Quality Checks

```bash
# Run all tests
make test

# Run backend tests
make test-backend

# Run frontend tests
make test-frontend

# Run tests with coverage (required to be 100%)
make test-coverage

# Run TypeScript type checking
make typecheck

# Run linting
make lint

# Run linting with auto-fix
make lint-fix

# Run pre-commit checks (typescript, lint, tests, coverage)
make pre-commit-check
```

### Dependency Management

```bash
# Clean and reinstall all dependencies
make clean-install

# Install all dependencies
make install-all

# Check for outdated dependencies
make deps-check

# Update dependencies safely
make deps-update

# Audit dependencies for vulnerabilities
make deps-audit
```

## Deployment

### Prerequisites

- AWS account
- GitHub repository with OIDC configured for AWS
- Node.js 22+ and npm 10.9.2+
- AWS CLI configured with appropriate credentials

### Infrastructure Management

```bash
# Deploy all infrastructure and applications to AWS
make deploy

# Synthesize CloudFormation templates
make cdk-synth

# Check infrastructure changes before deploying
make cdk-diff
```

### CI/CD Pipeline

The application is automatically deployed to AWS when changes are pushed to the main branch using GitHub Actions with the following checks:

1. TypeScript compilation checks
2. Linting verification
3. Test execution with 100% coverage requirement
4. Pre-commit validation
5. Infrastructure deployment

### Maintenance

```bash
# Clean build artifacts and generated files
make clean

# View all available commands
make help
```

## Architecture

The application follows clean architecture principles:

- **Frontend**: React/Next.js application hosted on S3 + CloudFront
- **Backend**: Node.js APIs deployed as Lambda functions behind API Gateway
- **Security**: Secrets stored in AWS Secrets Manager, HTTPS enforced, OAuth for authentication

## License

MIT