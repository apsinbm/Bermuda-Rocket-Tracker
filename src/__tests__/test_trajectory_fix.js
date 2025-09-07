/**
 * Test that USSF-106 trajectory is now correctly showing Southeast direction
 */

const { getTrajectoryMapping } = require('./src/services/trajectoryMappingService');

const ussf106 = {
  id: "ussf106",
  name: "Vulcan VC4S | USSF-106",
  mission: {
    name: "USSF-106",
    orbit: { name: "GTO" }
  },
  pad: {
    latitude: "28.5833",
    longitude: "-80.5833"
  }
};

console.log('=== TESTING USSF-106 TRAJECTORY FIX ===\n');

const mapping = getTrajectoryMapping(ussf106);

console.log('Mission: USSF-106 (GTO - Geosynchronous Transfer Orbit)');
console.log('Expected: Southeast trajectory (azimuth ~130°)');
console.log('\nResult:');
console.log(`  Azimuth: ${mapping.azimuth}°`);
console.log(`  Direction: ${mapping.direction}`);
console.log(`  Confidence: ${mapping.confidence}`);
console.log(`  Source: ${mapping.source}`);

const isCorrect = mapping.direction === 'Southeast' && mapping.azimuth >= 125 && mapping.azimuth <= 140;

console.log('\n' + (isCorrect ? '✅ SUCCESS\!' : '❌ FAILED\!'));
console.log(isCorrect ? 
  'USSF-106 now correctly shows Southeast trajectory\!' : 
  'USSF-106 still showing incorrect trajectory');

console.log('\n=== TRAJECTORY INTERPRETATION ===');
console.log('Southeast trajectory means:');
console.log('  • Rocket launches from Florida heading southeast');
console.log('  • Passes SOUTH of Bermuda');
console.log('  • Visible to the southwest/west from Bermuda');
console.log('  • Optimal for reaching geostationary orbit');
