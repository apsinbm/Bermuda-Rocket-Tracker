#!/usr/bin/env python3
"""
Test the modified hybrid system with persistent Chrome for MarketPlace
"""

import pandas as pd
from hybrid_monitor import HybridEcommerceMonitor

def test_persistent_system():
    """Test persistent Chrome with 2 MarketPlace products"""
    print("🧪 Testing Modified Hybrid System with Persistent Chrome")
    print("=" * 55)
    
    # Create test data
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
    test_file = '/Users/pato/test_persistent_products.xlsx'
    df.to_excel(test_file, index=False)
    print(f"✅ Created test file: {test_file}")
    
    # Run monitoring
    try:
        monitor = HybridEcommerceMonitor(test_file, "Test_Persistent_Results.xlsx")
        print("\n🚀 Starting persistent Chrome test...")
        print("🔧 IMPORTANT: When Chrome opens for the first product:")
        print("   1. Login to MarketPlace if needed")
        print("   2. Select Hamilton store if needed")
        print("   3. The system will then test persistence on the second product")
        
        monitor.monitor_products()
        monitor.generate_report()
        
        print(f"\n📊 Test completed! Results saved to: Test_Persistent_Results.xlsx")
        
        # Show results summary
        successful_mp = len([r for r in monitor.results if r.get('store_type') == 'mp' and r.get('status') == 'success'])
        total_mp = len([r for r in monitor.results if r.get('store_type') == 'mp'])
        
        print(f"\n📈 PERSISTENT CHROME RESULTS:")
        print(f"   MarketPlace products processed: {total_mp}")
        print(f"   MarketPlace successes: {successful_mp}")
        print(f"   Success rate: {(successful_mp/total_mp*100):.1f}%" if total_mp > 0 else "   No MP products found")
        
        if successful_mp == total_mp and total_mp > 1:
            print("\n🎉 PERSISTENT CHROME SUCCESS!")
            print("✅ All MarketPlace products succeeded")
            print("🚀 Ready for full overnight monitoring!")
            return True
        elif successful_mp > 0:
            print("\n⚠️ PARTIAL SUCCESS")
            print("Some MarketPlace products worked - may need refinement")
            return False
        else:
            print("\n❌ PERSISTENCE TEST FAILED")
            print("No MarketPlace products succeeded")
            return False
            
    except Exception as e:
        print(f"💥 Error during test: {e}")
        return False

if __name__ == "__main__":
    success = test_persistent_system()
    
    if success:
        print("\n🎯 SYSTEM READY!")
        print("The modified hybrid_monitor.py is ready for overnight monitoring.")
    else:
        print("\n🔧 NEEDS ADJUSTMENT")
        print("May need further modifications for reliable persistence.")