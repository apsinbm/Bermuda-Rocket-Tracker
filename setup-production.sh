#!/bin/bash

# Bermuda Rocket Tracker - Production Setup Script
# This script helps set up the production deployment environment

set -e

echo "🚀 Bermuda Rocket Tracker - Production Setup"
echo "==========================================="
echo

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}[✓]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[!]${NC} $1"
}

print_error() {
    echo -e "${RED}[✗]${NC} $1"
}

print_info() {
    echo -e "${BLUE}[i]${NC} $1"
}

# Check if we're in the right directory
if [[ ! -f "package.json" ]] || [[ ! -f "vercel.json" ]]; then
    print_error "Please run this script from the bermuda-rocket-tracker root directory"
    exit 1
fi

print_status "Found project files"

# Check Node.js version
NODE_VERSION=$(node -v)
print_info "Node.js version: $NODE_VERSION"

if [[ ! "$NODE_VERSION" =~ ^v1[8-9]\.|^v2[0-9]\. ]]; then
    print_warning "Recommended Node.js version is 18 or higher"
fi

# Check npm version
NPM_VERSION=$(npm -v)
print_info "npm version: $NPM_VERSION"

echo
print_info "Step 1: Installing dependencies..."
npm ci
print_status "Dependencies installed"

echo
print_info "Step 2: Running quality checks..."

# Type checking
print_info "Running TypeScript checks..."
npm run type-check
print_status "TypeScript checks passed"

# Linting
print_info "Running ESLint..."
npm run lint
print_status "Linting passed"

# Tests
print_info "Running tests..."
npm run test:ci
print_status "Tests completed"

# Build verification
print_info "Building for production..."
npm run build:production
print_status "Production build successful"

echo
print_info "Step 3: Security audit..."
npm audit --audit-level=moderate
print_status "Security audit completed"

echo
print_info "Step 4: Bundle analysis..."
du -sh build/static/js/*.js | head -5
print_status "Bundle analysis completed"

echo
echo "================================================"
print_status "Production setup completed successfully!"
echo "================================================"
echo

print_info "Next Steps:"
echo "1. Set up GitHub Secrets:"
echo "   - VERCEL_TOKEN"
echo "   - VERCEL_ORG_ID"
echo "   - VERCEL_PROJECT_ID"
echo "   - REACT_APP_OPENWEATHER_API_KEY"
echo
echo "2. Create Vercel project:"
echo "   - Go to https://vercel.com/dashboard"
echo "   - Import from GitHub"
echo "   - Configure environment variables"
echo
echo "3. Deploy:"
echo "   - Push to main branch"
echo "   - Monitor GitHub Actions"
echo "   - Verify production deployment"
echo

print_info "Documentation available:"
echo "   - PRODUCTION_DEPLOYMENT_STRATEGY.md"
echo "   - DISASTER_RECOVERY_PLAN.md"
echo "   - DEPLOYMENT_GUIDE.md"
echo

print_warning "Remember to:"
echo "   ✓ Test staging environment before production"
echo "   ✓ Set up monitoring and alerts"
echo "   ✓ Review security headers"
echo "   ✓ Configure custom domain (optional)"
echo

print_status "Ready for production deployment! 🚀"