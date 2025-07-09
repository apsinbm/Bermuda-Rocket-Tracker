#!/usr/bin/env python3
"""
Test the fixed production scraper
"""
import pandas as pd
import google.generativeai as genai
from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.support.ui import WebDriverWait
import ssl
import urllib3

# SSL bypass
ssl._create_default_https_context = ssl._create_unverified_context
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

# Configure Gemini
genai.configure(api_key="AIzaSyDWeTTxWR4lHD7IVV30q__5EWaQa1FcCCo")

def test_scraper():
    """Test single URL scraping"""
    print("🧪 Testing fixed scraper...")
    
    # Setup Chrome driver
    options = Options()
    options.add_argument("--headless")
    options.add_argument("--no-sandbox")
    options.add_argument("--disable-dev-shm-usage")
    
    try:
        driver = webdriver.Chrome(options=options)
        print("✅ Chrome driver created successfully")
        
        # Test URL
        test_url = "https://www.dropit.bm/product/bananas"
        driver.get(test_url)
        
        # Get page source
        page_source = driver.page_source
        print(f"✅ Page loaded successfully: {len(page_source)} characters")
        
        # Test Gemini AI extraction
        model = genai.GenerativeModel('gemini-2.0-flash-exp')
        prompt = f"""
        Extract product information from this grocery store HTML:
        {page_source[:5000]}
        
        Return JSON with:
        - name: product name
        - price: price as number
        - sku: product SKU/ID
        """
        
        response = model.generate_content(prompt)
        print(f"✅ Gemini response: {response.text[:200]}...")
        
        driver.quit()
        print("✅ Test completed successfully!")
        return True
        
    except Exception as e:
        print(f"❌ Test failed: {e}")
        if 'driver' in locals():
            driver.quit()
        return False

if __name__ == "__main__":
    success = test_scraper()
    if success:
        print("\n🎉 Scraper is working! Ready to process remaining URLs.")
    else:
        print("\n❌ Scraper needs more fixes.")