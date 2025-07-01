#!/usr/bin/env python3
"""
Robust persistence test - browser stays open with long delays
"""

import time
import re
from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.chrome.service import Service
from webdriver_manager.chrome import ChromeDriverManager

def robust_persistence_test():
    print("🧪 Robust Persistence Test")
    print("=" * 35)
    print("This test will keep Chrome open for 5+ minutes")
    print("You'll have plenty of time for manual setup")
    
    try:
        options = Options()
        options.add_argument("--no-sandbox")
        options.add_argument("--disable-dev-shm-usage")
        
        service = Service(ChromeDriverManager().install())
        driver = webdriver.Chrome(service=service, options=options)
        
        print("\n✅ Chrome opened - STAYING OPEN")
        
        # Product 1: BANANAS
        print("\n📦 Product 1: BANANAS")
        driver.get("https://www.marketplace.bm/shop/produce/tropical/yellow_bananas/p/12413")
        print("🔗 Navigated to BANANAS")
        
        print("\n🔧 MANUAL SETUP INSTRUCTIONS:")
        print("1. Login to MarketPlace if needed")
        print("2. Select Hamilton store if needed") 
        print("3. Click 'Show Price' if needed")
        print("4. Verify you can see the price")
        
        # Wait 3 minutes for manual setup
        print("\n⏰ You have 3 FULL MINUTES for setup...")
        for i in range(180, 0, -10):
            print(f"   {i} seconds remaining...")
            time.sleep(10)
        
        print("\n✅ Setup time complete!")
        
        # Product 2: AVOCADO (same browser session)
        print("\n📦 Product 2: AVOCADO HASS")
        print("🤞 Testing if login/store settings are remembered...")
        driver.get("https://www.marketplace.bm/shop/produce/tropical_fruit/green_avocados_large/p/78563")
        print("🔗 Navigated to AVOCADO")
        
        # Check for login persistence
        time.sleep(5)
        page_source = driver.page_source.lower()
        
        if "sign in" in page_source or "login" in page_source:
            print("❌ LOGIN LOST - Not persistent")
            login_persistent = False
        else:
            print("✅ LOGIN REMEMBERED - Persistent!")
            login_persistent = True
        
        if "hamilton" in page_source:
            print("✅ HAMILTON STORE REMEMBERED - Persistent!")
            store_persistent = True
        else:
            print("⚠️ Hamilton store not clearly detected")
            store_persistent = False
        
        # Wait for page content
        print("\n⏳ Loading AVOCADO content...")
        time.sleep(20)
        
        # Try to find price
        price_found = None
        try:
            elements = driver.execute_script("""
                return Array.from(document.querySelectorAll('[class*="price"]'))
                    .filter(el => el.offsetParent !== null)
                    .map(el => el.textContent.trim());
            """)
            
            for text in elements:
                if text:
                    price_match = re.search(r'\$\s*(\d+\.?\d*)', str(text))
                    if price_match:
                        price = float(price_match.group(1))
                        if 0.01 <= price <= 1000:
                            price_found = price
                            break
        except:
            pass
        
        if price_found:
            print(f"✅ AVOCADO PRICE FOUND: ${price_found}")
            price_accessible = True
        else:
            print("❌ AVOCADO PRICE NOT FOUND")
            price_accessible = False
        
        # Results
        print("\n" + "=" * 35)
        print("📊 PERSISTENCE TEST RESULTS:")
        print(f"   Login persistent: {'✅ YES' if login_persistent else '❌ NO'}")
        print(f"   Store persistent: {'✅ YES' if store_persistent else '❌ NO'}")
        print(f"   Price accessible: {'✅ YES' if price_accessible else '❌ NO'}")
        
        if login_persistent and store_persistent and price_accessible:
            print("\n🎉 FULL SUCCESS!")
            print("✅ Chrome remembers everything between products")
            print("🚀 READY FOR OVERNIGHT MONITORING!")
            success = True
        elif login_persistent and store_persistent:
            print("\n🎯 PARTIAL SUCCESS!")
            print("✅ Login and store settings are persistent")
            print("⚠️ May need price extraction refinement")
            success = True
        else:
            print("\n⚠️ PERSISTENCE ISSUES")
            print("❌ Settings not fully persistent")
            success = False
        
        # Keep browser open for 2 more minutes for review
        print(f"\n👀 Browser staying open for 2 more minutes...")
        print("   Use this time to manually verify results")
        for i in range(120, 0, -15):
            print(f"   {i} seconds remaining...")
            time.sleep(15)
        
        return success
        
    except Exception as e:
        print(f"💥 Error: {e}")
        return False
    
    finally:
        try:
            driver.quit()
            print("\n🔒 Browser closed")
        except:
            pass

if __name__ == "__main__":
    print("🚀 Starting robust persistence test...")
    success = robust_persistence_test()
    
    if success:
        print("\n🎯 PERSISTENCE CONFIRMED!")
        print("Ready to modify main system for persistent Chrome approach.")
    else:
        print("\n🔧 PERSISTENCE ISSUES DETECTED")
        print("May need alternative approach for MarketPlace automation.")