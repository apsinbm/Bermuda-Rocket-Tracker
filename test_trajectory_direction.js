// Test trajectory direction for USSF-106
const { getTrajectoryMapping } = require('./src/services/trajectoryMappingService.js');

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

console.log('Testing USSF-106 trajectory mapping:');
const mapping = getTrajectoryMapping(ussf106);
console.log('Result:', mapping);
console.log('\nExpected: azimuth ~130-140°, direction: Southeast');
console.log('Actual: azimuth', mapping.azimuth + '°, direction:', mapping.direction);
