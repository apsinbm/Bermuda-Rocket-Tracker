// Debug orbit classification for Starlink launches

function getTrajectoryVisibility(padName, orbitType) {
  console.log(`Debug: padName="${padName}", orbitType="${orbitType}"`);
  
  // Northeast trajectories (HIGH visibility from Bermuda)
  if (orbitType?.toLowerCase().includes('leo') || 
      orbitType?.toLowerCase().includes('iss') ||
      orbitType?.toLowerCase().includes('station') ||
      orbitType?.toLowerCase().includes('dragon') ||
      orbitType?.toLowerCase().includes('cygnus')) {
    console.log('-> Classified as HIGH (northeast)');
    return 'high';
  }
  
  // Southeast trajectories (MEDIUM visibility from Bermuda)  
  if (orbitType?.toLowerCase().includes('gto') || 
      orbitType?.toLowerCase().includes('geo') ||
      orbitType?.toLowerCase().includes('geosynchronous')) {
    console.log('-> Classified as MEDIUM (southeast)');
    return 'medium';
  }
  
  console.log('-> Classified as MEDIUM (default)');
  return 'medium';
}

// Test with various orbit types that Starlink might have
const testCases = [
  'Low Earth Orbit',
  'LEO', 
  'low earth orbit',
  'Starlink',
  'SSO',
  'Sun-Synchronous Orbit',
  undefined,
  null,
  ''
];

console.log('Testing orbit classifications:');
testCases.forEach(orbitType => {
  console.log(`\nTesting: "${orbitType}"`);
  getTrajectoryVisibility('SLC-40', orbitType);
});

// Test the specific case from the user
console.log('\n--- STARLINK GROUP 10-20 CASE ---');
getTrajectoryVisibility('Space Launch Complex 40', 'Low Earth Orbit');