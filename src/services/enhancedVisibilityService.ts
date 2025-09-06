import { Launch, VisibilityData } from '../types';
import { getTrajectoryData, TrajectoryData } from './trajectoryService';
import { extractLaunchCoordinates, getCoordinateError } from '../utils/launchCoordinates';
import { getTrajectoryInfo } from './visibilityService';

// Bermuda coordinates
const BERMUDA_LAT = 32.3078;
const BERMUDA_LNG = -64.7505;

/**
 * Enhanced visibility calculation using real trajectory data when available
 */
export async function calculateEnhancedVisibility(launch: Launch): Promise<VisibilityData & { trajectoryData?: TrajectoryData }> {
  console.log(`[EnhancedVisibility] ===== Starting visibility calculation for ${launch.name} (${launch.id}) =====`);
  console.log(`[EnhancedVisibility] Launch time: ${launch.net}`);
  console.log(`[EnhancedVisibility] Pad: ${launch.pad.name}`);
  console.log(`[EnhancedVisibility] Mission orbit: ${launch.mission.orbit?.name}`);
  
  try {
    // Get trajectory data with enhanced error handling
    console.log(`[EnhancedVisibility] Step 1: Getting trajectory data...`);
    let trajectoryData: TrajectoryData;
    
    try {
      trajectoryData = await getTrajectoryData(launch);
      console.log(`[EnhancedVisibility] Trajectory data result: source=${trajectoryData.source}, points=${trajectoryData.points.length}, realTelemetry=${trajectoryData.realTelemetry}`);
    } catch (trajectoryError) {
      console.error(`[EnhancedVisibility] ⚠️ Trajectory data fetching failed:`, trajectoryError);
      // Create minimal trajectory data for fallback
      trajectoryData = {
        launchId: launch.id,
        source: 'none',
        points: [],
        confidence: 'estimated',
        lastUpdated: new Date()
      };
      console.log(`[EnhancedVisibility] Created fallback trajectory data structure`);
    }
    
    // If we have trajectory data (real or generated), use it
    if (trajectoryData && trajectoryData.points.length > 0) {
      console.log(`[EnhancedVisibility] Step 2: Using trajectory data from ${trajectoryData.source} (${trajectoryData.realTelemetry ? 'real' : 'generated'})`);
      try {
        const result = calculateVisibilityFromTrajectory(launch, trajectoryData);
        console.log(`[EnhancedVisibility] ✅ Trajectory-based result: ${result.likelihood} - ${result.reason}`);
        return result;
      } catch (trajectoryVisibilityError) {
        console.error(`[EnhancedVisibility] ⚠️ Trajectory-based calculation failed:`, trajectoryVisibilityError);
        console.log(`[EnhancedVisibility] Falling back to estimation method`);
        // Don't throw here, fall through to estimation method
      }
    }
    
    console.log(`[EnhancedVisibility] Step 2: Using estimation method (${trajectoryData.points.length === 0 ? 'no trajectory data' : 'trajectory calculation failed'})`);
    // Fall back to original estimation method with enhanced error handling
    try {
      const result = calculateVisibilityFromEstimation(launch, trajectoryData);
      console.log(`[EnhancedVisibility] ✅ Estimation result: ${result.likelihood} - ${result.reason}`);
      return result;
    } catch (estimationError) {
      console.error(`[EnhancedVisibility] ⚠️ Estimation method also failed:`, estimationError);
      // Last resort: provide a basic fallback
      console.log(`[EnhancedVisibility] Providing basic fallback visibility data`);
      return {
        likelihood: 'medium',
        reason: `Unable to calculate detailed visibility for ${launch.mission.name}. Check manually for northeast trajectory.`,
        trajectoryData,
        bearing: 45, // Northeast assumption
        estimatedTimeVisible: 'T+6 to T+9 minutes (estimated)'
      };
    }
    
  } catch (error) {
    console.error(`[EnhancedVisibility] ❌ COMPLETE SYSTEM FAILURE for ${launch.name}:`, error);
    console.log(`[EnhancedVisibility] This should not happen with enhanced error handling`);
    
    // Absolute last resort fallback
    return {
      likelihood: 'medium',
      reason: `System error calculating visibility for ${launch.mission.name}. Launch from Florida typically visible northeast of Bermuda.`,
      bearing: 45,
      estimatedTimeVisible: 'Monitor T+6 to T+9 minutes',
      trajectoryData: {
        launchId: launch.id,
        source: 'none',
        points: [],
        confidence: 'estimated',
        lastUpdated: new Date()
      }
    };
  }
}

/**
 * Calculate visibility using real trajectory data
 */
function calculateVisibilityFromTrajectory(launch: Launch, trajectoryData: TrajectoryData): VisibilityData & { trajectoryData: TrajectoryData } {
  const isNight = isNightTime(launch.net);
  
  // Find closest approach point from trajectory data
  const visiblePoints = trajectoryData.points.filter(p => p.visible);
  
  if (visiblePoints.length === 0) {
    return {
      likelihood: 'none',
      reason: 'Real trajectory analysis: rocket path not visible from Bermuda',
      trajectoryData
    };
  }
  
  // Find closest approach
  let closestPoint = visiblePoints[0];
  let closestDistance = closestPoint.distance;
  
  visiblePoints.forEach(point => {
    if (point.distance < closestDistance) {
      closestDistance = point.distance;
      closestPoint = point;
    }
  });
  
  const startTime = visiblePoints[0].time;
  const endTime = visiblePoints[visiblePoints.length - 1].time;
  const startBearing = visiblePoints[0].bearing;
  const endBearing = visiblePoints[visiblePoints.length - 1].bearing;
  
  // Determine likelihood based on distance and time of day
  let likelihood: 'high' | 'medium' | 'low' | 'none';
  let reason: string;
  
  const roundedDistance = Math.round(closestDistance);
  
  const dataSource = trajectoryData.realTelemetry ? 'FLIGHT CLUB' : 'IMAGE ANALYSIS';
  
  if (closestDistance <= 200) { // Very close pass
    if (isNight) {
      likelihood = 'high';
      reason = `${dataSource}: Night launch passes ${roundedDistance}km from Bermuda`;
    } else {
      likelihood = 'medium';
      reason = `${dataSource}: Daytime launch passes ${roundedDistance}km from Bermuda`;
    }
  } else if (closestDistance <= 500) { // Close pass
    if (isNight) {
      likelihood = 'high';
      reason = `${dataSource}: Night launch passes ${roundedDistance}km from Bermuda`;
    } else {
      likelihood = 'low';
      reason = `${dataSource}: Daytime launch passes ${roundedDistance}km from Bermuda`;
    }
  } else if (closestDistance <= 1000) { // Moderate distance
    if (isNight) {
      likelihood = 'medium';
      reason = `${dataSource}: Night launch passes ${roundedDistance}km from Bermuda`;
    } else {
      likelihood = 'low';
      reason = `${dataSource}: Daytime launch passes ${roundedDistance}km from Bermuda. Very difficult to see`;
    }
  } else { // Far pass
    likelihood = isNight ? 'low' : 'none';
    reason = `${dataSource}: Passes ${roundedDistance}km from Bermuda. ${isNight ? 'May be faintly visible' : 'Too far and too bright'}`;
  }

  const avgBearing = (startBearing + endBearing) / 2;
  const duration = endTime - startTime;
  
  return {
    likelihood,
    reason,
    bearing: isNaN(avgBearing) ? undefined : Math.round(avgBearing),
    estimatedTimeVisible: isNight ? 
      `Visible T+${Math.round(startTime/60)}:${String(Math.round(startTime%60)).padStart(2,'0')} to T+${Math.round(endTime/60)}:${String(Math.round(endTime%60)).padStart(2,'0')} (${Math.round(duration)}s)` :
      'Difficult to see in daylight',
    trajectoryImageUrl: trajectoryData.imageUrl,
    trajectoryDirection: trajectoryData.trajectoryDirection,
    trajectoryData
  };
}

/**
 * Fall back to estimation method when trajectory data is not available
 */
function calculateVisibilityFromEstimation(launch: Launch, trajectoryData: TrajectoryData): VisibilityData & { trajectoryData: TrajectoryData } {
  console.log(`[EnhancedVisibility] === calculateVisibilityFromEstimation for ${launch.name} ===`);
  
  const isNight = isNightTime(launch.net);
  console.log(`[EnhancedVisibility] Night time check: ${isNight}`);
  
  // Extract coordinates using helper function
  console.log(`[EnhancedVisibility] Extracting coordinates from launch data...`);
  const coordinates = extractLaunchCoordinates(launch);
  console.log(`[EnhancedVisibility] Coordinates result: available=${coordinates.available}, lat=${coordinates.latitude}, lng=${coordinates.longitude}`);
  
  // Validate coordinates before calculations
  if (!coordinates.available) {
    const error = getCoordinateError(launch);
    console.log(`[EnhancedVisibility] COORDINATE ERROR: ${error}`);
    return {
      likelihood: 'none',
      reason: error,
      trajectoryData
    };
  }
  
  // Basic distance check
  console.log(`[EnhancedVisibility] Calculating distance from Bermuda (${BERMUDA_LAT}, ${BERMUDA_LNG}) to launch pad (${coordinates.latitude}, ${coordinates.longitude})`);
  const distance = calculateDistance(
    BERMUDA_LAT, BERMUDA_LNG,
    coordinates.latitude, coordinates.longitude
  );
  console.log(`[EnhancedVisibility] Distance calculated: ${distance} km`);
  
  // Validate distance calculation result (allow wider range for Florida launches)
  if (isNaN(distance) || distance > 1600 || distance < 600) {
    const reason = `Launch too ${distance > 1600 ? 'far' : 'close'} from Bermuda (${Math.round(distance)}km)`;
    console.log(`[EnhancedVisibility] DISTANCE ERROR: ${reason}`);
    return {
      likelihood: 'none',
      reason,
      trajectoryData
    };
  }

  // Use our own trajectory classification
  console.log(`[EnhancedVisibility] Getting trajectory info for pad: ${launch.pad.name}, orbit: ${launch.mission.orbit?.name}, mission: ${launch.mission.name}`);
  const trajectoryInfo = getTrajectoryInfoLocal(launch.pad.name, launch.mission.orbit?.name, launch.mission.name);
  console.log(`[EnhancedVisibility] Trajectory info: visibility=${trajectoryInfo.visibility}, direction=${trajectoryInfo.direction}, bearing=${trajectoryInfo.bearing}`);
  const bearing = trajectoryInfo.bearing;
  
  let likelihood: 'high' | 'medium' | 'low' | 'none';
  let reason = '';
  
  console.log(`[EnhancedVisibility] Determining visibility based on: isNight=${isNight}, trajectoryVisibility=${trajectoryInfo.visibility}`);
  
  if (isNight && trajectoryInfo.visibility === 'high') {
    likelihood = 'high';
    reason = `Night launch, ${trajectoryInfo.direction.toLowerCase()} trajectory (estimated). Look ${trajectoryInfo.direction.toLowerCase()}, low on horizon`;
    console.log(`[EnhancedVisibility] Night + High trajectory = HIGH visibility`);
  } else if (isNight && trajectoryInfo.visibility === 'medium') {
    likelihood = 'medium';
    reason = `Night launch, ${trajectoryInfo.direction.toLowerCase()} trajectory (estimated). Look ${trajectoryInfo.direction.toLowerCase()}`;
    console.log(`[EnhancedVisibility] Night + Medium trajectory = MEDIUM visibility`);
  } else if (!isNight && trajectoryInfo.visibility === 'high') {
    likelihood = 'medium';
    reason = `Daytime launch with ${trajectoryInfo.direction.toLowerCase()} trajectory. Difficult to see in bright sunlight but worth trying`;
    console.log(`[EnhancedVisibility] Day + High trajectory = MEDIUM visibility`);
  } else if (!isNight && trajectoryInfo.visibility === 'medium') {
    likelihood = 'low';
    reason = `Daytime launch with ${trajectoryInfo.direction.toLowerCase()} trajectory. Very difficult to see in sunlight but track ${trajectoryInfo.direction.toLowerCase()}`;
    console.log(`[EnhancedVisibility] Day + Medium trajectory = LOW visibility`);
  } else {
    likelihood = isNight ? 'low' : 'none';
    reason = isNight ? 'Limited visibility conditions' : 'Daytime launch with poor trajectory visibility from Bermuda';
    console.log(`[EnhancedVisibility] Default case: ${likelihood} (trajectoryVisibility=${trajectoryInfo.visibility})`);
  }
  
  const finalResult = {
    likelihood,
    reason,
    bearing: isNaN(bearing) ? undefined : Math.round(bearing),
    estimatedTimeVisible: isNight ? 'Start watching at T+6 min, visible until T+9 min (estimated)' : 
      (likelihood !== 'none' ? 'Track T+6 to T+9 min - look for contrail against blue sky' : 'Not visible in daylight'),
    trajectoryData
  };
  
  console.log(`[EnhancedVisibility] FINAL RESULT for ${launch.name}: ${finalResult.likelihood} - ${finalResult.reason}`);
  console.log(`[EnhancedVisibility] Bearing: ${finalResult.bearing}, Time: ${finalResult.estimatedTimeVisible}`);
  console.log(`[EnhancedVisibility] ===== End visibility calculation =====`);
  
  return finalResult;
}

// Helper functions (copied from original visibility service)
function calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371; // Earth's radius in kilometers (was 3959 miles - this was the bug!)
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c; // Now returns kilometers
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

function isNightTime(launchTime: string): boolean {
  // Convert to Bermuda time (AST/ADT UTC-4/-3) and check if it's night
  const launchDate = new Date(launchTime);
  // Bermuda is UTC-4 (AST) in winter, UTC-3 (ADT) in summer
  // For simplicity, use UTC-4 as typical offset
  const bermudaTime = new Date(launchDate.getTime() - (4 * 60 * 60 * 1000));
  
  // Use getUTCHours() to get the hour in the adjusted timezone
  const hour = bermudaTime.getUTCHours();
  // Night time in Bermuda: before 6am or after 8pm local time
  return hour < 6 || hour >= 20; // Fixed: >= 20 instead of > 20
}

interface TrajectoryInfo {
  visibility: 'high' | 'medium' | 'low' | 'none';
  direction: 'Northeast' | 'East-Northeast' | 'East' | 'East-Southeast' | 'Southeast' | 'North' | 'South' | 'Unknown';
  bearing: number;
}

function getTrajectoryInfoLocal(padName: string, orbitType?: string, missionName?: string): TrajectoryInfo {
  // This function should primarily be used when we don't have real trajectory data
  // The main enhanced visibility function should use actual Flight Club/Space Launch Schedule data
  
  // Use the imported trajectory classification as fallback
  return getTrajectoryInfo(padName, orbitType, missionName);
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function getTrajectoryVisibility(padName: string, orbitType?: string): 'high' | 'medium' | 'low' | 'none' {
  const orbitLower = orbitType?.toLowerCase() || '';
  
  // GTO/GEO missions - typically southeast trajectories (check first to avoid "geo" matching LEO)
  if (orbitLower.includes('gto') || 
      orbitLower.includes('geostationary') ||
      orbitLower.includes('geosynchronous') ||
      orbitLower.includes('transfer orbit')) {
    return 'medium';
  }
  
  // ISS/LEO missions - typically northeast trajectories (51.6° inclination)
  if (orbitLower.includes('iss') || 
      orbitLower.includes('station') ||
      orbitLower.includes('dragon') ||
      orbitLower.includes('cygnus')) {
    return 'high';
  }
  
  // Starlink missions - can vary but often northeast to east-northeast
  if (orbitLower.includes('starlink')) {
    return 'high';
  }
  
  // General LEO missions - could be various easterly directions
  if (orbitLower.includes('leo') || 
      orbitLower.includes('low earth orbit')) {
    return 'high';
  }
  
  // Polar/SSO missions - more northeasterly
  if (orbitLower.includes('sso') ||
      orbitLower.includes('sun-synchronous') ||
      orbitLower.includes('polar')) {
    return 'medium';
  }
  
  return 'medium';
}