#!/usr/bin/env python3
"""
Test enhanced pricing system on MarketPlace product with discount
"""

import pandas as pd
from hybrid_monitor import HybridEcommerceMonitor

def test_marketplace_discount():
    """Test discount detection on MarketPlace Stemilt Apples"""
    print("🧪 Testing Discount Detection on MarketPlace Product")
    print("=" * 55)
    print("🔗 URL: https://www.marketplace.bm/shop/produce/apples/stemilt_apples_fuji_1_36_kg/p/2450257")
    print()
    
    # Create test data for the MarketPlace discount product
    test_data = {
        'UPC/PLU': ['TEST_APPLE'],
        'Brand': ['Stemilt'], 
        'Long Description': ['APPLES FUJI 1.36 KG'],
        'Reg Retail': [7.99],  # Expected price
        'MP': ['https://www.marketplace.bm/shop/produce/apples/stemilt_apples_fuji_1_36_kg/p/2450257'],
        'HH': [None],
        'Drop It': [None], 
        'Miles': [None],
        'Pronto': [None]
    }
    
    # Create test Excel file
    df = pd.DataFrame(test_data)
    test_file = '/Users/pato/test_marketplace_discount.xlsx'
    df.to_excel(test_file, index=False)
    print(f"✅ Created test file: {test_file}")
    
    # Run monitoring on MarketPlace
    try:
        monitor = HybridEcommerceMonitor(test_file, "MarketPlace_Discount_Test_Results.xlsx")
        print("\n🚀 Starting MarketPlace discount detection test...")
        print("🔍 This will test the enhanced pricing system on MarketPlace store")
        print("   Looking for: sale prices, regular prices, discount percentages, sale dates")
        print("🔧 You may need to login and select Hamilton store for the first product")
        
        monitor.monitor_products()
        monitor.generate_report()
        
        print(f"\n📊 MarketPlace discount test completed!")
        
        # Analyze results specifically for the MarketPlace product
        mp_results = [r for r in monitor.results if r.get('store_type') == 'mp']
        
        if mp_results:
            result = mp_results[0]
            print(f"\n📈 MARKETPLACE PRICING ANALYSIS:")
            print(f"   Product: {result.get('product_name', 'Unknown')}")
            print(f"   Status: {result.get('status', 'Unknown')}")
            
            if result.get('status') == 'success':
                # Display all pricing information
                current_price = result.get('price_found')
                sale_price = result.get('sale_price')
                regular_price = result.get('regular_price')
                sale_percentage = result.get('sale_percentage')
                is_on_sale = result.get('is_on_sale', False)
                sale_start_date = result.get('sale_start_date')
                sale_end_date = result.get('sale_end_date')
                expected_price = result.get('expected_price')
                
                print(f"   Expected Price: ${expected_price}" if expected_price else "   Expected Price: Not set")
                print(f"   Current Price: ${current_price}" if current_price else "   Current Price: Not found")
                
                # Calculate expected vs found percentage
                if expected_price and current_price:
                    try:
                        expected = float(expected_price)
                        found = float(current_price)
                        expected_vs_found_pct = round(((found - expected) / expected) * 100, 1)
                        print(f"   Expected vs Found: {expected_vs_found_pct:+.1f}% ({'cheaper' if expected_vs_found_pct < 0 else 'more expensive' if expected_vs_found_pct > 0 else 'exact match'})")
                    except:
                        print(f"   Expected vs Found: Could not calculate")
                
                if is_on_sale:
                    print(f"\n   🔥 SALE DETECTED!")
                    print(f"   Sale Price: ${sale_price}" if sale_price else "   Sale Price: N/A")
                    print(f"   Regular Price: ${regular_price}" if regular_price else "   Regular Price: N/A")
                    print(f"   Discount: {sale_percentage}%" if sale_percentage else "   Discount: N/A")
                    if sale_start_date:
                        print(f"   Sale Start: {sale_start_date}")
                    if sale_end_date:
                        print(f"   Sale End: {sale_end_date}")
                else:
                    print(f"\n   📊 Regular Pricing")
                    if regular_price and regular_price != current_price:
                        print(f"   Regular Price: ${regular_price}")
                    else:
                        print(f"   No separate regular price detected")
                
                # Method used
                method = result.get('method', 'unknown')
                print(f"\n   Method: {method}")
                
                # Check if comprehensive pricing was used
                if method == 'comprehensive_scraping':
                    print(f"   ✅ Enhanced pricing system was used")
                else:
                    print(f"   ⚠️ Basic scraping was used")
                
            else:
                error = result.get('error', 'Unknown error')
                print(f"   ❌ Failed: {error}")
        else:
            print(f"\n   ❌ No MarketPlace results found")
        
        # Show Excel file info
        print(f"\n📋 EXCEL OUTPUT:")
        print(f"   File: MarketPlace_Discount_Test_Results.xlsx")
        print(f"   Contains all 21 enhanced pricing columns")
        
        # Quick Excel verification
        try:
            results_df = pd.read_excel("MarketPlace_Discount_Test_Results.xlsx")
            mp_row = results_df[results_df['store_type'] == 'mp']
            if len(mp_row) > 0:
                row = mp_row.iloc[0]
                print(f"\n📊 EXCEL DATA VERIFICATION:")
                key_columns = ['price_found', 'sale_price', 'regular_price', 'sale_percentage', 'is_on_sale', 'expected_vs_found_percentage']
                for col in key_columns:
                    if col in row.index:
                        value = row[col]
                        if pd.notna(value) and value != '':
                            print(f"   {col}: {value}")
                        else:
                            print(f"   {col}: (empty)")
        except Exception as e:
            print(f"   Could not verify Excel data: {e}")
        
        return True
            
    except Exception as e:
        print(f"💥 Error during MarketPlace discount test: {e}")
        return False

if __name__ == "__main__":
    success = test_marketplace_discount()
    
    if success:
        print("\n🎯 MARKETPLACE DISCOUNT TEST COMPLETED!")
        print("Check the results above to see if discount information was captured correctly.")
    else:
        print("\n🔧 TEST FAILED")
        print("There was an issue with the discount detection test.")