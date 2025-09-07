/**
 * Test the DST fix for Bermuda timezone calculation
 */

function testBermudaTime(launchTimeString, expectedBermudaHour, expectedIsNight) {
    console.log(`\nTesting: ${launchTimeString}`);
    
    const launchDate = new Date(launchTimeString);
    console.log(`UTC time: ${launchDate.toISOString()}`);
    
    // Determine if Bermuda is in Daylight Saving Time (March - November)
    const year = launchDate.getUTCFullYear();
    const month = launchDate.getUTCMonth(); // 0-based: 0=Jan, 1=Feb, etc.
    const isDST = month >= 2 && month <= 10; // March (2) through November (10)
    
    console.log(`Month: ${month + 1} (${['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][month]}), DST: ${isDST}`);
    
    // UTC-3 during ADT (March-November), UTC-4 during AST (December-February)
    const offsetHours = isDST ? 3 : 4;
    const bermudaTime = new Date(launchDate.getTime() - (offsetHours * 60 * 60 * 1000));
    const hour = bermudaTime.getUTCHours();
    const isNight = hour < 6 || hour >= 20;
    
    console.log(`Bermuda offset: UTC-${offsetHours}`);
    console.log(`Bermuda hour: ${hour}:${bermudaTime.getUTCMinutes().toString().padStart(2, '0')}`);
    console.log(`Is night: ${isNight}`);
    console.log(`Expected hour: ${expectedBermudaHour}, Expected night: ${expectedIsNight}`);
    console.log(`✅ ${hour === expectedBermudaHour && isNight === expectedIsNight ? 'CORRECT' : 'INCORRECT'}`);
}

console.log('=== TESTING BERMUDA DAYLIGHT SAVING TIME FIX ===');

// Test cases
testBermudaTime("2025-08-12T23:59:00Z", 20, true);  // USSF-106: 23:59 UTC should be 20:59 ADT (night)
testBermudaTime("2025-08-07T14:01:00Z", 11, false); // Project Kuiper: 14:01 UTC should be 11:01 ADT (day)
testBermudaTime("2025-08-10T02:16:00Z", 23, true);  // Starlink: 02:16 UTC should be 23:16 ADT (night)

// Test winter time (should use UTC-4)
testBermudaTime("2025-01-15T23:00:00Z", 19, false); // January: 23:00 UTC should be 19:00 AST (evening, not night yet)
testBermudaTime("2025-12-15T01:00:00Z", 21, true);  // December: 01:00 UTC should be 21:00 AST (night)

console.log('\n=== SUMMARY ===');
console.log('August launches should use ADT (UTC-3)');
console.log('USSF-106 at 23:59 UTC = 20:59 ADT = Night launch = High visibility for GTO mission');