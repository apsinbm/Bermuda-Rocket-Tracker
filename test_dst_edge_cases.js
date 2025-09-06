/**
 * Test the DST edge case fixes around transition times
 */

// Updated DST functions with UTC conversion
function getFirstSunday(year, month) {
  const firstDay = new Date(year, month, 1);
  const dayOfWeek = firstDay.getDay(); // 0 = Sunday, 1 = Monday, etc.
  const daysUntilSunday = dayOfWeek === 0 ? 0 : 7 - dayOfWeek;
  return new Date(year, month, 1 + daysUntilSunday);
}

function getSecondSunday(year, month) {
  const firstSunday = getFirstSunday(year, month);
  return new Date(firstSunday.getFullYear(), firstSunday.getMonth(), firstSunday.getDate() + 7);
}

function getBermudaDSTTransitions(year) {
  // Second Sunday in March at 2:00 AM
  const startDST = getSecondSunday(year, 2); // March is month index 2
  startDST.setHours(2, 0, 0, 0); // 2:00 AM local time
  
  // First Sunday in November at 2:00 AM
  const endDST = getFirstSunday(year, 10); // November is month index 10
  endDST.setHours(2, 0, 0, 0); // 2:00 AM local time
  
  return { start: startDST, end: endDST };
}

function isBermudaDST(date) {
  const year = date.getFullYear();
  const { start, end } = getBermudaDSTTransitions(year);
  
  // Convert transition times to UTC for accurate comparison
  const startUTC = new Date(start.getTime() + (4 * 60 * 60 * 1000)); // 2:00 AM AST = 6:00 AM UTC
  const endUTC = new Date(end.getTime() + (3 * 60 * 60 * 1000)); // 2:00 AM ADT = 5:00 AM UTC
  
  // DST is active from start date (inclusive) until end date (exclusive)
  return date >= startUTC && date < endUTC;
}

function getBermudaTimeZone(date) {
  return isBermudaDST(date) ? 'ADT' : 'AST';
}

console.log('=== TESTING DST EDGE CASES WITH UTC CONVERSION ===\n');

// Show the actual UTC transition times for 2025
const { start, end } = getBermudaDSTTransitions(2025);
const startUTC = new Date(start.getTime() + (4 * 60 * 60 * 1000));
const endUTC = new Date(end.getTime() + (3 * 60 * 60 * 1000));

console.log('2025 DST Transition Times:');
console.log(`Start DST: March 9, 2:00 AM AST = ${startUTC.toISOString()} UTC`);
console.log(`End DST: November 2, 2:00 AM ADT = ${endUTC.toISOString()} UTC`);
console.log('');

// Test edge cases around transitions
const edgeCases = [
    // Spring transition
    { name: "March 9, 2025 at 5:59 AM UTC (1:59 AM AST, before transition)", date: "2025-03-09T05:59:00Z", expected: "AST" },
    { name: "March 9, 2025 at 6:00 AM UTC (2:00 AM AST, transition moment)", date: "2025-03-09T06:00:00Z", expected: "ADT" },
    { name: "March 9, 2025 at 6:01 AM UTC (3:01 AM ADT, after transition)", date: "2025-03-09T06:01:00Z", expected: "ADT" },
    
    // Fall transition  
    { name: "November 2, 2025 at 4:59 AM UTC (1:59 AM ADT, before transition)", date: "2025-11-02T04:59:00Z", expected: "ADT" },
    { name: "November 2, 2025 at 5:00 AM UTC (2:00 AM ADT, transition moment)", date: "2025-11-02T05:00:00Z", expected: "AST" },
    { name: "November 2, 2025 at 5:01 AM UTC (1:01 AM AST, after transition)", date: "2025-11-02T05:01:00Z", expected: "AST" },
    
    // Regular cases for comparison
    { name: "August 7, 2025 (Project Kuiper)", date: "2025-08-07T14:01:00Z", expected: "ADT" },
    { name: "August 12, 2025 (USSF-106)", date: "2025-08-12T23:59:00Z", expected: "ADT" },
    { name: "December 15, 2025 (Winter)", date: "2025-12-15T20:00:00Z", expected: "AST" }
];

edgeCases.forEach((testCase, index) => {
    console.log(`${index + 1}. ${testCase.name}`);
    const date = new Date(testCase.date);
    const timeZone = getBermudaTimeZone(date);
    const isCorrect = timeZone === testCase.expected;
    
    console.log(`   UTC: ${testCase.date}`);
    console.log(`   Calculated: ${timeZone}`);
    console.log(`   Expected: ${testCase.expected}`);
    console.log(`   ${isCorrect ? '✅ CORRECT' : '❌ INCORRECT'}`);
    console.log('');
});

console.log('=== KEY INSIGHT ===');
console.log('The transition times are in LOCAL time, but we work with UTC dates.');
console.log('Spring: 2:00 AM AST (UTC-4) = 6:00 AM UTC');
console.log('Fall: 2:00 AM ADT (UTC-3) = 5:00 AM UTC');
console.log('This ensures accurate timezone detection for all times!');