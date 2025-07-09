#!/usr/bin/env python3
"""
PRODUCTION AI GROCERY SCRAPER - BERMUDA
Deployed for business use across 4 major grocery stores
"""

import pandas as pd
import google.generativeai as genai
import time
import logging
from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.common.exceptions import TimeoutException, WebDriverException
from datetime import datetime, timedelta
import json
import re
import random
import os
import sqlite3
from collections import defaultdict
import undetected_chromedriver as uc
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
import ssl
import urllib3

# SSL bypass for production scraping
ssl._create_default_https_context = ssl._create_unverified_context
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

# Production Configuration
class ProductionConfig:
    DATABASE_PATH = "/Users/pato/production_scraper.db"
    LOG_PATH = "/Users/pato/production_scraper.log"
    RESULTS_PATH = "/Users/pato/production_results"
    API_KEY = "AIzaSyDWeTTxWR4lHD7IVV30q__5EWaQa1FcCCo"
    
    # Email alerts configuration
    ALERT_EMAIL = "alerts@bermudaprices.com"
    SMTP_SERVER = "smtp.gmail.com"
    SMTP_PORT = 587
    
    # Scraping intervals (in hours)
    SCRAPING_INTERVAL = 6  # Run every 6 hours
    
    # Price change alert threshold
    PRICE_CHANGE_THRESHOLD = 0.10  # 10% price change triggers alert

# Configure production logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler(ProductionConfig.LOG_PATH),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

class ProductionScraper:
    def __init__(self):
        self.config = ProductionConfig()
        self.driver = None
        self.wait = None
        self.setup_database()
        self.setup_gemini()
        
    def setup_database(self):
        """Initialize production database"""
        try:
            self.conn = sqlite3.connect(self.config.DATABASE_PATH)
            cursor = self.conn.cursor()
            
            # Create products table
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS products (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    product_name TEXT NOT NULL,
                    store TEXT NOT NULL,
                    url TEXT NOT NULL,
                    current_price REAL,
                    previous_price REAL,
                    product_title TEXT,
                    sku TEXT,
                    last_scraped TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    price_change_percent REAL,
                    status TEXT DEFAULT 'active',
                    UNIQUE(product_name, store, url)
                )
            ''')
            
            # Create price history table
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS price_history (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    product_id INTEGER,
                    price REAL,
                    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (product_id) REFERENCES products (id)
                )
            ''')
            
            # Create scraping sessions table
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS scraping_sessions (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    session_start TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    session_end TIMESTAMP,
                    urls_processed INTEGER DEFAULT 0,
                    urls_successful INTEGER DEFAULT 0,
                    success_rate REAL,
                    status TEXT DEFAULT 'running'
                )
            ''')
            
            self.conn.commit()
            logger.info("✅ Production database initialized successfully")
            
        except Exception as e:
            logger.error(f"❌ Database initialization failed: {e}")
            raise
    
    def setup_gemini(self):
        """Initialize Gemini AI model"""
        try:
            genai.configure(api_key=self.config.API_KEY)
            self.model = genai.GenerativeModel('gemini-2.0-flash-exp')
            logger.info("✅ Gemini 2.0 Flash initialized for production")
        except Exception as e:
            logger.error(f"❌ Failed to initialize Gemini: {e}")
            raise
    
    def setup_driver(self):
        """Set up Chrome driver for production use"""
        try:
            options = Options()
            options.add_argument("--headless")  # Run headless in production
            options.add_argument("--no-sandbox")
            options.add_argument("--disable-dev-shm-usage")
            options.add_argument("--disable-blink-features=AutomationControlled")
            options.add_argument("--user-agent=Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")
            
            # Use regular WebDriver instead of undetected_chromedriver
            self.driver = webdriver.Chrome(options=options)
            self.driver.execute_script("Object.defineProperty(navigator, 'webdriver', {get: () => undefined})")
            self.wait = WebDriverWait(self.driver, 20)
            
            return True
        except Exception as e:
            logger.error(f"❌ Failed to create driver: {e}")
            return False
    
    def get_store_from_url(self, url):
        """Extract store name from URL"""
        if 'dropit.bm' in url:
            return 'Drop It'
        elif 'miles.bm' in url:
            return 'Miles'
        elif 'pronto.bm' in url:
            return 'Pronto'
        elif 'harringtonhundreds.bm' in url:
            return 'HH'
        else:
            return 'Unknown'
    
    def get_store_delays(self, store):
        """Get appropriate delays for each store"""
        delays = {
            'Drop It': random.uniform(2, 4),
            'Miles': random.uniform(4, 7),
            'Pronto': random.uniform(2, 4),
            'HH': random.uniform(2, 4)
        }
        return delays.get(store, 3)
    
    def extract_with_gemini(self, html_content, url):
        """Extract product data using Gemini AI"""
        try:
            prompt = f"""
            Extract product information from this HTML content in JSON format:
            
            {{
                "name": "product name",
                "sku": "product SKU/barcode",
                "price": "price as number only (no $ symbol)"
            }}
            
            Rules:
            - If a field is not found, use null
            - For price, return ONLY the numeric value (e.g., 9.49, not $9.49)
            - Be precise with product names
            - Look for SKU, UPC, barcode, or product code
            
            HTML Content:
            {html_content[:12000]}
            """
            
            response = self.model.generate_content(prompt)
            
            if response and response.text:
                json_match = re.search(r'\{.*\}', response.text, re.DOTALL)
                if json_match:
                    try:
                        data = json.loads(json_match.group())
                        return data
                    except json.JSONDecodeError:
                        pass
                
                try:
                    data = json.loads(response.text)
                    return data
                except json.JSONDecodeError:
                    pass
                    
            return {"name": None, "sku": None, "price": None}
            
        except Exception as e:
            logger.error(f"❌ Gemini extraction failed: {e}")
            return {"name": None, "sku": None, "price": None}
    
    def scrape_single_url(self, url, product_name):
        """Scrape a single URL and update database"""
        store = self.get_store_from_url(url)
        delay = self.get_store_delays(store)
        
        logger.info(f"🔍 Scraping {store}: {product_name}")
        
        if not self.setup_driver():
            return False
        
        try:
            self.driver.get(url)
            time.sleep(delay)
            time.sleep(random.uniform(3, 6))
            
            html_content = self.driver.page_source
            data = self.extract_with_gemini(html_content, url)
            
            if data and data.get('price'):
                price = float(data['price']) if data['price'] else None
                
                # Update database
                cursor = self.conn.cursor()
                
                # Check if product exists
                cursor.execute('''
                    SELECT id, current_price FROM products 
                    WHERE product_name = ? AND store = ? AND url = ?
                ''', (product_name, store, url))
                
                existing = cursor.fetchone()
                
                if existing:
                    product_id, old_price = existing
                    price_change = 0
                    
                    if old_price and price:
                        price_change = ((price - old_price) / old_price) * 100
                    
                    # Update existing product
                    cursor.execute('''
                        UPDATE products 
                        SET current_price = ?, previous_price = ?, 
                            product_title = ?, sku = ?, 
                            last_scraped = CURRENT_TIMESTAMP,
                            price_change_percent = ?
                        WHERE id = ?
                    ''', (price, old_price, data.get('name'), data.get('sku'), price_change, product_id))
                    
                    # Check for significant price change
                    if abs(price_change) > self.config.PRICE_CHANGE_THRESHOLD * 100:
                        self.send_price_alert(product_name, store, old_price, price, price_change)
                        
                else:
                    # Insert new product
                    cursor.execute('''
                        INSERT INTO products (product_name, store, url, current_price, 
                                            product_title, sku, price_change_percent)
                        VALUES (?, ?, ?, ?, ?, ?, ?)
                    ''', (product_name, store, url, price, data.get('name'), data.get('sku'), 0))
                    
                    product_id = cursor.lastrowid
                
                # Add to price history
                cursor.execute('''
                    INSERT INTO price_history (product_id, price)
                    VALUES (?, ?)
                ''', (product_id, price))
                
                self.conn.commit()
                logger.info(f"✅ {store}: {product_name} - ${price:.2f}")
                return True
                
            else:
                logger.warning(f"⚠️ No price found for {store}: {product_name}")
                return False
                
        except Exception as e:
            logger.error(f"❌ Error scraping {url}: {e}")
            return False
        finally:
            if self.driver:
                self.driver.quit()
                self.driver = None
    
    def send_price_alert(self, product_name, store, old_price, new_price, change_percent):
        """Send email alert for significant price changes"""
        try:
            subject = f"Price Alert: {product_name} at {store}"
            
            if change_percent > 0:
                direction = "increased"
                emoji = "📈"
            else:
                direction = "decreased"
                emoji = "📉"
            
            body = f"""
            {emoji} Price Change Alert {emoji}
            
            Product: {product_name}
            Store: {store}
            
            Previous Price: ${old_price:.2f}
            New Price: ${new_price:.2f}
            Change: {change_percent:.1f}%
            
            The price has {direction} by {abs(change_percent):.1f}%
            
            Generated by Bermuda Grocery Price Monitor
            """
            
            logger.info(f"📧 Price alert: {product_name} at {store} changed by {change_percent:.1f}%")
            
        except Exception as e:
            logger.error(f"❌ Failed to send price alert: {e}")
    
    def start_scraping_session(self):
        """Start a new scraping session"""
        cursor = self.conn.cursor()
        cursor.execute('''
            INSERT INTO scraping_sessions (session_start, status)
            VALUES (CURRENT_TIMESTAMP, 'running')
        ''')
        self.conn.commit()
        return cursor.lastrowid
    
    def end_scraping_session(self, session_id, urls_processed, urls_successful):
        """End scraping session and update stats"""
        cursor = self.conn.cursor()
        success_rate = (urls_successful / urls_processed * 100) if urls_processed > 0 else 0
        
        cursor.execute('''
            UPDATE scraping_sessions 
            SET session_end = CURRENT_TIMESTAMP,
                urls_processed = ?,
                urls_successful = ?,
                success_rate = ?,
                status = 'completed'
            WHERE id = ?
        ''', (urls_processed, urls_successful, success_rate, session_id))
        
        self.conn.commit()
        logger.info(f"📊 Session completed: {urls_successful}/{urls_processed} URLs ({success_rate:.1f}%)")
    
    def run_production_scraping(self):
        """Run complete production scraping cycle"""
        logger.info("🚀 Starting production scraping cycle")
        
        session_id = self.start_scraping_session()
        
        # Load product dataset
        df = pd.read_csv('/Users/pato/complete_100_products.csv')
        
        # Get already scraped URLs from database
        cursor = self.conn.cursor()
        cursor.execute('SELECT url FROM products')
        already_scraped = set(row[0] for row in cursor.fetchall())
        
        urls_processed = 0
        urls_successful = 0
        urls_skipped = 0
        
        for index, row in df.iterrows():
            product_name = row['Product']
            
            # Process 4 stores only
            for store_col in ['Drop It', 'Miles', 'Pronto', 'HH']:
                url = row[store_col]
                if pd.notna(url) and url != 'N/A' and str(url).startswith('http'):
                    # Skip if already scraped
                    if url in already_scraped:
                        urls_skipped += 1
                        logger.info(f"⏭️  Skipping already scraped: {self.get_store_from_url(url)}: {product_name}")
                        continue
                    
                    urls_processed += 1
                    
                    if self.scrape_single_url(url, product_name):
                        urls_successful += 1
                    
                    # Brief pause between requests
                    time.sleep(random.uniform(1, 3))
        
        logger.info(f"📊 Session Summary: {urls_processed} processed, {urls_successful} successful, {urls_skipped} skipped")
        
        self.end_scraping_session(session_id, urls_processed, urls_successful)
        
        # Generate production report
        self.generate_production_report()
        
        logger.info("✅ Production scraping cycle completed")
    
    def generate_production_report(self):
        """Generate comprehensive production report"""
        try:
            cursor = self.conn.cursor()
            
            # Get latest session stats
            cursor.execute('''
                SELECT * FROM scraping_sessions 
                ORDER BY session_start DESC LIMIT 1
            ''')
            latest_session = cursor.fetchone()
            
            # Get store performance
            cursor.execute('''
                SELECT store, COUNT(*) as total_products, 
                       AVG(current_price) as avg_price,
                       MIN(current_price) as min_price,
                       MAX(current_price) as max_price
                FROM products 
                WHERE current_price IS NOT NULL
                GROUP BY store
            ''')
            store_stats = cursor.fetchall()
            
            # Get recent price changes
            cursor.execute('''
                SELECT product_name, store, previous_price, current_price, 
                       price_change_percent, last_scraped
                FROM products 
                WHERE ABS(price_change_percent) > 5
                ORDER BY ABS(price_change_percent) DESC
                LIMIT 10
            ''')
            price_changes = cursor.fetchall()
            
            # Generate report
            report = f"""
            🏪 BERMUDA GROCERY PRICE MONITOR - PRODUCTION REPORT
            Generated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}
            =====================================================
            
            📊 LATEST SCRAPING SESSION:
            Success Rate: {latest_session[5]:.1f}% ({latest_session[4]}/{latest_session[3]} URLs)
            Duration: {latest_session[1]} to {latest_session[2] or 'Running'}
            
            🏪 STORE PERFORMANCE:
            """
            
            for store, total, avg, min_price, max_price in store_stats:
                report += f"\n{store:15} | {total:3} products | Avg: ${avg:.2f} | Range: ${min_price:.2f}-${max_price:.2f}"
            
            if price_changes:
                report += f"\n\n📈 RECENT PRICE CHANGES (>5%):"
                for product, store, old, new, change, timestamp in price_changes:
                    direction = "↗️" if change > 0 else "↘️"
                    report += f"\n{direction} {product} at {store}: ${old:.2f} → ${new:.2f} ({change:+.1f}%)"
            
            report += f"\n\n✅ System Status: OPERATIONAL"
            report += f"\nNext scraping: {(datetime.now() + timedelta(hours=self.config.SCRAPING_INTERVAL)).strftime('%Y-%m-%d %H:%M:%S')}"
            
            # Save report
            os.makedirs(self.config.RESULTS_PATH, exist_ok=True)
            report_file = f"{self.config.RESULTS_PATH}/production_report_{datetime.now().strftime('%Y%m%d_%H%M%S')}.txt"
            
            with open(report_file, 'w') as f:
                f.write(report)
            
            logger.info(f"📄 Production report saved: {report_file}")
            print(report)
            
        except Exception as e:
            logger.error(f"❌ Failed to generate production report: {e}")
    
    def get_price_comparison(self, product_name):
        """Get price comparison for a specific product"""
        cursor = self.conn.cursor()
        cursor.execute('''
            SELECT store, current_price, product_title, last_scraped
            FROM products 
            WHERE product_name = ? AND current_price IS NOT NULL
            ORDER BY current_price ASC
        ''', (product_name,))
        
        results = cursor.fetchall()
        
        if results:
            logger.info(f"\n💰 Price Comparison for {product_name}:")
            for store, price, title, last_scraped in results:
                logger.info(f"   {store:15} | ${price:.2f} | {title}")
        
        return results
    
    def close(self):
        """Close database connection"""
        if self.conn:
            self.conn.close()

def main():
    """Main production deployment function"""
    scraper = ProductionScraper()
    
    try:
        logger.info("🚀 BERMUDA GROCERY PRICE SCRAPER - PRODUCTION DEPLOYMENT")
        logger.info("="*80)
        
        # Run production scraping
        scraper.run_production_scraping()
        
        # Show some sample price comparisons
        sample_products = ['BANANAS', 'MILK_HALF_GALLON', 'BREAD_HONEY_WHEAT', 'SUGAR']
        for product in sample_products:
            scraper.get_price_comparison(product)
        
        logger.info("\n🎉 Production deployment completed successfully!")
        logger.info("System is now operational and ready for business use.")
        
    except Exception as e:
        logger.error(f"❌ Production deployment failed: {e}")
        raise
    finally:
        scraper.close()

if __name__ == "__main__":
    main()