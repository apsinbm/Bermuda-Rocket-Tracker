#!/usr/bin/env python3
import http.server
import socketserver
import socket

# Test if we can bind to localhost
def test_localhost():
    try:
        # Try binding to 127.0.0.1
        sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        sock.bind(('127.0.0.1', 0))
        port = sock.getsockname()[1]
        sock.close()
        print(f"✓ Successfully bound to 127.0.0.1:{port}")
        
        # Try binding to localhost
        sock2 = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        sock2.bind(('localhost', 0))
        port2 = sock2.getsockname()[1]
        sock2.close()
        print(f"✓ Successfully bound to localhost:{port2}")
        
        # Try binding to 0.0.0.0
        sock3 = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        sock3.bind(('0.0.0.0', 0))
        port3 = sock3.getsockname()[1]
        sock3.close()
        print(f"✓ Successfully bound to 0.0.0.0:{port3}")
        
    except Exception as e:
        print(f"✗ Error: {e}")

if __name__ == "__main__":
    test_localhost()