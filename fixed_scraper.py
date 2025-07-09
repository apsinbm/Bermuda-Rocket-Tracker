#!/usr/bin/env python3
"""
Fixed scraper with simplified AI extraction
"""
import pandas as pd
import google.generativeai as genai
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

# Configure Gemini
genai.configure(api_key="AIzaSyDWeTTxWR4lHD7IVV30q__5EWaQa1FcCCo")

class FixedScraper:
    def __init__(self):
        self.model = genai.GenerativeModel('gemini-2.0-flash-exp')
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
        
    def extract_price_simple(self, page_source):
        """Extract price using simple AI prompt"""
        try:
            # Try multiple simple prompts
            prompts = [
                "Find the main product price on this page. Return only the number (like 9.99):",
                "What is the price of this product? Return just the number:",
                "Price:",
                "Find the price. Number only:"
            ]
            
            for prompt in prompts:
                try:
                    full_prompt = f"{prompt}\\n\\n{page_source[:6000]}"
                    response = self.model.generate_content(full_prompt)
                    
                    if response and response.text:
                        # Look for number in response
                        price_match = re.search(r'\\b(\\d+\\.\\d+)\\b', response.text)
                        if price_match:
                            price = float(price_match.group(1))
                            if 0.50 <= price <= 50.00:  # Reasonable price range
                                return price
                except:
                    continue
            
            return None
            
        except Exception as e:
            logger.error(f"AI extraction error: {e}")
            return None
    
    def extract_price_regex(self, page_source):
        """Extract price using regex patterns"""
        try:
            # Look for price patterns in HTML
            patterns = [
                r'price["\']?[:\s]*[$"]*(\\d+\\.\\d+)',
                r'\\$(\\d+\\.\\d+)',
                r'price.*?(\\d+\\.\\d+)',
                r'\\b(\\d+\\.\\d+)\\b'
            ]
            
            for pattern in patterns:
                matches = re.findall(pattern, page_source, re.IGNORECASE)
                if matches:
                    # Find reasonable prices
                    for match in matches:
                        price = float(match)
                        if 0.50 <= price <= 50.00:
                            return price
            
            return None
            
        except Exception as e:
            logger.error(f"Regex extraction error: {e}")
            return None
    
    def scrape_url(self, url, product_name, store):
        """Scrape a single URL with improved extraction"""
        try:
            if not url or url == 'N/A':
                return None
                
            logger.info(f"🔍 Scraping {store}: {product_name}")
            
            self.driver.get(url)
            time.sleep(random.uniform(2, 4))
            
            page_source = self.driver.page_source
            
            # Try AI extraction first
            price = self.extract_price_simple(page_source)
            method = 'AI' if price else None
            
            # If AI fails, try regex
            if not price:
                price = self.extract_price_regex(page_source)
                method = 'Regex' if price else None
            
            if price:
                logger.info(f"✅ Found price: ${price:.2f} for {store}: {product_name}")
                return {
                    'product_name': product_name,
                    'store': store,
                    'url': url,
                    'price': price,
                    'method': method
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
            
        print(f"\\n✅ FIXED SCRAPER TEST RESULTS")
        print("=" * 60)
        print(f"Successfully scraped: {len(self.results)} products")
        
        for result in self.results:
            print(f"{result['store']:<10} | ${result['price']:<6.2f} | {result['product_name']}")
        
        # Save results
        if self.results:
            df = pd.DataFrame(self.results)
            filename = f'/Users/pato/fixed_scraper_test_results_{int(time.time())}.csv'
            df.to_csv(filename, index=False)
            print(f"\\n📄 Results saved to: {filename}")

def main():
    """Test the fixed scraper"""
    scraper = FixedScraper()
    
    print("🧪 Testing Fixed Scraper...")
    scraper.test_few_products()
    scraper.show_results()
    
    if scraper.results:
        print("\\n🎯 NEXT STEP: Run full scraping of all 74 additional products")
        print("The extraction is now working!")
    else:
        print("\\n❌ Still having issues - need further debugging")

if __name__ == "__main__":
    main()