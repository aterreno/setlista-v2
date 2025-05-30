.PHONY: setup dev backend frontend test test-backend test-frontend test-e2e deploy

setup:
	@echo "Setting up project dependencies..."
	cd backend && npm install
	cd frontend && npm install
	cd infra && npm install

dev:
	@echo "Starting development environment..."
	docker-compose up

backend:
	@echo "Starting backend..."
	cd backend && npm run dev

frontend:
	@echo "Starting frontend..."
	cd frontend && npm run start

test:
	@echo "Running all tests..."
	make test-backend
	make test-frontend
	make test-e2e

test-backend:
	@echo "Running backend tests..."
	cd backend && npm test

test-frontend:
	@echo "Running frontend tests..."
	cd frontend && npm test

test-e2e:
	@echo "Running E2E tests..."
	cd tests && npm test

lint:
	@echo "Linting code..."
	cd backend && npm run lint
	cd frontend && npm run lint
	cd infra && npm run lint

deploy:
	@echo "Deploying to AWS..."
	cd infra && npm run deploy

clean:
	@echo "Cleaning build artifacts..."
	rm -rf backend/dist
	rm -rf frontend/build
	rm -rf infra/cdk.out