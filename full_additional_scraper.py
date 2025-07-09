#!/usr/bin/env python3
"""
Full scraper for all 74 additional products using regex extraction
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

class FullAdditionalScraper:
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
    
    def scrape_all_additional_products(self):
        """Scrape all 74 additional products"""
        self.setup_driver()
        
        # Load additional products
        additional_df = pd.read_csv('/Users/pato/additional_products.csv')
        
        try:
            total_urls = 0
            for _, row in additional_df.iterrows():
                product_name = f"{row['Brand']} {row['Product']}" if pd.notna(row['Brand']) else row['Product']
                
                # Check each store
                for store in ['Drop It', 'Miles', 'Pronto', 'HH']:
                    url = row[store]
                    if pd.notna(url) and url != 'N/A' and str(url).startswith('http'):
                        total_urls += 1
                        result = self.scrape_url(url, product_name, store)
                        if result:
                            self.results.append(result)
                            
                        # Brief pause between URLs
                        time.sleep(random.uniform(1, 2))
                        
        finally:
            if self.driver:
                self.driver.quit()
        
        logger.info(f"📊 Scraping complete. Processed {total_urls} URLs, found {len(self.results)} prices")
    
    def save_results(self):
        """Save results to CSV and Excel"""
        if not self.results:
            print("❌ No results found")
            return
            
        # Create DataFrame
        df = pd.DataFrame(self.results)
        
        # Save CSV
        csv_filename = f'/Users/pato/additional_products_scraped_{int(time.time())}.csv'
        df.to_csv(csv_filename, index=False)
        
        # Save Excel
        excel_filename = f'/Users/pato/additional_products_scraped_{int(time.time())}.xlsx'
        df.to_excel(excel_filename, index=False)
        
        print(f"\n✅ FULL ADDITIONAL SCRAPER RESULTS")
        print("=" * 60)
        print(f"Successfully scraped: {len(self.results)} products")
        print(f"📄 CSV saved to: {csv_filename}")
        print(f"📄 Excel saved to: {excel_filename}")
        
        # Show store breakdown
        print(f"\n🏪 STORE BREAKDOWN:")
        print("=" * 30)
        for store in ['Drop It', 'Miles', 'Pronto', 'HH']:
            store_results = [r for r in self.results if r['store'] == store]
            print(f"{store:<10}: {len(store_results):3d} products")
        
        # Show price range
        prices = [r['price'] for r in self.results]
        if prices:
            print(f"\n💰 PRICE RANGE:")
            print(f"Lowest:  ${min(prices):.2f}")
            print(f"Highest: ${max(prices):.2f}")
            print(f"Average: ${sum(prices)/len(prices):.2f}")

def main():
    """Run the full additional products scraper"""
    scraper = FullAdditionalScraper()
    
    print("🚀 Starting Full Additional Products Scraper...")
    print("This will scrape all 74 additional products across 4 stores")
    print("Expected to process ~296 URLs")
    
    scraper.scrape_all_additional_products()
    scraper.save_results()
    
    print("\n🎯 NEXT STEP: Update the comprehensive comparison Excel file")

if __name__ == "__main__":
    main()