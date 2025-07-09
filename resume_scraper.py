#!/usr/bin/env python3
"""
Resume scraper to finish remaining URLs - automatically restart after crashes
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

class ResumeScraper:
    def __init__(self):
        self.driver = None
        self.results = []
        self.processed_urls = set()
        self.results_file = f'/Users/pato/resume_scraper_results_{int(time.time())}.json'
        
        # Setup logging
        logging.basicConfig(
            level=logging.INFO, 
            format='%(asctime)s - %(levelname)s - %(message)s',
            handlers=[
                logging.FileHandler(f'/Users/pato/resume_scraper_log_{int(time.time())}.log'),
                logging.StreamHandler()
            ]
        )
        self.logger = logging.getLogger(__name__)
        
    def load_previous_results(self):
        """Load previous results to avoid reprocessing"""
        try:
            with open('/Users/pato/background_scraper_results_1752062222.json', 'r') as f:
                previous_data = json.load(f)
                previous_results = previous_data.get('results', [])
                
                # Add previous results
                self.results.extend(previous_results)
                
                # Mark URLs as processed
                for result in previous_results:
                    self.processed_urls.add(result['url'])
                    
                self.logger.info(f"📂 Loaded {len(previous_results)} previous results")
                
        except Exception as e:
            self.logger.warning(f"⚠️ Could not load previous results: {e}")
        
    def setup_driver(self):
        """Setup Chrome driver with robust options"""
        options = Options()
        options.add_argument("--headless")
        options.add_argument("--no-sandbox")
        options.add_argument("--disable-dev-shm-usage")
        options.add_argument("--disable-gpu")
        options.add_argument("--disable-extensions")
        options.add_argument("--disable-plugins")
        options.add_argument("--disable-images")
        options.add_argument("--user-agent=Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36")
        
        try:
            self.driver = webdriver.Chrome(options=options)
            self.logger.info("✅ Chrome driver initialized")
        except Exception as e:
            self.logger.error(f"❌ Failed to initialize Chrome driver: {e}")
            raise
        
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
            self.logger.error(f"Regex extraction error: {e}")
            return None
    
    def scrape_url(self, url, product_name, store):
        """Scrape a single URL with error handling"""
        try:
            if not url or url == 'N/A':
                return None
                
            # Skip if already processed
            if url in self.processed_urls:
                self.logger.info(f"⏭️ Skipping already processed: {store}: {product_name}")
                return None
                
            self.logger.info(f"🔍 Scraping {store}: {product_name}")
            
            self.driver.get(url)
            time.sleep(random.uniform(2, 4))
            
            page_source = self.driver.page_source
            price = self.extract_price_regex(page_source)
            
            # Mark as processed regardless of success
            self.processed_urls.add(url)
            
            if price:
                self.logger.info(f"✅ Found price: ${price:.2f} for {store}: {product_name}")
                return {
                    'product_name': product_name,
                    'store': store,
                    'url': url,
                    'price': price,
                    'method': 'Regex',
                    'timestamp': time.time()
                }
            else:
                self.logger.warning(f"⚠️ No price found for {store}: {product_name}")
                return None
                
        except Exception as e:
            self.logger.error(f"❌ Error scraping {store}: {product_name} - {e}")
            self.processed_urls.add(url)  # Mark as processed to avoid retry
            return None
    
    def save_results(self):
        """Save current results"""
        try:
            with open(self.results_file, 'w') as f:
                json.dump({
                    'total_processed': len(self.processed_urls),
                    'successful_results': len(self.results),
                    'success_rate': f"{len(self.results)/max(len(self.processed_urls), 1)*100:.1f}%",
                    'results': self.results
                }, f, indent=2)
            
            # Also save CSV
            if self.results:
                df = pd.DataFrame(self.results)
                csv_file = self.results_file.replace('.json', '.csv')
                df.to_csv(csv_file, index=False)
                
        except Exception as e:
            self.logger.error(f"❌ Could not save results: {e}")
    
    def run_scraper(self):
        """Run the scraper with automatic restart on crashes"""
        self.logger.info("🚀 Starting Resume Scraper...")
        
        # Load previous results
        self.load_previous_results()
        
        # Load products
        additional_df = pd.read_csv('/Users/pato/additional_products.csv')
        
        # Count total URLs to process
        total_urls = 0
        urls_to_process = []
        
        for _, row in additional_df.iterrows():
            product_name = f"{row['Brand']} {row['Product']}" if pd.notna(row['Brand']) else row['Product']
            
            for store in ['Drop It', 'Miles', 'Pronto', 'HH']:
                url = row[store]
                if pd.notna(url) and url != 'N/A' and str(url).startswith('http'):
                    total_urls += 1
                    if url not in self.processed_urls:
                        urls_to_process.append((url, product_name, store))
        
        self.logger.info(f"📊 Total URLs: {total_urls}, Already processed: {len(self.processed_urls)}, Remaining: {len(urls_to_process)}")
        
        # Process remaining URLs with automatic restart
        batch_size = 20
        for i in range(0, len(urls_to_process), batch_size):
            batch = urls_to_process[i:i+batch_size]
            
            try:
                # Setup driver for this batch
                self.setup_driver()
                
                # Process batch
                for url, product_name, store in batch:
                    result = self.scrape_url(url, product_name, store)
                    if result:
                        self.results.append(result)
                    
                    # Save progress frequently
                    if len(self.processed_urls) % 10 == 0:
                        self.save_results()
                    
                    time.sleep(random.uniform(1, 2))
                    
                # Clean up driver
                if self.driver:
                    self.driver.quit()
                    self.driver = None
                
                self.logger.info(f"📊 Batch {i//batch_size + 1} complete. Progress: {len(self.processed_urls)}/{total_urls}")
                
            except Exception as e:
                self.logger.error(f"❌ Batch error: {e}")
                if self.driver:
                    self.driver.quit()
                    self.driver = None
                # Continue to next batch
                continue
        
        # Final save
        self.save_results()
        self.logger.info(f"🎯 RESUME SCRAPING COMPLETE!")
        self.logger.info(f"Total processed: {len(self.processed_urls)}")
        self.logger.info(f"Successful results: {len(self.results)}")
        self.logger.info(f"Success rate: {len(self.results)/max(len(self.processed_urls), 1)*100:.1f}%")
        self.logger.info(f"Results saved to: {self.results_file}")

def main():
    """Run resume scraper"""
    scraper = ResumeScraper()
    scraper.run_scraper()

if __name__ == "__main__":
    main()