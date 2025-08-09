#!/bin/bash
# Bermuda Rocket Tracker - Production Monitoring Script

set -e

echo "📊 Bermuda Rocket Tracker - Production Monitor"
echo "=============================================="

# Configuration
PROD_URL="https://bermuda-rocket-tracker.vercel.app"
API_URL="https://ll.thespacedevs.com/2.2.0/launch/upcoming/"
ALERT_THRESHOLD_MS=5000
BUNDLE_SIZE_LIMIT_KB=200

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo_status() {
    local status=$1
    local message=$2
    case $status in
        "success") echo -e "${GREEN}✅ $message${NC}" ;;
        "warning") echo -e "${YELLOW}⚠️  $message${NC}" ;;
        "error") echo -e "${RED}❌ $message${NC}" ;;
        *) echo "$message" ;;
    esac
}

# Application Health Check
echo "🔍 Checking application health..."
app_start_time=$(date +%s%3N)
app_response=$(curl -s -w "%{http_code}|%{time_total}" "$PROD_URL" || echo "000|0")
app_end_time=$(date +%s%3N)

http_code=$(echo "$app_response" | cut -d'|' -f1 | tail -c 4)
response_time=$(echo "$app_response" | cut -d'|' -f2)
response_time_ms=$(echo "$response_time * 1000" | bc -l | cut -d'.' -f1)

if [ "$http_code" == "200" ]; then
    echo_status "success" "Application responding (HTTP $http_code)"
    
    if [ "$response_time_ms" -lt "$ALERT_THRESHOLD_MS" ]; then
        echo_status "success" "Response time: ${response_time_ms}ms"
    else
        echo_status "warning" "Slow response time: ${response_time_ms}ms"
    fi
else
    echo_status "error" "Application down (HTTP $http_code)"
    exit 1
fi

# Content Validation
echo ""
echo "📄 Validating application content..."
if echo "$app_response" | grep -q "Bermuda Rocket Tracker"; then
    echo_status "success" "Application title found"
else
    echo_status "warning" "Application title missing - possible loading issue"
fi

# API Dependency Check  
echo ""
echo "🔌 Checking upstream API..."
api_response=$(curl -s -w "%{http_code}" "$API_URL?limit=1" || echo "000")
api_code="${api_response: -3}"

if [ "$api_code" == "200" ]; then
    echo_status "success" "Space Devs API accessible"
    
    # Count launches in response
    launch_count=$(echo "$api_response" | grep -o '"count":[0-9]*' | cut -d':' -f2 || echo "0")
    echo_status "success" "API returning $launch_count total launches"
else
    echo_status "error" "Space Devs API issue (HTTP $api_code)"
fi

# Bundle Size Check
echo ""
echo "📦 Checking bundle size..."
bundle_url=$(curl -s "$PROD_URL" | grep -o 'static/js/main\.[a-f0-9]*\.js' | head -1)

if [ ! -z "$bundle_url" ]; then
    bundle_size=$(curl -s --head "$PROD_URL/$bundle_url" | grep -i content-length | cut -d' ' -f2 | tr -d '\r\n')
    bundle_kb=$((bundle_size / 1024))
    
    if [ "$bundle_kb" -lt "$BUNDLE_SIZE_LIMIT_KB" ]; then
        echo_status "success" "Bundle size: ${bundle_kb}KB"
    else
        echo_status "warning" "Large bundle size: ${bundle_kb}KB (limit: ${BUNDLE_SIZE_LIMIT_KB}KB)"
    fi
else
    echo_status "warning" "Could not detect bundle URL"
fi

# Certificate Check
echo ""
echo "🔒 Checking SSL certificate..."
cert_end_date=$(echo | openssl s_client -servername bermuda-rocket-tracker.vercel.app -connect bermuda-rocket-tracker.vercel.app:443 2>/dev/null | openssl x509 -noout -enddate | cut -d'=' -f2)

if [ ! -z "$cert_end_date" ]; then
    cert_end_epoch=$(date -d "$cert_end_date" +%s 2>/dev/null || date -j -f "%b %d %H:%M:%S %Y %Z" "$cert_end_date" +%s 2>/dev/null || echo "0")
    current_epoch=$(date +%s)
    days_until_expiry=$(( (cert_end_epoch - current_epoch) / 86400 ))
    
    if [ "$days_until_expiry" -gt 30 ]; then
        echo_status "success" "SSL certificate valid ($days_until_expiry days remaining)"
    elif [ "$days_until_expiry" -gt 7 ]; then
        echo_status "warning" "SSL certificate expires soon ($days_until_expiry days)"
    else
        echo_status "error" "SSL certificate expires very soon ($days_until_expiry days)"
    fi
else
    echo_status "warning" "Could not check SSL certificate"
fi

# Performance Metrics Summary
echo ""
echo "📈 Performance Summary:"
echo "  Response Time: ${response_time_ms}ms"
echo "  Bundle Size: ${bundle_kb}KB"
echo "  HTTP Status: $http_code"
echo "  API Status: $api_code"
echo "  SSL Days: $days_until_expiry"

# Generate alerts if needed
alert_count=0

if [ "$http_code" != "200" ]; then
    echo_status "error" "ALERT: Application not responding"
    alert_count=$((alert_count + 1))
fi

if [ "$response_time_ms" -gt "$ALERT_THRESHOLD_MS" ]; then
    echo_status "warning" "ALERT: Slow response time detected"
    alert_count=$((alert_count + 1))
fi

if [ "$bundle_kb" -gt "$BUNDLE_SIZE_LIMIT_KB" ]; then
    echo_status "warning" "ALERT: Bundle size exceeds limit"
    alert_count=$((alert_count + 1))
fi

if [ "$days_until_expiry" -lt 7 ] && [ "$days_until_expiry" -gt 0 ]; then
    echo_status "error" "ALERT: SSL certificate expiring soon"
    alert_count=$((alert_count + 1))
fi

echo ""
if [ "$alert_count" -eq 0 ]; then
    echo_status "success" "All systems operational"
    exit 0
else
    echo_status "warning" "$alert_count alerts detected"
    exit 1
fi