#!/usr/bin/env python3
"""
Debug Pronto price extraction to see what elements are being found
"""

import time
from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.common.by import By
from webdriver_manager.chrome import ChromeDriverManager
import re

def debug_pronto_prices():
    """Debug price extraction on Pronto strawberry page"""
    print("🔍 Debug Pronto Price Extraction")
    print("=" * 40)
    
    try:
        options = Options()
        options.add_argument("--no-sandbox")
        options.add_argument("--disable-dev-shm-usage")
        
        service = Service(ChromeDriverManager().install())
        driver = webdriver.Chrome(service=service, options=options)
        
        print("✅ Chrome opened")
        print("🔗 Going to Pronto strawberries...")
        
        driver.get("https://pronto.bm/product/strawberries-driscolls-16-oz")
        time.sleep(10)
        
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
        
        # Look for percentage off indicators
        percentage_elements = driver.execute_script("""
            var elements = Array.from(document.querySelectorAll('*'));
            return elements.filter(el => {
                var text = el.textContent.toLowerCase();
                return text.includes('% off') || text.includes('%off') || text.includes('off');
            }).map(el => ({
                text: el.textContent.trim(),
                tag: el.tagName,
                className: el.className
            }));
        """)
        
        print(f"\n💥 PERCENTAGE OFF ELEMENTS:")
        print(f"Found {len(percentage_elements)} elements with percentage indicators:")
        for i, elem in enumerate(percentage_elements, 1):
            print(f"   {i}. {elem['tag']}: '{elem['text']}'")
        
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
        
        input("\nPress Enter to close browser...")
        
    except Exception as e:
        print(f"Error: {e}")
    finally:
        try:
            driver.quit()
        except:
            pass

if __name__ == "__main__":
    debug_pronto_prices()