#!/usr/bin/env python3
"""
Regex-only scraper to focus on what's working
"""
import pandas as pd
from selenium import webdriver
from selenium.webdriver.chrome.options import Options
import time
import logging
import re
import random
import ssl
import urllib3

# SSL bypass
ssl._create_default_https_context = ssl._create_unverified_context
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

class RegexOnlyScraper:
    def __init__(self):
        self.driver = None
        self.results = []
        
    def setup_driver(self):
        """Setup Chrome driver"""
        options = Options()
        options.add_argument("--headless")
        options.add_argument("--no-sandbox")
        options.add_argument("--disable-dev-shm-usage")
        options.add_argument("--user-agent=Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36")
        
        self.driver = webdriver.Chrome(options=options)
        
    def extract_price_regex(self, page_source):
        """Extract price using regex patterns"""
        try:
            # Look for price patterns in HTML
            patterns = [
                r'price["\']?[:\s]*[$"]*(\d+\.\d+)',
                r'\$(\d+\.\d+)',
                r'price.*?(\d+\.\d+)',
                r'\b(\d+\.\d+)\b'
            ]
            
            for pattern in patterns:
                matches = re.findall(pattern, page_source, re.IGNORECASE)
                if matches:
                    # Find reasonable prices
                    for match in matches:
                        try:
                            price = float(match)
                            if 0.50 <= price <= 50.00:
                                return price
                        except:
                            continue
            
            return None
            
        except Exception as e:
            logger.error(f"Regex extraction error: {e}")
            return None
    
    def scrape_url(self, url, product_name, store):
        """Scrape a single URL with regex extraction"""
        try:
            if not url or url == 'N/A':
                return None
                
            logger.info(f"🔍 Scraping {store}: {product_name}")
            
            self.driver.get(url)
            time.sleep(random.uniform(2, 4))
            
            page_source = self.driver.page_source
            
            # Use regex extraction
            price = self.extract_price_regex(page_source)
            
            if price:
                logger.info(f"✅ Found price: ${price:.2f} for {store}: {product_name}")
                return {
                    'product_name': product_name,
                    'store': store,
                    'url': url,
                    'price': price,
                    'method': 'Regex'
                }
            else:
                logger.warning(f"⚠️ No price found for {store}: {product_name}")
                return None
                
        except Exception as e:
            logger.error(f"❌ Error scraping {store}: {product_name} - {e}")
            return None
    
    def test_few_products(self):
        """Test scraping a few products from your list"""
        self.setup_driver()
        
        # Test URLs from your additional products
        test_products = [
            ("HELLMANN REAL MAYONNAISE", "https://www.dropit.bm/shop/pantry/condiments_sauces_marinades/condiments/mayonnaise/hellmann_s_real_mayonnaise_30_fl_oz/p/32968", "Drop It"),
            ("HELLMANN REAL MAYONNAISE", "https://pronto.bm/product/hellmanns-real-mayonnaise-30-oz", "Pronto"),
            ("HELLMANN REAL MAYONNAISE", "https://shop.miles.bm/shop/pantry/condiments_sauces_marinades/condiments/mayonnaise/hellmann_s_real_mayonnaise_30_fl_oz/p/32968", "Miles"),
            ("SUNKIST LEMON", "https://pronto.bm/product/lemon-1-ct", "Pronto"),
            ("SUNKIST LEMON", "https://www.dropit.bm/shop/produce/fresh_fruit/citrus/lemon/p/1564405684690088162", "Drop It"),
        ]
        
        try:
            for product_name, url, store in test_products:
                result = self.scrape_url(url, product_name, store)
                if result:
                    self.results.append(result)
                    
                # Brief pause
                time.sleep(random.uniform(1, 2))
                
        finally:
            if self.driver:
                self.driver.quit()
    
    def show_results(self):
        """Show test results"""
        if not self.results:
            print("❌ No results found")
            return
            
        print(f"\n✅ REGEX-ONLY SCRAPER TEST RESULTS")
        print("=" * 60)
        print(f"Successfully scraped: {len(self.results)} products")
        
        for result in self.results:
            print(f"{result['store']:<10} | ${result['price']:<6.2f} | {result['product_name']}")
        
        # Save results
        if self.results:
            df = pd.DataFrame(self.results)
            filename = f'/Users/pato/regex_scraper_test_results_{int(time.time())}.csv'
            df.to_csv(filename, index=False)
            print(f"\n📄 Results saved to: {filename}")

def main():
    """Test the regex-only scraper"""
    scraper = RegexOnlyScraper()
    
    print("🧪 Testing Regex-Only Scraper...")
    scraper.test_few_products()
    scraper.show_results()
    
    if scraper.results:
        print("\n🎯 SUCCESS! Regex extraction is working")
        print("Ready to run full scraping of all 74 additional products")
    else:
        print("\n❌ Still having issues with regex extraction")

if __name__ == "__main__":
    main()