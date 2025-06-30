#!/usr/bin/env python3
"""
API Integration Module for E-commerce QA Monitoring
Handles all API communications with Freshop and Eddress systems
"""

import requests
import json
import time
import re
import logging
from urllib.parse import urlparse, quote, unquote
from datetime import datetime
from typing import Dict, List, Optional, Tuple
import concurrent.futures
from api_config import (
    FRESHOP_CONFIG, EDDRESS_CONFIG, URL_STORE_MAPPING, 
    DISCOVERY_PATTERNS, DISCOVERY_URLS, RESPONSE_PARSING,
    ERROR_CONFIG, REQUEST_HEADERS, get_store_config, 
    get_api_type, is_store_active
)

class APIRateLimiter:
    """Rate limiter for API requests"""
    def __init__(self, requests_per_second=10):
        self.requests_per_second = requests_per_second
        self.last_request_time = 0
        self.request_interval = 1.0 / requests_per_second
    
    def wait_if_needed(self):
        """Wait if necessary to respect rate limits"""
        current_time = time.time()
        time_since_last = current_time - self.last_request_time
        
        if time_since_last < self.request_interval:
            wait_time = self.request_interval - time_since_last
            time.sleep(wait_time)
        
        self.last_request_time = time.time()

class FreshopAPI:
    """Freshop API integration for MP, HH, Miles, Drop It"""
    
    def __init__(self):
        self.logger = logging.getLogger(__name__)
        self.rate_limiter = APIRateLimiter(FRESHOP_CONFIG['rate_limit']['requests_per_second'])
        self.session = requests.Session()
        self.session.headers.update(REQUEST_HEADERS['freshop'])
    
    def discover_credentials(self, store_code: str) -> Dict:
        """Discover missing store_id and token for a store"""
        self.logger.info(f"Discovering credentials for {store_code}")
        
        discovered = {'store_id': None, 'token': None}
        
        urls_to_check = DISCOVERY_URLS.get(store_code, [])
        
        for url in urls_to_check:
            try:
                self.rate_limiter.wait_if_needed()
                response = self.session.get(url, timeout=ERROR_CONFIG['timeout'])
                
                if response.status_code == 200:
                    content = response.text
                    
                    # Look for store_id
                    for pattern in DISCOVERY_PATTERNS['freshop']['store_id_patterns']:
                        matches = re.findall(pattern, content, re.IGNORECASE)
                        if matches:
                            discovered['store_id'] = matches[0]
                            self.logger.info(f"Found store_id for {store_code}: {discovered['store_id']}")
                            break
                    
                    # Look for token
                    for pattern in DISCOVERY_PATTERNS['freshop']['token_patterns']:
                        matches = re.findall(pattern, content, re.IGNORECASE)
                        if matches:
                            discovered['token'] = matches[0]
                            self.logger.info(f"Found token for {store_code}: {discovered['token'][:8]}...")
                            break
                    
                    # If we found both, we're done
                    if discovered['store_id'] and discovered['token']:
                        break
                        
            except Exception as e:
                self.logger.debug(f"Error checking {url}: {e}")
                continue
        
        return discovered
    
    def _extract_product_id_from_url(self, url: str) -> Optional[str]:
        """Extract Freshop product ID from URL"""
        # Example: https://www.marketplace.bm/shop/produce/tropical/yellow_bananas/p/12413
        # Should extract: 12413
        try:
            # This is a common pattern for Freshop product URLs
            match = re.search(r'/p/(\d+)$', url)
            if match:
                return match.group(1)
            # Fallback for other potential Freshop URL structures
            parsed = urlparse(url)
            path_parts = parsed.path.strip('/').split('/')
            if path_parts and path_parts[-1].isdigit():
                return path_parts[-1]
        except Exception as e:
            self.logger.error(f"Error extracting product ID from {url}: {e}")
        return None

    def get_product_data(self, url: str, store_code: str) -> Dict:
        """Get product data from Freshop API using product ID"""
        store_config = FRESHOP_CONFIG['stores'][store_code]
        
        if not store_config.get('active'):
            return {'error': f'Store {store_code} not configured', 'url': url}
        
        product_id = self._extract_product_id_from_url(url)
        if not product_id:
            return {'error': 'Could not extract product ID from URL', 'url': url}
        
        api_url = f"{FRESHOP_CONFIG['base_url']}/products/{product_id}"
        
        params = {
            'app_key': store_config['app_key'],
            'token': store_config['token'],
            'store_id': store_config['store_id'], # Add store_id to params
            'fields': 'id,name,price,sale_price,unit_price,in_stock,available' # Request specific fields
        }
        
        try:
            self.rate_limiter.wait_if_needed()
            response = self.session.get(api_url, params=params, timeout=ERROR_CONFIG['timeout'])
            
            if response.status_code == 200:
                data = response.json()
                return self.parse_freshop_response(data, url)
            else:
                self.logger.warning(f"Freshop API error {response.status_code} for {url}")
                return {'error': f'HTTP {response.status_code}', 'url': url}
                
        except requests.exceptions.RequestException as e:
            self.logger.error(f"Request error for {url}: {e}")
            return {'error': str(e), 'url': url}
        except json.JSONDecodeError as e:
            self.logger.error(f"JSON decode error for {url}: {e}")
            return {'error': 'Invalid JSON response', 'url': url}
    
    def parse_freshop_response(self, data: Dict, url: str) -> Dict:
        """Parse Freshop API response and extract product information"""
        result = {
            'url': url,
            'api_type': 'freshop',
            'status': 'success',
            'price_found': None,
            'product_name': None,
            'availability': None,
            'raw_data': data,
            'scraped_at': datetime.now().isoformat()
        }
        
        try:
            # Prioritize unit_price, then price, then sale_price
            for field in ['unit_price', 'price', 'sale_price']:
                price = self.extract_nested_field(data, field)
                if price is not None:
                    try:
                        if isinstance(price, str):
                            price = re.sub(r'[^\d.]', '', price)
                        result['price_found'] = float(price)
                        break
                    except (ValueError, TypeError):
                        continue
            
            # Look for product name
            name_fields = RESPONSE_PARSING['freshop']['product_fields']
            for field in name_fields:
                name = self.extract_nested_field(data, field)
                if name:
                    result['product_name'] = str(name)
                    break
            
            # Look for availability
            availability_fields = RESPONSE_PARSING['freshop']['availability_fields']
            for field in availability_fields:
                availability = self.extract_nested_field(data, field)
                if availability is not None:
                    result['availability'] = bool(availability)
                    break
            
            # If we couldn't find a price, mark as no price found
            if result['price_found'] is None:
                result['status'] = 'no_price_found'
            
        except Exception as e:
            self.logger.error(f"Error parsing Freshop response: {e}")
            result['status'] = 'parse_error'
            result['error'] = str(e)
        
        return result
    
    def extract_nested_field(self, data: Dict, field_path: str):
        """Extract field from nested dictionary structure"""
        if not isinstance(data, dict):
            return None
        
        # Handle direct field access
        if field_path in data:
            return data[field_path]
        
        # Handle nested field access (e.g., 'product.price')
        if '.' in field_path:
            parts = field_path.split('.')
            current = data
            for part in parts:
                if isinstance(current, dict) and part in current:
                    current = current[part]
                else:
                    return None
            return current
        
        # Search recursively through the data structure
        return self.recursive_field_search(data, field_path)
    
    def recursive_field_search(self, data, field_name):
        """Recursively search for a field in nested data structure"""
        if isinstance(data, dict):
            # Direct match
            if field_name in data:
                return data[field_name]
            
            # Search in nested objects
            for value in data.values():
                result = self.recursive_field_search(value, field_name)
                if result is not None:
                    return result
        
        elif isinstance(data, list):
            # Search in list items
            for item in data:
                result = self.recursive_field_search(item, field_name)
                if result is not None:
                    return result
        
        return None

class EddressAPI:
    """Eddress API integration for Pronto"""
    
    def __init__(self):
        self.logger = logging.getLogger(__name__)
        self.rate_limiter = APIRateLimiter(EDDRESS_CONFIG['rate_limit']['requests_per_second'])
        self.session = requests.Session()
        self.session.headers.update(REQUEST_HEADERS['eddress'])
    
    def extract_product_slug(self, url: str) -> Optional[str]:
        """Extract product slug from Pronto URL"""
        # Example: https://pronto.bm/product/bananas-imported-1lb
        # Should extract: bananas-imported-1lb
        
        try:
            parsed = urlparse(url)
            path_parts = parsed.path.strip('/').split('/')
            
            if 'product' in path_parts:
                product_index = path_parts.index('product')
                if product_index + 1 < len(path_parts):
                    return path_parts[product_index + 1]
            
            # If no 'product' in path, try last part
            if path_parts:
                return path_parts[-1]
                
        except Exception as e:
            self.logger.error(f"Error extracting product slug from {url}: {e}")
        
        return None
    
    def get_product_data(self, url: str) -> Dict:
        """Get product data from Eddress API using URL"""
        product_slug = self.extract_product_slug(url)
        
        if not product_slug:
            return {'error': 'Could not extract product slug from URL', 'url': url}
        
        # Build API URL
        store_id = EDDRESS_CONFIG['store']['store_id']
        api_url = f"{EDDRESS_CONFIG['base_url']}/market/app/store/{store_id}/product/{product_slug}"
        
        try:
            self.rate_limiter.wait_if_needed()
            response = self.session.get(api_url, timeout=ERROR_CONFIG['timeout'])
            
            if response.status_code == 200:
                data = response.json()
                return self.parse_eddress_response(data, url)
            else:
                self.logger.warning(f"Eddress API error {response.status_code} for {url}")
                return {'error': f'HTTP {response.status_code}', 'url': url}
                
        except requests.exceptions.RequestException as e:
            self.logger.error(f"Request error for {url}: {e}")
            return {'error': str(e), 'url': url}
        except json.JSONDecodeError as e:
            self.logger.error(f"JSON decode error for {url}: {e}")
            return {'error': 'Invalid JSON response', 'url': url}
    
    def parse_eddress_response(self, data: Dict, url: str) -> Dict:
        """Parse Eddress API response and extract product information"""
        result = {
            'url': url,
            'api_type': 'eddress',
            'status': 'success',
            'price_found': None,
            'product_name': None,
            'availability': None,
            'raw_data': data,
            'scraped_at': datetime.now().isoformat()
        }
        
        try:
            # Look for price in various fields
            price_fields = RESPONSE_PARSING['eddress']['price_fields']
            
            for field in price_fields:
                price = self.extract_nested_field(data, field)
                if price is not None:
                    try:
                        # Clean and convert price
                        if isinstance(price, str):
                            price = re.sub(r'[^\d.]', '', price)
                        result['price_found'] = float(price)
                        break
                    except (ValueError, TypeError):
                        continue
            
            # Look for product name
            name_fields = RESPONSE_PARSING['eddress']['product_fields']
            for field in name_fields:
                name = self.extract_nested_field(data, field)
                if name:
                    result['product_name'] = str(name)
                    break
            
            # Look for availability
            availability_fields = RESPONSE_PARSING['eddress']['availability_fields']
            for field in availability_fields:
                availability = self.extract_nested_field(data, field)
                if availability is not None:
                    result['availability'] = bool(availability)
                    break
            
            # If we couldn't find a price, mark as no price found
            if result['price_found'] is None:
                result['status'] = 'no_price_found'
            
        except Exception as e:
            self.logger.error(f"Error parsing Eddress response: {e}")
            result['status'] = 'parse_error'
            result['error'] = str(e)
        
        return result
    
    def extract_nested_field(self, data: Dict, field_path: str):
        """Extract field from nested dictionary structure"""
        if not isinstance(data, dict):
            return None
        
        # Handle direct field access
        if field_path in data:
            return data[field_path]
        
        # Handle nested field access (e.g., 'product.price')
        if '.' in field_path:
            parts = field_path.split('.')
            current = data
            for part in parts:
                if isinstance(current, dict) and part in current:
                    current = current[part]
                else:
                    return None
            return current
        
        # Search recursively through the data structure
        return self.recursive_field_search(data, field_path)
    
    def recursive_field_search(self, data, field_name):
        """Recursively search for a field in nested data structure"""
        if isinstance(data, dict):
            # Direct match
            if field_name in data:
                return data[field_name]
            
            # Search in nested objects
            for value in data.values():
                result = self.recursive_field_search(value, field_name)
                if result is not None:
                    return result
        
        elif isinstance(data, list):
            # Search in list items
            for item in data:
                result = self.recursive_field_search(item, field_name)
                if result is not None:
                    return result
        
        return None

class APIManager:
    """Main API manager that coordinates all API integrations"""
    
    def __init__(self):
        self.logger = logging.getLogger(__name__)
        self.freshop_api = FreshopAPI()
        self.eddress_api = EddressAPI()
        self.discovered_credentials = {}
    
    def identify_store_from_url(self, url: str) -> Optional[str]:
        """Identify which store a URL belongs to"""
        try:
            parsed = urlparse(url)
            domain = parsed.netloc.lower()
            
            for domain_pattern, store_code in URL_STORE_MAPPING.items():
                if domain_pattern in domain:
                    return store_code
            
            return None
            
        except Exception as e:
            self.logger.error(f"Error identifying store from URL {url}: {e}")
            return None
    
    def discover_missing_credentials(self):
        """Discover missing credentials for Freshop stores"""
        stores_to_discover = ['hh', 'miles', 'dropit']
        
        for store_code in stores_to_discover:
            if not is_store_active(store_code):
                self.logger.info(f"Discovering credentials for {store_code}")
                credentials = self.freshop_api.discover_credentials(store_code)
                
                if credentials['store_id'] and credentials['token']:
                    # Update the configuration
                    FRESHOP_CONFIG['stores'][store_code]['store_id'] = credentials['store_id']
                    FRESHOP_CONFIG['stores'][store_code]['token'] = credentials['token']
                    FRESHOP_CONFIG['stores'][store_code]['active'] = True
                    
                    self.discovered_credentials[store_code] = credentials
                    self.logger.info(f"Successfully configured {store_code}")
                else:
                    self.logger.warning(f"Could not discover complete credentials for {store_code}")
    
    def get_product_data(self, url: str, site_type: str) -> Dict:
        """Get product data from appropriate API based on URL"""
        store_code = self.identify_store_from_url(url)
        
        if not store_code:
            return {'error': 'Could not identify store from URL', 'url': url}
        
        if not is_store_active(store_code):
            return {'error': f'Store {store_code} API not configured', 'url': url, 'store_code': store_code}
        
        try:
            if store_code == 'pronto':
                return self.eddress_api.get_product_data(url)
            else:
                # Call the new get_product_data method for FreshopAPI
                return self.freshop_api.get_product_data(url, site_type)
                
        except Exception as e:
            self.logger.error(f"Error getting product data for {url}: {e}")
            return {'error': str(e), 'url': url, 'store_code': store_code}
    
    def get_multiple_products(self, urls: List[str], max_workers: int = 5) -> List[Dict]:
        """Get product data for multiple URLs concurrently"""
        results = []
        
        with concurrent.futures.ThreadPoolExecutor(max_workers=max_workers) as executor:
            # Submit all requests
            future_to_url = {executor.submit(self.get_product_data, url, self.identify_store_from_url(url)): url for url in urls}
            
            # Collect results as they complete
            for future in concurrent.futures.as_completed(future_to_url):
                url = future_to_url[future]
                try:
                    result = future.result()
                    results.append(result)
                except Exception as e:
                    self.logger.error(f"Error processing {url}: {e}")
                    results.append({'error': str(e), 'url': url})
        
        return results
    
    def test_api_connections(self) -> Dict:
        """Test all API connections and return status"""
        test_results = {}
        
        # Test Pronto (Eddress)
        test_results['pronto'] = {
            'active': is_store_active('pronto'),
            'api_type': 'eddress'
        }
        
        # Test Freshop stores
        for store_code in ['mp', 'hh', 'miles', 'dropit']:
            test_results[store_code] = {
                'active': is_store_active(store_code),
                'api_type': 'freshop'
            }
            
            if is_store_active(store_code):
                store_config = FRESHOP_CONFIG['stores'][store_code]
                test_results[store_code]['app_key'] = store_config['app_key']
                test_results[store_code]['has_credentials'] = bool(
                    store_config.get('store_id') and store_config.get('token')
                )
        
        return test_results
    
    def get_store_config(self, store_code):
        """Get store configuration"""
        return get_store_config(store_code)
