// Test the fixed orbit classification and bearing logic

function getTrajectoryVisibility(padName, orbitType) {
  // Northeast trajectories (HIGH visibility from Bermuda)
  const orbitLower = orbitType?.toLowerCase() || '';
  if (orbitLower.includes('leo') || 
      orbitLower.includes('low earth orbit') ||
      orbitLower.includes('iss') ||
      orbitLower.includes('station') ||
      orbitLower.includes('dragon') ||
      orbitLower.includes('cygnus') ||
      orbitLower.includes('starlink')) {
    return 'high';
  }
  
  // Southeast trajectories (MEDIUM visibility from Bermuda)  
  if (orbitLower.includes('gto') || 
      orbitLower.includes('geo') ||
      orbitLower.includes('geosynchronous')) {
    return 'medium';
  }
  
  return 'medium';
}

function calculateViewing(orbitType, isNight) {
  const trajectoryVisibility = getTrajectoryVisibility('SLC-40', orbitType);
  
  // Calculate proper viewing direction based on trajectory type
  let bearing;
  let trajectoryType;
  if (trajectoryVisibility === 'high') {
    // Northeast trajectory - look northeast from Bermuda
    bearing = 60; // Northeast direction (45-75° range, use middle)
    trajectoryType = 'northeast';
  } else if (trajectoryVisibility === 'medium') {
    // Southeast trajectory - look southeast from Bermuda  
    bearing = 150; // Southeast direction (135-165° range, use middle) 
    trajectoryType = 'southeast';
  }
  
  let likelihood, reason;
  
  if (isNight && trajectoryVisibility === 'high') {
    likelihood = 'high';
    reason = 'Night launch, northeast trajectory (estimated). Look northeast (45-75°), low on horizon';
  } else if (isNight && trajectoryVisibility === 'medium') {
    likelihood = 'medium';
    reason = 'Night launch, southeast trajectory (estimated). Look southeast (135-165°)';
  } else if (!isNight && trajectoryVisibility === 'high') {
    likelihood = 'medium';
    reason = 'Daytime launch with northeast trajectory (estimated). Harder to spot in sunlight';
  } else if (!isNight && trajectoryVisibility === 'medium') {
    likelihood = 'low';
    reason = 'Daytime launch with southeast trajectory (estimated). Very difficult to see';
  }
  
  return { trajectoryVisibility, bearing, trajectoryType, likelihood, reason };
}

console.log('=== STARLINK GROUP 10-20 TEST ===');
console.log('Orbit: "Low Earth Orbit", Daytime launch\n');

const result = calculateViewing('Low Earth Orbit', false);
console.log('Results:');
console.log(`- Trajectory Visibility: ${result.trajectoryVisibility}`);
console.log(`- Trajectory Type: ${result.trajectoryType}`);
console.log(`- Bearing: ${result.bearing}° (${result.bearing >= 315 || result.bearing < 45 ? 'North' : 
                                          result.bearing >= 45 && result.bearing < 135 ? 'Northeast/East' :
                                          result.bearing >= 135 && result.bearing < 225 ? 'Southeast/South' : 'Southwest/West'})`);
console.log(`- Likelihood: ${result.likelihood}`);
console.log(`- Reason: ${result.reason}`);

console.log('\n=== EXPECTED RESULT ===');
console.log('- Trajectory Visibility: high');
console.log('- Trajectory Type: northeast'); 
console.log('- Bearing: 60° (Northeast/East)');
console.log('- Likelihood: medium');
console.log('- Reason: Daytime launch with northeast trajectory (estimated). Harder to spot in sunlight');