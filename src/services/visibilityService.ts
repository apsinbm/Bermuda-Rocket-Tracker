import { Launch, VisibilityData, EnhancedVisibilityData, LaunchPad, LaunchWithFlightClub } from '../types';
import { extractLaunchCoordinates } from '../utils/launchCoordinates';
import { BermudaTimeService } from './bermudaTimeService';
import { FlightClubApiService } from './flightClubApiService';

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
// - Visibility window: Dynamic 2nd stage horizon crossing to SECO  
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
  const R = 6371; // Earth's radius in km (changed from miles)
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

// Helper function to calculate bearing from Bermuda to a point
function calculateBearingFromBermuda(lat: number, lng: number): number {
  return calculateBearing(BERMUDA_LAT, BERMUDA_LNG, lat, lng);
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
  
  // East Coast to Bermuda distances:
  // Florida: ~900 miles, Wallops: ~600 miles
  // Visibility ring at 150-200km altitude: ~1,400-1,600km  
  // Convert to miles: ~870-990 miles, so pad distance + trajectory extension
  return distance > 400 && distance < 1200; // Expanded range for Wallops
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


// Helper function to calculate elevation angle above horizon from Bermuda's perspective
function calculateElevationAngle(distance: number, altitude: number): number {
  const R = 6371; // Earth radius in km
  
  // Account for Earth's curvature - distant objects appear lower
  const earthCurvature = (distance * distance) / (2 * R);
  const apparentAltitude = altitude - earthCurvature;
  
  // Calculate elevation angle using proper trigonometry
  const elevationRadians = Math.atan2(apparentAltitude, distance);
  const elevationDegrees = elevationRadians * 180 / Math.PI;
  
  // Return actual angle (can be negative if below horizon)
  return elevationDegrees;
}

// Helper function to calculate visibility duration for second stage
function calculateVisibilityDuration(trajectoryPoints: any[]): { 
  startTime: number; 
  endTime: number; 
  durationSeconds: number; 
  durationMinutes: number;
  visiblePointCount: number;
} {
  let visibilityStart: number | null = null;
  let visibilityEnd: number | null = null;
  let visiblePointCount = 0;
  
  // Find when rocket rises above and sets below horizon
  for (const point of trajectoryPoints) {
    const distance = calculateDistance(BERMUDA_LAT, BERMUDA_LNG, point.latitude, point.longitude);
    const altitude = point.altitude / 1000; // Convert to km
    const elevation = calculateElevationAngle(distance, altitude);
    
    if (elevation > 0) {
      visiblePointCount++;
      if (visibilityStart === null) {
        visibilityStart = point.time;
      }
      visibilityEnd = point.time;
    }
  }
  
  if (visibilityStart !== null && visibilityEnd !== null) {
    const durationSeconds = visibilityEnd - visibilityStart;
    return {
      startTime: visibilityStart,
      endTime: visibilityEnd,
      durationSeconds: durationSeconds,
      durationMinutes: durationSeconds / 60,
      visiblePointCount: visiblePointCount
    };
  }
  
  return { 
    startTime: 0, 
    endTime: 0, 
    durationSeconds: 0, 
    durationMinutes: 0,
    visiblePointCount: 0
  };
}

// Process Flight Club telemetry data for visibility calculation
// Helper function to detect ISS/Cygnus missions
function isISSMission(launch: Launch | LaunchWithFlightClub): boolean {
  const missionName = launch.mission?.name?.toLowerCase() || '';
  const launchName = launch.name?.toLowerCase() || '';
  
  return missionName.includes('cygnus') || 
         missionName.includes('dragon') || 
         missionName.includes('crew') ||
         missionName.includes('crs-') ||
         launchName.includes('cygnus') ||
         launchName.includes('dragon') ||
         launchName.includes('crew') ||
         launchName.includes('crs-');
}

async function calculateVisibilityFromFlightClub(launch: LaunchWithFlightClub): Promise<VisibilityData | null> {
  if (!launch.flightClubMatch || !launch.hasFlightClubData) {
    return null;
  }

  try {
    console.log(`[VisibilityService] Using Flight Club data for ${launch.name}`);
    
    // ISS MISSION OVERRIDE: These missions are always visible from Bermuda
    if (isISSMission(launch)) {
      console.log(`[VisibilityService] ✅ ISS/Cygnus mission detected: ${launch.name} - Applying high visibility override`);
      
      const lightingStatus = getLightingStatusSync(launch.net);
      let reason = '';
      let likelihood: VisibilityData['likelihood'] = 'high';
      
      if (lightingStatus === 'twilight') {
        reason = 'ISS mission with optimal twilight viewing - exhaust plume clearly visible against dark sky. Northeast trajectory passes west of Bermuda at high altitude (~200km). Look WSW around T+3-8 minutes for best visibility.';
      } else if (lightingStatus === 'night') {
        reason = 'ISS mission with excellent night viewing - exhaust plume glow visible against dark sky. Northeast trajectory passes west of Bermuda at high altitude (~200km). Look WSW around T+3-8 minutes for best visibility.';
      } else {
        likelihood = 'medium';
        reason = 'ISS mission with daylight viewing - look for bright moving dot. Northeast trajectory passes west of Bermuda at high altitude (~200km). Look WSW around T+3-8 minutes.';
      }
      
      return {
        likelihood,
        reason,
        bearing: 247, // WSW bearing for ISS trajectories from Bermuda
        estimatedTimeVisible: 'Visible T+3 to T+8 minutes. Look WSW (west-southwest) for best view.',
        trajectoryDirection: 'Northeast',
        dataSource: 'iss-override' as any,
        score: likelihood === 'high' ? 0.95 : 0.75,
        factors: [
          'ISS/Cygnus mission - known high visibility',
          'Northeast trajectory (51.6° inclination)',
          'High altitude second stage (~200km)',
          `${lightingStatus} lighting conditions`
        ]
      };
    }
    
    // Get trajectory data from Flight Club (with caching)
    const trajectoryData = await FlightClubApiService.getSimulationData(
      launch.flightClubMatch.flightClubMission.id,
      launch.id // Pass launchId for caching
    );
    
    if (!trajectoryData || !trajectoryData.enhancedTelemetry || trajectoryData.enhancedTelemetry.length === 0) {
      console.log(`[VisibilityService] No trajectory data available for ${launch.name}`);
      return null;
    }

    // Find stage events to determine 2nd stage visibility window
    const stageEvents = trajectoryData.stageEvents || [];
    const stageSeparationEvent = stageEvents.find(e => e.event === 'Stage Separation');
    const secoEvent = stageEvents.find(e => e.event.includes('SECO') && e.engineType === 'MVac');
    
    // Use the enhanced telemetry directly
    const allTelemetry = trajectoryData.enhancedTelemetry.sort((a, b) => a.time - b.time);
    
    // Filter for 2nd stage telemetry only (after stage separation)
    const stageSeparationTime = stageSeparationEvent ? stageSeparationEvent.time : 150; // Default ~2.5 min
    const secoTime = secoEvent ? secoEvent.time : null;
    
    console.log(`[VisibilityService] Stage separation at T+${Math.round(stageSeparationTime/60)}:${String(Math.round(stageSeparationTime%60)).padStart(2,'0')}, SECO ${secoTime ? `at T+${Math.round(secoTime/60)}:${String(Math.round(secoTime%60)).padStart(2,'0')}` : 'not detected'}`);
    
    // Process only 2nd stage telemetry points for visibility analysis  
    const secondStageTelemetry = allTelemetry.filter(point => 
      point.time >= stageSeparationTime && 
      (secoTime === null || point.time <= secoTime) &&
      point.stageNumber === 2
    );

    const visiblePoints = [];
    let minDistance = Infinity;
    let closestPoint = null;
    let maxElevation = 0;
    let visibilityStart = null;
    let visibilityEnd = null;

    for (const point of secondStageTelemetry) {
      const distance = calculateDistance(BERMUDA_LAT, BERMUDA_LNG, point.latitude, point.longitude);
      const altitude = point.altitude / 1000; // Convert to km
      const elevation = calculateElevationAngle(distance, altitude);
      const bearing = calculateBearingFromBermuda(point.latitude, point.longitude);

      // Track closest approach
      if (distance < minDistance) {
        minDistance = distance;
        closestPoint = { ...point, distance, bearing, elevation };
      }

      // Track maximum elevation
      if (elevation > maxElevation) {
        maxElevation = elevation;
      }

      // 2nd stage is visible if above horizon and within reasonable distance
      if (elevation > 0 && distance < 1500) { // 1500km visibility limit
        visiblePoints.push({
          time: point.time,
          distance,
          bearing,
          elevation,
          altitude
        });

        if (visibilityStart === null) visibilityStart = point.time;
        visibilityEnd = point.time;
      }
    }

    // Determine visibility likelihood based on real data
    let likelihood: VisibilityData['likelihood'];
    let reason: string;
    let estimatedTimeVisible: string;

    // Use sync lighting status for faster initial display (API call can update later)
    const lightingStatus = getLightingStatusSync(launch.net);
    
    // Calculate visibility duration using our enhanced function
    const visibilityDurationInfo = calculateVisibilityDuration(secondStageTelemetry);
    const visibleDuration = visibilityDurationInfo.durationMinutes;

    if (visiblePoints.length === 0) {
      likelihood = 'none';
      reason = 'Rocket trajectory does not pass within visible range of Bermuda';
      estimatedTimeVisible = 'Not visible from Bermuda';
    } else {
      // Calculate average elevation for potential future use
      // const avgElevation = visiblePoints.reduce((sum, p) => sum + p.elevation, 0) / visiblePoints.length;
      
      // New three-tier visibility system based on real-world observations
      if (lightingStatus === 'twilight' && maxElevation > 5 && minDistance < 1200) {
        likelihood = 'high';
        reason = `Optimal viewing conditions - twilight launch with exhaust plume illuminated by sun against dark sky. Rocket passes ${Math.round(minDistance)}km from Bermuda at max ${Math.round(maxElevation)}° elevation. Visible for ${Math.round(visibleDuration * 10) / 10} minutes`;
      } else if (lightingStatus === 'night' && maxElevation > 5 && minDistance < 1200) {
        likelihood = 'high';
        reason = `Good viewing conditions - night launch with exhaust plume glow clearly visible against dark sky. Rocket passes ${Math.round(minDistance)}km from Bermuda at max ${Math.round(maxElevation)}° elevation. Visible for ${Math.round(visibleDuration * 10) / 10} minutes`;
      } else if (lightingStatus === 'night' && maxElevation > 0 && minDistance < 1500) {
        likelihood = 'medium';
        reason = `Good viewing conditions - night launch with visible exhaust plume. Rocket passes ${Math.round(minDistance)}km from Bermuda at max ${Math.round(maxElevation)}° elevation. Visible for ${Math.round(visibleDuration * 10) / 10} minutes`;
      } else if (lightingStatus === 'day' && maxElevation > 15 && minDistance < 600) {
        likelihood = 'low';
        reason = `Challenging viewing conditions - daytime launch. Look for bright dot or contrail. Rocket passes ${Math.round(minDistance)}km away at ${Math.round(maxElevation)}° elevation. Visible for ${Math.round(visibleDuration * 10) / 10} minutes`;
      } else if (maxElevation > 0) {
        likelihood = 'low';
        reason = `Marginal visibility conditions. Rocket passes ${Math.round(minDistance)}km away at ${Math.round(maxElevation)}° elevation. Visible for ${Math.round(visibleDuration * 10) / 10} minutes. ${lightingStatus === 'day' ? 'Daylight makes viewing challenging' : 'Low viewing angle'}`;
      } else {
        likelihood = 'none';
        reason = 'Rocket remains below horizon from Bermuda';
      }

      if (visibilityStart !== null && visibilityEnd !== null) {
        estimatedTimeVisible = `Visible from T+${Math.round(visibilityStart/60)} to T+${Math.round(visibilityEnd/60)} minutes. Look ${getBearingDirection(closestPoint?.bearing || 0)} for best view.`;
      } else {
        estimatedTimeVisible = 'Visibility window uncertain';
      }
    }

    // Determine trajectory direction based on telemetry
    const trajectoryDirection = getTrajectoryDirectionFromTelemetry(allTelemetry);

    return {
      likelihood,
      reason,
      bearing: Math.round(closestPoint?.bearing || 0),
      estimatedTimeVisible,
      trajectoryDirection,
      dataSource: 'flightclub' as const,
      score: likelihood === 'high' ? 0.9 : likelihood === 'medium' ? 0.6 : likelihood === 'low' ? 0.3 : 0,
      factors: [
        `Flight Club telemetry data used`,
        `Closest approach: ${Math.round(minDistance)}km`,
        `Maximum elevation: ${Math.round(maxElevation)}°`,
        `Visible duration: ${Math.round(visibleDuration)} minutes`,
        `Time of day: ${lightingStatus}`,
        `Data confidence: ${launch.flightClubMatch.confidence}`
      ]
    };

  } catch (error) {
    console.error('[VisibilityService] Error processing Flight Club data:', error);
    return null;
  }
}

// Helper to determine trajectory direction from telemetry
function getTrajectoryDirectionFromTelemetry(telemetry: any[]): VisibilityData['trajectoryDirection'] {
  if (telemetry.length < 2) return 'Unknown';

  const start = telemetry[0];
  const middle = telemetry[Math.floor(telemetry.length / 2)];
  
  const deltaLat = middle.latitude - start.latitude;
  const deltaLng = middle.longitude - start.longitude;
  
  const angle = Math.atan2(deltaLng, deltaLat) * 180 / Math.PI;
  const normalizedAngle = (angle + 360) % 360;

  if (normalizedAngle >= 22.5 && normalizedAngle < 67.5) return 'Northeast';
  if (normalizedAngle >= 67.5 && normalizedAngle < 112.5) return 'East';
  if (normalizedAngle >= 112.5 && normalizedAngle < 157.5) return 'Southeast';
  if (normalizedAngle >= 157.5 && normalizedAngle < 202.5) return 'South';
  if (normalizedAngle >= 202.5 && normalizedAngle < 247.5) return 'Unknown'; // Southwest not common
  if (normalizedAngle >= 247.5 && normalizedAngle < 292.5) return 'Unknown'; // West not common
  if (normalizedAngle >= 292.5 && normalizedAngle < 337.5) return 'Unknown'; // Northwest not common
  return 'North';
}


/**
 * Helper function to convert VisibilityData to EnhancedVisibilityData
 */
function enhanceVisibilityData(baseData: VisibilityData): EnhancedVisibilityData {
  const now = new Date();
  return {
    ...baseData,
    solarConditions: {
      sunElevation: 0, // Placeholder - would need actual solar calculation
      sunAzimuth: 0,   // Placeholder - would need actual solar calculation
      twilightPhase: 'day',
      illuminationConditions: 'fair',
      rocketSunlit: true,
      groundDarkness: false
    },
    governmentDataUsed: false,
    lastCalculated: now,
    validationStatus: {
      isValid: true,
      warnings: [],
      dataQuality: 'fair'
    }
  };
}

export async function calculateVisibility(launch: Launch | LaunchWithFlightClub): Promise<EnhancedVisibilityData> {
  // Check cache first
  try {
    const { indexedDBCache } = await import('./indexedDBCache');
    const inputHash = indexedDBCache.createHash({
      id: launch.id,
      net: launch.net,
      pad: launch.pad,
      hasFlightClubData: ('hasFlightClubData' in launch) ? launch.hasFlightClubData : false,
      missionId: ('flightClubMatch' in launch) ? launch.flightClubMatch?.flightClubMission.id : null
    });
    
    const cachedVisibility = await indexedDBCache.getVisibilityData(launch.id, inputHash);
    if (cachedVisibility) {
      console.log(`[VisibilityService] Using cached visibility for ${launch.name} (${cachedVisibility.dataSource})`);
      return cachedVisibility as EnhancedVisibilityData;
    }
  } catch (cacheError) {
    console.warn('[VisibilityService] Cache read failed:', cacheError);
  }

  try {
    // First priority: Try to use Flight Club telemetry data if available
    if ('hasFlightClubData' in launch && launch.hasFlightClubData && launch.flightClubMatch) {
      console.log(`[VisibilityService] Attempting Flight Club calculation for ${launch.name}`);
      const flightClubResult = await calculateVisibilityFromFlightClub(launch as LaunchWithFlightClub);
      if (flightClubResult) {
        console.log(`[VisibilityService] ✅ Using Flight Club data for ${launch.name} (${flightClubResult.likelihood} visibility)`);
        
        // Cache the result
        try {
          const { indexedDBCache } = await import('./indexedDBCache');
          const inputHash = indexedDBCache.createHash({
            id: launch.id,
            net: launch.net,
            pad: launch.pad,
            hasFlightClubData: true,
            missionId: launch.flightClubMatch.flightClubMission.id
          });
          await indexedDBCache.cacheVisibilityData(launch.id, flightClubResult, inputHash);
        } catch (cacheError) {
          console.warn('[VisibilityService] Failed to cache Flight Club result:', cacheError);
        }
        
        return flightClubResult as EnhancedVisibilityData;
      }
      console.log(`[VisibilityService] ⚠️ Flight Club calculation failed for ${launch.name}, falling back to geometric`);
    }

    // Second priority: Use physics-based geometric visibility calculations
    const { GeometricVisibilityService } = await import('./geometricVisibilityService');
    const geometricResult = GeometricVisibilityService.calculateVisibility(launch);
    
    // Convert geometric result to standard VisibilityData format
    // Use viewing bearing from trajectory mapping instead of bearing to closest point
    const { getTrajectoryMapping, getViewingBearingFromBermuda } = require('./trajectoryMappingService');
    const trajectoryMapping = getTrajectoryMapping(launch);
    const bearing = getViewingBearingFromBermuda(trajectoryMapping);
      
    const visibilityResult = {
      likelihood: geometricResult.likelihood,
      reason: geometricResult.reason,
      bearing: Math.round(bearing),
      trajectoryDirection: geometricResult.factors.trajectoryDirection as VisibilityData['trajectoryDirection'],
      estimatedTimeVisible: geometricResult.factors.visibilityReason 
        ? `${geometricResult.factors.visibilityReason}. Look ${geometricResult.factors.initialViewingDirection} and track ${geometricResult.factors.trackingPath}.`
        : geometricResult.factors.visibilityWindow.duration > 0 
          ? `Track from ${geometricResult.factors.initialViewingDirection} following path: ${geometricResult.factors.trackingPath}. Visible T+${Math.round(geometricResult.factors.visibilityWindow.start)} to T+${Math.round(geometricResult.factors.visibilityWindow.end)} minutes.`
          : 'Not visible - rocket travels away from Bermuda',
      dataSource: 'calculated' as const,
      factors: [
        `Rocket travels: ${geometricResult.factors.trajectoryDirection}`,
        `Look initially: ${geometricResult.factors.initialViewingDirection}`,
        `Tracking path: ${geometricResult.factors.trackingPath}`,
        `Max altitude: ${Math.round(geometricResult.factors.maxAltitude)}km`,
        `Closest approach: ${Math.round(geometricResult.factors.closestApproach)}km`,
        `Max viewing angle: ${Math.round(geometricResult.factors.maxViewingAngle)}°`,
        `Time of day: ${geometricResult.factors.timeOfDay}`,
        ...(geometricResult.factors.visibilityReason ? [`2nd stage timing: ${geometricResult.factors.visibilityReason}`] : [])
      ]
    };
    
    // Cache the geometric result
    try {
      const { indexedDBCache } = await import('./indexedDBCache');
      const inputHash = indexedDBCache.createHash({
        id: launch.id,
        net: launch.net,
        pad: launch.pad,
        hasFlightClubData: ('hasFlightClubData' in launch) ? launch.hasFlightClubData : false,
        missionId: ('flightClubMatch' in launch) ? launch.flightClubMatch?.flightClubMission.id : null
      });
      await indexedDBCache.cacheVisibilityData(launch.id, visibilityResult, inputHash);
    } catch (cacheError) {
      console.warn('[VisibilityService] Failed to cache geometric result:', cacheError);
    }
    
    return visibilityResult as EnhancedVisibilityData;
    
  } catch (error) {
    console.error('[VisibilityService] Geometric calculation failed, using fallback:', error);
    
    // Fallback to enhanced trajectory calculation
    const coordinates = extractLaunchCoordinates(launch);
    const trajectoryInfo = await getEnhancedTrajectoryInfo(launch);
    
    if (!coordinates.available) {
      const lightingStatus = getLightingStatusSync(launch.net);
      
      let likelihood: 'high' | 'medium' | 'low' | 'none';
      let reasonText: string;
      let timeVisible: string;
      
      if (lightingStatus === 'twilight') {
        likelihood = trajectoryInfo.visibility === 'high' ? 'high' : 'high';
        reasonText = `Optimal viewing - twilight ${trajectoryInfo.direction} trajectory launch from East Coast (fallback calculation). Exhaust plume illuminated against dark sky`;
        timeVisible = '2nd stage visible approximately T+2.5 to T+8 minutes (estimated)';
      } else if (lightingStatus === 'night') {
        likelihood = trajectoryInfo.visibility === 'high' ? 'high' : 'medium';
        reasonText = `Good viewing - night ${trajectoryInfo.direction} trajectory launch from East Coast (fallback calculation). Exhaust plume glow visible`;
        timeVisible = '2nd stage visible approximately T+2.5 to T+8 minutes (estimated)';
      } else {
        likelihood = 'low';
        reasonText = `Challenging viewing - daytime ${trajectoryInfo.direction} trajectory launch from East Coast (fallback calculation). Look for bright dot or contrail`;
        timeVisible = 'Challenging to see in daylight - look for bright dot';
      }
      
      // Use viewing bearing from trajectory mapping for accurate directions
      const { getTrajectoryMapping, getViewingBearingFromBermuda } = require('./trajectoryMappingService');
      const trajectoryMapping = getTrajectoryMapping(launch);
      const viewingBearing = getViewingBearingFromBermuda(trajectoryMapping);
      
      return enhanceVisibilityData({
        likelihood,
        reason: reasonText,
        bearing: Math.round(viewingBearing),
        trajectoryDirection: trajectoryInfo.direction,
        estimatedTimeVisible: timeVisible
      });
    }
    
    // Use viewing bearing from trajectory mapping for accurate directions
    const { getTrajectoryMapping, getViewingBearingFromBermuda } = require('./trajectoryMappingService');
    const trajectoryMapping = getTrajectoryMapping(launch);
    const bearing = getViewingBearingFromBermuda(trajectoryMapping);
    
    let likelihood: 'high' | 'medium' | 'low' | 'none';
    let reason = '';
    
    const trajectorySource = trajectoryInfo.visibility === 'high' ? 'real trajectory data' : 
                            trajectoryInfo.visibility === 'medium' ? 'orbital mechanics' : 'mission analysis';
    
    // Enhanced visibility logic based on lighting conditions (using sync for speed)
    const lightingStatus = getLightingStatusSync(launch.net);
    
    if (lightingStatus === 'twilight' && trajectoryInfo.visibility === 'high') {
      likelihood = 'high';
      reason = `Optimal viewing conditions - twilight launch with ${trajectoryInfo.direction.toLowerCase()} trajectory (from ${trajectorySource}). Exhaust plume illuminated by sun against dark sky. Look ${trajectoryInfo.direction.toLowerCase()}`;
    } else if (lightingStatus === 'twilight' && trajectoryInfo.visibility === 'medium') {
      likelihood = 'high';
      reason = `Optimal viewing conditions - twilight launch with ${trajectoryInfo.direction.toLowerCase()} trajectory (from ${trajectorySource}). Look ${trajectoryInfo.direction.toLowerCase()}`;
    } else if (lightingStatus === 'night' && trajectoryInfo.visibility === 'high') {
      likelihood = 'high';
      reason = `Good viewing conditions - night launch with ${trajectoryInfo.direction.toLowerCase()} trajectory (from ${trajectorySource}). Exhaust plume glow visible against dark sky. Look ${trajectoryInfo.direction.toLowerCase()}`;
    } else if (lightingStatus === 'night' && trajectoryInfo.visibility === 'medium') {
      likelihood = 'medium';
      reason = `Good viewing conditions - night launch with ${trajectoryInfo.direction.toLowerCase()} trajectory (from ${trajectorySource}). Look ${trajectoryInfo.direction.toLowerCase()}`;
    } else if (lightingStatus === 'day' && trajectoryInfo.visibility === 'high') {
      likelihood = 'low';
      reason = `Challenging viewing conditions - daytime launch with ${trajectoryInfo.direction.toLowerCase()} trajectory (from ${trajectorySource}). Look for bright dot or contrail ${trajectoryInfo.direction.toLowerCase()}`;
    } else if (lightingStatus === 'day' && trajectoryInfo.visibility === 'medium') {
      likelihood = 'low';
      reason = `Challenging viewing conditions - daytime launch with ${trajectoryInfo.direction.toLowerCase()} trajectory (from ${trajectorySource}). Very difficult to see in daylight`;
    } else {
      likelihood = 'low';
      reason = `Limited visibility conditions for ${trajectoryInfo.direction.toLowerCase()} trajectory`;
    }
    
    return enhanceVisibilityData({
      likelihood,
      reason,
      bearing: Math.round(bearing),
      trajectoryDirection: trajectoryInfo.direction,
      estimatedTimeVisible: lightingStatus !== 'day' ? '2nd stage visible approximately T+2.5 to T+8 minutes (estimated)' : 'Challenging to see in daylight - look for bright dot'
    });
  }
}

// Legacy synchronous version for backward compatibility
export function calculateVisibilitySync(launch: Launch): VisibilityData {
  
  // ISS MISSION OVERRIDE: These missions are always visible from Bermuda
  if (isISSMission(launch)) {
    console.log(`[VisibilitySync] ✅ ISS/Cygnus mission detected: ${launch.name} - Applying high visibility override`);
    
    const lightingStatus = getLightingStatusSync(launch.net);
    let reason = '';
    let likelihood: VisibilityData['likelihood'] = 'high';
    
    if (lightingStatus === 'twilight') {
      reason = 'ISS mission with optimal twilight viewing - exhaust plume clearly visible against dark sky. Northeast trajectory passes west of Bermuda at high altitude (~200km). Look WSW around T+3-8 minutes for best visibility.';
    } else if (lightingStatus === 'night') {
      reason = 'ISS mission with excellent night viewing - exhaust plume glow visible against dark sky. Northeast trajectory passes west of Bermuda at high altitude (~200km). Look WSW around T+3-8 minutes for best visibility.';
    } else {
      likelihood = 'medium';
      reason = 'ISS mission with daylight viewing - look for bright moving dot. Northeast trajectory passes west of Bermuda at high altitude (~200km). Look WSW around T+3-8 minutes.';
    }
    
    return {
      likelihood,
      reason,
      bearing: 247, // WSW bearing for ISS trajectories from Bermuda
      estimatedTimeVisible: 'Visible T+3 to T+8 minutes. Look WSW (west-southwest) for best view.',
      trajectoryDirection: 'Northeast',
      dataSource: 'iss-override' as any,
      score: likelihood === 'high' ? 0.95 : 0.75,
      factors: [
        'ISS/Cygnus mission - known high visibility',
        'Northeast trajectory (51.6° inclination)', 
        'High altitude second stage (~200km)',
        `${lightingStatus} lighting conditions`
      ]
    };
  }
  
  // Extract coordinates using helper function
  const coordinates = extractLaunchCoordinates(launch);
  
  // Use legacy trajectory info
  const trajectoryInfo = getTrajectoryInfo(launch.pad.name, launch.mission.orbit?.name, launch.mission.name);
  
  // Validate coordinates before calculations
  if (!coordinates.available) {
    
    const lightingStatus = getLightingStatusSync(launch.net);
    
    let likelihood: 'high' | 'medium' | 'low' | 'none';
    let reasonText: string;
    let timeVisible: string;
    
    if (lightingStatus === 'twilight') {
      likelihood = trajectoryInfo.visibility === 'high' ? 'high' : 'high';
      reasonText = `Optimal viewing - twilight ${trajectoryInfo.direction} trajectory launch from East Coast (legacy calculation). Exhaust plume illuminated against dark sky`;
      timeVisible = '2nd stage visible approximately T+2.5 to T+8 minutes (estimated)';
    } else if (lightingStatus === 'night') {
      likelihood = trajectoryInfo.visibility === 'high' ? 'high' : 'medium';
      reasonText = `Good viewing - night ${trajectoryInfo.direction} trajectory launch from East Coast (legacy calculation). Exhaust plume glow visible`;
      timeVisible = '2nd stage visible approximately T+2.5 to T+8 minutes (estimated)';
    } else {
      likelihood = 'low';
      reasonText = `Challenging viewing - daytime ${trajectoryInfo.direction} trajectory launch from East Coast (legacy calculation). Look for bright dot or contrail`;
      timeVisible = 'Challenging to see in daylight - look for bright dot';
    }
    
    // Use viewing bearing from trajectory mapping for accurate directions
    const { getTrajectoryMapping: getTrajMapping, getViewingBearingFromBermuda: getViewBearing } = require('./trajectoryMappingService');
    const trajMapping = getTrajMapping(launch);
    const viewBearing = getViewBearing(trajMapping);
    
    return {
      likelihood,
      reason: reasonText,
      bearing: Math.round(viewBearing),
      trajectoryDirection: trajectoryInfo.direction,
      estimatedTimeVisible: timeVisible
    };
  }
  
  // Convert launch time to Bermuda time (AST/ADT - UTC-4 in summer, UTC-3 in winter)
  const launchTime = new Date(launch.net);
  // const bermudaTime = new Date(launchTime.getTime() - (4 * 60 * 60 * 1000)); // Rough AST conversion (unused)
  
  // Check if launch trajectory could be visible from Bermuda
  if (!isTrajectoryVisible({ latitude: coordinates.latitude, longitude: coordinates.longitude })) {
    return {
      likelihood: 'none',
      reason: 'Launch trajectory not visible from Bermuda'
    };
  }
  
  const lightingStatus = getLightingStatusSync(launch.net);
  
  // Use viewing bearing from trajectory mapping for accurate directions
  const { getTrajectoryMapping: getTrajMap, getViewingBearingFromBermuda: getViewBear } = require('./trajectoryMappingService');
  const trajMap = getTrajMap(launch);
  const bearing = getViewBear(trajMap);
  
  let likelihood: 'high' | 'medium' | 'low' | 'none';
  let reason = '';
  
  if (lightingStatus === 'twilight' && trajectoryInfo.visibility === 'high') {
    likelihood = 'high';
    reason = `Optimal viewing - twilight launch, ${trajectoryInfo.direction.toLowerCase()} trajectory. Exhaust plume illuminated by sun against dark sky. Look ${trajectoryInfo.direction.toLowerCase()}`;
  } else if (lightingStatus === 'twilight' && trajectoryInfo.visibility === 'medium') {
    likelihood = 'high';
    reason = `Optimal viewing - twilight launch, ${trajectoryInfo.direction.toLowerCase()} trajectory. Look ${trajectoryInfo.direction.toLowerCase()}`;
  } else if (lightingStatus === 'night' && trajectoryInfo.visibility === 'high') {
    likelihood = 'high';
    reason = `Good viewing - night launch, ${trajectoryInfo.direction.toLowerCase()} trajectory. Exhaust plume glow visible against dark sky. Look ${trajectoryInfo.direction.toLowerCase()}`;
  } else if (lightingStatus === 'night' && trajectoryInfo.visibility === 'medium') {
    likelihood = 'medium';
    reason = `Good viewing - night launch, ${trajectoryInfo.direction.toLowerCase()} trajectory. Look ${trajectoryInfo.direction.toLowerCase()}`;
  } else if (lightingStatus === 'day' && trajectoryInfo.visibility === 'high') {
    likelihood = 'low';
    reason = `Challenging viewing - daytime launch with ${trajectoryInfo.direction.toLowerCase()} trajectory. Look for bright dot or contrail ${trajectoryInfo.direction.toLowerCase()}`;
  } else if (lightingStatus === 'day' && trajectoryInfo.visibility === 'medium') {
    likelihood = 'low';
    reason = `Challenging viewing - daytime launch with ${trajectoryInfo.direction.toLowerCase()} trajectory. Very difficult to see in daylight`;
  } else {
    likelihood = 'low';
    reason = 'Limited visibility conditions';
  }
  
  return {
    likelihood,
    reason,
    bearing: Math.round(bearing),
    trajectoryDirection: trajectoryInfo.direction,
    estimatedTimeVisible: lightingStatus !== 'day' ? '2nd stage visible approximately T+2.5 to T+8 minutes (estimated)' : 'Challenging to see in daylight - look for bright dot'
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

/**
 * Determine lighting status for visibility calculations based on exact launch date
 * Accounts for seasonal variations, daylight saving time, and daily sun time changes
 * - twilight: Optimal viewing (sun below horizon but illuminating high-altitude plume)
 * - night: Good viewing (exhaust plume self-illumination visible)  
 * - day: Challenging viewing (daylight washes out exhaust glow)
 */
async function getLightingStatus(launchTimeStr: string): Promise<'twilight' | 'night' | 'day'> {
  try {
    const { BermudaTimeService } = await import('./bermudaTimeService');
    
    // Get precise sun times for the exact launch date (accounts for season, DST, etc.)
    const launchTime = new Date(launchTimeStr);
    const sunTimes = await BermudaTimeService.getSunTimes(launchTime);
    
    console.log(`[VisibilityService] Launch ${launchTime.toISOString().split('T')[0]} sun times - Sunrise: ${sunTimes.sunrise.toISOString().split('T')[1].slice(0,5)}Z, Sunset: ${sunTimes.sunset.toISOString().split('T')[1].slice(0,5)}Z, Civil twilight: ${sunTimes.civilTwilightBegin.toISOString().split('T')[1].slice(0,5)}Z - ${sunTimes.civilTwilightEnd.toISOString().split('T')[1].slice(0,5)}Z`);
    
    // Compare launch time directly with sun times (all in UTC)
    const launchUTC = launchTime.getTime();
    const sunriseUTC = sunTimes.sunrise.getTime();
    const sunsetUTC = sunTimes.sunset.getTime();
    const civilTwilightBeginUTC = sunTimes.civilTwilightBegin.getTime();
    const civilTwilightEndUTC = sunTimes.civilTwilightEnd.getTime();
    
    // Determine lighting phase based on actual astronomical calculations
    if (launchUTC >= sunriseUTC && launchUTC <= sunsetUTC) {
      return 'day';
    } else if ((launchUTC >= civilTwilightBeginUTC && launchUTC < sunriseUTC) ||
               (launchUTC > sunsetUTC && launchUTC <= civilTwilightEndUTC)) {
      return 'twilight';
    } else {
      return 'night';
    }
  } catch (error) {
    console.warn('Failed to get precise sun times for lighting calculation, using seasonal approximation');
    
    // Enhanced fallback that considers seasons (better than fixed hours)
    const launchTime = new Date(launchTimeStr);
    const month = launchTime.getMonth() + 1; // 1-12
    const hour = launchTime.getUTCHours();
    
    // Approximate seasonal sunrise/sunset for Bermuda (32.3°N)
    // Summer (June-Aug): Earlier sunrise, later sunset
    // Winter (Dec-Feb): Later sunrise, earlier sunset  
    let sunriseHourUTC, sunsetHourUTC;
    
    if (month >= 6 && month <= 8) { // Summer
      sunriseHourUTC = 10; // ~6 AM Bermuda time (UTC-4)
      sunsetHourUTC = 23;  // ~7 PM Bermuda time
    } else if (month >= 12 || month <= 2) { // Winter
      sunriseHourUTC = 12; // ~7 AM Bermuda time  
      sunsetHourUTC = 21;  // ~5 PM Bermuda time
    } else { // Spring/Fall
      sunriseHourUTC = 11; // ~6:30 AM Bermuda time
      sunsetHourUTC = 22;  // ~6:30 PM Bermuda time  
    }
    
    if (hour >= sunriseHourUTC && hour <= sunsetHourUTC) {
      return 'day';
    } else if ((hour >= sunriseHourUTC - 1 && hour < sunriseHourUTC) ||
               (hour > sunsetHourUTC && hour <= sunsetHourUTC + 1)) {
      return 'twilight';
    } else {
      return 'night';
    }
  }
}

/**
 * Synchronous version of lighting status for legacy compatibility
 */
function getLightingStatusSync(launchTimeStr: string): 'twilight' | 'night' | 'day' {
  const hour = new Date(launchTimeStr).getUTCHours();
  if (hour >= 6 && hour <= 18) return 'day';
  if ((hour >= 5 && hour < 6) || (hour > 18 && hour <= 20)) return 'twilight';
  return 'night';
}