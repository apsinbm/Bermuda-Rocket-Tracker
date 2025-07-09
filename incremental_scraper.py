#!/usr/bin/env python3
"""
Incremental scraper that saves progress every 10 products to avoid timeout issues
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
import json
import os

# SSL bypass
ssl._create_default_https_context = ssl._create_unverified_context
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

class IncrementalScraper:
    def __init__(self):
        self.driver = None
        self.results = []
        self.progress_file = '/Users/pato/scraper_progress.json'
        
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
            patterns = [
                r'price["\']?[:\s]*[$"]*(\d+\.\d+)',
                r'\$(\d+\.\d+)',
                r'price.*?(\d+\.\d+)',
                r'\b(\d+\.\d+)\b'
            ]
            
            for pattern in patterns:
                matches = re.findall(pattern, page_source, re.IGNORECASE)
                if matches:
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
        """Scrape a single URL"""
        try:
            if not url or url == 'N/A':
                return None
                
            logger.info(f"🔍 Scraping {store}: {product_name}")
            
            self.driver.get(url)
            time.sleep(random.uniform(2, 4))
            
            page_source = self.driver.page_source
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
    
    def load_progress(self):
        """Load previous progress if exists"""
        if os.path.exists(self.progress_file):
            try:
                with open(self.progress_file, 'r') as f:
                    data = json.load(f)
                    self.results = data.get('results', [])
                    processed_urls = data.get('processed_urls', [])
                    logger.info(f"📂 Loaded {len(self.results)} previous results")
                    return set(processed_urls)
            except:
                logger.warning("⚠️ Could not load progress file")
        return set()
    
    def save_progress(self, processed_urls):
        """Save current progress"""
        try:
            with open(self.progress_file, 'w') as f:
                json.dump({
                    'results': self.results,
                    'processed_urls': list(processed_urls)
                }, f, indent=2)
            logger.info(f"💾 Progress saved: {len(self.results)} results")
        except Exception as e:
            logger.error(f"❌ Could not save progress: {e}")
    
    def scrape_batch(self, batch_size=50):
        """Scrape in batches with progress saving"""
        processed_urls = self.load_progress()
        additional_df = pd.read_csv('/Users/pato/additional_products.csv')
        
        self.setup_driver()
        
        try:
            total_urls = 0
            batch_count = 0
            
            for _, row in additional_df.iterrows():
                product_name = f"{row['Brand']} {row['Product']}" if pd.notna(row['Brand']) else row['Product']
                
                for store in ['Drop It', 'Miles', 'Pronto', 'HH']:
                    url = row[store]
                    if pd.notna(url) and url != 'N/A' and str(url).startswith('http'):
                        total_urls += 1
                        
                        # Skip if already processed
                        if url in processed_urls:
                            logger.info(f"⏭️ Skipping already processed: {store}: {product_name}")
                            continue
                        
                        result = self.scrape_url(url, product_name, store)
                        if result:
                            self.results.append(result)
                        
                        processed_urls.add(url)
                        batch_count += 1
                        
                        # Save progress every batch_size URLs
                        if batch_count % batch_size == 0:
                            self.save_progress(processed_urls)
                            logger.info(f"📊 Batch complete: {batch_count}/{total_urls} processed")
                        
                        time.sleep(random.uniform(1, 2))
                        
        finally:
            if self.driver:
                self.driver.quit()
            
            # Final save
            self.save_progress(processed_urls)
            logger.info(f"🎯 Scraping complete: {len(self.results)} results from {total_urls} URLs")
    
    def save_final_results(self):
        """Save final results to CSV and Excel"""
        if not self.results:
            print("❌ No results found")
            return
            
        df = pd.DataFrame(self.results)
        
        # Save CSV
        csv_filename = f'/Users/pato/incremental_scraper_results_{int(time.time())}.csv'
        df.to_csv(csv_filename, index=False)
        
        # Save Excel
        excel_filename = f'/Users/pato/incremental_scraper_results_{int(time.time())}.xlsx'
        df.to_excel(excel_filename, index=False)
        
        print(f"\n✅ INCREMENTAL SCRAPER FINAL RESULTS")
        print("=" * 60)
        print(f"Successfully scraped: {len(self.results)} products")
        print(f"📄 CSV saved to: {csv_filename}")
        print(f"📄 Excel saved to: {excel_filename}")
        
        # Show store breakdown
        print(f"\n🏪 STORE BREAKDOWN:")
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
        
        return csv_filename, excel_filename

def main():
    """Run incremental scraper"""
    scraper = IncrementalScraper()
    
    print("🚀 Starting Incremental Scraper...")
    print("This will process all 74 additional products with progress saving")
    
    scraper.scrape_batch(batch_size=50)
    csv_file, excel_file = scraper.save_final_results()
    
    print(f"\n🎯 Files created:")
    print(f"CSV: {csv_file}")
    print(f"Excel: {excel_file}")

if __name__ == "__main__":
    main()