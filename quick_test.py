#!/usr/bin/env python3
"""
Quick test of just one product across all 5 stores to prove the concept
"""

import pandas as pd
from hybrid_monitor import HybridEcommerceMonitor

def main():
    # Load the Excel file and test just one product
    df = pd.read_excel("/Users/pato/Short test.xlsx")
    
    # Create a single-product test file
    single_product = df.head(1)  # Just first product (BANANAS)
    temp_file = "/Users/pato/single_product_test.xlsx"
    single_product.to_excel(temp_file, index=False)
    
    print("🧪 Testing single product across all 5 stores...")
    print(f"Product: {single_product.iloc[0]['Long Description']}")
    
    # Run monitor on single product
    monitor = HybridEcommerceMonitor(temp_file, "/Users/pato/Single_Product_Results.xlsx")
    monitor.run()
    
    # Check results
    successful = len([r for r in monitor.results if r['status'] == 'success'])
    total = len(monitor.results)
    
    print(f"\n🎯 FINAL TEST RESULTS:")
    print(f"   Success Rate: {successful}/{total} ({(successful/total)*100:.1f}%)")
    print(f"   Scraping Success: {monitor.performance_stats['successful_scrapes']}")
    print(f"   API Success: {monitor.performance_stats['successful_apis']}")
    print(f"   OCR Success: {monitor.performance_stats['successful_ocr']}")
    
    # Show successful results
    print(f"\n✅ Successful Price Captures:")
    for result in monitor.results:
        if result['status'] == 'success':
            print(f"   {result['store_type'].upper()}: ${result['price_found']} via {result['method']}")

if __name__ == "__main__":
    main()