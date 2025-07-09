#!/usr/bin/env python3
"""
AUTOMATED SCHEDULER FOR PRODUCTION SCRAPER
Runs scraping every 6 hours automatically
"""

import schedule
import time
import subprocess
import logging
from datetime import datetime, timedelta
import os
import sys

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('/Users/pato/scheduler.log'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

class ProductionScheduler:
    def __init__(self):
        self.scraper_path = "/Users/pato/production_scraper.py"
        self.is_running = False
        
    def run_scraper(self):
        """Execute the production scraper"""
        if self.is_running:
            logger.warning("⚠️ Scraper already running, skipping this cycle")
            return
        
        try:
            self.is_running = True
            logger.info("🚀 Starting scheduled scraping cycle")
            
            # Run the production scraper
            result = subprocess.run(
                [sys.executable, self.scraper_path],
                capture_output=True,
                text=True,
                timeout=7200  # 2 hour timeout
            )
            
            if result.returncode == 0:
                logger.info("✅ Scheduled scraping completed successfully")
                logger.info(f"Output: {result.stdout}")
            else:
                logger.error(f"❌ Scraping failed with return code {result.returncode}")
                logger.error(f"Error: {result.stderr}")
                
        except subprocess.TimeoutExpired:
            logger.error("❌ Scraping timed out after 2 hours")
        except Exception as e:
            logger.error(f"❌ Scheduler error: {e}")
        finally:
            self.is_running = False
    
    def start_scheduler(self):
        """Start the automated scheduler"""
        logger.info("🔄 Starting automated scheduler")
        logger.info("Schedule: Every 6 hours")
        
        # Schedule scraping every 6 hours
        schedule.every(6).hours.do(self.run_scraper)
        
        # Run immediately on start
        self.run_scraper()
        
        logger.info("✅ Scheduler started successfully")
        logger.info(f"Next run: {datetime.now() + timedelta(hours=6)}")
        
        # Keep the scheduler running
        while True:
            schedule.run_pending()
            time.sleep(60)  # Check every minute

def main():
    """Main scheduler function"""
    scheduler = ProductionScheduler()
    
    try:
        scheduler.start_scheduler()
    except KeyboardInterrupt:
        logger.info("⏹️ Scheduler stopped by user")
    except Exception as e:
        logger.error(f"❌ Scheduler failed: {e}")
        raise

if __name__ == "__main__":
    main()