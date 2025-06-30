#!/usr/bin/env python3
"""
Quick test to verify the new column format
"""

import pandas as pd
from hybrid_monitor import HybridEcommerceMonitor
import os

def main():
    # Create a minimal test with just 1 product
    full_file = "/Users/pato/Downloads/Download June_Top_100_with_URLs_Accurate.xlsx"
    
    if not os.path.exists(full_file):
        print(f"❌ Input file not found: {full_file}")
        return
    
    df = pd.read_excel(full_file)
    
    # Take just 1 product for quick test
    test_df = df.head(1)
    test_file = "/Users/pato/test_column_format.xlsx"
    test_df.to_excel(test_file, index=False)
    
    print("🧪 TESTING NEW COLUMN FORMAT")
    print("=" * 40)
    print("Expected columns:")
    expected_columns = [
        "upc_plu", "brand", "product_name", "store_type", "expected_price", 
        "price_found", "price_difference", "price_match", "method", 
        "status", "error", "response_time", "scraped_at", "url"
    ]
    for i, col in enumerate(expected_columns, 1):
        print(f"   {i:2d}. {col}")
    print("=" * 40)
    
    output_file = "/Users/pato/Column_Format_Test_Results.xlsx"
    
    monitor = HybridEcommerceMonitor(test_file, output_file)
    monitor.run()
    
    # Check the output format
    if os.path.exists(output_file):
        result_df = pd.read_excel(output_file)
        print(f"\n✅ Test complete! Results:")
        print(f"📊 Columns: {list(result_df.columns)}")
        print(f"📋 Rows: {len(result_df)}")
        
        # Show sample data
        if len(result_df) > 0:
            print(f"\n📋 Sample row:")
            for col in result_df.columns:
                value = result_df.iloc[0][col] if len(result_df) > 0 else ""
                print(f"   {col}: {value}")
    else:
        print("❌ Results file not created")

if __name__ == "__main__":
    main()