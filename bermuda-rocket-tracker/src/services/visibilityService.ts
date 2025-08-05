import { Launch, VisibilityData, LaunchPad } from '../types';
import { extractLaunchCoordinates, getCoordinateError } from '../utils/launchCoordinates';

// ROCKET VISIBILITY FROM BERMUDA - PHYSICS-BASED CALCULATIONS
//
// CURRENT: Simplified algorithm using mission type and basic geometry
// FUTURE: Full physics implementation would require:
//   1. Real trajectory data (lat/lng/alt over time from SpaceX TLE or trajectory files)
//   2. Line-of-sight calculations: cos θ = R/(R+h) where R=6,371km
//   3. Dynamic visibility ring: 1,400-1,600km at Falcon 9 altitudes 150-210km
//   4. Real-time bearing calculations as rocket moves through visibility zone
//
// OBSERVATION DATA (corrected based on trajectory analysis):
// - Visibility window: T+6 to T+9 minutes after liftoff  
// - Northeast launches (35-55° azimuth): visible 45-75° bearing (northeast)
// - Southeast launches (110-135° azimuth): visible 135-165° bearing (southeast)
// - Plume appears low on horizon, climbs and fades by T+9 min

// Bermuda coordinates
const BERMUDA_LAT = 32.3078;
const BERMUDA_LNG = -64.7505;

// Known launch pads and their typical trajectories
const LAUNCH_PADS: Record<string, LaunchPad> = {
  'SLC-40': {
    name: 'Space Launch Complex 40',
    location: { latitude: 28.5618, longitude: -80.5772 },
    typicalAzimuth: [35, 135], // Northeast (35-55°) for ISS/LEO, Southeast (110-135°) for GTO
    description: 'SpaceX Falcon 9 launches - ISS missions northeast, satellites southeast'
  },
  'LC-39A': {
    name: 'Launch Complex 39A',
    location: { latitude: 28.6080, longitude: -80.6040 },
    typicalAzimuth: [35, 135], // Northeast for Crew Dragon, Southeast for heavy payloads
    description: 'SpaceX Falcon Heavy and Crew Dragon - varies by mission profile'
  },
  'SLC-41': {
    name: 'Space Launch Complex 41',
    location: { latitude: 28.5830, longitude: -80.5832 },
    typicalAzimuth: [110, 135], // Primarily southeast for GTO missions
    description: 'ULA Atlas V launches - typically GTO/GEO missions'
  }
};

function calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 3959; // Earth's radius in miles
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function calculateBearing(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const y = Math.sin(dLng) * Math.cos(lat2 * Math.PI / 180);
  const x = Math.cos(lat1 * Math.PI / 180) * Math.sin(lat2 * Math.PI / 180) -
    Math.sin(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.cos(dLng);
  let bearing = Math.atan2(y, x) * 180 / Math.PI;
  return (bearing + 360) % 360;
}

function isNightTime(launchTime: string, bermudaTime: string): boolean {
  const hour = new Date(bermudaTime).getHours();
  return hour < 6 || hour > 20; // Rough night time estimation
}

function isTrajectoryVisible(padLocation: { latitude: number; longitude: number }): boolean {
  // Check if launch trajectory from this location could be visible from Bermuda
  // 
  // PHYSICS: Visibility depends on rocket altitude and Earth's curvature
  // Line-of-sight formula: cos θ = R/(R+h) where R=6,371km, h=altitude
  // Falcon 9 second stage: 150-210km altitude at T+5-8min → 1,400-1,600km visibility ring
  // 
  // Current implementation: Simple distance check (to be enhanced with real trajectory data)
  const distance = calculateDistance(
    BERMUDA_LAT, BERMUDA_LNG,
    padLocation.latitude, padLocation.longitude
  );
  
  // Florida to Bermuda ~900 miles. Visibility ring at 150-200km altitude: ~1,400-1,600km
  // Convert to miles: ~870-990 miles, so pad distance + trajectory extension
  return distance > 700 && distance < 1200;
}

interface TrajectoryInfo {
  visibility: 'high' | 'medium' | 'low' | 'none';
  direction: 'Northeast' | 'East-Northeast' | 'East' | 'East-Southeast' | 'Southeast';
  bearing: number; // viewing direction from Bermuda
}

export function getTrajectoryInfo(padName: string, orbitType?: string, missionName?: string): TrajectoryInfo {
  const orbitLower = orbitType?.toLowerCase() || '';
  const missionLower = missionName?.toLowerCase() || '';
  
  // Classify based on orbit type and typical trajectory patterns
  // NOTE: This is a fallback for when we don't have real trajectory data
  // The enhanced visibility service should use actual trajectory data from Flight Club/Space Launch Schedule
  
  // GTO/GEO missions - rockets go southeast, so look west-southwest to see them coming
  if (orbitLower.includes('gto') || 
      orbitLower.includes('geostationary') ||
      orbitLower.includes('geosynchronous') ||
      orbitLower.includes('transfer orbit')) {
    return {
      visibility: 'medium',
      direction: 'Southeast',
      bearing: 247  // West-Southwest (to see Southeast-bound rockets coming)
    };
  }
  
  // ISS/LEO missions - rockets go northeast, so look southwest to see them coming
  if (orbitLower.includes('iss') || 
      orbitLower.includes('station') ||
      orbitLower.includes('dragon') ||
      orbitLower.includes('cygnus')) {
    return {
      visibility: 'high',
      direction: 'Northeast',
      bearing: 225  // Southwest (to see Northeast-bound rockets coming)
    };
  }
  
  // Starlink missions - CHECK REAL TRAJECTORY DATA FIRST
  // This is just a fallback - the enhanced service should use actual Flight Club data
  if (orbitLower.includes('starlink') || missionLower.includes('starlink')) {
    return {
      visibility: 'high', 
      direction: 'Northeast', // This should come from real trajectory analysis
      bearing: 225  // Southwest (to see Northeast-bound rockets coming)
    };
  }
  
  // General LEO missions - depends on actual trajectory, this is just a fallback
  if (orbitLower.includes('leo') || 
      orbitLower.includes('low earth orbit')) {
    return {
      visibility: 'high',
      direction: 'Northeast', // Most LEO missions from Florida are Northeast
      bearing: 225  // Southwest viewing direction
    };
  }
  
  // Polar/SSO missions - rockets go northeast, so look southwest to see them coming
  if (orbitLower.includes('sso') ||
      orbitLower.includes('sun-synchronous') ||
      orbitLower.includes('polar')) {
    return {
      visibility: 'medium',
      direction: 'Northeast', 
      bearing: 225  // Southwest (to see Northeast-bound rockets coming)
    };
  }
  
  // Default for unknown missions - assume southeast trajectory, look west-southwest
  return {
    visibility: 'medium',
    direction: 'Southeast',
    bearing: 247  // West-Southwest (to see Southeast-bound rockets coming)
  };
}

// Legacy function for backward compatibility
function getTrajectoryVisibility(padName: string, orbitType?: string): 'high' | 'medium' | 'low' | 'none' {
  return getTrajectoryInfo(padName, orbitType).visibility;
}

export function calculateVisibility(launch: Launch): VisibilityData {
  // Extract coordinates using helper function
  const coordinates = extractLaunchCoordinates(launch);
  
  // Validate coordinates before calculations
  if (!coordinates.available) {
    return {
      likelihood: 'none',
      reason: getCoordinateError(launch)
    };
  }
  
  // Convert launch time to Bermuda time (AST/ADT - UTC-4 in summer, UTC-3 in winter)
  const launchTime = new Date(launch.net);
  const bermudaTime = new Date(launchTime.getTime() - (4 * 60 * 60 * 1000)); // Rough AST conversion
  
  // Check if launch trajectory could be visible from Bermuda
  if (!isTrajectoryVisible({ latitude: coordinates.latitude, longitude: coordinates.longitude })) {
    return {
      likelihood: 'none',
      reason: 'Launch trajectory not visible from Bermuda'
    };
  }
  
  const isNight = isNightTime(launch.net, bermudaTime.toISOString());
  const trajectoryInfo = getTrajectoryInfo(launch.pad.name, launch.mission.orbit?.name, launch.mission.name);
  const bearing = trajectoryInfo.bearing;
  
  let likelihood: 'high' | 'medium' | 'low' | 'none';
  let reason = '';
  
  if (isNight && trajectoryInfo.visibility === 'high') {
    likelihood = 'high';
    reason = `Night launch, ${trajectoryInfo.direction.toLowerCase()} trajectory. Look ${trajectoryInfo.direction.toLowerCase()}, low on horizon`;
  } else if (isNight && trajectoryInfo.visibility === 'medium') {
    likelihood = 'medium';
    reason = `Night launch, ${trajectoryInfo.direction.toLowerCase()} trajectory. Look ${trajectoryInfo.direction.toLowerCase()}`;
  } else if (!isNight && trajectoryInfo.visibility === 'high') {
    likelihood = 'medium';
    reason = `Daytime launch with ${trajectoryInfo.direction.toLowerCase()} trajectory. Look ${trajectoryInfo.direction.toLowerCase()}, harder to spot in sunlight`;
  } else if (!isNight && trajectoryInfo.visibility === 'medium') {
    likelihood = 'low';
    reason = `Daytime launch with ${trajectoryInfo.direction.toLowerCase()} trajectory. Look ${trajectoryInfo.direction.toLowerCase()}, very difficult to see`;
  } else {
    likelihood = 'low';
    reason = 'Limited visibility conditions';
  }
  
  return {
    likelihood,
    reason,
    bearing: Math.round(bearing),
    estimatedTimeVisible: isNight ? 'Start watching at T+6 min, visible until T+9 min' : 'Difficult to see in daylight'
  };
}

export function getBearingDirection(bearing: number): string {
  const directions = [
    'North', 'NNE', 'NE', 'ENE', 'East', 'ESE', 'SE', 'SSE',
    'South', 'SSW', 'SW', 'WSW', 'West', 'WNW', 'NW', 'NNW'
  ];
  const index = Math.round(bearing / 22.5) % 16;
  return directions[index];
}