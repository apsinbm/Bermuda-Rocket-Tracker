#!/usr/bin/env python3
"""
API Configuration for E-commerce QA Monitoring
Contains all API credentials and endpoints for the 5 stores
"""

# Freshop API Configuration (4 stores)
FRESHOP_CONFIG = {
    'base_url': 'https://api.freshop.ncrcloud.com/1',
    
    # Store configurations
    'stores': {
        'mp': {
            'name': 'The MarketPlace',
            'app_key': 'the_marketplace',
            'store_id': '2882',
            'token': '2ce398e00076e624c0760921a1ee127c',
            'active': True
        },
        'hh': {
            'name': 'Harrington Hundreds',
            'app_key': 'harrington_hundreds',
            'store_id': '6945',  # Discovered
            'token': 'b86e074fd78263bf756e72a9bee66741',     # Discovered
            'active': True
        },
        'miles': {
            'name': 'Miles Market',
            'app_key': 'miles_market',
            'store_id': '7267',  # Discovered
            'token': '7bea8f90bc4e2784d42554dcd73768b3',     # Discovered
            'active': True
        },
        'dropit': {
            'name': 'Drop It/Lindos',
            'app_key': 'lindos',
            'store_id': '7442',  # Discovered
            'token': '5ab4d2e24cd4a3689d71df0bf0226387',     # Discovered
            'active': True
        }
    },
    
    # API endpoints
    'endpoints': {
        'url_analyze': '/urls/analyze',
        'store_info': '/stores/{store_id}',
        'product_search': '/stores/{store_id}/products/search',
        'product_detail': '/stores/{store_id}/products/{product_id}'
    },
    
    # Rate limiting
    'rate_limit': {
        'requests_per_second': 10,
        'requests_per_minute': 300,
        'concurrent_requests': 5
    }
}

# Eddress API Configuration (1 store)
EDDRESS_CONFIG = {
    'base_url': 'https://prod-api.eddress.co/api',
    
    # Store configuration
    'store': {
        'name': 'Pronto',
        'store_id': '62bc5c3f5e1f9a0685630dbf',
        'tenant_id': 'WLxcLSplRaS7A9DKkDDHMQ',
        'active': True
    },
    
    # API endpoints
    'endpoints': {
        'product_detail': '/market/app/store/{store_id}/product/{product_slug}',
        'store_info': '/market/app/store/{store_id}',
        'product_search': '/market/app/store/{store_id}/products/search'
    },
    
    # Rate limiting
    'rate_limit': {
        'requests_per_second': 20,
        'requests_per_minute': 600,
        'concurrent_requests': 10
    }
}

# URL to Store mapping for automatic detection
URL_STORE_MAPPING = {
    'marketplace.bm': 'mp',
    'harringtonhundreds.bm': 'hh',
    'miles.bm': 'miles',
    'shop.miles.bm': 'miles',
    'dropit.bm': 'dropit',
    'pronto.bm': 'pronto'
}

# API Discovery patterns for missing credentials
DISCOVERY_PATTERNS = {
    'freshop': {
        'app_key_patterns': [
            r'app_key["\']?\s*[:=]\s*["\']([^"\']+)["\']',
            r'appKey["\']?\s*[:=]\s*["\']([^"\']+)["\']'
        ],
        'store_id_patterns': [
            r'store_id["\']?\s*[:=]\s*["\']?(\d+)["\']?',
            r'storeId["\']?\s*[:=]\s*["\']?(\d+)["\']?'
        ],
        'token_patterns': [
            r'token["\']?\s*[:=]\s*["\']([a-f0-9]{32})["\']',
            r'api_token["\']?\s*[:=]\s*["\']([a-f0-9]{32})["\']'
        ]
    }
}

# Fallback URLs for credential discovery
DISCOVERY_URLS = {
    'hh': [
        'https://www.harringtonhundreds.bm/',
        'https://www.harringtonhundreds.bm/shop/',
        'https://www.harringtonhundreds.bm/js/',
        'https://www.harringtonhundreds.bm/api/'
    ],
    'miles': [
        'https://shop.miles.bm/',
        'https://shop.miles.bm/shop/',
        'https://shop.miles.bm/js/',
        'https://shop.miles.bm/api/'
    ],
    'dropit': [
        'https://www.dropit.bm/',
        'https://www.dropit.bm/shop/',
        'https://www.dropit.bm/js/',
        'https://www.dropit.bm/api/'
    ]
}

# Response parsing configurations
RESPONSE_PARSING = {
    'freshop': {
        'price_fields': ['price', 'unit_price', 'regular_price', 'sale_price'],
        'availability_fields': ['in_stock', 'available', 'inventory_count'],
        'product_fields': ['name', 'title', 'description', 'brand']
    },
    'eddress': {
        'price_fields': ['price', 'unitPrice', 'regularPrice', 'salePrice'],
        'availability_fields': ['inStock', 'available', 'inventoryCount'],
        'product_fields': ['name', 'title', 'description', 'brand']
    }
}

# Error handling and retry configuration
ERROR_CONFIG = {
    'max_retries': 3,
    'retry_delay': 1,  # seconds
    'timeout': 30,     # seconds
    'retry_status_codes': [429, 500, 502, 503, 504],
    'skip_status_codes': [401, 403, 404]
}

# Request headers for API calls
REQUEST_HEADERS = {
    'freshop': {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache'
    },
    'eddress': {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache'
    }
}

def get_store_config(store_code):
    """Get configuration for a specific store"""
    if store_code == 'pronto':
        return EDDRESS_CONFIG
    else:
        return FRESHOP_CONFIG['stores'].get(store_code)

def get_api_type(store_code):
    """Get API type (freshop or eddress) for a store"""
    return 'eddress' if store_code == 'pronto' else 'freshop'

def is_store_active(store_code):
    """Check if a store's API is active and configured"""
    if store_code == 'pronto':
        return EDDRESS_CONFIG['store']['active']
    else:
        store_config = FRESHOP_CONFIG['stores'].get(store_code)
        return store_config and store_config.get('active', False)