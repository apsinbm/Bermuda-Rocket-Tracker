#!/usr/bin/env python3
"""
AI-Powered Grocery Price Scraper
Uses Gemini 2.5 Flash for intelligent data extraction (similar to director.ai approach)
"""

import time
import json
import logging
from datetime import datetime
from typing import Dict, List, Optional, Any
import pandas as pd
from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.chrome.service import Service
from webdriver_manager.chrome import ChromeDriverManager
import undetected_chromedriver as uc
import google.generativeai as genai
from PIL import Image
import io
import base64
import os
from dataclasses import dataclass


@dataclass
class ProductData:
    """Structure for extracted product data"""
    name: Optional[str] = None
    sku: Optional[str] = None
    price: Optional[str] = None
    success: bool = False
    error: Optional[str] = None


class AIGroceryScraper:
    """AI-powered grocery price scraper using Gemini 2.5 Flash"""
    
    def __init__(self, google_api_key: str):
        self.google_api_key = google_api_key
        self.results = []
        
        # Configure logging
        logging.basicConfig(
            level=logging.INFO,
            format='%(asctime)s - %(levelname)s - %(message)s',
            handlers=[
                logging.FileHandler('ai_scraper.log'),
                logging.StreamHandler()
            ]
        )
        self.logger = logging.getLogger(__name__)
        
        # Initialize Gemini
        self.setup_gemini()
        
        # Stats tracking
        self.stats = {
            'total_processed': 0,
            'successful_extractions': 0,
            'failed_extractions': 0,
            'api_calls': 0,
            'retry_attempts': 0,
            'retry_successes': 0
        }
    
    def setup_gemini(self):
        """Initialize Gemini AI client"""
        try:
            genai.configure(api_key=self.google_api_key)
            self.model = genai.GenerativeModel('gemini-2.5-flash')
            self.logger.info("✅ Gemini 2.5 Flash initialized successfully")
        except Exception as e:
            self.logger.error(f"❌ Failed to initialize Gemini: {e}")
            raise
    
    def create_driver(self) -> webdriver.Chrome:
        """Create a simple Chrome driver (no stealth needed with AI approach)"""
        try:
            options = Options()
            options.add_argument('--headless=new')  # Run in background
            options.add_argument('--no-sandbox')
            options.add_argument('--disable-dev-shm-usage')
            options.add_argument('--disable-gpu')
            options.add_argument('--window-size=1920,1080')
            
            # Use undetected Chrome for reliability
            driver = uc.Chrome(options=options)
            self.logger.info("✅ Chrome driver created successfully")
            return driver
            
        except Exception as e:
            self.logger.error(f"❌ Failed to create driver: {e}")
            # Fallback to regular Chrome
            service = Service(ChromeDriverManager().install())
            return webdriver.Chrome(service=service, options=options)
    
    def extract_with_gemini(self, screenshot_data: bytes, url: str) -> ProductData:
        """Use Gemini 2.5 Flash to extract product data from screenshot"""
        try:
            # Convert screenshot to PIL Image
            image = Image.open(io.BytesIO(screenshot_data))
            
            # Prepare the extraction prompt with store-specific hints
            if 'marketplace.bm' in url:
                prompt = """
                Extract the following information from this MarketPlace grocery store product page:
                
                1. Product Name: The full product name/description
                2. SKU/UPC: Any product code, SKU, UPC, or item number
                3. Price: The current price (include $ symbol) - Look for sale prices, regular prices, or any price display
                
                MarketPlace specific notes:
                - Prices may be displayed as regular price or sale price
                - Look for price information in large text, bold text, or highlighted areas
                - Price might be shown with or without $ symbol
                - Check for both sale prices and regular prices
                
                Return the data in this exact JSON format:
                {
                    "name": "product name here",
                    "sku": "sku/upc number here", 
                    "price": "$X.XX"
                }
                
                If any field is not found, use null for that field.
                Only return the JSON, no other text.
                """
            else:
                prompt = """
                Extract the following information from this grocery store product page:
                
                1. Product Name: The full product name/description
                2. SKU/UPC: Any product code, SKU, UPC, or item number
                3. Price: The current price (include $ symbol)
                
                Return the data in this exact JSON format:
                {
                    "name": "product name here",
                    "sku": "sku/upc number here", 
                    "price": "$X.XX"
                }
                
                If any field is not found, use null for that field.
                Only return the JSON, no other text.
                """
            
            # Make API call to Gemini
            self.stats['api_calls'] += 1
            self.logger.info(f"🤖 Calling Gemini API for URL: {url}")
            
            response = self.model.generate_content([prompt, image])
            
            # Parse response
            response_text = response.text.strip()
            
            # Remove any markdown formatting
            if response_text.startswith('```json'):
                response_text = response_text[7:-3]
            elif response_text.startswith('```'):
                response_text = response_text[3:-3]
            
            # Parse JSON response
            try:
                self.logger.info(f"🔍 Raw Gemini response: {response_text}")
                
                data = json.loads(response_text)
                
                product_data = ProductData(
                    name=data.get('name'),
                    sku=data.get('sku'),
                    price=data.get('price'),
                    success=True
                )
                
                self.logger.info(f"✅ Gemini extraction successful:")
                self.logger.info(f"   Name: {product_data.name}")
                self.logger.info(f"   SKU: {product_data.sku}")
                self.logger.info(f"   Price: {product_data.price}")
                
                return product_data
                
            except json.JSONDecodeError as e:
                self.logger.error(f"❌ Failed to parse Gemini response as JSON: {e}")
                self.logger.error(f"   Raw response: {response_text}")
                return ProductData(success=False, error=f"JSON parse error: {e}")
                
        except Exception as e:
            self.logger.error(f"❌ Gemini API call failed: {e}")
            return ProductData(success=False, error=str(e))
    
    def _setup_marketplace_store(self, driver):
        """Setup MarketPlace by selecting Hamilton store before accessing product URLs"""
        try:
            # Go to MarketPlace homepage first
            self.logger.info("📍 Loading MarketPlace homepage to select store...")
            driver.get("https://www.marketplace.bm")
            time.sleep(5)
            
            # Look for store selector button/link
            store_selectors = [
                "//a[contains(text(), 'My Store')]",
                "//button[contains(text(), 'My Store')]", 
                "//div[contains(text(), 'My Store')]",
                "//span[contains(text(), 'My Store')]",
                "//a[contains(text(), 'Store')]",
                "//button[contains(text(), 'Store')]"
            ]
            
            store_button = None
            for selector in store_selectors:
                try:
                    from selenium.webdriver.common.by import By
                    elements = driver.find_elements(By.XPATH, selector)
                    if elements:
                        store_button = elements[0]
                        self.logger.info(f"✅ Found store selector using: {selector}")
                        break
                except:
                    continue
            
            if store_button:
                self.logger.info("🔄 Clicking store selector...")
                store_button.click()
                time.sleep(3)
                
                # Look for Hamilton store option
                hamilton_selectors = [
                    "//a[contains(text(), 'Hamilton')]",
                    "//button[contains(text(), 'Hamilton')]",
                    "//div[contains(text(), 'Hamilton')]",
                    "//span[contains(text(), 'Hamilton')]",
                    "//a[contains(text(), '42 Church Street')]",  # MarketPlace Hamilton address
                    "//div[contains(text(), '42 Church Street')]"
                ]
                
                hamilton_found = False
                for selector in hamilton_selectors:
                    try:
                        elements = driver.find_elements(By.XPATH, selector)
                        if elements:
                            self.logger.info(f"✅ Found Hamilton store option")
                            elements[0].click()
                            time.sleep(3)
                            hamilton_found = True
                            break
                    except:
                        continue
                
                if hamilton_found:
                    self.logger.info("✅ Hamilton store selected successfully!")
                    return True
                else:
                    self.logger.warning("⚠️  Hamilton store option not found")
                    return False
            else:
                self.logger.warning("⚠️  Store selector not found")
                return False
                
        except Exception as e:
            self.logger.error(f"❌ MarketPlace store selection failed: {e}")
            return False
    
    def scrape_single_url(self, url: str, longer_delay: bool = False) -> Dict[str, Any]:
        """Scrape a single URL using AI extraction"""
        self.stats['total_processed'] += 1
        start_time = time.time()
        
        driver = None
        try:
            delay_time = 20 if longer_delay else 8
            delay_type = "RETRY (20s delay)" if longer_delay else "normal (8s delay)"
            
            self.logger.info(f"\n🔍 Processing URL ({delay_type}): {url}")
            
            # Create driver and navigate
            driver = self.create_driver()
            
            # Handle MarketPlace store selection BEFORE going to product URL
            if 'marketplace.bm' in url:
                self.logger.info("🏪 MarketPlace detected - selecting Hamilton store first")
                self._setup_marketplace_store(driver)
                # Extra wait for MarketPlace after store selection
                delay_time += 10  # Add 10 seconds for MarketPlace
                self.logger.info("⏰ Added extra 10 seconds for MarketPlace store processing")
            
            # Now navigate to the product URL
            driver.get(url)
            
            # Wait for page to load completely (longer delay for retries + MarketPlace extra time)
            self.logger.info(f"⏳ Waiting {delay_time} seconds for page to load...")
            time.sleep(delay_time)
            
            # Take screenshot
            screenshot_data = driver.get_screenshot_as_png()
            
            # Extract data using Gemini
            product_data = self.extract_with_gemini(screenshot_data, url)
            
            # Calculate response time
            response_time = time.time() - start_time
            
            # Build result
            result = {
                'url': url,
                'timestamp': datetime.now().isoformat(),
                'response_time': response_time,
                'method': 'gemini_ai',
                'success': product_data.success,
                'name': product_data.name,
                'sku': product_data.sku,
                'price': product_data.price,
                'error': product_data.error
            }
            
            if product_data.success:
                self.stats['successful_extractions'] += 1
                self.logger.info(f"✅ Success in {response_time:.2f}s")
            else:
                self.stats['failed_extractions'] += 1
                self.logger.error(f"❌ Failed: {product_data.error}")
            
            return result
            
        except Exception as e:
            response_time = time.time() - start_time
            self.stats['failed_extractions'] += 1
            self.logger.error(f"❌ Error processing {url}: {e}")
            
            return {
                'url': url,
                'timestamp': datetime.now().isoformat(),
                'response_time': response_time,
                'method': 'gemini_ai',
                'success': False,
                'name': None,
                'sku': None,
                'price': None,
                'error': str(e)
            }
        
        finally:
            if driver:
                try:
                    driver.quit()
                except:
                    pass
    
    def scrape_urls(self, urls: List[str]) -> List[Dict[str, Any]]:
        """Scrape multiple URLs with retry mechanism for failures"""
        self.logger.info(f"🚀 Starting AI-powered scraping of {len(urls)} URLs")
        
        # First pass - normal speed
        results = []
        failed_indices = []
        
        for i, url in enumerate(urls, 1):
            self.logger.info(f"\n📦 Processing {i}/{len(urls)} (First Pass)")
            
            result = self.scrape_single_url(url)
            results.append(result)
            self.results.append(result)
            
            # Track failed extractions (success=True but no actual data extracted)
            if result['success'] and not result['name'] and not result['sku'] and not result['price']:
                failed_indices.append(i-1)  # Store index for retry
                self.logger.warning(f"❌ No data extracted for URL {i}, will retry with longer delay")
            
            # Small delay between requests
            time.sleep(1)
        
        # Second pass - retry failed URLs with longer delays
        if failed_indices:
            self.logger.info(f"\n🔄 RETRY PHASE: Processing {len(failed_indices)} failed URLs with 20-second delays")
            
            for idx in failed_indices:
                url = urls[idx]
                self.logger.info(f"\n🔁 Retry {idx+1}: {url}")
                
                # Track retry attempt
                self.stats['retry_attempts'] += 1
                
                # Use longer delay for retry
                retry_result = self.scrape_single_url(url, longer_delay=True)
                
                # Replace the failed result with retry result
                results[idx] = retry_result
                self.results[idx] = retry_result
                
                # Update stats if retry was successful
                if retry_result['success'] and (retry_result['name'] or retry_result['sku'] or retry_result['price']):
                    self.stats['retry_successes'] += 1
                    self.logger.info(f"✅ Retry successful! Extracted data on second attempt")
                else:
                    self.logger.warning(f"❌ Retry also failed for URL {idx+1}")
                
                # Longer delay between retry attempts
                time.sleep(2)
        
        return results
    
    def save_results(self, filename: str = "ai_scraper_results.xlsx"):
        """Save results to Excel file"""
        try:
            if not self.results:
                self.logger.warning("No results to save")
                return
            
            df = pd.DataFrame(self.results)
            df.to_excel(filename, index=False)
            self.logger.info(f"💾 Results saved to {filename}")
            
        except Exception as e:
            self.logger.error(f"❌ Failed to save results: {e}")
    
    def print_stats(self):
        """Print final statistics"""
        # Calculate data extraction rate (URLs with actual data)
        data_extracted = sum(1 for result in self.results if result.get('name') or result.get('sku') or result.get('price'))
        data_extraction_rate = (data_extracted / len(self.results)) * 100 if self.results else 0
        
        success_rate = (self.stats['successful_extractions'] / self.stats['total_processed']) * 100 if self.stats['total_processed'] > 0 else 0
        retry_success_rate = (self.stats['retry_successes'] / self.stats['retry_attempts']) * 100 if self.stats['retry_attempts'] > 0 else 0
        
        self.logger.info(f"\n📊 FINAL STATISTICS:")
        self.logger.info(f"   Total URLs Processed: {self.stats['total_processed']}")
        self.logger.info(f"   Successful Extractions: {self.stats['successful_extractions']}")
        self.logger.info(f"   Failed Extractions: {self.stats['failed_extractions']}")
        self.logger.info(f"   Success Rate: {success_rate:.1f}%")
        self.logger.info(f"   Data Extraction Rate: {data_extraction_rate:.1f}% ({data_extracted}/{len(self.results)} URLs)")
        self.logger.info(f"   Gemini API Calls: {self.stats['api_calls']}")
        
        if self.stats['retry_attempts'] > 0:
            self.logger.info(f"\n🔄 RETRY STATISTICS:")
            self.logger.info(f"   Retry Attempts: {self.stats['retry_attempts']}")
            self.logger.info(f"   Retry Successes: {self.stats['retry_successes']}")
            self.logger.info(f"   Retry Success Rate: {retry_success_rate:.1f}%")


def main():
    """Main execution function"""
    
    # Test URLs (same ones director.ai used successfully)
    test_urls = [
        "https://www.dropit.bm/shop/produce/fresh_fruit/bananas_plantains/bananas_imported/p/1564405684689979256",
        "https://www.dropit.bm/shop/produce/fresh_vegetables/avocados/avocado_haas/p/7178511", 
        "https://www.dropit.bm/shop/produce/fresh_fruit/berries_cherries/driscoll_s_strawberries_fresh_16_oz/p/147301",
        "https://www.dropit.bm/shop/produce/fresh_fruit/grapes/grapes_green/p/7303673",
        "https://www.dropit.bm/shop/dairy/milk_cream/milk/dunkleys_milk_fresh_1_2_gallon/p/1564405684704421332"
    ]
    
    # Get Google API key
    google_api_key = os.getenv('GOOGLE_API_KEY')
    if not google_api_key:
        print("❌ Error: GOOGLE_API_KEY environment variable not set")
        print("Please set it with: export GOOGLE_API_KEY='your_api_key_here'")
        return
    
    # Initialize scraper
    scraper = AIGroceryScraper(google_api_key)
    
    # Run scraping
    try:
        results = scraper.scrape_urls(test_urls)
        
        # Save results
        scraper.save_results()
        
        # Print statistics
        scraper.print_stats()
        
        print(f"\n✅ Scraping completed! Check ai_scraper_results.xlsx for full results.")
        
    except KeyboardInterrupt:
        print("\n⚠️  Scraping interrupted by user")
    except Exception as e:
        print(f"❌ Scraping failed: {e}")


if __name__ == "__main__":
    main()