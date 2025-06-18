.PHONY: setup dev docker backend frontend test test-backend test-frontend test-coverage lint lint-fix pre-commit-check typecheck deploy clean clean-install install-all

# Project setup and dependency management
setup:
	@echo "🔧 Setting up project dependencies..."
	cd backend && npm install
	cd frontend && npm install
	cd infra && npm install

clean-install:
	@echo "🧹 Cleaning all dependencies and performing fresh install..."
	npm run clean-install

install-all:
	@echo "📦 Installing all dependencies and verifying integrity..."
	npm run install-all

# Development environments
dev:
	@echo "🚀 Starting development environment with Docker..."
	docker-compose up

docker:
	@echo "🐳 Starting Docker with bake optimization..."
	COMPOSE_BAKE=true docker compose up

backend:
	@echo "⚙️ Starting backend server..."
	cd backend && npm run dev

frontend:
	@echo "🎨 Starting frontend development server..."
	cd frontend && npm run dev

start-frontend:
	@echo "🖥️ Starting frontend production server..."
	cd frontend && npm run start

serve-frontend:
	@echo "🌐 Serving frontend static files..."
	cd frontend && npm run serve

# Testing commands
test:
	@echo "🧪 Running all tests..."
	npm test

test-backend:
	@echo "🧪 Running backend tests..."
	npm run test-backend

test-frontend:
	@echo "🧪 Running frontend tests..."
	npm run test-frontend

test-coverage:
	@echo "🧪 Running backend tests with coverage..."
	npm run test-coverage

# Code quality commands
typecheck:
	@echo "🔍 Running TypeScript checks across all projects..."
	npm run typecheck

lint:
	@echo "🔎 Running linters across all projects..."
	npm run lint

lint-fix:
	@echo "🔎 Linting code with auto-fix..."
	npm run lint-fix

pre-commit-check:
	@echo "✅ Running pre-commit checks (typescript, lint, tests, coverage)..."
	npm run pre-commit-check

# Building and deployment commands
build-backend:
	@echo "🏗️ Building backend..."
	cd backend && npm run build

build-frontend:
	@echo "🏗️ Building frontend..."
	cd frontend && npm run build

build-infra:
	@echo "🏗️ Building infrastructure code..."
	cd infra && npm run build

build-all: build-backend build-frontend build-infra
	@echo "🏗️ All projects built successfully"

deploy:
	@echo "🚀 Deploying infrastructure and applications..."
	cd infra && npm run deploy

# CDK infrastructure commands
cdk-synth:
	@echo "📝 Synthesizing CloudFormation templates..."
	cd infra && npm run synth

cdk-diff:
	@echo "🔄 Checking infrastructure changes..."
	cd infra && npm run diff

# Cleanup commands
clean:
	@echo "🧹 Cleaning generated files and build artifacts..."
	find . -name "dist" -type d -prune -exec rm -rf '{}' +
	find . -name ".next" -type d -prune -exec rm -rf '{}' +
	find . -name "coverage" -type d -prune -exec rm -rf '{}' +
	find . -name "cdk.out" -type d -prune -exec rm -rf '{}' +
	rm -rf infra/cdk.out

# Documentation for commands
help:
	@echo "📚 Setlista Project Commands"
	@echo ""
	@echo "Development Commands:"
	@echo "  make setup           - Install dependencies in each folder"
	@echo "  make clean-install   - Clean and reinstall all dependencies"
	@echo "  make install-all     - Install all dependencies and verify integrity"
	@echo "  make dev             - Start full stack with Docker"
	@echo "  make backend         - Start backend server only"
	@echo "  make frontend        - Start frontend dev server only"
	@echo ""
	@echo "Building Commands:"
	@echo "  make build-all       - Build backend, frontend and infra"
	@echo "  make build-backend   - Build backend only"
	@echo "  make build-frontend  - Build frontend only"
	@echo ""
	@echo "Testing and Quality Commands:"
	@echo "  make test            - Run all tests"
	@echo "  make test-backend    - Run backend tests"
	@echo "  make test-frontend   - Run frontend tests"
	@echo "  make test-coverage   - Run tests with coverage"
	@echo "  make lint            - Run linters"
	@echo "  make lint-fix        - Run linters with auto-fix"
	@echo "  make typecheck       - Run TypeScript checks"
	@echo "  make pre-commit-check - Run pre-commit validation"
	@echo ""
	@echo "Deployment Commands:"
	@echo "  make deploy          - Deploy all infrastructure and apps"
	@echo "  make cdk-synth       - Synthesize CloudFormation templates"
	@echo "  make cdk-diff        - Show infrastructure changes"
	@echo ""
	@echo "Maintenance Commands:"
	@echo "  make clean           - Remove build artifacts"
	@echo "  make deps-check      - Check outdated dependencies"
	@echo "  make deps-audit      - Audit dependencies for vulnerabilities"
	@echo "  make deps-update     - Update dependencies safely"