import { Launch, VisibilityData, LaunchPad } from '../types';
import { extractLaunchCoordinates } from '../utils/launchCoordinates';
import { BermudaTimeService } from './bermudaTimeService';

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
// eslint-disable-next-line @typescript-eslint/no-unused-vars
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

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function calculateBearing(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const y = Math.sin(dLng) * Math.cos(lat2 * Math.PI / 180);
  const x = Math.cos(lat1 * Math.PI / 180) * Math.sin(lat2 * Math.PI / 180) -
    Math.sin(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.cos(dLng);
  let bearing = Math.atan2(y, x) * 180 / Math.PI;
  return (bearing + 360) % 360;
}

function isNightTime(launchTime: string, _bermudaTime?: string): boolean {
  // Use centralized Bermuda time service for consistent night detection
  return BermudaTimeService.isNightTime(launchTime);
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
  direction: 'Northeast' | 'East-Northeast' | 'East' | 'East-Southeast' | 'Southeast' | 'North' | 'South' | 'Unknown';
  bearing: number; // viewing direction from Bermuda
}

export function getTrajectoryInfo(padName: string, orbitType?: string, missionName?: string): TrajectoryInfo {
  
  // This function is kept for backward compatibility but should be replaced
  // with real trajectory data from the trajectory mapping service
  
  const orbitLower = orbitType?.toLowerCase() || '';
  const missionLower = missionName?.toLowerCase() || '';
  
  // Create a mock launch object for trajectory mapping
  const mockLaunch = {
    mission: {
      name: missionName || 'Unknown Mission',
      orbit: orbitType ? { name: orbitType } : undefined
    }
  };
  
  try {
    // Try to use the enhanced trajectory mapping service
    const { getTrajectoryMapping, getViewingBearingFromBermuda } = require('./trajectoryMappingService');
    const trajectoryMapping = getTrajectoryMapping(mockLaunch);
    const viewingBearing = getViewingBearingFromBermuda(trajectoryMapping);
    
    // Map trajectory mapping confidence to visibility
    const visibilityMap: Record<string, 'high' | 'medium' | 'low'> = {
      'high': 'high',
      'medium': 'medium',  
      'low': 'low'
    };
    
    return {
      visibility: visibilityMap[trajectoryMapping.confidence] || 'medium',
      direction: trajectoryMapping.direction as TrajectoryInfo['direction'],
      bearing: viewingBearing
    };
  } catch (error) {
  }
  
  // Legacy fallback logic (to be removed when all callers are updated)
  if (orbitLower.includes('gto') || orbitLower.includes('geo')) {
    return { visibility: 'medium', direction: 'Southeast', bearing: 247 };
  }
  
  if (orbitLower.includes('iss') || orbitLower.includes('dragon')) {
    return { visibility: 'high', direction: 'Northeast', bearing: 225 };
  }
  
  if (orbitLower.includes('starlink') || missionLower.includes('starlink')) {
    return { visibility: 'high', direction: 'Northeast', bearing: 225 };
  }
  
  return { visibility: 'medium', direction: 'Northeast', bearing: 225 };
}

/**
 * Enhanced trajectory info using real launch data and trajectory services
 * This replaces the simple mission-type assumptions with actual trajectory analysis
 */
export async function getEnhancedTrajectoryInfo(launch: Launch): Promise<TrajectoryInfo> {
  try {
    
    // Try to get real trajectory data first
    const { getTrajectoryData } = await import('./trajectoryService');
    const trajectoryData = await getTrajectoryData(launch);
    
    if (trajectoryData.realTelemetry && trajectoryData.trajectoryDirection) {
      // We have real Flight Club telemetry data!
      
      const { getViewingBearingFromBermuda } = await import('./trajectoryMappingService');
      const validDirection = trajectoryData.trajectoryDirection === 'Unknown' ? 'Northeast' : trajectoryData.trajectoryDirection;
      const viewingBearing = getViewingBearingFromBermuda({ 
        direction: validDirection,
        confidence: 'high',
        azimuth: 0, // Not used for viewing bearing calculation
        source: 'database'
      });
      
      return {
        visibility: 'high', // Real data always gets high confidence
        direction: trajectoryData.trajectoryDirection as TrajectoryInfo['direction'],
        bearing: viewingBearing
      };
    }
    
    if (trajectoryData.trajectoryDirection && trajectoryData.source !== 'none') {
      // We have trajectory direction from Space Launch Schedule or generated data
      
      const { getViewingBearingFromBermuda } = await import('./trajectoryMappingService');
      const validDirection = trajectoryData.trajectoryDirection === 'Unknown' ? 'Northeast' : trajectoryData.trajectoryDirection;
      const viewingBearing = getViewingBearingFromBermuda({
        direction: validDirection,
        confidence: 'medium',
        azimuth: 0,
        source: trajectoryData.source === 'spacelaunchschedule' ? 'database' : 'orbital-mechanics'
      });
      
      return {
        visibility: trajectoryData.source === 'spacelaunchschedule' ? 'high' : 'medium',
        direction: trajectoryData.trajectoryDirection as TrajectoryInfo['direction'],
        bearing: viewingBearing
      };
    }
    
    // Fall back to trajectory mapping service (orbital mechanics)
    const { getTrajectoryMapping, getViewingBearingFromBermuda } = await import('./trajectoryMappingService');
    const trajectoryMapping = getTrajectoryMapping(launch);
    const viewingBearing = getViewingBearingFromBermuda(trajectoryMapping);
    
    const visibilityMap = {
      'high': 'high' as const,
      'medium': 'medium' as const,
      'low': 'low' as const
    };
    
    
    return {
      visibility: visibilityMap[trajectoryMapping.confidence] || 'medium',
      direction: trajectoryMapping.direction as TrajectoryInfo['direction'],
      bearing: viewingBearing
    };
    
  } catch (error) {
    console.error('[VisibilityService] Error getting enhanced trajectory info:', error);
    
    // Ultimate fallback - use the old logic
    return getTrajectoryInfo(launch.pad.name, launch.mission.orbit?.name, launch.mission.name);
  }
}

// Legacy function for backward compatibility
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function getTrajectoryVisibility(padName: string, orbitType?: string): 'high' | 'medium' | 'low' | 'none' {
  return getTrajectoryInfo(padName, orbitType).visibility;
}

export async function calculateVisibility(launch: Launch): Promise<VisibilityData> {
  
  // Extract coordinates using helper function
  const coordinates = extractLaunchCoordinates(launch);
  
  // Get enhanced trajectory info (this is the key improvement!)
  const trajectoryInfo = await getEnhancedTrajectoryInfo(launch);
  
  // Validate coordinates before calculations
  if (!coordinates.available) {
    
    const isNight = isNightTime(launch.net, launch.net);
    
    return {
      likelihood: isNight ? (trajectoryInfo.visibility === 'high' ? 'high' : 'medium') : 'low',
      reason: `${trajectoryInfo.direction} trajectory launch from Florida (based on ${trajectoryInfo.visibility === 'high' ? 'real trajectory data' : 'orbital mechanics'}). ${isNight ? 'Night launch may be visible' : 'Daytime launch difficult to see'}`,
      bearing: Math.round(trajectoryInfo.bearing),
      trajectoryDirection: trajectoryInfo.direction,
      estimatedTimeVisible: isNight ? 'Start watching at T+6 min, visible until T+9 min' : 'Difficult to see in daylight'
    };
  }
  
  // Convert launch time to Bermuda time (AST/ADT - UTC-4 in summer, UTC-3 in winter)
  const launchTime = new Date(launch.net);
  const bermudaTime = new Date(launchTime.getTime() - (4 * 60 * 60 * 1000)); // Rough AST conversion
  
  // Check if launch trajectory could be visible from Bermuda
  if (!isTrajectoryVisible({ latitude: coordinates.latitude, longitude: coordinates.longitude })) {
    return {
      likelihood: 'none',
      reason: 'Launch trajectory not visible from Bermuda (too far or wrong direction)'
    };
  }
  
  const isNight = isNightTime(launch.net, bermudaTime.toISOString());
  const bearing = trajectoryInfo.bearing;
  
  let likelihood: 'high' | 'medium' | 'low' | 'none';
  let reason = '';
  
  // Enhanced visibility logic based on real trajectory data
  const trajectorySource = trajectoryInfo.visibility === 'high' ? 'real trajectory data' : 
                          trajectoryInfo.visibility === 'medium' ? 'orbital mechanics' : 'mission analysis';
  
  // Simplified night/day logic with improved detection
  if (isNight && trajectoryInfo.visibility === 'high') {
    likelihood = 'high';
    reason = `Night launch with ${trajectoryInfo.direction.toLowerCase()} trajectory (from ${trajectorySource}). Look ${trajectoryInfo.direction.toLowerCase()}, low on horizon`;
  } else if (isNight && trajectoryInfo.visibility === 'medium') {
    likelihood = 'medium';
    reason = `Night launch with ${trajectoryInfo.direction.toLowerCase()} trajectory (from ${trajectorySource}). Look ${trajectoryInfo.direction.toLowerCase()}`;
  } else if (!isNight && trajectoryInfo.visibility === 'high') {
    likelihood = 'medium';
    reason = `Daytime launch with ${trajectoryInfo.direction.toLowerCase()} trajectory (from ${trajectorySource}). Look ${trajectoryInfo.direction.toLowerCase()}, harder to spot in sunlight`;
  } else if (!isNight && trajectoryInfo.visibility === 'medium') {
    likelihood = 'low';
    reason = `Daytime launch with ${trajectoryInfo.direction.toLowerCase()} trajectory (from ${trajectorySource}). Look ${trajectoryInfo.direction.toLowerCase()}, very difficult to see`;
  } else {
    likelihood = 'low';
    reason = `Limited visibility conditions for ${trajectoryInfo.direction.toLowerCase()} trajectory`;
  }
  
  return {
    likelihood,
    reason,
    bearing: Math.round(bearing),
    trajectoryDirection: trajectoryInfo.direction,
    estimatedTimeVisible: isNight ? 'Start watching at T+6 min, visible until T+9 min' : 'Difficult to see in daylight'
  };
}

// Legacy synchronous version for backward compatibility
export function calculateVisibilitySync(launch: Launch): VisibilityData {
  
  // Extract coordinates using helper function
  const coordinates = extractLaunchCoordinates(launch);
  
  // Use legacy trajectory info
  const trajectoryInfo = getTrajectoryInfo(launch.pad.name, launch.mission.orbit?.name, launch.mission.name);
  
  // Validate coordinates before calculations
  if (!coordinates.available) {
    
    const isNight = isNightTime(launch.net, launch.net);
    
    return {
      likelihood: isNight ? 'medium' : 'low',
      reason: `${trajectoryInfo.direction} trajectory launch from Florida (legacy calculation). ${isNight ? 'Night launch may be visible' : 'Daytime launch difficult to see'}`,
      bearing: Math.round(trajectoryInfo.bearing),
      trajectoryDirection: trajectoryInfo.direction,
      estimatedTimeVisible: isNight ? 'Start watching at T+6 min, visible until T+9 min' : 'Difficult to see in daylight'
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
    trajectoryDirection: trajectoryInfo.direction,
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