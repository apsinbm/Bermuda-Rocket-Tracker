#!/usr/bin/env python3
"""
Debug MarketPlace price extraction to see what's being detected
"""

import time
from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.common.by import By
from webdriver_manager.chrome import ChromeDriverManager
import re

def debug_marketplace_prices():
    """Debug price extraction on MarketPlace apple page"""
    print("🔍 Debug MarketPlace Price Extraction")
    print("=" * 45)
    
    try:
        options = Options()
        options.add_argument("--no-sandbox")
        options.add_argument("--disable-dev-shm-usage")
        
        service = Service(ChromeDriverManager().install())
        driver = webdriver.Chrome(service=service, options=options)
        
        print("✅ Chrome opened")
        print("🔗 Going to MarketPlace Stemilt Apples...")
        
        driver.get("https://www.marketplace.bm/shop/produce/apples/stemilt_apples_fuji_1_36_kg/p/2450257")
        time.sleep(15)  # Wait for page load and login if needed
        
        print("\n📊 DEBUGGING PRICE ELEMENTS:")
        
        # Look for all elements containing dollar signs
        price_elements = driver.execute_script("""
            var elements = Array.from(document.querySelectorAll('*'));
            return elements.filter(el => {
                var text = el.textContent;
                return text.includes('$') && el.offsetParent !== null && text.trim().length < 100;
            }).map(el => ({
                text: el.textContent.trim(),
                tag: el.tagName,
                className: el.className,
                style: el.getAttribute('style') || '',
                id: el.id
            }));
        """)
        
        print(f"Found {len(price_elements)} elements with $ signs:")
        for i, elem in enumerate(price_elements, 1):
            print(f"\n   {i}. {elem['tag']} element:")
            print(f"      Text: '{elem['text']}'")
            print(f"      Class: '{elem['className']}'")
            print(f"      Style: '{elem['style']}'")
            if elem['id']:
                print(f"      ID: '{elem['id']}'")
        
        # Look specifically for strikethrough elements
        strikethrough_elements = driver.execute_script("""
            var elements = Array.from(document.querySelectorAll('*'));
            return elements.filter(el => {
                var style = window.getComputedStyle(el);
                var text = el.textContent;
                return (style.textDecoration.includes('line-through') || 
                       el.tagName === 'DEL' || el.tagName === 'S') && 
                       text.includes('$') && el.offsetParent !== null;
            }).map(el => ({
                text: el.textContent.trim(),
                tag: el.tagName,
                className: el.className,
                computedStyle: window.getComputedStyle(el).textDecoration
            }));
        """)
        
        print(f"\n🚫 STRIKETHROUGH ELEMENTS:")
        print(f"Found {len(strikethrough_elements)} strikethrough elements with $ signs:")
        for i, elem in enumerate(strikethrough_elements, 1):
            print(f"   {i}. {elem['tag']}: '{elem['text']}' (decoration: {elem['computedStyle']})")
        
        # Extract all prices using regex patterns
        all_text = driver.execute_script("return document.body.textContent;")
        price_patterns = [
            r'\$\s*(\d+\.?\d*)',  # Standard $X.XX
            r'(\d+\.?\d*)\s*\$',  # X.XX$
        ]
        
        all_prices = []
        for pattern in price_patterns:
            matches = re.findall(pattern, all_text)
            for match in matches:
                try:
                    price = float(match)
                    if 0.01 <= price <= 1000:
                        all_prices.append(price)
                except ValueError:
                    continue
        
        print(f"\n💰 ALL PRICES FOUND IN PAGE TEXT:")
        unique_prices = sorted(list(set(all_prices)))
        for price in unique_prices:
            print(f"   ${price}")
        
        print(f"\n🎯 EXPECTED TO FIND:")
        print(f"   Sale Price: $8.99")
        print(f"   Regular Price: $10.99 (crossed out)")
        print(f"   Should NOT find: $1.89 or anything related to 1.36 KG")
        
        # Check page content for debugging
        print("\n🔍 PAGE DEBUG INFO:")
        try:
            page_text = driver.page_source[:2000]  # First 2000 chars
            print(f"   Page title: {driver.title}")
            print(f"   Current URL: {driver.current_url}")
            if "login" in page_text.lower():
                print("   ⚠️  Login required")
            if "hamilton" in page_text.lower():
                print("   ✅ Hamilton store mention found")
            if "out of stock" in page_text.lower():
                print("   ⚠️  Out of stock mention found")
            if "8.99" in page_text:
                print("   ✅ 8.99 found in page")
            if "10.99" in page_text:
                print("   ✅ 10.99 found in page")
            print(f"   Page contains 'price': {'price' in page_text.lower()}")
            print(f"   Page length: {len(driver.page_source)} characters")
        except Exception as e:
            print(f"   Error checking page: {e}")
        
        input("\nPress Enter to close browser...")
        
    except Exception as e:
        print(f"Error: {e}")
    finally:
        try:
            driver.quit()
        except:
            pass

if __name__ == "__main__":
    debug_marketplace_prices()