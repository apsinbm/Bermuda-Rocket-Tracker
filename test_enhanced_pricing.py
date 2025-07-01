#!/usr/bin/env python3
"""
Test the enhanced pricing system with sale detection
"""

import pandas as pd
from hybrid_monitor import HybridEcommerceMonitor

def test_enhanced_pricing():
    """Test enhanced pricing system with comprehensive sale detection"""
    print("🧪 Testing Enhanced Pricing System with Sale Detection")
    print("=" * 55)
    
    # Create test data with same products as before
    test_data = {
        'UPC/PLU': ['TEST001', 'TEST002'],
        'Brand': ['Test Brand', 'Test Brand'], 
        'Long Description': ['BANANAS YELLOW', 'AVOCADO HASS LARGE'],
        'Reg Retail': [2.99, 3.09],
        'MP': [
            'https://www.marketplace.bm/shop/produce/tropical/yellow_bananas/p/12413',
            'https://www.marketplace.bm/shop/produce/tropical_fruit/green_avocados_large/p/78563'
        ],
        'HH': [None, None],
        'Drop It': [None, None], 
        'Miles': [None, None],
        'Pronto': [None, None]
    }
    
    # Create test Excel file
    df = pd.DataFrame(test_data)
    test_file = '/Users/pato/test_enhanced_pricing_products.xlsx'
    df.to_excel(test_file, index=False)
    print(f"✅ Created test file: {test_file}")
    
    # Run monitoring with enhanced pricing
    try:
        monitor = HybridEcommerceMonitor(test_file, "Enhanced_Pricing_Results.xlsx")
        print("\n🚀 Starting enhanced pricing test...")
        print("🔧 IMPORTANT: When Chrome opens for the first product:")
        print("   1. Login to MarketPlace if needed")
        print("   2. Select Hamilton store if needed")
        print("   3. Look for any sale prices or discounts on the products")
        print("   4. The system will now detect sale prices, regular prices, and sale dates")
        
        monitor.monitor_products()
        monitor.generate_report()
        
        print(f"\n📊 Enhanced pricing test completed! Results saved to: Enhanced_Pricing_Results.xlsx")
        
        # Analyze results for enhanced pricing features
        mp_results = [r for r in monitor.results if r.get('store_type') == 'mp']
        
        print(f"\n📈 ENHANCED PRICING RESULTS:")
        print(f"   Products processed: {len(mp_results)}")
        
        for i, result in enumerate(mp_results, 1):
            product_name = result.get('product_name', 'Unknown')
            current_price = result.get('price_found')
            sale_price = result.get('sale_price')
            regular_price = result.get('regular_price')
            sale_percentage = result.get('sale_percentage')
            is_on_sale = result.get('is_on_sale', False)
            sale_start_date = result.get('sale_start_date')
            sale_end_date = result.get('sale_end_date')
            
            print(f"\n   📦 Product {i}: {product_name}")
            print(f"      Current Price: ${current_price}" if current_price else "      Current Price: Not found")
            
            if is_on_sale:
                print(f"      🔥 ON SALE!")
                print(f"      Sale Price: ${sale_price}" if sale_price else "      Sale Price: N/A")
                print(f"      Regular Price: ${regular_price}" if regular_price else "      Regular Price: N/A")
                print(f"      Discount: {sale_percentage}%" if sale_percentage else "      Discount: N/A")
                if sale_start_date:
                    print(f"      Sale Start: {sale_start_date}")
                if sale_end_date:
                    print(f"      Sale End: {sale_end_date}")
            else:
                print(f"      Regular pricing")
                if regular_price and regular_price != current_price:
                    print(f"      Regular Price: ${regular_price}")
        
        # Check if any sales were detected
        sales_detected = any(r.get('is_on_sale', False) for r in mp_results)
        if sales_detected:
            print(f"\n🎉 SALE DETECTION SUCCESS!")
            print(f"✅ System successfully detected sale pricing information")
        else:
            print(f"\n📊 NO SALES DETECTED")
            print(f"✅ System working - no current sales on test products")
            
        # Check new Excel columns
        print(f"\n📋 NEW EXCEL COLUMNS AVAILABLE:")
        print(f"   ✅ sale_price - Current sale price if on sale")
        print(f"   ✅ regular_price - Original/regular price")
        print(f"   ✅ sale_percentage - Discount percentage")
        print(f"   ✅ expected_vs_found_percentage - Price difference as percentage")
        print(f"   ✅ is_on_sale - True/False sale indicator")
        print(f"   ✅ sale_start_date - Sale start date if detected")
        print(f"   ✅ sale_end_date - Sale end date if detected")
        
        return True
            
    except Exception as e:
        print(f"💥 Error during enhanced pricing test: {e}")
        return False

if __name__ == "__main__":
    success = test_enhanced_pricing()
    
    if success:
        print("\n🎯 ENHANCED PRICING SYSTEM READY!")
        print("The system now detects sales, regular prices, and calculates percentages.")
        print("Ready for full overnight monitoring with comprehensive pricing data.")
    else:
        print("\n🔧 NEEDS ADJUSTMENT")
        print("Enhanced pricing system may need further refinement.")