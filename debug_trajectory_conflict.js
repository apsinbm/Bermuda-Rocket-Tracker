/**
 * Debug the OTV-8 trajectory direction conflict between text descriptions and 2D visualization
 */

console.log('=== OTV-8 TRAJECTORY DIRECTION CONFLICT DEBUG ===\n');

// Mock OTV-8 launch data similar to what the app would receive
const mockOTV8Launch = {
  id: "otv8-test",
  name: "Falcon 9 Block 5 | OTV-8 (USSF-36)",
  mission: {
    name: "OTV-8 (X-37B) (USSF-36)",
    orbit: { name: "LEO" }
  },
  pad: {
    name: "Space Launch Complex 40",
    location: {
      latitude: 28.5618,
      longitude: -80.5772
    }
  }
};

console.log('Launch Data:');
console.log('  Name:', mockOTV8Launch.name);
console.log('  Mission:', mockOTV8Launch.mission.name);
console.log('  Orbit:', mockOTV8Launch.mission.orbit.name);
console.log('  Pad:', mockOTV8Launch.pad.name);
console.log('');

// Manual trajectory mapping simulation
console.log('=== TRAJECTORY MAPPING SERVICE LOGIC ===');
console.log('Step 1: Mission name analysis');

const missionName = mockOTV8Launch.mission.name.toLowerCase();
console.log('  Mission name (lowercase):', missionName);
console.log('  Contains "x-37b":', missionName.includes('x-37b'));
console.log('  Contains "x37b":', missionName.includes('x37b'));
console.log('  Contains "otv-":', missionName.includes('otv-'));
console.log('  Contains "otv ":', missionName.includes('otv '));

// Check USSF special handling
console.log('');
console.log('Step 2: USSF special handling');
console.log('  Contains "ussf":', missionName.includes('ussf'));
console.log('  Contains "ussf-36":', missionName.includes('ussf-36'));

// Expected result from trajectory mapping service
console.log('');
console.log('Step 3: Expected trajectory mapping result');
console.log('  Expected Azimuth: 50°');
console.log('  Expected Direction: Northeast');
console.log('  Expected Confidence: high');
console.log('  Expected Source: database');

console.log('');
console.log('=== 2D VISUALIZATION COORDINATE CALCULATION ===');
console.log('Step 1: Azimuth conversion to coordinates');

// Simulate the 2D visualization azimuth calculation
const azimuth = 50; // Expected from trajectory mapping
const azimuthRad = azimuth * Math.PI / 180;

console.log('  Azimuth:', azimuth, 'degrees');
console.log('  Azimuth (radians):', azimuthRad);

// This is the CRITICAL calculation that may be causing the issue
const latDelta = -Math.cos(azimuthRad) * 10; // Negative cos for southern component
const lngDelta = Math.sin(azimuthRad) * 15; // Positive sin for eastern component

console.log('');
console.log('Step 2: Coordinate deltas calculation');
console.log('  Math.cos(' + azimuth + '°) =', Math.cos(azimuthRad));
console.log('  Math.sin(' + azimuth + '°) =', Math.sin(azimuthRad));
console.log('  latDelta = -Math.cos(' + azimuth + '°) * 10 =', latDelta);
console.log('  lngDelta = Math.sin(' + azimuth + '°) * 15 =', lngDelta);

console.log('');
console.log('Step 3: What this means for trajectory');
console.log('  Cape Canaveral start: ~28.56°N, -80.58°W');
console.log('  With latDelta =', latDelta, '(NEGATIVE = moving SOUTH)');
console.log('  With lngDelta =', lngDelta, '(POSITIVE = moving EAST)');

if (latDelta < 0) {
  console.log('  🚨 PROBLEM FOUND: Negative latDelta means trajectory goes SOUTH');
  console.log('     This would make the 2D visualization show SOUTHEAST path!');
} else {
  console.log('  ✅ Positive latDelta means trajectory goes NORTH (correct for Northeast)');
}

console.log('');
console.log('=== COORDINATE SYSTEM ANALYSIS ===');
console.log('Expected behavior for 50° azimuth (Northeast):');
console.log('  • Should move NORTH (positive latitude change)');
console.log('  • Should move EAST (positive longitude change)');
console.log('');
console.log('Actual calculation result:');
console.log('  • latDelta =', latDelta, '→', latDelta < 0 ? 'SOUTH' : 'NORTH', '(', latDelta < 0 ? '❌ WRONG' : '✅ CORRECT', ')');
console.log('  • lngDelta =', lngDelta, '→', lngDelta > 0 ? 'EAST' : 'WEST', '(', lngDelta > 0 ? '✅ CORRECT' : '❌ WRONG', ')');

console.log('');
console.log('=== ROOT CAUSE IDENTIFIED ===');
if (latDelta < 0) {
  console.log('🚨 THE ISSUE: The 2D visualization uses -Math.cos(azimuth) for latitude');
  console.log('   This creates NEGATIVE latitude change for Northeast trajectories');
  console.log('   Making the rocket path go SOUTHEAST instead of NORTHEAST');
  console.log('');
  console.log('🔧 THE FIX: Change latitude calculation to +Math.cos(azimuth) or');
  console.log('   adjust the azimuth coordinate system to match expected behavior');
} else {
  console.log('✅ No coordinate system issue found - the math checks out');
}

console.log('');
console.log('=== VERIFICATION WITH DIFFERENT AZIMUTHS ===');
const testAzimuths = [
  { name: 'Northeast (45°)', azimuth: 45, expected: 'NE' },
  { name: 'Northeast (50°)', azimuth: 50, expected: 'NE' },
  { name: 'East (90°)', azimuth: 90, expected: 'E' },
  { name: 'Southeast (135°)', azimuth: 135, expected: 'SE' }
];

testAzimuths.forEach(test => {
  const rad = test.azimuth * Math.PI / 180;
  const lat = -Math.cos(rad) * 10;
  const lng = Math.sin(rad) * 15;
  const actualDir = lat < 0 ? (lng > 0 ? 'SE' : 'SW') : (lng > 0 ? 'NE' : 'NW');
  const correct = actualDir === test.expected;
  
  console.log(`${test.name}: lat=${lat.toFixed(2)}, lng=${lng.toFixed(2)} → ${actualDir} ${correct ? '✅' : '❌'}`);
});