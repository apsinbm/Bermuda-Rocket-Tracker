/**
 * Comprehensive trajectory database based on real Florida launch data
 * Sources: Space Launch Schedule, Flight Club telemetry, orbital mechanics
 */

export interface TrajectorySpec {
  inclination: number;
  azimuth: number;
  direction: 'Northeast' | 'East-Northeast' | 'East' | 'East-Southeast' | 'Southeast';
  bearing: number; // viewing direction from Bermuda
  visibility: 'high' | 'medium' | 'low';
  confidence: 'high' | 'medium' | 'low';
  source: string;
}

/**
 * Mission-specific trajectory database
 * Based on actual Flight Club telemetry and SpaceX mission data
 */
export const MISSION_TRAJECTORIES: Record<string, TrajectorySpec> = {
  // ISS MISSIONS - All use 51.6° inclination for ISS compatibility
  'iss': {
    inclination: 51.6,
    azimuth: 44.9,
    direction: 'Northeast',
    bearing: 225, // Southwest
    visibility: 'high',
    confidence: 'high',
    source: 'ISS orbital requirements'
  },
  
  'crew_dragon': {
    inclination: 51.6,
    azimuth: 44.9,
    direction: 'Northeast',
    bearing: 225, // Southwest
    visibility: 'high',
    confidence: 'high',
    source: 'ISS docking requirement'
  },
  
  'cygnus': {
    inclination: 51.6,
    azimuth: 44.9,
    direction: 'Northeast',
    bearing: 225, // Southwest
    visibility: 'high',
    confidence: 'high',
    source: 'ISS cargo mission'
  },
  
  // STARLINK MISSIONS - Verified from Flight Club Group 10-20 telemetry
  'starlink_standard': {
    inclination: 53.4,
    azimuth: 42.7,
    direction: 'Northeast',
    bearing: 225, // Southwest
    visibility: 'high',
    confidence: 'high',
    source: 'Flight Club Group 10-20: 53.4152°'
  },
  
  'starlink_polar': {
    inclination: 97.6,
    azimuth: 35,
    direction: 'Northeast',
    bearing: 225, // Southwest
    visibility: 'medium',
    confidence: 'medium',
    source: 'Polar Starlink shells'
  },
  
  'starlink_lower': {
    inclination: 43.0,
    azimuth: 50,
    direction: 'East-Northeast',
    bearing: 247, // West-Southwest
    visibility: 'high',
    confidence: 'medium',
    source: 'Lower Starlink shells'
  },
  
  // GTO MISSIONS - True easterly launches for geostationary orbit
  'gto_standard': {
    inclination: 28.5,
    azimuth: 90,
    direction: 'East',
    bearing: 270, // West
    visibility: 'medium',
    confidence: 'high',
    source: 'Cape Canaveral natural inclination'
  },
  
  'geostationary': {
    inclination: 28.5,
    azimuth: 90,
    direction: 'East',
    bearing: 270, // West
    visibility: 'medium',
    confidence: 'high',
    source: 'Geostationary transfer requirement'
  },
  
  // MILITARY/GOVERNMENT MISSIONS
  'nro': {
    inclination: 63.4,
    azimuth: 40,
    direction: 'Northeast',
    bearing: 225, // Southwest
    visibility: 'medium',
    confidence: 'medium',
    source: 'Typical NRO polar access'
  },
  
  'space_force': {
    inclination: 28.5,
    azimuth: 90,
    direction: 'East',
    bearing: 270, // West
    visibility: 'medium',
    confidence: 'medium',
    source: 'Military satellite requirements'
  },
  
  // POLAR/SUN-SYNCHRONOUS
  'polar': {
    inclination: 98,
    azimuth: 35,
    direction: 'Northeast',
    bearing: 225, // Southwest
    visibility: 'medium',
    confidence: 'high',
    source: 'Sun-synchronous orbit requirement'
  },
  
  'sso': {
    inclination: 98,
    azimuth: 35,
    direction: 'Northeast',
    bearing: 225, // Southwest
    visibility: 'medium',
    confidence: 'high',
    source: 'Sun-synchronous orbit'
  }
};

/**
 * Orbit type to trajectory mapping
 * Based on comprehensive Florida launch analysis
 */
export const ORBIT_TRAJECTORIES: Record<string, TrajectorySpec> = {
  'low earth orbit': {
    inclination: 53.4, // Default to Starlink-type
    azimuth: 42.7,
    direction: 'Northeast',
    bearing: 225, // Southwest
    visibility: 'high',
    confidence: 'medium',
    source: 'Most common LEO trajectory from Florida'
  },
  
  'geostationary transfer orbit': {
    inclination: 28.5,
    azimuth: 90,
    direction: 'East',
    bearing: 270, // West
    visibility: 'medium',
    confidence: 'high',
    source: 'GTO standard trajectory'
  },
  
  'sun-synchronous orbit': {
    inclination: 98,
    azimuth: 35,
    direction: 'Northeast',
    bearing: 225, // Southwest
    visibility: 'medium',
    confidence: 'high',
    source: 'SSO requirement'
  },
  
  'polar orbit': {
    inclination: 90,
    azimuth: 35,
    direction: 'Northeast',
    bearing: 225, // Southwest
    visibility: 'medium',
    confidence: 'high',
    source: 'Polar orbit access'
  }
};

/**
 * Get trajectory specification based on mission analysis
 */
export function getTrajectorySpec(
  missionName: string, 
  orbitType: string, 
  padName: string
): TrajectorySpec {
  const missionLower = missionName.toLowerCase();
  const orbitLower = orbitType.toLowerCase();
  
  // First check for specific mission patterns
  if (missionLower.includes('starlink')) {
    if (missionLower.includes('polar')) {
      return MISSION_TRAJECTORIES.starlink_polar;
    }
    return MISSION_TRAJECTORIES.starlink_standard;
  }
  
  if (missionLower.includes('dragon') || missionLower.includes('crew')) {
    return MISSION_TRAJECTORIES.crew_dragon;
  }
  
  if (missionLower.includes('cygnus') || orbitLower.includes('iss') || orbitLower.includes('station')) {
    return MISSION_TRAJECTORIES.iss;
  }
  
  if (missionLower.includes('nro') || missionLower.includes('classified')) {
    return MISSION_TRAJECTORIES.nro;
  }
  
  // Then check orbit types
  if (orbitLower.includes('geostationary') || orbitLower.includes('gto')) {
    return ORBIT_TRAJECTORIES['geostationary transfer orbit'];
  }
  
  if (orbitLower.includes('sun-synchronous') || orbitLower.includes('sso')) {
    return ORBIT_TRAJECTORIES['sun-synchronous orbit'];
  }
  
  if (orbitLower.includes('polar')) {
    return ORBIT_TRAJECTORIES['polar orbit'];
  }
  
  // Default LEO missions - most are Northeast from Florida
  if (orbitLower.includes('leo') || orbitLower.includes('low earth orbit')) {
    return ORBIT_TRAJECTORIES['low earth orbit'];
  }
  
  // Unknown missions - default to Southeast (most conservative)
  return {
    inclination: 28.5,
    azimuth: 120,
    direction: 'Southeast',
    bearing: 247, // West-Southwest
    visibility: 'medium',
    confidence: 'low',
    source: 'Default assumption - Southeast trajectory'
  };
}

/**
 * Validate trajectory against known orbital mechanics
 */
export function validateTrajectory(spec: TrajectorySpec, padName: string): boolean {
  const CAPE_CANAVERAL_LAT = 28.5;
  
  // Check if azimuth is physically possible from Cape Canaveral
  if (spec.azimuth < 35 || spec.azimuth > 120) {
    return false; // Outside safe launch corridor
  }
  
  // Check if inclination matches azimuth (basic orbital mechanics)
  const minInclination = CAPE_CANAVERAL_LAT; // 28.5°
  if (spec.inclination < minInclination && spec.azimuth === 90) {
    return false; // Impossible to achieve lower inclination than launch site latitude
  }
  
  return true;
}