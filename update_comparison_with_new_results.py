#!/usr/bin/env python3
"""
Update comprehensive comparison with new scraped results
"""
import pandas as pd
import sqlite3
import json

def update_comprehensive_comparison():
    """Update the comprehensive comparison with new scraped results"""
    
    # Load the new scraped results
    with open('/Users/pato/background_scraper_results_1752062222.json', 'r') as f:
        new_data = json.load(f)
    
    new_results = new_data['results']
    print(f"📊 New scraped results: {len(new_results)} products")
    
    # Create URL to price mapping
    url_to_price = {}
    for result in new_results:
        url_to_price[result['url']] = {
            'price': result['price'],
            'product_name': result['product_name']
        }
    
    # Load existing scraped data from database
    conn = sqlite3.connect('/Users/pato/production_scraper.db')
    query = '''
        SELECT store, product_title, current_price, sku, url, product_name
        FROM products 
        WHERE current_price IS NOT NULL
        ORDER BY store, product_title
    '''
    existing_df = pd.read_sql_query(query, conn)
    conn.close()
    
    # Create price lookup for existing data
    existing_price_lookup = {}
    for _, row in existing_df.iterrows():
        existing_price_lookup[row['url']] = {
            'price': row['current_price'],
            'product_title': row['product_title'],
            'sku': row['sku']
        }
    
    # Combine all price lookups
    all_price_lookup = {**existing_price_lookup, **url_to_price}
    
    # Load original 88 products
    original_df = pd.read_csv('/Users/pato/complete_100_products.csv')
    
    # Load additional 74 products
    additional_df = pd.read_csv('/Users/pato/additional_products.csv')
    
    # Process original products
    original_data = []
    for _, row in original_df.iterrows():
        product_name = row['Product']
        
        row_data = {
            'Product': product_name,
            'Category': 'Original Dataset',
            'Drop It Price': None,
            'Drop It Name': None,
            'Miles Price': None,
            'Miles Name': None,
            'Pronto Price': None,
            'Pronto Name': None,
            'HH Price': None,
            'HH Name': None
        }
        
        # Check each store
        for store_col in ['Drop It', 'Miles', 'Pronto', 'HH']:
            url = row[store_col]
            if pd.notna(url) and url != 'N/A' and str(url).startswith('http'):
                if url in all_price_lookup:
                    price_data = all_price_lookup[url]
                    row_data[f'{store_col} Price'] = f"${price_data['price']:.2f}"
                    row_data[f'{store_col} Name'] = price_data.get('product_title', price_data.get('product_name', 'Scraped'))
                else:
                    row_data[f'{store_col} Price'] = "Not Scraped"
                    row_data[f'{store_col} Name'] = "Available but Not Scraped"
            else:
                row_data[f'{store_col} Price'] = "No URL"
                row_data[f'{store_col} Name'] = "No URL"
        
        original_data.append(row_data)
    
    # Process additional products
    additional_data = []
    for _, row in additional_df.iterrows():
        product_name = f"{row['Brand']} {row['Product']}" if pd.notna(row['Brand']) else row['Product']
        expected_price = row['Price']
        
        row_data = {
            'Product': product_name,
            'Category': 'Additional Products',
            'Expected Price': f"${expected_price:.2f}",
            'Drop It Price': None,
            'Drop It Name': None,
            'Miles Price': None,
            'Miles Name': None,
            'Pronto Price': None,
            'Pronto Name': None,
            'HH Price': None,
            'HH Name': None
        }
        
        # Check each store
        for store_col in ['Drop It', 'Miles', 'Pronto', 'HH']:
            url = row[store_col]
            if pd.notna(url) and url != 'N/A' and str(url).startswith('http'):
                if url in all_price_lookup:
                    price_data = all_price_lookup[url]
                    row_data[f'{store_col} Price'] = f"${price_data['price']:.2f}"
                    row_data[f'{store_col} Name'] = price_data.get('product_title', price_data.get('product_name', 'Scraped'))
                else:
                    row_data[f'{store_col} Price'] = "NEEDS SCRAPING"
                    row_data[f'{store_col} Name'] = "URL Available - Needs Scraping"
            else:
                row_data[f'{store_col} Price'] = "No URL"
                row_data[f'{store_col} Name'] = "No URL"
        
        additional_data.append(row_data)
    
    # Combine all data
    original_df_final = pd.DataFrame(original_data)
    additional_df_final = pd.DataFrame(additional_data)
    
    # Add Expected Price column to original (empty for now)
    original_df_final['Expected Price'] = ""
    
    # Reorder columns to match
    columns = ['Product', 'Category', 'Expected Price', 'Drop It Price', 'Drop It Name', 
               'Miles Price', 'Miles Name', 'Pronto Price', 'Pronto Name', 'HH Price', 'HH Name']
    
    original_df_final = original_df_final[columns]
    additional_df_final = additional_df_final[columns]
    
    # Combine
    combined_df = pd.concat([original_df_final, additional_df_final], ignore_index=True)
    
    # Create summary statistics
    scraped_count = len([p for p in combined_df['Drop It Price'] if p and p.startswith('$')])
    scraped_count += len([p for p in combined_df['Miles Price'] if p and p.startswith('$')])
    scraped_count += len([p for p in combined_df['Pronto Price'] if p and p.startswith('$')])
    scraped_count += len([p for p in combined_df['HH Price'] if p and p.startswith('$')])
    
    needs_scraping_count = len([p for p in combined_df['Drop It Price'] if p == "NEEDS SCRAPING"])
    needs_scraping_count += len([p for p in combined_df['Miles Price'] if p == "NEEDS SCRAPING"])
    needs_scraping_count += len([p for p in combined_df['Pronto Price'] if p == "NEEDS SCRAPING"])
    needs_scraping_count += len([p for p in combined_df['HH Price'] if p == "NEEDS SCRAPING"])
    
    not_scraped_count = len([p for p in combined_df['Drop It Price'] if p == "Not Scraped"])
    not_scraped_count += len([p for p in combined_df['Miles Price'] if p == "Not Scraped"])
    not_scraped_count += len([p for p in combined_df['Pronto Price'] if p == "Not Scraped"])
    not_scraped_count += len([p for p in combined_df['HH Price'] if p == "Not Scraped"])
    
    # Count newly scraped items
    newly_scraped = len(new_results)
    
    # Create status summary
    status_data = [
        {'Status': 'Successfully Scraped (Original)', 'Count': scraped_count - newly_scraped, 'Percentage': f"{(scraped_count - newly_scraped)/((88+74)*4)*100:.1f}%"},
        {'Status': 'Newly Scraped (Additional)', 'Count': newly_scraped, 'Percentage': f"{newly_scraped/((88+74)*4)*100:.1f}%"},
        {'Status': 'Total Successfully Scraped', 'Count': scraped_count, 'Percentage': f"{scraped_count/((88+74)*4)*100:.1f}%"},
        {'Status': 'Still Needs Scraping', 'Count': needs_scraping_count, 'Percentage': f"{needs_scraping_count/((88+74)*4)*100:.1f}%"},
        {'Status': 'Not Scraped (Original)', 'Count': not_scraped_count, 'Percentage': f"{not_scraped_count/((88+74)*4)*100:.1f}%"},
        {'Status': 'Original Products', 'Count': 88, 'Percentage': f"{88/(88+74)*100:.1f}%"},
        {'Status': 'Additional Products', 'Count': 74, 'Percentage': f"{74/(88+74)*100:.1f}%"},
        {'Status': 'Total Products', 'Count': 88+74, 'Percentage': "100.0%"},
    ]
    
    status_df = pd.DataFrame(status_data)
    
    # Create new scraped results summary
    new_scraped_summary = []
    for result in new_results:
        new_scraped_summary.append({
            'Product': result['product_name'],
            'Store': result['store'],
            'Price': f"${result['price']:.2f}",
            'URL': result['url']
        })
    
    new_scraped_df = pd.DataFrame(new_scraped_summary)
    
    # Save to Excel with multiple sheets
    filename = '/Users/pato/UPDATED_Bermuda_Grocery_Price_Comparison.xlsx'
    
    with pd.ExcelWriter(filename, engine='openpyxl') as writer:
        # Main comparison sheet
        combined_df.to_excel(writer, sheet_name='Complete Comparison', index=False)
        
        # Status summary
        status_df.to_excel(writer, sheet_name='Scraping Status', index=False)
        
        # New scraped results
        new_scraped_df.to_excel(writer, sheet_name='New Scraped Results', index=False)
        
        # Original products only
        original_df_final.to_excel(writer, sheet_name='Original Products', index=False)
        
        # Additional products only
        additional_df_final.to_excel(writer, sheet_name='Additional Products', index=False)
    
    print(f"✅ Updated comparison Excel file created: {filename}")
    print(f"📊 Total Products: {len(combined_df)}")
    print(f"💰 Total Successfully Scraped Prices: {scraped_count}")
    print(f"✨ Newly Scraped Prices: {newly_scraped}")
    print(f"🔍 URLs Still Needing Scraping: {needs_scraping_count}")
    print(f"📋 Original Products: 88")
    print(f"📋 Additional Products: 74")
    
    # Show breakdown by store
    print(f"\n🏪 STORE BREAKDOWN:")
    print("=" * 50)
    for store in ['Drop It', 'Miles', 'Pronto', 'HH']:
        scraped = len([p for p in combined_df[f'{store} Price'] if p and p.startswith('$')])
        needs_scraping = len([p for p in combined_df[f'{store} Price'] if p == "NEEDS SCRAPING"])
        not_scraped = len([p for p in combined_df[f'{store} Price'] if p == "Not Scraped"])
        print(f"{store:<10}: {scraped:3d} scraped, {needs_scraping:3d} need scraping, {not_scraped:3d} not scraped")
    
    # Show newly scraped products
    print(f"\n✨ NEWLY SCRAPED PRODUCTS:")
    print("=" * 50)
    current_product = ""
    for result in new_results:
        if result['product_name'] != current_product:
            current_product = result['product_name']
            print(f"\n{current_product}:")
        print(f"  {result['store']:<10}: ${result['price']:.2f}")
    
    return filename

if __name__ == "__main__":
    update_comprehensive_comparison()