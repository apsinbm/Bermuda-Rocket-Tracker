const puppeteer = require('puppeteer');

async function clearTrajectoryCache() {
  console.log('Starting trajectory cache clearing process...');
  
  const browser = await puppeteer.launch({
    headless: false, // Show browser to see what's happening
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  try {
    const page = await browser.newPage();
    
    // Navigate to the app
    console.log('Navigating to http://localhost:8080...');
    await page.goto('http://localhost:8080', { waitUntil: 'networkidle2' });
    
    // Wait for app to load
    await page.waitForTimeout(3000);
    
    // Execute JavaScript to clear the cache
    console.log('Clearing trajectory cache...');
    await page.evaluate(() => {
      // Clear launch database
      localStorage.removeItem('bermuda-rocket-launches-db');
      localStorage.removeItem('bermuda-rocket-db-metadata');
      
      // Clear any trajectory cache
      const keys = Object.keys(localStorage);
      keys.forEach(key => {
        if (key.includes('trajectory') || key.includes('cache') || key.includes('launch')) {
          localStorage.removeItem(key);
          console.log(`Removed: ${key}`);
        }
      });
      
      console.log('Cache cleared successfully');
    });
    
    // Reload the page
    console.log('Reloading app...');
    await page.reload({ waitUntil: 'networkidle2' });
    
    // Wait for launches to load
    await page.waitForTimeout(5000);
    
    // Look for OTV-8 launch
    console.log('Searching for OTV-8 launch...');
    const otvFound = await page.evaluate(() => {
      const text = document.body.innerText.toLowerCase();
      return text.includes('otv-8') || text.includes('x-37b') || text.includes('ussf-36');
    });
    
    if (otvFound) {
      console.log('✅ OTV-8 launch found in the app');
    } else {
      console.log('❌ OTV-8 launch not found in the app');
    }
    
    // Leave browser open for manual testing
    console.log('Browser left open for manual testing. Press Ctrl+C when done.');
    await new Promise(() => {}); // Keep browser open indefinitely
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await browser.close();
  }
}

clearTrajectoryCache();