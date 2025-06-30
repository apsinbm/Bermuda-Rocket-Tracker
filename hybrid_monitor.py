#!/usr/bin/env python3
"""
Hybrid E-commerce Monitor
Uses web scraping with 20-second delays for Freshop stores (MP, HH, Miles, Drop It)
Uses API for Pronto store
Includes OCR fallback capability
"""

import pandas as pd
import time
import logging
import random
import re
from datetime import datetime
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.common.action_chains import ActionChains
from selenium.webdriver.chrome.options import Options
from selenium.common.exceptions import TimeoutException, NoSuchElementException
from selenium.webdriver.chrome.service import Service
from webdriver_manager.chrome import ChromeDriverManager
import undetected_chromedriver as uc
from openpyxl import Workbook
from openpyxl.styles import PatternFill, Font, Alignment
import sys
import os
from api_integrations import EddressAPI
import easyocr
import cv2
import numpy as np
from PIL import Image
import io

class HybridEcommerceMonitor:
    def __init__(self, input_file, output_file="Hybrid_Monitor_Results.xlsx"):
        self.input_file = input_file
        self.output_file = output_file
        self.results = []
        
        # Setup logging
        logging.basicConfig(
            level=logging.INFO,
            format='%(asctime)s - %(levelname)s - %(message)s',
            handlers=[
                logging.FileHandler('hybrid_monitor.log'),
                logging.StreamHandler()
            ]
        )
        self.logger = logging.getLogger(__name__)
        
        # Initialize Pronto API
        self.pronto_api = EddressAPI()
        
        # Initialize OCR reader
        try:
            self.ocr_reader = easyocr.Reader(['en'])
            self.ocr_available = True
            self.logger.info("OCR system initialized successfully")
        except Exception as e:
            self.logger.warning(f"OCR initialization failed: {e}")
            self.ocr_available = False
        
        # Chrome options for stealth browsing
        self.viewport_sizes = [
            (1920, 1080), (1366, 768), (1536, 864),
            (1440, 900), (1280, 720), (1600, 900)
        ]
        
        self.user_agents = [
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36",
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36",
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Safari/605.1.15",
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/119.0",
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/118.0.0.0 Safari/537.36",
            "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36",
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Edge/119.0.0.0"
        ]
        
        self.performance_stats = {
            'total_requests': 0,
            'successful_scrapes': 0,
            'successful_apis': 0,
            'successful_ocr': 0,
            'failed_requests': 0
        }
    
    def create_driver(self):
        """Create a stealth Chrome driver with random configurations"""
        try:
            # Random configurations
            width, height = random.choice(self.viewport_sizes)
            user_agent = random.choice(self.user_agents)
            
            # Chrome options
            options = Options()
            options.add_argument(f'--user-agent={user_agent}')
            options.add_argument(f'--window-size={width},{height}')
            options.add_argument('--disable-web-security')
            options.add_argument('--disable-features=VizDisplayCompositor')
            options.add_argument('--disable-extensions')
            options.add_argument('--no-sandbox')
            options.add_argument('--disable-dev-shm-usage')
            options.add_experimental_option("excludeSwitches", ["enable-automation"])
            options.add_experimental_option('useAutomationExtension', False)
            
            # Try undetected Chrome first
            try:
                driver = uc.Chrome(options=options, version_main=None)
                self.logger.info("Created undetected Chrome driver")
            except Exception as e:
                self.logger.warning(f"Undetected Chrome failed: {e}, using webdriver-manager Chrome")
                service = Service(ChromeDriverManager().install())
                driver = webdriver.Chrome(service=service, options=options)
            
            # Remove webdriver property
            driver.execute_script("Object.defineProperty(navigator, 'webdriver', {get: () => undefined})")
            
            return driver
            
        except Exception as e:
            self.logger.error(f"Failed to create driver: {e}")
            return None
    
    def random_mouse_movement(self, driver):
        """Simulate random mouse movements"""
        try:
            actions = ActionChains(driver)
            
            # Get viewport size
            viewport_width = driver.execute_script("return window.innerWidth")
            viewport_height = driver.execute_script("return window.innerHeight")
            
            # Random mouse movements
            for _ in range(random.randint(2, 5)):
                x = random.randint(0, viewport_width)
                y = random.randint(0, viewport_height)
                actions.move_by_offset(x, y)
                time.sleep(random.uniform(0.1, 0.3))
            
            actions.perform()
            
        except Exception as e:
            self.logger.debug(f"Mouse movement failed: {e}")
    
    def random_scroll(self, driver):
        """Simulate random scrolling"""
        try:
            # Random scroll
            scroll_amount = random.randint(300, 800)
            if random.choice([True, False]):
                scroll_amount = -scroll_amount
            
            driver.execute_script(f"window.scrollBy(0, {scroll_amount});")
            time.sleep(random.uniform(0.5, 1.5))
            
        except Exception as e:
            self.logger.debug(f"Scrolling failed: {e}")
    
    def handle_store_selection(self, driver, store_type):
        """Handle store selection for MarketPlace and Drop It"""
        try:
            if store_type == 'mp':  # MarketPlace
                # Look for store selection elements
                store_selectors = [
                    "button:contains('Hamilton')",
                    "div:contains('The MarketPlace Hamilton')",
                    "div:contains('42 Church Street')",
                    "*[data-store*='hamilton']",
                    "*[class*='store-selector']",
                    "*[class*='location']",
                    ".store-location",
                    "#store-selector"
                ]
                
                for selector in store_selectors:
                    try:
                        if 'contains' in selector:
                            # Use JavaScript for text-based selection
                            element = driver.execute_script(f"""
                                var elements = Array.from(document.querySelectorAll('*'));
                                return elements.find(el => 
                                    el.textContent.includes('Hamilton') || 
                                    el.textContent.includes('42 Church Street') ||
                                    el.textContent.includes('The MarketPlace Hamilton')
                                );
                            """)
                            if element:
                                driver.execute_script("arguments[0].click();", element)
                                self.logger.info("Selected MarketPlace Hamilton store")
                                time.sleep(2)
                                break
                        else:
                            element = driver.find_element(By.CSS_SELECTOR, selector)
                            element.click()
                            self.logger.info("Selected MarketPlace Hamilton store")
                            time.sleep(2)
                            break
                    except:
                        continue
                        
            elif store_type == 'dropit':  # Drop It
                # Look for store selection elements
                store_selectors = [
                    "button:contains('Warwick')",
                    "div:contains('Warwick')",
                    "*[data-store*='warwick']",
                    "*[class*='store-selector']",
                    "*[class*='location']",
                    ".store-location",
                    "#store-selector"
                ]
                
                for selector in store_selectors:
                    try:
                        if 'contains' in selector:
                            # Use JavaScript for text-based selection
                            element = driver.execute_script(f"""
                                var elements = Array.from(document.querySelectorAll('*'));
                                return elements.find(el => 
                                    el.textContent.includes('Warwick')
                                );
                            """)
                            if element:
                                driver.execute_script("arguments[0].click();", element)
                                self.logger.info("Selected Drop It Warwick store")
                                time.sleep(2)
                                break
                        else:
                            element = driver.find_element(By.CSS_SELECTOR, selector)
                            element.click()
                            self.logger.info("Selected Drop It Warwick store")
                            time.sleep(2)
                            break
                    except:
                        continue
                        
        except Exception as e:
            self.logger.debug(f"Store selection handling failed for {store_type}: {e}")
    
    def extract_price_with_ocr(self, driver):
        """Extract price using OCR from screenshot"""
        if not self.ocr_available:
            return None
        
        try:
            # Take screenshot
            screenshot = driver.get_screenshot_as_png()
            image = Image.open(io.BytesIO(screenshot))
            
            # Convert to numpy array for OpenCV
            opencv_image = cv2.cvtColor(np.array(image), cv2.COLOR_RGB2BGR)
            
            # Extract text using OCR
            results = self.ocr_reader.readtext(opencv_image)
            
            # Look for price patterns
            price_patterns = [
                r'\$\s*(\d+\.?\d*)',  # $12.34 or $12
                r'(\d+\.?\d*)\s*\$',  # 12.34$ or 12$
                r'Price[:\s]*\$?\s*(\d+\.?\d*)',  # Price: $12.34
                r'USD[:\s]*\$?\s*(\d+\.?\d*)',    # USD: $12.34
            ]
            
            for detection in results:
                text = detection[1].strip()
                
                for pattern in price_patterns:
                    match = re.search(pattern, text, re.IGNORECASE)
                    if match:
                        try:
                            price = float(match.group(1))
                            if 0.01 <= price <= 1000:  # Reasonable price range
                                self.logger.info(f"OCR found price: ${price}")
                                return price
                        except ValueError:
                            continue
            
            return None
            
        except Exception as e:
            self.logger.error(f"OCR extraction failed: {e}")
            return None
    
    def scrape_freshop_store(self, url, store_type, product_name):
        """Scrape Freshop stores with 20-second delays and OCR fallback"""
        driver = None
        try:
            driver = self.create_driver()
            if not driver:
                return {'error': 'Failed to create driver', 'method': 'scraping'}
            
            self.logger.info(f"🔍 Scraping {store_type.upper()}: {product_name}")
            
            # Navigate to URL
            driver.get(url)
            
            # Wait and simulate human behavior
            time.sleep(random.uniform(3, 5))
            self.random_mouse_movement(driver)
            time.sleep(random.uniform(2, 3))
            self.random_scroll(driver)
            
            # Wait for page to fully load
            WebDriverWait(driver, 10).until(
                lambda d: d.execute_script("return document.readyState") == "complete"
            )
            
            # Handle store selection for MarketPlace and Drop It
            self.handle_store_selection(driver, store_type)
            
            # Long delay as requested (20 seconds)
            self.logger.info(f"Waiting 20 seconds for {store_type.upper()} dynamic content...")
            time.sleep(20)
            
            # Try multiple price selectors
            price_selectors = [
                # Common Freshop price selectors
                '.price',
                '.product-price',
                '.current-price',
                '.sale-price',
                '.unit-price',
                '[data-price]',
                '.price-value',
                '.price-amount',
                '.product-price-value',
                # Broader selectors
                '*[class*="price"]',
                '*[id*="price"]',
                'span:contains("$")',
                'div:contains("$")'
            ]
            
            price_found = None
            method_used = 'scraping'
            
            # Try CSS selectors first
            for selector in price_selectors:
                try:
                    if ':contains' in selector:
                        # Use JavaScript for :contains selector
                        elements = driver.execute_script(f"""
                            return Array.from(document.querySelectorAll('*')).filter(
                                el => el.textContent.includes('$') && 
                                      el.offsetParent !== null &&
                                      el.textContent.trim().length < 50
                            );
                        """)
                    else:
                        elements = driver.find_elements(By.CSS_SELECTOR, selector)
                    
                    for element in elements:
                        try:
                            text = element.text.strip() if hasattr(element, 'text') else element.get('textContent', '')
                            if not text and hasattr(element, 'get_attribute'):
                                text = element.get_attribute('data-price') or element.get_attribute('value') or ''
                            
                            # Extract price from text
                            price_match = re.search(r'\$\s*(\d+\.?\d*)', text)
                            if price_match:
                                price = float(price_match.group(1))
                                if 0.01 <= price <= 1000:  # Reasonable price range
                                    price_found = price
                                    self.logger.info(f"✓ Found price with selector {selector}: ${price}")
                                    break
                        except (ValueError, AttributeError, Exception):
                            continue
                    
                    if price_found:
                        break
                        
                except Exception as e:
                    self.logger.debug(f"Selector {selector} failed: {e}")
                    continue
            
            # If scraping failed, try OCR
            if not price_found and self.ocr_available:
                self.logger.info(f"Scraping failed for {store_type.upper()}, trying OCR...")
                price_found = self.extract_price_with_ocr(driver)
                if price_found:
                    method_used = 'ocr'
                    self.performance_stats['successful_ocr'] += 1
            
            if price_found:
                if method_used == 'scraping':
                    self.performance_stats['successful_scrapes'] += 1
                return {
                    'price_found': price_found,
                    'method': method_used,
                    'status': 'success'
                }
            else:
                self.logger.warning(f"❌ No price found for {store_type.upper()}: {product_name}")
                return {'error': 'No price found', 'method': 'scraping+ocr'}
                
        except Exception as e:
            self.logger.error(f"Error scraping {url}: {e}")
            return {'error': str(e), 'method': 'scraping'}
        
        finally:
            if driver:
                try:
                    driver.quit()
                except:
                    pass
    
    def get_pronto_data(self, url, product_name):
        """Get Pronto data using API (which works well)"""
        try:
            self.logger.info(f"🔗 API call for PRONTO: {product_name}")
            result = self.pronto_api.get_product_data(url)
            
            if result.get('price_found'):
                self.performance_stats['successful_apis'] += 1
                return {
                    'price_found': result['price_found'],
                    'method': 'api',
                    'status': 'success'
                }
            else:
                return {'error': result.get('error', 'No price found'), 'method': 'api'}
                
        except Exception as e:
            self.logger.error(f"Error with Pronto API for {url}: {e}")
            return {'error': str(e), 'method': 'api'}
    
    def process_single_url(self, url, store_type, product_info, product_name):
        """Process a single URL using appropriate method"""
        if not url or pd.isna(url):
            return {
                'upc_plu': product_info.get('UPC/PLU', ''),
                'brand': product_info.get('Brand', ''),
                'product_name': product_name,
                'url': None,
                'store_type': store_type,
                'status': 'skipped',
                'error': 'No URL provided',
                'price_found': None,
                'expected_price': product_info.get('Reg Retail'),
                'method': 'none'
            }
        
        start_time = time.time()
        self.performance_stats['total_requests'] += 1
        
        try:
            # Use API for Pronto, scraping for others
            if store_type == 'pronto':
                api_result = self.get_pronto_data(url, product_name)
            else:
                # Use scraping for Freshop stores
                api_result = self.scrape_freshop_store(url, store_type, product_name)
            
            response_time = time.time() - start_time
            
            # Build result
            result = {
                'upc_plu': product_info.get('UPC/PLU', ''),
                'brand': product_info.get('Brand', ''),
                'product_name': product_name,
                'url': url,
                'store_type': store_type,
                'response_time': response_time,
                'scraped_at': datetime.now().isoformat(),
                'expected_price': product_info.get('Reg Retail'),
                'method': api_result.get('method', 'unknown')
            }
            
            if 'error' in api_result:
                result.update({
                    'status': 'failed',
                    'error': api_result['error'],
                    'price_found': None,
                    'price_match': False
                })
                self.performance_stats['failed_requests'] += 1
            else:
                result.update({
                    'status': 'success',
                    'price_found': api_result.get('price_found'),
                    'error': None
                })
                
                # Calculate price match
                expected_price = result['expected_price']
                found_price = result['price_found']
                
                if found_price and expected_price and isinstance(expected_price, (int, float)):
                    tolerance = 0.05  # 5% tolerance
                    price_diff = abs(found_price - expected_price) / expected_price
                    result['price_match'] = price_diff <= tolerance
                    result['price_difference'] = found_price - expected_price
                else:
                    result['price_match'] = False
                    result['price_difference'] = None
            
            return result
            
        except Exception as e:
            response_time = time.time() - start_time
            self.logger.error(f"Error processing {url}: {e}")
            self.performance_stats['failed_requests'] += 1
            
            return {
                'upc_plu': product_info.get('UPC/PLU', ''),
                'brand': product_info.get('Brand', ''),
                'product_name': product_name,
                'url': url,
                'store_type': store_type,
                'status': 'error',
                'error': str(e),
                'price_found': None,
                'expected_price': product_info.get('Reg Retail'),
                'price_match': False,
                'response_time': response_time,
                'method': 'error',
                'scraped_at': datetime.now().isoformat()
            }
    
    def monitor_products(self):
        """Monitor all products in the Excel file"""
        try:
            df = pd.read_excel(self.input_file)
            self.logger.info(f"Loaded {len(df)} products from {self.input_file}")
            
            start_time = time.time()
            site_columns = ['MP', 'HH', 'Drop It', 'Miles', 'Pronto']
            
            for index, row in df.iterrows():
                product_info = row.to_dict()
                product_name = f"{product_info.get('Brand', '')} {product_info.get('Long Description', '')}".strip()
                
                self.logger.info(f"\n📦 Processing Product {index + 1}: {product_name}")
                
                for site_col in site_columns:
                    url = product_info.get(site_col)
                    store_type = site_col.lower().replace(' ', '').replace('dropit', 'dropit')
                    if store_type == 'dropit':
                        store_type = 'dropit'
                    
                    self.logger.info(f"  🏪 Store: {site_col}")
                    
                    result = self.process_single_url(url, store_type, product_info, product_name)
                    self.results.append(result)
                    
                    # Log result
                    if result['status'] == 'success':
                        method = result.get('method', 'unknown')
                        self.logger.info(f"    ✅ Success via {method}: ${result['price_found']}")
                    else:
                        self.logger.warning(f"    ❌ Failed: {result.get('error', 'Unknown error')}")
                    
                    # Small delay between stores
                    time.sleep(random.uniform(1, 3))
            
            total_time = time.time() - start_time
            self.logger.info(f"\n📊 Monitoring completed in {total_time:.2f} seconds")
            
        except Exception as e:
            self.logger.error(f"Error in monitoring: {e}")
            raise
    
    def generate_report(self):
        """Generate Excel report"""
        wb = Workbook()
        ws = wb.active
        ws.title = "Hybrid Monitor Report"
        
        # Styles
        header_fill = PatternFill(start_color="366092", end_color="366092", fill_type="solid")
        header_font = Font(color="FFFFFF", bold=True)
        success_fill = PatternFill(start_color="C6EFCE", end_color="C6EFCE", fill_type="solid")
        error_fill = PatternFill(start_color="FFC7CE", end_color="FFC7CE", fill_type="solid")
        
        # Headers in exact requested order
        headers = [
            "upc_plu", "brand", "product_name", "store_type", "expected_price", 
            "price_found", "price_difference", "price_match", "method", 
            "status", "error", "response_time", "scraped_at", "url"
        ]
        
        for col, header in enumerate(headers, 1):
            cell = ws.cell(row=1, column=col, value=header)
            cell.fill = header_fill
            cell.font = header_font
            cell.alignment = Alignment(horizontal="center")
        
        # Data rows in exact requested order
        for row_idx, result in enumerate(self.results, 2):
            ws.cell(row=row_idx, column=1, value=result.get('upc_plu', ''))           # upc_plu
            ws.cell(row=row_idx, column=2, value=result.get('brand', ''))            # brand
            ws.cell(row=row_idx, column=3, value=result.get('product_name', ''))     # product_name
            ws.cell(row=row_idx, column=4, value=result.get('store_type', '').lower())  # store_type
            ws.cell(row=row_idx, column=5, value=result.get('expected_price', ''))   # expected_price
            ws.cell(row=row_idx, column=6, value=result.get('price_found', ''))      # price_found
            ws.cell(row=row_idx, column=7, value=result.get('price_difference', '')) # price_difference
            ws.cell(row=row_idx, column=8, value=result.get('price_match', ''))      # price_match
            ws.cell(row=row_idx, column=9, value=result.get('method', ''))           # method
            ws.cell(row=row_idx, column=10, value=result.get('status', ''))          # status
            ws.cell(row=row_idx, column=11, value=result.get('error', ''))           # error
            ws.cell(row=row_idx, column=12, value=f"{result.get('response_time', 0):.2f}s")  # response_time
            ws.cell(row=row_idx, column=13, value=result.get('scraped_at', ''))      # scraped_at
            ws.cell(row=row_idx, column=14, value=result.get('url', ''))             # url
            
            # Color coding
            if result.get('status') == 'success':
                for col in range(1, 15):  # Updated to 14 columns
                    ws.cell(row=row_idx, column=col).fill = success_fill
            else:
                for col in range(1, 15):  # Updated to 14 columns
                    ws.cell(row=row_idx, column=col).fill = error_fill
        
        # Auto-adjust column widths
        for col in ws.columns:
            max_length = 0
            column = col[0].column_letter
            for cell in col:
                try:
                    if len(str(cell.value)) > max_length:
                        max_length = len(str(cell.value))
                except:
                    pass
            adjusted_width = min(max_length + 2, 50)
            ws.column_dimensions[column].width = adjusted_width
        
        # Summary sheet
        summary_ws = wb.create_sheet("Summary")
        
        successful = len([r for r in self.results if r['status'] == 'success'])
        
        summary_data = [
            ["Hybrid Monitoring Summary", ""],
            ["Report Generated", datetime.now().isoformat()],
            ["", ""],
            ["Total Requests", self.performance_stats['total_requests']],
            ["Successful Results", successful],
            ["Success Rate", f"{(successful/len(self.results))*100:.1f}%" if self.results else "0%"],
            ["", ""],
            ["Method Breakdown", ""],
            ["Successful Scraping", self.performance_stats['successful_scrapes']],
            ["Successful API", self.performance_stats['successful_apis']],
            ["Successful OCR", self.performance_stats['successful_ocr']],
            ["Failed Requests", self.performance_stats['failed_requests']],
        ]
        
        for row_idx, (label, value) in enumerate(summary_data, 1):
            summary_ws.cell(row=row_idx, column=1, value=label).font = Font(bold=True)
            summary_ws.cell(row=row_idx, column=2, value=value)
        
        wb.save(self.output_file)
        self.logger.info(f"Report saved to {self.output_file}")
    
    def run(self):
        """Run the complete hybrid monitoring process"""
        self.logger.info("🚀 Starting Hybrid E-commerce Monitoring")
        self.logger.info("📝 Method: Web scraping (20s delays) for Freshop + API for Pronto + OCR fallback")
        
        self.monitor_products()
        self.generate_report()
        
        # Final stats
        successful = len([r for r in self.results if r['status'] == 'success'])
        total = len(self.results)
        
        self.logger.info(f"\n📊 FINAL RESULTS:")
        self.logger.info(f"   Total URLs: {total}")
        self.logger.info(f"   Successful: {successful}")
        self.logger.info(f"   Success Rate: {(successful/total)*100:.1f}%")
        self.logger.info(f"   Scraping: {self.performance_stats['successful_scrapes']}")
        self.logger.info(f"   API: {self.performance_stats['successful_apis']}")
        self.logger.info(f"   OCR: {self.performance_stats['successful_ocr']}")
        self.logger.info(f"   Failed: {self.performance_stats['failed_requests']}")

def main():
    input_file = "/Users/pato/Downloads/Download June_Top_100_with_URLs_Accurate.xlsx"
    output_file = "/Users/pato/Full_Monitoring_Results.xlsx"
    
    monitor = HybridEcommerceMonitor(input_file, output_file)
    monitor.run()

if __name__ == "__main__":
    main()