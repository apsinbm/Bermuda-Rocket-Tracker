#!/usr/bin/env python3
"""
Display all found prices and products from the production database
"""

import sqlite3
import pandas as pd
from datetime import datetime

def show_all_prices():
    """Display all prices and products found by the scraper"""
    
    try:
        # Connect to production database
        conn = sqlite3.connect('/Users/pato/production_scraper.db')
        
        # Get all products with prices
        query = '''
            SELECT product_title, store, current_price, sku, last_scraped, url
            FROM products 
            WHERE current_price IS NOT NULL
            ORDER BY store, current_price ASC
        '''
        
        df = pd.read_sql_query(query, conn)
        
        if len(df) == 0:
            print("No products found in database. Let me check the original Excel file...")
            
            # Fallback to original Excel file
            try:
                df = pd.read_excel('/Users/pato/four_store_results_1752024951.xlsx')
                print(f"\n🛒 FOUND PRICES AND PRODUCTS ({len(df)} items)")
                print("=" * 80)
                
                # Group by store for better display
                for store in ['Drop It', 'Miles', 'Pronto', 'HH']:
                    store_data = df[df['store'] == store]
                    if len(store_data) > 0:
                        print(f"\n🏪 {store.upper()} ({len(store_data)} products)")
                        print("-" * 60)
                        
                        for _, row in store_data.iterrows():
                            price = row['price']
                            name = row['name']
                            sku = row['sku'] if pd.notna(row['sku']) else 'N/A'
                            
                            # Clean up display
                            if pd.notna(price):
                                if isinstance(price, str) and not price.startswith('$'):
                                    price = f"${price}"
                                elif isinstance(price, (int, float)):
                                    price = f"${price:.2f}"
                            
                            print(f"   💰 {price:<8} | {name:<35} | SKU: {sku}")
                
                # Show price comparison for same products
                print(f"\n📊 PRICE COMPARISON EXAMPLES")
                print("=" * 80)
                
                # Look for similar products across stores
                product_groups = {}
                for _, row in df.iterrows():
                    name = str(row['name']).lower()
                    if 'banana' in name:
                        if 'bananas' not in product_groups:
                            product_groups['bananas'] = []
                        product_groups['bananas'].append(row)
                    elif 'milk' in name:
                        if 'milk' not in product_groups:
                            product_groups['milk'] = []
                        product_groups['milk'].append(row)
                    elif 'sugar' in name:
                        if 'sugar' not in product_groups:
                            product_groups['sugar'] = []
                        product_groups['sugar'].append(row)
                    elif 'bread' in name:
                        if 'bread' not in product_groups:
                            product_groups['bread'] = []
                        product_groups['bread'].append(row)
                
                # Display comparisons
                for product_type, items in product_groups.items():
                    if len(items) > 1:
                        print(f"\n🔍 {product_type.upper()} COMPARISON:")
                        sorted_items = sorted(items, key=lambda x: float(str(x['price']).replace('$', '')) if pd.notna(x['price']) else 999)
                        for item in sorted_items:
                            price = item['price']
                            if pd.notna(price):
                                if isinstance(price, str) and not price.startswith('$'):
                                    price = f"${price}"
                                elif isinstance(price, (int, float)):
                                    price = f"${price:.2f}"
                            print(f"   {item['store']:<12} | {price:<8} | {item['name']}")
                
                # Show statistics
                print(f"\n📈 PRICING STATISTICS")
                print("=" * 80)
                
                # Calculate stats per store
                for store in ['Drop It', 'Miles', 'Pronto', 'HH']:
                    store_data = df[df['store'] == store]
                    if len(store_data) > 0:
                        prices = []
                        for _, row in store_data.iterrows():
                            if pd.notna(row['price']):
                                try:
                                    price_val = float(str(row['price']).replace('$', ''))
                                    prices.append(price_val)
                                except:
                                    continue
                        
                        if prices:
                            avg_price = sum(prices) / len(prices)
                            min_price = min(prices)
                            max_price = max(prices)
                            print(f"{store:<15} | Products: {len(store_data):<3} | Avg: ${avg_price:.2f} | Range: ${min_price:.2f} - ${max_price:.2f}")
                
                # Show best deals
                print(f"\n💎 BEST DEALS FOUND")
                print("=" * 80)
                
                # Find products under $3
                cheap_items = []
                for _, row in df.iterrows():
                    if pd.notna(row['price']):
                        try:
                            price_val = float(str(row['price']).replace('$', ''))
                            if price_val < 3.0:
                                cheap_items.append((row['name'], row['store'], price_val))
                        except:
                            continue
                
                cheap_items.sort(key=lambda x: x[2])
                for name, store, price in cheap_items[:10]:
                    print(f"   💰 ${price:.2f} | {name} at {store}")
                
                print(f"\n✅ Total products with prices: {len(df)}")
                print(f"✅ Stores covered: Drop It, Miles, Pronto, HH")
                print(f"✅ Price range: ${min([float(str(row['price']).replace('$', '')) for _, row in df.iterrows() if pd.notna(row['price'])]):.2f} - ${max([float(str(row['price']).replace('$', '')) for _, row in df.iterrows() if pd.notna(row['price'])]):.2f}")
                
            except Exception as e:
                print(f"❌ Error reading Excel file: {e}")
                
        else:
            print(f"\n🛒 PRODUCTION DATABASE RESULTS ({len(df)} items)")
            print("=" * 80)
            
            # Display from database
            for store in df['store'].unique():
                store_data = df[df['store'] == store]
                print(f"\n🏪 {store.upper()} ({len(store_data)} products)")
                print("-" * 60)
                
                for _, row in store_data.iterrows():
                    price = f"${row['current_price']:.2f}"
                    name = row['product_title']
                    sku = row['sku'] if pd.notna(row['sku']) else 'N/A'
                    
                    print(f"   💰 {price:<8} | {name:<35} | SKU: {sku}")
        
        conn.close()
        
    except Exception as e:
        print(f"❌ Error accessing database: {e}")

if __name__ == "__main__":
    show_all_prices()