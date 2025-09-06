#!/bin/bash

echo "=== Network Diagnosis ==="
echo

echo "1. Checking if servers can bind to ports:"
nc -l 127.0.0.1 9999 &
PID1=$!
sleep 1
if ps -p $PID1 > /dev/null; then
    echo "✓ Can bind to 127.0.0.1:9999"
    kill $PID1 2>/dev/null
else
    echo "✗ Cannot bind to 127.0.0.1:9999"
fi

echo
echo "2. Checking firewall status:"
sudo pfctl -s info 2>/dev/null | grep "Status" || echo "Unable to check firewall (needs sudo)"

echo
echo "3. Active network connections:"
netstat -an | grep LISTEN | grep -E "8080|3000|3001" | head -5

echo
echo "4. Testing local connectivity:"
curl -s -o /dev/null -w "127.0.0.1:8080 - %{http_code}\n" http://127.0.0.1:8080 || echo "127.0.0.1:8080 - Failed"
curl -s -o /dev/null -w "172.20.10.2:8080 - %{http_code}\n" http://172.20.10.2:8080 || echo "172.20.10.2:8080 - Failed"

echo
echo "5. Checking for proxy settings:"
echo "HTTP_PROXY: ${HTTP_PROXY:-Not set}"
echo "HTTPS_PROXY: ${HTTPS_PROXY:-Not set}"
echo "NO_PROXY: ${NO_PROXY:-Not set}"

echo
echo "6. macOS application firewall:"
/usr/libexec/ApplicationFirewall/socketfilterfw --getglobalstate 2>/dev/null || echo "Unable to check (needs different permissions)"

echo
echo "7. Process listening on port 8080:"
lsof -i :8080 2>/dev/null | grep LISTEN || echo "No process found on port 8080"