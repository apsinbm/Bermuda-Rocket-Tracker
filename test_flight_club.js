// Test Flight Club API for Starlink Group 10-20
// Launch ID: e369a238-2746-4400-9396-62e8b7a660c5

async function testFlightClub() {
  const launchId = 'e369a238-2746-4400-9396-62e8b7a660c5';
  const url = `https://flightclub.io/result/telemetry?llId=${launchId}`;
  
  try {
    console.log(`Fetching: ${url}`);
    const response = await fetch(url);
    console.log(`Status: ${response.status}`);
    
    if (response.ok) {
      const data = await response.json();
      console.log(`Got ${data.length} telemetry points`);
      
      if (data.length > 0) {
        console.log('First few points:');
        data.slice(0, 5).forEach((point, i) => {
          console.log(`  ${i}: t=${point.time}s, lat=${point.lat}, lon=${point.lon}, alt=${point.alt}m`);
        });
        
        console.log('Last few points:');
        data.slice(-5).forEach((point, i) => {
          console.log(`  ${data.length - 5 + i}: t=${point.time}s, lat=${point.lat}, lon=${point.lon}, alt=${point.alt}m`);
        });
      }
    } else {
      console.log('No telemetry data available');
    }
  } catch (error) {
    console.error('Error:', error.message);
  }
}

testFlightClub();