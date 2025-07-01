#!/usr/bin/env python3
"""
Debug the actual result data structure from Pronto test
"""

import pandas as pd
from hybrid_monitor import HybridEcommerceMonitor

def debug_result_data():
    """Debug what data is actually in the results"""
    print("🔍 Debug Result Data Structure")
    print("=" * 40)
    
    test_data = {
        'UPC/PLU': ['DEBUG_TEST'],
        'Brand': ['Driscolls'], 
        'Long Description': ['STRAWBERRIES 16 OZ'],
        'Reg Retail': [6.99],
        'MP': [None],
        'HH': [None],
        'Drop It': [None], 
        'Miles': [None],
        'Pronto': ['https://pronto.bm/product/strawberries-driscolls-16-oz']
    }
    
    df = pd.DataFrame(test_data)
    test_file = '/Users/pato/debug_test.xlsx'
    df.to_excel(test_file, index=False)
    
    monitor = HybridEcommerceMonitor(test_file, "Debug_Results.xlsx")
    monitor.monitor_products()
    
    # Debug the raw results
    pronto_results = [r for r in monitor.results if r.get('store_type') == 'pronto']
    
    if pronto_results:
        result = pronto_results[0]
        print(f"\n📊 RAW RESULT DATA:")
        for key, value in result.items():
            print(f"   {key}: {value}")
        
        print(f"\n🔍 SALE-SPECIFIC FIELDS:")
        sale_fields = ['sale_price', 'regular_price', 'sale_percentage', 'is_on_sale', 'sale_start_date', 'sale_end_date']
        for field in sale_fields:
            value = result.get(field, 'NOT_FOUND')
            print(f"   {field}: {value}")
    else:
        print("❌ No Pronto results found")

if __name__ == "__main__":
    debug_result_data()