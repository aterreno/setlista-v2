# Setlista Project Development Rules

## 🎯 Core Principles

### 📊 Test Coverage
- **100% test coverage** required for all new code
- **Run tests after every change** - no exceptions
- Tests must cover happy path, edge cases, and error scenarios
- Use meaningful test descriptions and assertions
- Mock external dependencies properly

### 🏗️ SOLID Principles
- **Single Responsibility**: Each class/function has one reason to change
- **Open/Closed**: Open for extension, closed for modification
- **Liskov Substitution**: Derived classes must be substitutable for base classes
- **Interface Segregation**: Many client-specific interfaces better than one general-purpose interface
- **Dependency Inversion**: Depend on abstractions, not concretions

### 🔧 Code Quality
- **Run linter after every edit** - code must pass ESLint
- **No hardcoded values** - use constants, config files, or environment variables
- **Don't write comments** - instead write code that is easy to reason about and read
- **TypeScript strict mode** - all code must be properly typed
- **Consistent naming conventions** - camelCase for variables/functions, PascalCase for classes
- **Meaningful variable/function names** - self-documenting code

### 🏛️ Software Engineering Best Practices
- **DRY (Don't Repeat Yourself)** - extract common functionality
- **KISS (Keep It Simple, Stupid)** - prefer simple solutions
- **YAGNI (You Aren't Gonna Need It)** - don't over-engineer
- **Separation of Concerns** - clear boundaries between layers
- **Error Handling** - proper try/catch blocks and meaningful error messages
- **Logging** - comprehensive logging for debugging and monitoring

## 🌍 Multi-Environment Support

### 📦 Deployment Targets
- **Local Development** - npm scripts must work seamlessly
- **Docker** - containerized development and production
- **Cloud (AWS)** - Lambda functions and CDK infrastructure
- **CI/CD** - GitHub Actions for automated testing and deployment

### 💰 Cost Efficiency
- **Optimize for Claude usage** - minimize API calls and context
- **Efficient code** - avoid unnecessary computations
- **Proper caching** - cache API responses where appropriate
- **Resource optimization** - minimize memory and CPU usage

## 🔒 DevSecOps & Security

### 🛡️ Security Requirements
- **No secrets in code** - use environment variables and secret management
- **Input validation** - sanitize all user inputs
- **Authentication & Authorization** - proper OAuth flows
- **HTTPS only** - secure communications
- **Dependency scanning** - regular security audits of npm packages
- **Principle of least privilege** - minimal required permissions

### 🔄 DevSecOps Pipeline
- **Automated testing** - all tests run in CI/CD
- **Security scanning** - SAST/DAST in pipeline
- **Code quality gates** - lint, test coverage, security checks
- **Infrastructure as Code** - CDK for reproducible deployments
- **Monitoring & Alerting** - observability in production

## 📝 Development Workflow

### ✅ Before Every Commit
1. **Run linter**: `npm run lint` (must pass)
2. **Run tests**: `npm test` (must pass with 100% coverage)
3. **Check TypeScript**: `npx tsc --noEmit` (must compile)
4. **Test all environments**: npm, Docker, production build

### 🏗️ Architecture Requirements
- **Layered architecture**: Controllers → Services → Repositories
- **Dependency injection** - services injected into controllers
- **Interface-based design** - depend on interfaces, not implementations
- **Configuration management** - centralized config with environment overrides
- **Error boundaries** - proper error handling at each layer

## 📚 Documentation Standards
- **Self-documenting code** - clear function/variable names
- **README files** - setup and usage instructions
- **API documentation** - OpenAPI/Swagger specs
- **Architecture decisions** - ADR (Architecture Decision Records)
- **Inline comments** - only for complex business logic, not obvious code

## 🚨 Non-Negotiables

### ❌ Never Allow
- Hardcoded values (magic numbers, URLs, secrets)
- Skipping tests for "quick fixes"
- Committing with linting errors
- Deploying without 100% test coverage
- Pushing secrets or sensitive data
- Breaking changes without proper versioning

### ✅ Always Require
- Type safety (strict TypeScript)
- Error handling for all async operations
- Proper logging for debugging
- Input validation for all endpoints
- Security headers and HTTPS
- Performance monitoring

## 🎭 Code Review Checklist
- [ ] Tests written and passing (100% coverage)
- [ ] Linting passes without errors
- [ ] No hardcoded values
- [ ] SOLID principles followed
- [ ] Security considerations addressed
- [ ] Performance implications considered
- [ ] Documentation updated if needed
- [ ] All environments tested (npm, Docker, cloud)

---

**Remember: Quality over speed. It's better to do it right the first time than to rush and create technical debt.**