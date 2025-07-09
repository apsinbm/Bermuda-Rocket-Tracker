#!/usr/bin/env python3
"""
Analyze URL coverage across all 4 stores
"""

import pandas as pd

def analyze_coverage():
    """Analyze which URLs have been scraped vs available"""
    
    # Load the successfully scraped data
    scraped_df = pd.read_excel('/Users/pato/four_store_results_1752024951.xlsx')
    scraped_urls = set(scraped_df['url'].tolist())
    
    # Load the complete dataset
    complete_df = pd.read_csv('/Users/pato/complete_100_products.csv')
    
    print("🔍 URL COVERAGE ANALYSIS")
    print("=" * 80)
    
    # Analyze each store
    for store_col in ['Drop It', 'Miles', 'Pronto', 'HH']:
        print(f"\n🏪 {store_col.upper()}")
        print("-" * 40)
        
        # Get all URLs for this store
        store_urls = []
        for _, row in complete_df.iterrows():
            url = row[store_col]
            if pd.notna(url) and url != 'N/A' and str(url).startswith('http'):
                store_urls.append({
                    'product': row['Product'],
                    'url': url,
                    'scraped': url in scraped_urls
                })
        
        # Count scraped vs not scraped
        scraped_count = sum(1 for item in store_urls if item['scraped'])
        not_scraped_count = len(store_urls) - scraped_count
        
        print(f"📊 Total URLs: {len(store_urls)}")
        print(f"✅ Scraped: {scraped_count}")
        print(f"❌ Not scraped: {not_scraped_count}")
        print(f"📈 Coverage: {(scraped_count/len(store_urls)*100):.1f}%")
        
        # Show some examples of what's been scraped
        scraped_examples = [item for item in store_urls if item['scraped']][:5]
        if scraped_examples:
            print(f"\n✅ SCRAPED EXAMPLES:")
            for example in scraped_examples:
                print(f"   • {example['product']}")
        
        # Show what hasn't been scraped yet
        not_scraped_examples = [item for item in store_urls if not item['scraped']][:5]
        if not_scraped_examples:
            print(f"\n❌ NOT SCRAPED YET:")
            for example in not_scraped_examples:
                print(f"   • {example['product']}")
    
    # Overall statistics
    print(f"\n📊 OVERALL STATISTICS")
    print("=" * 40)
    
    total_available = 0
    total_scraped = 0
    
    for store_col in ['Drop It', 'Miles', 'Pronto', 'HH']:
        store_urls = []
        for _, row in complete_df.iterrows():
            url = row[store_col]
            if pd.notna(url) and url != 'N/A' and str(url).startswith('http'):
                store_urls.append(url)
        
        total_available += len(store_urls)
        total_scraped += sum(1 for url in store_urls if url in scraped_urls)
    
    print(f"Total URLs available: {total_available}")
    print(f"Total URLs scraped: {total_scraped}")
    print(f"Overall coverage: {(total_scraped/total_available*100):.1f}%")
    
    # Show the actual scraped URLs by store
    print(f"\n🔗 SCRAPED URLS BY STORE")
    print("=" * 80)
    
    for store in ['Drop It', 'Miles', 'Pronto', 'HH']:
        store_data = scraped_df[scraped_df['store'] == store]
        print(f"\n🏪 {store.upper()} ({len(store_data)} URLs scraped)")
        for _, row in store_data.iterrows():
            print(f"   ✅ {row['url']}")
    
    # Show products by coverage
    print(f"\n📦 PRODUCT COVERAGE")
    print("=" * 60)
    
    for _, row in complete_df.iterrows():
        product = row['Product']
        stores_scraped = []
        
        for store_col in ['Drop It', 'Miles', 'Pronto', 'HH']:
            url = row[store_col]
            if pd.notna(url) and url != 'N/A' and str(url).startswith('http'):
                if url in scraped_urls:
                    stores_scraped.append(store_col)
        
        if stores_scraped:
            print(f"{product:<25} | Scraped: {', '.join(stores_scraped)}")
    
    return scraped_urls, total_available, total_scraped

if __name__ == "__main__":
    scraped_urls, total_available, total_scraped = analyze_coverage()
    
    print(f"\n🎯 SUMMARY")
    print("=" * 30)
    print(f"Coverage: {total_scraped}/{total_available} URLs ({(total_scraped/total_available*100):.1f}%)")
    print(f"Remaining: {total_available - total_scraped} URLs to scrape")