// Debug bearing calculations for Starlink Group 10-20
// Launch ID: e369a238-2746-4400-9396-62e8b7a660c5

const BERMUDA_LAT = 32.30;
const BERMUDA_LON = -64.78;

// Cape Canaveral coordinates
const CAPE_CANAVERAL_LAT = 28.5;
const CAPE_CANAVERAL_LON = -80.6;

function calculateBearing(lat1, lon1, lat2, lon2) {
  const dLng = (lon2 - lon1) * Math.PI / 180;
  const y = Math.sin(dLng) * Math.cos(lat2 * Math.PI / 180);
  const x = Math.cos(lat1 * Math.PI / 180) * Math.sin(lat2 * Math.PI / 180) -
    Math.sin(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.cos(dLng);
  
  let bearing = Math.atan2(y, x) * 180 / Math.PI;
  return (bearing + 360) % 360;
}

function bearingToDirection(bearing) {
  if (bearing >= 337.5 || bearing < 22.5) return 'North';
  if (bearing >= 22.5 && bearing < 67.5) return 'Northeast';
  if (bearing >= 67.5 && bearing < 112.5) return 'East';
  if (bearing >= 112.5 && bearing < 157.5) return 'Southeast';
  if (bearing >= 157.5 && bearing < 202.5) return 'South';
  if (bearing >= 202.5 && bearing < 247.5) return 'Southwest';
  if (bearing >= 247.5 && bearing < 292.5) return 'West';
  if (bearing >= 292.5 && bearing < 337.5) return 'Northwest';
}

// Calculate bearing from Bermuda to Cape Canaveral
const bermudaToCape = calculateBearing(BERMUDA_LAT, BERMUDA_LON, CAPE_CANAVERAL_LAT, CAPE_CANAVERAL_LON);
console.log(`Bermuda to Cape Canaveral: ${bermudaToCape.toFixed(1)}° (${bearingToDirection(bermudaToCape)})`);

// Calculate bearing from Cape Canaveral to Bermuda
const capeToBermuda = calculateBearing(CAPE_CANAVERAL_LAT, CAPE_CANAVERAL_LON, BERMUDA_LAT, BERMUDA_LON);
console.log(`Cape Canaveral to Bermuda: ${capeToBermuda.toFixed(1)}° (${bearingToDirection(capeToBermuda)})`);

// Simulate a northeast trajectory from Cape Canaveral
console.log('\nNortheast trajectory simulation:');
for (let i = 0; i <= 10; i++) {
  const t = i / 10; // 0 to 1
  const lat = CAPE_CANAVERAL_LAT + t * (35 - CAPE_CANAVERAL_LAT); // Northeast to ~35°N
  const lon = CAPE_CANAVERAL_LON + t * (-65 - CAPE_CANAVERAL_LON); // East to ~-65°W
  
  const bearing = calculateBearing(BERMUDA_LAT, BERMUDA_LON, lat, lon);
  console.log(`Point ${i}: ${lat.toFixed(1)}, ${lon.toFixed(1)} -> ${bearing.toFixed(1)}° (${bearingToDirection(bearing)})`);
}

// Simulate a southeast trajectory from Cape Canaveral  
console.log('\nSoutheast trajectory simulation:');
for (let i = 0; i <= 10; i++) {
  const t = i / 10; // 0 to 1
  const lat = CAPE_CANAVERAL_LAT + t * (25 - CAPE_CANAVERAL_LAT); // Southeast to ~25°N
  const lon = CAPE_CANAVERAL_LON + t * (-70 - CAPE_CANAVERAL_LON); // East to ~-70°W
  
  const bearing = calculateBearing(BERMUDA_LAT, BERMUDA_LON, lat, lon);
  console.log(`Point ${i}: ${lat.toFixed(1)}, ${lon.toFixed(1)} -> ${bearing.toFixed(1)}° (${bearingToDirection(bearing)})`);
}