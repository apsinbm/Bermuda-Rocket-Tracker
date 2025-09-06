/**
 * BROWSER CONSOLE TEST SCRIPT
 * Copy and paste this entire script into the browser console at http://localhost:8080
 * to perform comprehensive OTV-8 trajectory direction validation
 */

console.log('=== OTV-8 TRAJECTORY DIRECTION VALIDATION SCRIPT ===');
console.log('🧪 Starting comprehensive browser-based testing...\n');

// Step 1: Clear cache
console.log('📋 Step 1: Clearing app cache...');
try {
  window.clearLaunchCache();
  localStorage.removeItem('bermuda-rocket-launches-db');
  localStorage.removeItem('bermuda-rocket-db-metadata');
  console.log('✅ Cache cleared successfully');
} catch (error) {
  console.log('⚠️  Cache clearing function not available, clearing manually...');
  localStorage.removeItem('bermuda-rocket-launches-db');
  localStorage.removeItem('bermuda-rocket-db-metadata');
}

// Step 2: Wait and search for OTV-8 launch
setTimeout(() => {
  console.log('\n📋 Step 2: Searching for OTV-8 launch...');
  
  // Search for OTV-8 in the page content
  const pageText = document.body.innerText.toLowerCase();
  const otvFound = pageText.includes('otv-8') || pageText.includes('x-37b') || pageText.includes('ussf-36');
  
  if (otvFound) {
    console.log('✅ OTV-8 launch found in page content');
    
    // Try to find the specific launch card
    const launchCards = document.querySelectorAll('[class*="launch"], [class*="card"], .space-y-6 > div');
    let otvCard = null;
    
    launchCards.forEach(card => {
      const cardText = card.innerText.toLowerCase();
      if (cardText.includes('otv-8') || cardText.includes('x-37b') || cardText.includes('ussf-36')) {
        otvCard = card;
        console.log('🎯 Found OTV-8 launch card');
      }
    });
    
    if (otvCard) {
      console.log('\n📋 Step 3A: Testing text description for trajectory direction...');
      const cardText = otvCard.innerText;
      console.log('Card content:', cardText);
      
      if (cardText.toLowerCase().includes('northeast')) {
        console.log('✅ PASS: Text description mentions Northeast trajectory');
      } else if (cardText.toLowerCase().includes('southeast')) {
        console.log('❌ FAIL: Text description incorrectly shows Southeast trajectory');
      } else {
        console.log('⚠️  UNCLEAR: Trajectory direction not explicitly mentioned in text');
      }
      
      // Look for trajectory-related buttons (Sky Map, 2D Visualization)
      console.log('\n📋 Step 3B: Looking for Interactive Sky Map button...');
      const skyMapButtons = otvCard.querySelectorAll('button');
      skyMapButtons.forEach(button => {
        if (button.innerText.includes('Sky Map') || button.innerText.includes('Interactive')) {
          console.log('🔍 Found Sky Map button:', button.innerText);
          console.log('⚠️  Manual test required: Click this button and verify arrow points Northeast');
        }
      });
      
      console.log('\n📋 Step 3C: Looking for 2D Trajectory button...');
      skyMapButtons.forEach(button => {
        if (button.innerText.includes('2D') || button.innerText.includes('Trajectory')) {
          console.log('🔍 Found 2D Trajectory button:', button.innerText);
          console.log('⚠️  Manual test required: Click this button and verify trajectory line heads Northeast');
        }
      });
      
      console.log('\n📋 Step 3D: Testing tracking explanation...');
      if (cardText.toLowerCase().includes('southwest')) {
        console.log('✅ PASS: Tracking explanation mentions looking Southwest (correct for Northeast trajectory)');
      } else if (cardText.toLowerCase().includes('northwest')) {
        console.log('❌ FAIL: Tracking explanation incorrectly mentions Northwest (would be for Southeast trajectory)');
      } else {
        console.log('⚠️  UNCLEAR: No clear viewing direction mentioned in tracking explanation');
      }
      
    } else {
      console.log('❌ Could not find OTV-8 launch card for detailed testing');
    }
    
  } else {
    console.log('❌ OTV-8 launch not found in page content');
    console.log('Possible issues:');
    console.log('- Launch data not loaded yet (wait and try again)');
    console.log('- Launch filtered out by date/status');
    console.log('- API issues');
  }
  
  // Step 4: Regression testing
  console.log('\n📋 Step 4: Regression testing other missions...');
  
  // Look for USSF-106 (should be Southeast)
  if (pageText.includes('ussf-106')) {
    console.log('🔍 Found USSF-106 mission');
    const ussfCards = Array.from(launchCards).filter(card => 
      card.innerText.toLowerCase().includes('ussf-106')
    );
    
    if (ussfCards.length > 0) {
      const ussfText = ussfCards[0].innerText.toLowerCase();
      if (ussfText.includes('southeast')) {
        console.log('✅ PASS: USSF-106 correctly shows Southeast trajectory');
      } else if (ussfText.includes('northeast')) {
        console.log('❌ REGRESSION: USSF-106 incorrectly shows Northeast (should be Southeast)');
      } else {
        console.log('⚠️  USSF-106 trajectory direction unclear');
      }
    }
  }
  
  // Look for Starlink (should be Northeast)
  if (pageText.includes('starlink')) {
    console.log('🔍 Found Starlink mission(s)');
    const starlinkCards = Array.from(launchCards).filter(card => 
      card.innerText.toLowerCase().includes('starlink')
    );
    
    if (starlinkCards.length > 0) {
      const starlinkText = starlinkCards[0].innerText.toLowerCase();
      if (starlinkText.includes('northeast')) {
        console.log('✅ PASS: Starlink correctly shows Northeast trajectory');
      } else if (starlinkText.includes('southeast')) {
        console.log('❌ REGRESSION: Starlink incorrectly shows Southeast (should be Northeast)');
      } else {
        console.log('⚠️  Starlink trajectory direction unclear');
      }
    }
  }
  
  console.log('\n=== BROWSER VALIDATION COMPLETE ===');
  console.log('\n📋 MANUAL TESTING CHECKLIST:');
  console.log('1. ✅ Find OTV-8 launch card');
  console.log('2. ✅ Verify text mentions Northeast trajectory');
  console.log('3. 🔘 Click Interactive Sky Map - arrow should point Northeast');
  console.log('4. 🔘 Click 2D Trajectory - line should head Northeast from launch pad');
  console.log('5. ✅ Verify tracking explanation mentions looking Southwest');
  console.log('6. ✅ Check USSF-106 still shows Southeast (regression test)');
  console.log('7. ✅ Check Starlink still shows Northeast (regression test)');
  
  console.log('\n🎯 CRITICAL SUCCESS CRITERIA:');
  console.log('✅ OTV-8 shows Northeast in ALL views (text, sky map, 2D chart)');
  console.log('✅ No contradictions between different representations');
  console.log('✅ Other missions maintain correct directions');
  
}, 3000); // Wait 3 seconds for page to load

// Provide reload function
console.log('\n🔄 If page is not fully loaded, run: location.reload()');
console.log('📝 To run this test again, copy and paste this entire script');