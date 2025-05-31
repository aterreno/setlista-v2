# Setlista

A full-stack web application that allows users to search for artists on Setlist.fm, view their recent concerts, and create Spotify playlists from setlists.

## Features

- Search for artists using Setlist.fm API
- View recent concerts and setlists
- Create Spotify playlists from setlists with a single click
- Secure authentication with Spotify OAuth

## Tech Stack

- **Backend**: TypeScript, Node.js, Express
- **Frontend**: React, TypeScript
- **Infrastructure**: AWS CDK (CloudFront, S3, Lambda, API Gateway)
- **Testing**: Jest, React Testing Library, Cypress
- **CI/CD**: GitHub Actions

## Local Development

### Prerequisites

- Node.js (v18+)
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
   - Install Node.js 18.20.5 and npm 10.9.2+ manually

3. Create a `.env` file in both the `backend` and `frontend` directories (see `.env.example`)
4. Run `make setup` to install dependencies

### Running locally

```bash
# Start the full stack locally
make dev

# Run backend only
make backend

# Run frontend only
make frontend
```

### Testing

```bash
# Run all tests
make test

# Run backend tests
make test-backend

# Run frontend tests
make test-frontend

# Run tests with coverage
make test-coverage

# Run all tests with coverage
make test-with-coverage

# Run linting
make lint

# Run linting with auto-fix
make lint-fix

# Run pre-commit checks (tests + coverage + linting)
make pre-commit-check
```

## Deployment

### Prerequisites

- AWS account
- GitHub repository with OIDC configured for AWS

### Deploying to AWS

The application is automatically deployed to AWS when changes are pushed to the main branch, using GitHub Actions.

For manual deployment:

```bash
make deploy
```

## Architecture

The application follows clean architecture principles:

- **Frontend**: React application hosted on S3 + CloudFront
- **Backend**: Node.js APIs deployed as Lambda functions behind API Gateway
- **Security**: Secrets stored in AWS Secrets Manager, HTTPS enforced, OAuth for authentication

## License

MIT