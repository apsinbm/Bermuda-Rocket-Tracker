#!/usr/bin/env python3
"""
Create final complete Excel file with ALL scraped data including the 260 new results
"""
import pandas as pd
import sqlite3
import json

def create_final_complete_excel():
    """Create the most complete Excel file with all scraped data"""
    
    # Load the latest complete results from resume scraper
    with open('/Users/pato/resume_scraper_results_1752065222.json', 'r') as f:
        resume_data = json.load(f)
    
    resume_results = resume_data['results']
    print(f"📊 Resume scraper results: {len(resume_results)} products")
    
    # Create URL to price mapping for resume scraper results
    resume_url_to_price = {}
    for result in resume_results:
        resume_url_to_price[result['url']] = {
            'price': result['price'],
            'product_name': result['product_name']
        }
    
    # Load existing database results
    try:
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
        print(f"📊 Existing database results: {len(existing_df)} products")
        
    except Exception as e:
        print(f"⚠️ Could not load existing database: {e}")
        existing_price_lookup = {}
    
    # Combine all price lookups
    all_price_lookup = {**existing_price_lookup, **resume_url_to_price}
    print(f"📊 Total combined price lookups: {len(all_price_lookup)}")
    
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
    
    # Create status summary
    status_data = [
        {'Status': 'Total Successfully Scraped', 'Count': scraped_count, 'Percentage': f"{scraped_count/((88+74)*4)*100:.1f}%"},
        {'Status': 'Resume Scraper Results', 'Count': len(resume_results), 'Percentage': f"{len(resume_results)/((88+74)*4)*100:.1f}%"},
        {'Status': 'Original Database Results', 'Count': scraped_count - len(resume_results), 'Percentage': f"{(scraped_count - len(resume_results))/((88+74)*4)*100:.1f}%"},
        {'Status': 'Still Needs Scraping', 'Count': needs_scraping_count, 'Percentage': f"{needs_scraping_count/((88+74)*4)*100:.1f}%"},
        {'Status': 'Not Scraped (Original)', 'Count': not_scraped_count, 'Percentage': f"{not_scraped_count/((88+74)*4)*100:.1f}%"},
        {'Status': 'Original Products', 'Count': 88, 'Percentage': f"{88/(88+74)*100:.1f}%"},
        {'Status': 'Additional Products', 'Count': 74, 'Percentage': f"{74/(88+74)*100:.1f}%"},
        {'Status': 'Total Products', 'Count': 88+74, 'Percentage': "100.0%"},
    ]
    
    status_df = pd.DataFrame(status_data)
    
    # Create resume scraper results summary
    resume_scraped_summary = []
    for result in resume_results:
        resume_scraped_summary.append({
            'Product': result['product_name'],
            'Store': result['store'],
            'Price': f"${result['price']:.2f}",
            'URL': result['url'],
            'Timestamp': result['timestamp']
        })
    
    resume_scraped_df = pd.DataFrame(resume_scraped_summary)
    
    # Create store comparison summary
    store_comparison = []
    for store in ['Drop It', 'Miles', 'Pronto', 'HH']:
        scraped = len([p for p in combined_df[f'{store} Price'] if p and p.startswith('$')])
        needs_scraping = len([p for p in combined_df[f'{store} Price'] if p == "NEEDS SCRAPING"])
        not_scraped = len([p for p in combined_df[f'{store} Price'] if p == "Not Scraped"])
        no_url = len([p for p in combined_df[f'{store} Price'] if p == "No URL"])
        
        store_comparison.append({
            'Store': store,
            'Successfully Scraped': scraped,
            'Needs Scraping': needs_scraping,
            'Not Scraped': not_scraped,
            'No URL Available': no_url,
            'Total Products': 162,
            'Coverage %': f"{scraped/162*100:.1f}%"
        })
    
    store_comparison_df = pd.DataFrame(store_comparison)
    
    # Save to Excel with multiple sheets
    filename = '/Users/pato/FINAL_COMPLETE_Bermuda_Grocery_Price_Comparison.xlsx'
    
    with pd.ExcelWriter(filename, engine='openpyxl') as writer:
        # Main comparison sheet
        combined_df.to_excel(writer, sheet_name='Complete Comparison', index=False)
        
        # Resume scraper results (ALL 260 results)
        resume_scraped_df.to_excel(writer, sheet_name='Resume Scraper Results', index=False)
        
        # Status summary
        status_df.to_excel(writer, sheet_name='Scraping Status', index=False)
        
        # Store comparison
        store_comparison_df.to_excel(writer, sheet_name='Store Coverage', index=False)
        
        # Original products only
        original_df_final.to_excel(writer, sheet_name='Original Products', index=False)
        
        # Additional products only
        additional_df_final.to_excel(writer, sheet_name='Additional Products', index=False)
    
    print(f"✅ FINAL COMPLETE Excel file created: {filename}")
    print(f"📊 Total Products: {len(combined_df)}")
    print(f"💰 Total Successfully Scraped Prices: {scraped_count}")
    print(f"🆕 Resume Scraper Results: {len(resume_results)}")
    print(f"📈 Overall Coverage: {scraped_count/((88+74)*4)*100:.1f}%")
    
    # Show breakdown by store
    print(f"\n🏪 STORE BREAKDOWN:")
    print("=" * 70)
    for store in ['Drop It', 'Miles', 'Pronto', 'HH']:
        scraped = len([p for p in combined_df[f'{store} Price'] if p and p.startswith('$')])
        needs_scraping = len([p for p in combined_df[f'{store} Price'] if p == "NEEDS SCRAPING"])
        not_scraped = len([p for p in combined_df[f'{store} Price'] if p == "Not Scraped"])
        coverage = scraped/162*100
        print(f"{store:<10}: {scraped:3d} scraped ({coverage:5.1f}%), {needs_scraping:3d} need scraping, {not_scraped:3d} not scraped")
    
    return filename

if __name__ == "__main__":
    create_final_complete_excel()