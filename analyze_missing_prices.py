#!/usr/bin/env python3
"""
Analyze which URLs and products failed to capture prices
"""

import re
import pandas as pd
from collections import defaultdict

def analyze_missing_prices():
    """Analyze log to find URLs without prices"""
    
    # Load dataset for product mapping
    df = pd.read_csv('complete_dataset.csv')
    url_to_product = {}
    
    for index, row in df.iterrows():
        product_name = f"{row['Brand']} {row['Long Description']}" if pd.notna(row['Brand']) else row['Long Description']
        expected_price = row['Reg Retail']
        
        for store_col in ['MP', 'Drop It', 'Miles', 'Pronto', 'HH']:
            url = row[store_col]
            if pd.notna(url) and url != 'N/A' and str(url).startswith('http'):
                url_to_product[url] = {
                    'product_name': product_name,
                    'store': store_col,
                    'expected_price': expected_price,
                    'upc_plu': row['UPC/PLU']
                }
    
    # Analyze log file
    try:
        with open('ai_scraper.log', 'r') as f:
            content = f.read()
    except:
        print("❌ Could not read ai_scraper.log")
        return
    
    # Process each URL section in the log
    log_sections = content.split('🔍 Processing URL')[1:]
    
    url_results = {}
    missing_prices = []
    complete_failures = []
    partial_successes = []
    
    for section in log_sections:
        if 'https://' in section:
            # Extract URL
            url_match = re.search(r'(https://[^\s]+)', section)
            if url_match:
                url = url_match.group(1)
                
                if '✅ Gemini extraction successful:' in section:
                    # Extract what data we got
                    name_match = re.search(r'Name: ([^\n]+)', section)
                    sku_match = re.search(r'SKU: ([^\n]+)', section)
                    price_match = re.search(r'Price: ([^\n]+)', section)
                    
                    name = name_match.group(1) if name_match else None
                    sku = sku_match.group(1) if sku_match else None
                    price = price_match.group(1) if price_match else None
                    
                    # Clean up None values
                    if name in ['None', 'null']:
                        name = None
                    if sku in ['None', 'null']:
                        sku = None
                    if price in ['None', 'null']:
                        price = None
                    
                    # Store the latest result for this URL
                    url_results[url] = {
                        'name': name,
                        'sku': sku,
                        'price': price,
                        'success': True
                    }
                else:
                    # Complete failure
                    url_results[url] = {
                        'name': None,
                        'sku': None,
                        'price': None,
                        'success': False
                    }
    
    # Categorize results
    for url, result in url_results.items():
        product_info = url_to_product.get(url, {})
        
        combined_info = {
            'url': url,
            'product_name': product_info.get('product_name', 'Unknown'),
            'store': product_info.get('store', 'Unknown'),
            'expected_price': product_info.get('expected_price', 'N/A'),
            'upc_plu': product_info.get('upc_plu', 'N/A'),
            'extracted_name': result['name'],
            'extracted_sku': result['sku'],
            'extracted_price': result['price'],
            'success': result['success']
        }
        
        if not result['success']:
            complete_failures.append(combined_info)
        elif not result['price']:
            missing_prices.append(combined_info)
        elif result['name'] or result['sku'] or result['price']:
            partial_successes.append(combined_info)
    
    # Print analysis
    print("🔍 PRICE EXTRACTION ANALYSIS")
    print("=" * 60)
    print(f"📊 Total URLs analyzed: {len(url_results)}")
    print(f"❌ Complete failures: {len(complete_failures)}")
    print(f"⚠️  Missing prices only: {len(missing_prices)}")
    print(f"✅ Some/all data extracted: {len(partial_successes)}")
    print()
    
    # Show missing prices by store
    if missing_prices:
        print("⚠️  URLS WITH MISSING PRICES:")
        print("=" * 60)
        
        store_missing = defaultdict(list)
        for item in missing_prices:
            store_missing[item['store']].append(item)
        
        for store, items in store_missing.items():
            print(f"\n🏪 {store} ({len(items)} missing prices):")
            for item in items:
                print(f"   📦 {item['product_name']}")
                print(f"      Expected: ${item['expected_price']}")
                print(f"      URL: {item['url']}")
                if item['extracted_name']:
                    print(f"      ✅ Got name: {item['extracted_name']}")
                if item['extracted_sku']:
                    print(f"      ✅ Got SKU: {item['extracted_sku']}")
                print()
    
    # Show complete failures
    if complete_failures:
        print("\n❌ COMPLETE EXTRACTION FAILURES:")
        print("=" * 60)
        
        store_failures = defaultdict(list)
        for item in complete_failures:
            store_failures[item['store']].append(item)
        
        for store, items in store_failures.items():
            print(f"\n🏪 {store} ({len(items)} complete failures):")
            for item in items:
                print(f"   📦 {item['product_name']}")
                print(f"      Expected: ${item['expected_price']}")
                print(f"      URL: {item['url']}")
                print()
    
    # Summary by store
    print("\n📊 SUMMARY BY STORE:")
    print("=" * 40)
    print(f"{'Store':12} | {'Missing':7} | {'Failures':8}")
    print("-" * 40)
    
    all_stores = ['MP', 'Drop It', 'Miles', 'Pronto', 'HH']
    for store in all_stores:
        missing_count = len([x for x in missing_prices if x['store'] == store])
        failure_count = len([x for x in complete_failures if x['store'] == store])
        print(f"{store:12} | {missing_count:7} | {failure_count:8}")
    
    # Save detailed results
    if missing_prices or complete_failures:
        all_issues = missing_prices + complete_failures
        issues_df = pd.DataFrame(all_issues)
        issues_df.to_excel('/Users/pato/missing_prices_analysis.xlsx', index=False)
        print(f"\n💾 Detailed analysis saved to: missing_prices_analysis.xlsx")
    
    return missing_prices, complete_failures

if __name__ == "__main__":
    missing, failures = analyze_missing_prices()