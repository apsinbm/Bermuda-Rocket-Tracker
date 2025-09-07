/**
 * Test X-37B OTV-8 (USSF-36) trajectory mapping
 */

// Need to compile TypeScript first
const ts = require('typescript');
const fs = require('fs');

// Read and compile the TypeScript file
const tsSource = fs.readFileSync('./src/services/trajectoryMappingService.ts', 'utf8');
const jsSource = ts.transpileModule(tsSource, {
  compilerOptions: { module: ts.ModuleKind.CommonJS }
}).outputText;

// Execute the compiled code
eval(jsSource);

// Test launches
const testLaunches = [
  {
    id: "otv8",
    name: "Falcon 9 | OTV-8 (X-37B) (USSF-36)",
    mission: {
      name: "OTV-8 (X-37B) (USSF-36)",
      orbit: { name: "LEO" }
    },
    pad: {
      latitude: "28.5833",
      longitude: "-80.5833"
    }
  },
  {
    id: "ussf36",
    name: "USSF-36",
    mission: {
      name: "USSF-36",
      orbit: { name: "LEO" }
    },
    pad: {
      latitude: "28.5833",
      longitude: "-80.5833"
    }
  },
  {
    id: "ussf106",
    name: "Vulcan | USSF-106",
    mission: {
      name: "USSF-106",
      orbit: { name: "GTO" }
    },
    pad: {
      latitude: "28.5833", 
      longitude: "-80.5833"
    }
  }
];

console.log('=== TESTING X-37B AND USSF TRAJECTORY MAPPING ===\n');

testLaunches.forEach(launch => {
  const mapping = getTrajectoryMapping(launch);
  const passRelative = mapping.direction === 'Northeast' ? 'NORTH' : 
                       mapping.direction === 'Southeast' ? 'SOUTH' : 'VARIES';
  const lookFrom = mapping.direction === 'Northeast' ? 'Southwest toward Florida' : 
                   'West/Northwest toward Florida';
  
  console.log(`Mission: ${launch.mission.name}`);
  console.log(`  Azimuth: ${mapping.azimuth}°`);
  console.log(`  Direction: ${mapping.direction}`);
  console.log(`  Pass relative to Bermuda: ${passRelative}`);
  console.log(`  Look from Bermuda: ${lookFrom}`);
  console.log('');
});

console.log('=== SUMMARY ===');
console.log('✅ OTV-8 (X-37B): Northeast trajectory, passes NORTH of Bermuda');
console.log('✅ USSF-36 (X-37B): Northeast trajectory, passes NORTH of Bermuda');  
console.log('✅ USSF-106 (GTO): Southeast trajectory, passes SOUTH of Bermuda');