#!/usr/bin/env python3
"""
Background scraper that runs independently and creates immediate results files
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
import threading

# SSL bypass
ssl._create_default_https_context = ssl._create_unverified_context
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

class BackgroundScraper:
    def __init__(self):
        self.driver = None
        self.results = []
        self.total_processed = 0
        self.results_file = f'/Users/pato/background_scraper_results_{int(time.time())}.json'
        
        # Setup logging to file
        logging.basicConfig(
            level=logging.INFO, 
            format='%(asctime)s - %(levelname)s - %(message)s',
            handlers=[
                logging.FileHandler(f'/Users/pato/scraper_log_{int(time.time())}.log'),
                logging.StreamHandler()
            ]
        )
        self.logger = logging.getLogger(__name__)
        
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
            self.logger.error(f"Regex extraction error: {e}")
            return None
    
    def scrape_url(self, url, product_name, store):
        """Scrape a single URL"""
        try:
            if not url or url == 'N/A':
                return None
                
            self.logger.info(f"🔍 Scraping {store}: {product_name}")
            
            self.driver.get(url)
            time.sleep(random.uniform(2, 4))
            
            page_source = self.driver.page_source
            price = self.extract_price_regex(page_source)
            
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
            return None
    
    def save_results(self):
        """Save current results to file"""
        try:
            with open(self.results_file, 'w') as f:
                json.dump({
                    'total_processed': self.total_processed,
                    'successful_results': len(self.results),
                    'success_rate': f"{len(self.results)/max(self.total_processed, 1)*100:.1f}%",
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
        """Run the full scraping process"""
        self.logger.info("🚀 Starting Background Scraper...")
        
        # Load products
        additional_df = pd.read_csv('/Users/pato/additional_products.csv')
        
        # Setup driver
        self.setup_driver()
        
        try:
            for _, row in additional_df.iterrows():
                product_name = f"{row['Brand']} {row['Product']}" if pd.notna(row['Brand']) else row['Product']
                
                for store in ['Drop It', 'Miles', 'Pronto', 'HH']:
                    url = row[store]
                    if pd.notna(url) and url != 'N/A' and str(url).startswith('http'):
                        self.total_processed += 1
                        
                        result = self.scrape_url(url, product_name, store)
                        if result:
                            self.results.append(result)
                        
                        # Save progress every 10 results
                        if self.total_processed % 10 == 0:
                            self.save_results()
                            self.logger.info(f"📊 Progress: {self.total_processed} processed, {len(self.results)} successful")
                        
                        time.sleep(random.uniform(1, 2))
                        
        except Exception as e:
            self.logger.error(f"❌ Scraping error: {e}")
        finally:
            if self.driver:
                self.driver.quit()
            
            # Final save
            self.save_results()
            self.logger.info(f"🎯 SCRAPING COMPLETE!")
            self.logger.info(f"Total processed: {self.total_processed}")
            self.logger.info(f"Successful results: {len(self.results)}")
            self.logger.info(f"Success rate: {len(self.results)/max(self.total_processed, 1)*100:.1f}%")
            self.logger.info(f"Results saved to: {self.results_file}")

def run_in_background():
    """Run scraper in background"""
    scraper = BackgroundScraper()
    scraper.run_scraper()

if __name__ == "__main__":
    # Run immediately
    run_in_background()
    
    # Also create a simple status file
    with open('/Users/pato/scraper_status.txt', 'w') as f:
        f.write("Background scraper started at: " + str(time.time()) + "\n")
        f.write("Check scraper_log_*.log for progress\n")
        f.write("Check background_scraper_results_*.json for results\n")