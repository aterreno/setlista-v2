.PHONY: setup dev docker backend frontend test test-backend test-frontend test-coverage test-with-coverage lint lint-fix pre-commit-check prepare deploy clean check-deps update-deps audit

setup:
	@echo "Setting up project dependencies..."
	cd backend && npm install
	cd frontend && npm install
	cd infra && npm install

dev:
	@echo "Starting development environment..."
	docker-compose up

docker:
	@echo "Starting Docker with bake optimization..."
	COMPOSE_BAKE=true docker compose up

backend:
	@echo "Starting backend..."
	cd backend && npm run dev

frontend:
	@echo "Starting frontend..."
	cd frontend && npm run start

test:
	@echo "Running all tests..."
	npm run test

test-backend:
	@echo "Running backend tests..."
	npm run test-backend

test-frontend:
	@echo "Running frontend tests..."
	npm run test-frontend

test-coverage:
	@echo "Running backend tests with coverage..."
	npm run test-coverage

test-with-coverage:
	@echo "Running all tests with coverage..."
	make test-coverage
	make test-frontend

pre-commit-check:
	@echo "Running pre-commit checks..."
	npm run pre-commit-check

lint:
	@echo "Linting code..."
	npm run lint

lint-fix:
	@echo "Linting and fixing code..."
	npm run lint-fix

prepare:
	@echo "Preparing git hooks..."
	npm run prepare

deploy:
	@echo "Deploying to AWS..."
	cd infra && npm run deploy

clean:
	@echo "Cleaning build artifacts..."
	rm -rf backend/dist
	rm -rf frontend/build
	rm -rf infra/cdk.out

check-deps:
	@echo "Checking dependencies..."
	./scripts/check-dependencies.sh

update-deps:
	@echo "Updating minor/patch dependencies..."
	cd backend && ncu --target minor -u && npm install
	cd frontend && ncu --target minor -u && npm install
	cd infra && ncu --target minor -u && npm install
	@echo "Running tests after updates..."
	make test

audit:
	@echo "Running security audit..."
	cd backend && npm audit
	cd frontend && npm audit 
	cd infra && npm audit