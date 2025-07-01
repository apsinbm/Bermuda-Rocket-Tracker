#!/usr/bin/env python3
"""
Test enhanced pricing system on specific Pronto product to check discount detection
"""

import pandas as pd
from hybrid_monitor import HybridEcommerceMonitor

def test_pronto_discount():
    """Test discount detection on Pronto strawberries product"""
    print("🧪 Testing Discount Detection on Pronto Product")
    print("=" * 50)
    print("🔗 URL: https://pronto.bm/product/strawberries-driscolls-16-oz")
    print()
    
    # Create test data for the specific product
    test_data = {
        'UPC/PLU': ['TEST_STRAWBERRY'],
        'Brand': ['Driscolls'], 
        'Long Description': ['STRAWBERRIES 16 OZ'],
        'Reg Retail': [6.99],  # Expected price
        'MP': [None],
        'HH': [None],
        'Drop It': [None], 
        'Miles': [None],
        'Pronto': ['https://pronto.bm/product/strawberries-driscolls-16-oz']
    }
    
    # Create test Excel file
    df = pd.DataFrame(test_data)
    test_file = '/Users/pato/test_pronto_discount.xlsx'
    df.to_excel(test_file, index=False)
    print(f"✅ Created test file: {test_file}")
    
    # Run monitoring on Pronto
    try:
        monitor = HybridEcommerceMonitor(test_file, "Pronto_Discount_Test_Results.xlsx")
        print("\n🚀 Starting Pronto discount detection test...")
        print("🔍 This will test the enhanced pricing system on Pronto store")
        print("   Looking for: sale prices, regular prices, discount percentages, sale dates")
        
        monitor.monitor_products()
        monitor.generate_report()
        
        print(f"\n📊 Pronto discount test completed!")
        
        # Analyze results specifically for the Pronto product
        pronto_results = [r for r in monitor.results if r.get('store_type') == 'pronto']
        
        if pronto_results:
            result = pronto_results[0]
            print(f"\n📈 PRONTO PRICING ANALYSIS:")
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
                elif method == 'api':
                    print(f"   ✅ API method was used (Pronto's native API)")
                else:
                    print(f"   ⚠️ Basic scraping was used")
                
            else:
                error = result.get('error', 'Unknown error')
                print(f"   ❌ Failed: {error}")
        else:
            print(f"\n   ❌ No Pronto results found")
        
        # Show Excel file info
        print(f"\n📋 EXCEL OUTPUT:")
        print(f"   File: Pronto_Discount_Test_Results.xlsx")
        print(f"   Contains all 21 enhanced pricing columns")
        
        # Quick Excel verification
        try:
            results_df = pd.read_excel("Pronto_Discount_Test_Results.xlsx")
            pronto_row = results_df[results_df['store_type'] == 'pronto']
            if len(pronto_row) > 0:
                row = pronto_row.iloc[0]
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
        print(f"💥 Error during Pronto discount test: {e}")
        return False

if __name__ == "__main__":
    success = test_pronto_discount()
    
    if success:
        print("\n🎯 PRONTO DISCOUNT TEST COMPLETED!")
        print("Check the results above to see if discount information was captured correctly.")
    else:
        print("\n🔧 TEST FAILED")
        print("There was an issue with the discount detection test.")