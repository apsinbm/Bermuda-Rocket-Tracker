#!/usr/bin/env python3
"""
Diagnose scraping issues - test API key, page loading, and extraction
"""
import pandas as pd
import google.generativeai as genai
from selenium import webdriver
from selenium.webdriver.chrome.options import Options
import time
import ssl
import urllib3
import json
import re

# SSL bypass
ssl._create_default_https_context = ssl._create_unverified_context
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

def test_api_key():
    """Test if Gemini API key is working"""
    try:
        genai.configure(api_key="AIzaSyDWeTTxWR4lHD7IVV30q__5EWaQa1FcCCo")
        model = genai.GenerativeModel('gemini-2.0-flash-exp')
        
        # Simple test
        response = model.generate_content("What is 2+2?")
        if response and response.text:
            print("✅ API Key Working - Response:", response.text[:100])
            return True
        else:
            print("❌ API Key Problem - No response")
            return False
    except Exception as e:
        print(f"❌ API Key Error: {e}")
        return False

def test_page_loading():
    """Test if pages are loading correctly"""
    test_urls = [
        "https://www.dropit.bm/shop/pantry/condiments_sauces_marinades/condiments/mayonnaise/hellmann_s_real_mayonnaise_30_fl_oz/p/32968",
        "https://pronto.bm/product/hellmanns-real-mayonnaise-30-oz",
        "https://shop.miles.bm/shop/pantry/condiments_sauces_marinades/condiments/mayonnaise/hellmann_s_real_mayonnaise_30_fl_oz/p/32968",
        "https://www.harringtonhundreds.bm/shop/grocery/mayonnaise_miracle_whip/hellmann_s_real_mayonnaise_30_fl_oz/p/32968"
    ]
    
    options = Options()
    options.add_argument("--headless")
    options.add_argument("--no-sandbox")
    options.add_argument("--disable-dev-shm-usage")
    
    driver = webdriver.Chrome(options=options)
    results = []
    
    for url in test_urls:
        try:
            store = "Drop It" if "dropit" in url else "Pronto" if "pronto" in url else "Miles" if "miles" in url else "HH"
            print(f"Testing {store}: {url}")
            
            driver.get(url)
            time.sleep(3)
            
            page_source = driver.page_source
            
            # Check various indicators
            has_price_symbol = "$" in page_source
            has_price_pattern = bool(re.search(r'\$\d+\.\d+', page_source))
            page_length = len(page_source)
            has_product_info = "mayonnaise" in page_source.lower()
            
            print(f"  Page length: {page_length}")
            print(f"  Has $ symbol: {has_price_symbol}")
            print(f"  Has price pattern: {has_price_pattern}")
            print(f"  Has product info: {has_product_info}")
            
            # Look for specific price patterns
            price_matches = re.findall(r'\$\d+\.\d+', page_source)
            if price_matches:
                print(f"  Found prices: {price_matches[:5]}")
            
            results.append({
                'store': store,
                'url': url,
                'page_length': page_length,
                'has_price_symbol': has_price_symbol,
                'has_price_pattern': has_price_pattern,
                'has_product_info': has_product_info,
                'price_matches': price_matches[:5] if price_matches else []
            })
            
        except Exception as e:
            print(f"❌ Error loading {url}: {e}")
            results.append({
                'store': store,
                'url': url,
                'page_length': 0,
                'has_price_symbol': False,
                'has_price_pattern': False,
                'has_product_info': False,
                'price_matches': [],
                'error': str(e)
            })
    
    driver.quit()
    return results

def test_ai_extraction(page_results):
    """Test AI extraction on loaded pages"""
    if not page_results:
        return
        
    model = genai.GenerativeModel('gemini-2.0-flash-exp')
    
    # Test different prompts
    prompts = [
        # Original prompt
        """Extract product information from this HTML content in JSON format:
        {
            "name": "product name",
            "sku": "product SKU/barcode", 
            "price": "price as number only (no $ symbol)"
        }
        
        Rules:
        - If a field is not found, use null
        - For price, return ONLY the numeric value (e.g., 9.49, not $9.49)
        - Be precise with product names
        - Look for SKU, UPC, barcode, or product code""",
        
        # Simplified prompt
        """Find the price of this product. Return just the number (like 9.99):""",
        
        # Very simple prompt
        """What is the price? Return only the number:"""
    ]
    
    # Get a sample page
    sample_result = next((r for r in page_results if r['has_price_pattern']), None)
    if not sample_result:
        print("❌ No pages with price patterns found for AI testing")
        return
    
    # Load the page again to get content
    options = Options()
    options.add_argument("--headless")
    options.add_argument("--no-sandbox")
    options.add_argument("--disable-dev-shm-usage")
    
    driver = webdriver.Chrome(options=options)
    
    try:
        driver.get(sample_result['url'])
        time.sleep(3)
        page_source = driver.page_source
        
        print(f"\\n🧪 Testing AI extraction on {sample_result['store']} page...")
        
        for i, prompt in enumerate(prompts, 1):
            try:
                print(f"\\nPrompt {i}: {prompt[:50]}...")
                
                full_prompt = f"{prompt}\\n\\nHTML Content:\\n{page_source[:8000]}"
                response = model.generate_content(full_prompt)
                
                if response and response.text:
                    print(f"Response: {response.text[:200]}")
                    
                    # Try to find JSON in response
                    json_match = re.search(r'\\{.*\\}', response.text, re.DOTALL)
                    if json_match:
                        try:
                            data = json.loads(json_match.group())
                            print(f"✅ Successfully parsed JSON: {data}")
                        except json.JSONDecodeError:
                            print("❌ JSON parsing failed")
                    
                    # Try to find price number
                    price_match = re.search(r'\\b\\d+\\.\\d+\\b', response.text)
                    if price_match:
                        print(f"✅ Found price number: {price_match.group()}")
                    
                else:
                    print("❌ No response from AI")
                    
            except Exception as e:
                print(f"❌ Error with prompt {i}: {e}")
    
    finally:
        driver.quit()

def main():
    """Run all diagnostic tests"""
    print("🔍 SCRAPING DIAGNOSTIC TESTS")
    print("=" * 50)
    
    # Test 1: API Key
    print("\\n1. Testing API Key...")
    api_working = test_api_key()
    
    # Test 2: Page Loading
    print("\\n2. Testing Page Loading...")
    page_results = test_page_loading()
    
    # Test 3: AI Extraction
    if api_working and page_results:
        print("\\n3. Testing AI Extraction...")
        test_ai_extraction(page_results)
    
    # Summary
    print("\\n📊 DIAGNOSTIC SUMMARY")
    print("=" * 50)
    print(f"API Key Working: {'✅' if api_working else '❌'}")
    
    if page_results:
        working_pages = len([r for r in page_results if r['has_price_pattern']])
        print(f"Pages Loading: {len(page_results)}")
        print(f"Pages with Prices: {working_pages}")
        
        for result in page_results:
            status = "✅" if result['has_price_pattern'] else "❌"
            print(f"  {status} {result['store']}: {result['has_price_pattern']} price pattern")
    
    print("\\n🎯 NEXT STEPS:")
    if not api_working:
        print("- Fix API key issue")
    elif not page_results or not any(r['has_price_pattern'] for r in page_results):
        print("- Investigate page loading/parsing issues")
    else:
        print("- Fix AI extraction prompts")
        print("- Consider alternative extraction methods")

if __name__ == "__main__":
    main()