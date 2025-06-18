# Dependency Management Guide

## Overview

This document outlines our approach to dependency management in the Setlista project. Following our strict quality requirements, we maintain separate package management for each project folder (frontend, backend, infrastructure) while ensuring consistency across environments.

## Structure

The project is organized as follows:

- `/frontend`: Next.js React application
- `/backend`: Node.js Express API
- `/infra`: AWS CDK infrastructure
- Root: Project configuration and shared scripts

Each folder has its own `package.json` and `package-lock.json` files, allowing for isolated dependency management.

## Requirements

- Node.js: v22.0.0 or higher
- npm: v10.8.0 or higher
- Enforced through `.npmrc` engine-strict setting

## Best Practices

1. **Lock Files**: Always commit `package-lock.json` files for reproducible builds
2. **Dependency Installation**: Use `npm ci` in CI/CD pipelines for consistent installations
3. **Versioning**: Use exact versions (`save-exact=true` in `.npmrc`) to prevent unexpected updates
4. **Updates**: Coordinate updates across folders to prevent compatibility issues
5. **Pre-commit Validation**: Dependencies are automatically validated before commits

## Common Commands

```bash
# Install dependencies in a specific folder
cd [folder] && npm ci

# Update dependencies (with caution)
cd [folder] && npm update

# Check for outdated dependencies
cd [folder] && npm outdated

# Verify dependency integrity
cd [folder] && npm ls --depth=0
```

## CI/CD Pipeline

Our GitHub Actions workflows are configured to:

1. Set up Node.js v22
2. Run `npm ci` in each folder independently
3. Cache dependencies based on corresponding `package-lock.json`
4. Run tests and build processes with the installed dependencies

## Troubleshooting Common Issues

### Missing or Out-of-Sync Lock Files

If you encounter npm warnings about missing lock files or packages:

```bash
# Generate or update package-lock.json
npm install
```

### Peer Dependency Conflicts

If you see peer dependency warnings:

1. Check version compatibility
2. Install compatible versions of the conflicting packages
3. If needed, update the parent package

### CI Pipeline Failures

If the CI pipeline fails with dependency errors:

1. Verify local `npm ci` works in each folder
2. Ensure all `package-lock.json` files are committed
3. Check for Node.js version mismatches
4. Verify no merge conflicts exist in lock files

## Security Considerations

1. Run `npm audit` regularly to check for vulnerabilities
2. Use `npm audit fix` with caution, test thoroughly after fixes
3. Keep dependencies updated to secure versions
4. Avoid installing packages with known security issues

## Dependency Review Process

Before adding new dependencies:

1. Evaluate necessity and maintenance status
2. Check compatibility with existing packages
3. Review security implications
4. Consider bundle size impact (especially for frontend)
5. Test thoroughly in all environments

By following these guidelines, we maintain a stable, secure, and consistent dependency management approach across our project.
