#!/bin/bash
# Bermuda Rocket Tracker - Production Rollback Script

set -e

echo "🔄 Bermuda Rocket Tracker - Emergency Rollback"
echo "=============================================="

# Check if deployment URL is provided
if [ -z "$1" ]; then
    echo "❌ Usage: ./rollback.sh [deployment-url-or-commit-hash]"
    echo "Examples:"
    echo "  ./rollback.sh dpl_abc123xyz"
    echo "  ./rollback.sh abc123f"
    exit 1
fi

TARGET=$1

echo "🔍 Validating rollback target: $TARGET"

# Check if it's a Vercel deployment URL
if [[ $TARGET == dpl_* ]]; then
    echo "📦 Rolling back to Vercel deployment: $TARGET"
    
    # Promote previous deployment
    vercel promote $TARGET --token $VERCEL_TOKEN
    
    if [ $? -eq 0 ]; then
        echo "✅ Rollback to deployment $TARGET completed"
        echo "🌐 Production URL: https://bermuda-rocket-tracker.vercel.app"
    else
        echo "❌ Rollback failed. Check Vercel token and deployment ID"
        exit 1
    fi

# Check if it's a git commit hash
elif [[ $TARGET =~ ^[a-f0-9]{7,40}$ ]]; then
    echo "📝 Rolling back to git commit: $TARGET"
    
    # Verify commit exists
    if ! git rev-parse --verify $TARGET >/dev/null 2>&1; then
        echo "❌ Commit $TARGET not found in repository"
        exit 1
    fi
    
    # Create rollback branch
    ROLLBACK_BRANCH="rollback-$(date +%Y%m%d-%H%M%S)"
    git checkout -b $ROLLBACK_BRANCH $TARGET
    
    # Deploy from rollback commit
    echo "🚀 Deploying rollback..."
    npm ci
    npm run build
    vercel --prod --token $VERCEL_TOKEN
    
    if [ $? -eq 0 ]; then
        echo "✅ Rollback to commit $TARGET completed"
        echo "🔗 Rollback branch: $ROLLBACK_BRANCH"
    else
        echo "❌ Rollback deployment failed"
        git checkout main
        git branch -D $ROLLBACK_BRANCH
        exit 1
    fi

else
    echo "❌ Invalid rollback target. Use Vercel deployment ID (dpl_*) or git commit hash"
    exit 1
fi

echo ""
echo "🔍 Post-rollback validation..."
sleep 10

# Validate rollback
response=$(curl -s -w "%{http_code}" https://bermuda-rocket-tracker.vercel.app)
http_code="${response: -3}"

if [ "$http_code" == "200" ]; then
    echo "✅ Rollback validation successful"
    echo "🎯 Application is responding normally"
else
    echo "❌ Rollback validation failed (HTTP $http_code)"
    echo "🚨 Manual intervention required"
    exit 1
fi

echo ""
echo "📋 Rollback Summary:"
echo "  - Target: $TARGET"
echo "  - Status: SUCCESS"
echo "  - Timestamp: $(date)"
echo "  - URL: https://bermuda-rocket-tracker.vercel.app"
echo ""
echo "📢 Next steps:"
echo "  1. Monitor application for 15-30 minutes"
echo "  2. Check error logs and user reports"
echo "  3. Investigate root cause of original issue"
echo "  4. Plan proper fix and re-deployment"