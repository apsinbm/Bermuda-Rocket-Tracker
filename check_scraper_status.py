#!/usr/bin/env python3
"""
Check status of background scraper
"""
import os
import glob
import json
import time

def check_scraper_status():
    """Check if background scraper is running and show results"""
    
    # Check for background scraper process
    import subprocess
    result = subprocess.run(['ps', 'aux'], capture_output=True, text=True)
    background_running = 'background_scraper.py' in result.stdout
    
    print("🔍 BACKGROUND SCRAPER STATUS")
    print("=" * 50)
    print(f"Background scraper running: {'✅ YES' if background_running else '❌ NO'}")
    
    # Check for results files
    results_files = glob.glob('/Users/pato/background_scraper_results_*.json')
    log_files = glob.glob('/Users/pato/scraper_log_*.log')
    
    print(f"Results files found: {len(results_files)}")
    print(f"Log files found: {len(log_files)}")
    
    # Show latest results if available
    if results_files:
        latest_results = max(results_files, key=os.path.getctime)
        print(f"\n📊 LATEST RESULTS: {latest_results}")
        
        try:
            with open(latest_results, 'r') as f:
                data = json.load(f)
                print(f"Total processed: {data.get('total_processed', 0)}")
                print(f"Successful results: {data.get('successful_results', 0)}")
                print(f"Success rate: {data.get('success_rate', 'N/A')}")
                
                # Show some sample results
                results = data.get('results', [])
                if results:
                    print(f"\n🛍️ SAMPLE RESULTS (last 5):")
                    for result in results[-5:]:
                        print(f"  {result['store']:<10} | ${result['price']:<6.2f} | {result['product_name']}")
                        
        except Exception as e:
            print(f"❌ Error reading results: {e}")
    
    # Show latest log if available
    if log_files:
        latest_log = max(log_files, key=os.path.getctime)
        print(f"\n📋 LATEST LOG: {latest_log}")
        
        try:
            with open(latest_log, 'r') as f:
                lines = f.readlines()
                if lines:
                    print("Last 10 log entries:")
                    for line in lines[-10:]:
                        print(f"  {line.strip()}")
        except Exception as e:
            print(f"❌ Error reading log: {e}")
    
    # Check if we need to start scraper
    if not background_running and not results_files:
        print(f"\n🚀 RECOMMENDATION: Start background scraper")
        print("Run: python3 background_scraper.py")
    elif background_running:
        print(f"\n⏳ RECOMMENDATION: Wait for scraper to complete")
        print("Check again in a few minutes")

if __name__ == "__main__":
    check_scraper_status()