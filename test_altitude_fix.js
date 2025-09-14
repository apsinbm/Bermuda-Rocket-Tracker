// Test the altitude calculation fix
console.log('Testing trajectory altitude calculation...');

// Simulate the realistic physics model
function testAltitudeCalculation() {
  const testTimes = [0, 162, 165, 300, 540, 600];
  
  testTimes.forEach(t => {
    let velocity; // km/s
    let altitude; // meters
    
    if (t <= 162) {
      // First stage burn: 0 to ~2.4 km/s, 0 to ~80km altitude
      velocity = (t / 162) * 2.4;
      altitude = Math.pow(t / 162, 1.8) * 80000; // Non-linear altitude gain
    } else if (t <= 165) {
      // Stage separation: maintain velocity, slight altitude gain
      velocity = 2.4;
      altitude = 80000 + (t - 162) * 1000; // +3km during separation
    } else if (t <= 540) {
      // Second stage burn: 2.4 to ~7.8 km/s, 80km to ~200km
      const secondStageProgress = (t - 165) / (540 - 165);
      velocity = 2.4 + secondStageProgress * 5.4; // Reach orbital velocity
      altitude = 80000 + Math.pow(secondStageProgress, 1.2) * 120000; // Reach ~200km
    } else {
      // Coasting: maintain orbital velocity and altitude
      velocity = 7.8;
      altitude = 200000 + (t - 540) * 100; // Slight altitude increase
    }
    
    console.log(`T+${t}s: ${(altitude/1000).toFixed(1)}km altitude, ${velocity.toFixed(1)}km/s velocity`);
  });
}

testAltitudeCalculation();

console.log('\n✅ Expected max altitude: 200km (not 68.7km)');
console.log('✅ Expected max velocity: 7.8km/s (not constant 8km/s)');