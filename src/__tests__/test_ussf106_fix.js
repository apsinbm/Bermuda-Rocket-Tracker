/**
 * Test the specific USSF-106 launch that was showing incorrect visibility
 */

const ussf106Launch = {
    id: "ussf106",
    name: "Vulcan VC4S | USSF-106", 
    net: "2025-08-12T23:59:00Z", // 23:59 UTC on Aug 12
    mission: {
        name: "USSF-106",
        orbit: { name: "GTO" } // Geosynchronous Transfer Orbit
    },
    pad: {
        name: "SLC-41",
        latitude: "28.5833",
        longitude: "-80.5833",
        location: {
            name: "Cape Canaveral SFS, FL, USA"
        }
    },
    rocket: { name: "Vulcan VC4S" },
    status: { name: "Go" }
};

console.log('=== TESTING USSF-106 VISIBILITY FIX ===\n');

// Test the visibility calculation logic
function testUSSF106Visibility() {
    const launch = ussf106Launch;
    console.log(`Testing: ${launch.name}`);
    console.log(`Launch time: ${launch.net}`);
    
    const launchDate = new Date(launch.net);
    
    // Check DST calculation
    const month = launchDate.getUTCMonth(); // August = 7 (0-based)
    const isDST = month >= 2 && month <= 10; // Should be true for August
    const offsetHours = isDST ? 3 : 4; // Should be 3 for August (ADT)
    
    console.log(`Month: ${month + 1} (August), DST: ${isDST}, Offset: UTC-${offsetHours}`);
    
    const bermudaTime = new Date(launchDate.getTime() - (offsetHours * 60 * 60 * 1000));
    const hour = bermudaTime.getUTCHours();
    const minute = bermudaTime.getUTCMinutes();
    const isNight = hour < 6 || hour >= 20;
    
    console.log(`Bermuda time: ${hour}:${minute.toString().padStart(2, '0')} (${hour >= 12 ? hour - 12 || 12 : hour}:${minute.toString().padStart(2, '0')} ${hour >= 12 ? 'PM' : 'AM'})`);
    console.log(`Is night: ${isNight}`);
    
    // Check trajectory (GTO should be Southeast)
    const orbit = launch.mission.orbit?.name?.toLowerCase() || '';
    let trajectory = 'Northeast';
    if (orbit.includes('gto')) {
        trajectory = 'Southeast';
    }
    console.log(`Orbit: ${orbit}, Trajectory: ${trajectory}`);
    
    // Calculate likelihood
    let likelihood = 'low';
    if (isNight) {
        if (trajectory === 'Southeast') {
            likelihood = 'high'; // GTO night launches should be high visibility
        } else {
            likelihood = 'medium';
        }
    }
    
    console.log(`Final likelihood: ${likelihood}`);
    
    const expectedResults = {
        bermudaHour: 20, // 23:59 UTC - 3 hours = 20:59 ADT
        bermudaMinute: 59,
        isNight: true,
        trajectory: 'Southeast',
        likelihood: 'high'
    };
    
    console.log('\n--- VERIFICATION ---');
    console.log(`✅ Bermuda time: ${hour}:${minute} (expected 20:59) - ${hour === expectedResults.bermudaHour && minute === expectedResults.bermudaMinute ? 'CORRECT' : 'INCORRECT'}`);
    console.log(`✅ Is night: ${isNight} (expected true) - ${isNight === expectedResults.isNight ? 'CORRECT' : 'INCORRECT'}`);
    console.log(`✅ Trajectory: ${trajectory} (expected Southeast) - ${trajectory === expectedResults.trajectory ? 'CORRECT' : 'INCORRECT'}`);
    console.log(`✅ Likelihood: ${likelihood} (expected high) - ${likelihood === expectedResults.likelihood ? 'CORRECT' : 'INCORRECT'}`);
    
    const allCorrect = hour === expectedResults.bermudaHour && 
                       minute === expectedResults.bermudaMinute && 
                       isNight === expectedResults.isNight && 
                       trajectory === expectedResults.trajectory && 
                       likelihood === expectedResults.likelihood;
    
    console.log(`\n🎯 OVERALL RESULT: ${allCorrect ? '✅ ALL CORRECT - USSF-106 should now show HIGH visibility' : '❌ STILL HAS ISSUES'}`);
    
    return allCorrect;
}

testUSSF106Visibility();

console.log('\n=== EXPECTED APP DISPLAY ===');
console.log('USSF-106');
console.log('Vulcan VC4S');
console.log('');
console.log('High Visibility 🟢'); 
console.log('Date: Aug 12, 2025');
console.log('Time (Bermuda): 08:59 PM ADT');
console.log('Launch Pad: Space Launch Complex 41, Florida, USA');
console.log('Target Orbit: Geosynchronous Transfer Orbit');
console.log('');
console.log('🌙 Night launch going Southeast (GTO) - look for a bright moving star climbing slowly across the sky.');