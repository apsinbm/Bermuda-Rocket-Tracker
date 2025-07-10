#!/usr/bin/env python3
"""
Diagnose why the scraping is failing so badly
"""
import pandas as pd
from hybrid_monitor import HybridEcommerceMonitor

def diagnose_scraping_issues():
    """Test with a single known working product"""
    
    print("🔍 DIAGNOSING SCRAPING FAILURES...")
    
    # Create a simple test with one product we know works
    test_data = {
        'UPC/PLU': ['TEST123'],
        'Brand': ['Test'],
        'Long Description': ['Test Product'],
        'Reg Retail': [5.99],
        'MP': ['https://www.marketplace.bm/shop/produce/tropical/yellow_bananas/p/12413']  # Correct banana URL
    }
    
    df = pd.DataFrame(test_data)
    test_file = 'scraping_diagnosis_test.xlsx'
    df.to_excel(test_file, index=False)
    
    print(f"✅ Created diagnostic test file: {test_file}")
    print(f"🎯 Testing single MarketPlace product...")
    
    # Test the monitoring system
    monitor = HybridEcommerceMonitor(test_file, 'Scraping_Diagnosis_Results.xlsx')
    
    # Process just the MarketPlace product
    try:
        monitor.monitor_products()
        monitor.generate_report()
        
        # Check results
        results_df = pd.read_excel('Scraping_Diagnosis_Results.xlsx')
        if len(results_df) > 0:
            result = results_df.iloc[0]
            print(f"\\n📊 DIAGNOSTIC RESULTS:")
            print(f"   Status: {result['status']}")
            print(f"   Method: {result.get('method', 'N/A')}")
            print(f"   Price Found: {result.get('price_found', 'N/A')}")
            print(f"   Website SKU: {result.get('website_sku', 'N/A')}")
            print(f"   Error: {result.get('error', 'N/A')}")
            
            if result['status'] == 'success':
                print("✅ BASIC SCRAPING IS WORKING")
            else:
                print("❌ BASIC SCRAPING IS BROKEN")
                print(f"   Error Details: {result.get('error', 'Unknown')}")
        else:
            print("❌ NO RESULTS GENERATED")
            
    except Exception as e:
        print(f"❌ SYSTEM ERROR: {e}")

if __name__ == "__main__":
    diagnose_scraping_issues()