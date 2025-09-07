/**
 * Trajectory Mapping Service
 * Maps mission types and orbital parameters to accurate trajectory directions
 * Based on real launch data and orbital mechanics
 */

import { Launch } from '../types';

export interface OrbitParameters {
  inclination: number; // degrees
  apogee: number; // km
  perigee: number; // km
  orbitType: 'LEO' | 'MEO' | 'GTO' | 'GEO' | 'Polar' | 'SSO' | 'Unknown';
}

export interface TrajectoryMapping {
  azimuth: number; // launch azimuth in degrees
  direction: 'Northeast' | 'East-Northeast' | 'East' | 'East-Southeast' | 'Southeast' | 'North' | 'South';
  confidence: 'high' | 'medium' | 'low';
  source: 'database' | 'orbital-mechanics' | 'mission-type' | 'fallback';
  orbitParameters?: OrbitParameters;
}

/**
 * Comprehensive mission trajectory database
 * Based on real launch data and orbital mechanics analysis
 */
const MISSION_TRAJECTORY_DATABASE: Record<string, TrajectoryMapping> = {
  // Starlink missions by group - real inclination data
  'starlink-group-1': { azimuth: 51, direction: 'Northeast', confidence: 'high', source: 'database' },
  'starlink-group-2': { azimuth: 53, direction: 'Northeast', confidence: 'high', source: 'database' },
  'starlink-group-3': { azimuth: 53, direction: 'Northeast', confidence: 'high', source: 'database' },
  'starlink-group-4': { azimuth: 45, direction: 'Northeast', confidence: 'high', source: 'database' },
  'starlink-group-5': { azimuth: 55, direction: 'East-Northeast', confidence: 'high', source: 'database' },
  'starlink-group-6': { azimuth: 130, direction: 'Southeast', confidence: 'high', source: 'database' },
  'starlink-group-7': { azimuth: 130, direction: 'Southeast', confidence: 'high', source: 'database' },
  'starlink-group-8': { azimuth: 130, direction: 'Southeast', confidence: 'high', source: 'database' },
  'starlink-group-9': { azimuth: 130, direction: 'Southeast', confidence: 'high', source: 'database' },
  'starlink-group-10': { azimuth: 45, direction: 'Northeast', confidence: 'high', source: 'database' },
  
  // ISS and crew missions
  'iss-crew': { azimuth: 51, direction: 'Northeast', confidence: 'high', source: 'database' },
  'dragon-crew': { azimuth: 51, direction: 'Northeast', confidence: 'high', source: 'database' },
  'cygnus-cargo': { azimuth: 51, direction: 'Northeast', confidence: 'high', source: 'database' },
  
  // Military and GTO missions - these typically go southeast from Cape Canaveral
  'ussf-gto': { azimuth: 130, direction: 'Southeast', confidence: 'high', source: 'database' },
  'ussf-geo': { azimuth: 135, direction: 'Southeast', confidence: 'high', source: 'database' },
  'commercial-gto': { azimuth: 125, direction: 'East-Southeast', confidence: 'high', source: 'database' },
  
  // X-37B OTV missions - typically 38-60° inclination requiring northeast trajectory
  'x-37b': { azimuth: 50, direction: 'Northeast', confidence: 'high', source: 'database' },
  'otv': { azimuth: 50, direction: 'Northeast', confidence: 'high', source: 'database' },
  
  // Polar and SSO missions (corrected)
  'polar-orbit': { azimuth: 180, direction: 'South', confidence: 'high', source: 'database' },
  'sso-mission': { azimuth: 140, direction: 'Southeast', confidence: 'high', source: 'database' },
  
  // KOMPSAT Earth observation satellites (SSO missions)
  'kompsat-7a': { azimuth: 140, direction: 'Southeast', confidence: 'high', source: 'database' },
  'kompsat': { azimuth: 140, direction: 'Southeast', confidence: 'high', source: 'database' },
  
  // Other common SSO Earth observation missions
  'earth-observation': { azimuth: 140, direction: 'Southeast', confidence: 'high', source: 'database' },
  'landsat': { azimuth: 140, direction: 'Southeast', confidence: 'high', source: 'database' },
  'sentinel': { azimuth: 140, direction: 'Southeast', confidence: 'high', source: 'database' }
};

/**
 * Orbital inclination to launch azimuth mapping for Cape Canaveral
 * Based on orbital mechanics with proper handling for retrograde orbits
 */
function calculateLaunchAzimuthFromInclination(inclination: number, launchLatitude: number = 28.5): number {
  const incRad = inclination * Math.PI / 180;
  const latRad = launchLatitude * Math.PI / 180;
  
  // Handle retrograde orbits (inclination > 90°)
  // SSO satellites from Cape Canaveral must launch southeast for safety and efficiency
  if (inclination >= 90) {
    // For retrograde SSO orbits, Cape Canaveral launches southeast over water
    // Typical azimuth range: 135-150°
    return 140; // Southeast trajectory for SSO missions
  }
  
  // Standard formula for prograde orbits
  const cosAzimuth = Math.cos(incRad) / Math.cos(latRad);
  
  // Handle impossible orbits (inclination < launch latitude for prograde)
  if (Math.abs(cosAzimuth) > 1) {
    // Use minimum energy transfer azimuth
    return inclination < launchLatitude ? 90 : 45;
  }
  
  let azimuth = Math.acos(cosAzimuth) * 180 / Math.PI;
  
  // Most prograde missions use ascending node (eastward launch)
  return Math.round(azimuth);
}

/**
 * Determine orbit parameters from mission data
 */
function analyzeOrbitParameters(launch: Launch): OrbitParameters {
  const orbitName = launch.mission.orbit?.name?.toLowerCase() || '';
  const missionName = launch.mission.name.toLowerCase();
  
  // Known orbit types and their typical parameters
  if (orbitName.includes('gto') || orbitName.includes('transfer')) {
    // GTO missions from Cape Canaveral typically use higher inclinations for efficiency
    // They launch southeast to take advantage of Earth's rotation
    return {
      inclination: 27, // GTO inclination optimized for Cape Canaveral latitude
      apogee: 35786,
      perigee: 200,
      orbitType: 'GTO'
    };
  }
  
  if (orbitName.includes('geo') || orbitName.includes('synchronous')) {
    return {
      inclination: 0,
      apogee: 35786,
      perigee: 35786,
      orbitType: 'GEO'
    };
  }
  
  if (orbitName.includes('iss') || orbitName.includes('station') || missionName.includes('dragon')) {
    return {
      inclination: 51.64, // ISS orbital inclination
      apogee: 420,
      perigee: 420,
      orbitType: 'LEO'
    };
  }
  
  if (missionName.includes('starlink')) {
    // Starlink Shell 1: 53.2° inclination, 550km altitude
    return {
      inclination: 53.2,
      apogee: 550,
      perigee: 550,
      orbitType: 'LEO'
    };
  }
  
  if (orbitName.includes('sso') || orbitName.includes('sun-synchronous') || 
      missionName.includes('kompsat') || missionName.includes('earth observation') ||
      missionName.includes('earth imaging') || missionName.includes('surveillance')) {
    return {
      inclination: 98, // Sun-synchronous orbit inclination (retrograde)
      apogee: 800,
      perigee: 800,
      orbitType: 'SSO'
    };
  }
  
  if (orbitName.includes('polar')) {
    return {
      inclination: 90,
      apogee: 800,
      perigee: 800,
      orbitType: 'Polar'
    };
  }
  
  // Default LEO parameters
  return {
    inclination: 45,
    apogee: 400,
    perigee: 400,
    orbitType: 'LEO'
  };
}

/**
 * Convert azimuth to trajectory direction
 */
function azimuthToDirection(azimuth: number): TrajectoryMapping['direction'] {
  if (azimuth >= 15 && azimuth <= 45) {
    return 'Northeast';
  } else if (azimuth >= 45 && azimuth <= 75) {
    return 'East-Northeast';
  } else if (azimuth >= 75 && azimuth <= 105) {
    return 'East';
  } else if (azimuth >= 105 && azimuth <= 135) {
    return 'East-Southeast';
  } else if (azimuth >= 135 && azimuth <= 165) {
    return 'Southeast';
  } else {
    // Default to northeast for unusual azimuths
    return 'Northeast';
  }
}

/**
 * Main function to get accurate trajectory mapping for a launch
 */
export function getTrajectoryMapping(launch: Launch): TrajectoryMapping {
  const missionName = launch.mission.name.toLowerCase();
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const orbitName = launch.mission.orbit?.name?.toLowerCase() || '';
  
  
  // Step 1: Check mission trajectory database first (highest confidence)
  const missionKey = missionName
    .replace(/\s+/g, '-')
    .replace(/[^\w-]/g, '')
    .toLowerCase();
  
  // Special handling for X-37B OTV missions  
  if (missionName.includes('x-37b') || missionName.includes('x37b') || 
      missionName.includes('otv-') || missionName.includes('otv ')) {
    return { 
      azimuth: 50, 
      direction: 'Northeast', 
      confidence: 'high', 
      source: 'database',
      orbitParameters: {
        inclination: 45, // Typical X-37B inclination
        apogee: 400,
        perigee: 350,
        orbitType: 'LEO'
      }
    };
  }
  
  // Special handling for USSF missions
  if (missionName.includes('ussf')) {
    const isGTO = orbitName.includes('gto') || orbitName.includes('transfer');
    const isGEO = orbitName.includes('geo') || orbitName.includes('synchronous');
    
    // Check if it's an X-37B mission (USSF-36 is OTV-8)
    if (missionName.includes('ussf-36') || launch.name?.toLowerCase().includes('x-37b')) {
      return { 
        azimuth: 50, 
        direction: 'Northeast', 
        confidence: 'high', 
        source: 'database',
        orbitParameters: {
          inclination: 45,
          apogee: 400,
          perigee: 350,
          orbitType: 'LEO'
        }
      };
    }
    
    if (isGTO || isGEO) {
      return { azimuth: 130, direction: 'Southeast', confidence: 'high', source: 'database' };
    }
  }
  
  if (MISSION_TRAJECTORY_DATABASE[missionKey]) {
    return MISSION_TRAJECTORY_DATABASE[missionKey];
  }
  
  // Step 2: Check for Starlink group patterns
  const starlinkMatch = missionName.match(/starlink.*group.*(\\d+)/);
  if (starlinkMatch) {
    const groupNumber = parseInt(starlinkMatch[1]);
    
    // Starlink trajectory patterns based on group number
    if (groupNumber >= 1 && groupNumber <= 5) {
      // Shell 1: 53.2° inclination → Northeast
      return { azimuth: 53, direction: 'Northeast', confidence: 'high', source: 'database' };
    } else if (groupNumber >= 6 && groupNumber <= 9) {
      // Shell 4: Polar/inclined shells → Southeast
      return { azimuth: 130, direction: 'Southeast', confidence: 'high', source: 'database' };
    } else {
      // Recent groups typically northeast
      return { azimuth: 50, direction: 'Northeast', confidence: 'medium', source: 'database' };
    }
  }
  
  // Step 3: Use orbital mechanics calculation
  const orbitParams = analyzeOrbitParameters(launch);
  const calculatedAzimuth = calculateLaunchAzimuthFromInclination(orbitParams.inclination);
  const direction = azimuthToDirection(calculatedAzimuth);
  
  
  return {
    azimuth: calculatedAzimuth,
    direction,
    confidence: 'medium',
    source: 'orbital-mechanics',
    orbitParameters: orbitParams
  };
}

/**
 * Get trajectory bearing from Bermuda (for "Look towards" direction)
 * This is different from launch azimuth - it's the direction to look FROM Bermuda
 */
export function getViewingBearingFromBermuda(trajectoryMapping: TrajectoryMapping): number {
  // Bermuda is southwest of Cape Canaveral
  // To see rockets going northeast, look southwest (225°)
  // To see rockets going southeast, look west-southwest (247°)
  // To see rockets going east, look west (270°)
  
  switch (trajectoryMapping.direction) {
    case 'Northeast':
      return 225; // Southwest
    case 'East-Northeast':
      return 240; // Southwest-West
    case 'East':
      return 270; // West
    case 'East-Southeast':
      return 280; // West-Northwest
    case 'Southeast':
      return 300; // Northwest-West
    default:
      return 225; // Default southwest
  }
}

/**
 * Clear trajectory mapping cache (for testing)
 */
export function clearTrajectoryMappingCache(): void {
  // Currently no cache, but could be added for orbital calculations
}

// Export for CommonJS compatibility
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    getTrajectoryMapping,
    getViewingBearingFromBermuda,
    clearTrajectoryMappingCache
  };
}