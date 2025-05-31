#!/bin/bash

# Dependency checking script for Setlista project
# This script helps check for outdated dependencies and security vulnerabilities

set -e

echo "🔍 Checking dependencies across all packages..."
echo "========================================"

# Function to check dependencies for a specific package
check_package() {
    local dir=$1
    local name=$2
    
    echo ""
    echo "📦 Checking $name ($dir)"
    echo "------------------------"
    
    cd "$dir"
    
    echo "🔒 Security audit:"
    npm audit --audit-level=moderate || true
    
    echo ""
    echo "📅 Outdated packages:"
    npm outdated || true
    
    echo ""
    echo "🆕 Minor/patch updates available:"
    ncu --target minor || true
    
    cd - > /dev/null
}

# Check root package
check_package "." "Root"

# Check backend
check_package "backend" "Backend"

# Check frontend  
check_package "frontend" "Frontend"

# Check infrastructure
check_package "infra" "Infrastructure"

echo ""
echo "✅ Dependency check complete!"
echo ""
echo "📋 Summary:"
echo "- Run 'npm audit fix' in any directory to fix security issues"
echo "- Run 'ncu -u && npm install' to update minor/patch versions"
echo "- Review major version updates manually before applying"
echo "- Dependabot will create PRs for dependency updates automatically"