import { Launch, VisibilityData } from '../types';
import { getTrajectoryData, TrajectoryData } from './trajectoryService';
import { extractLaunchCoordinates, getCoordinateError } from '../utils/launchCoordinates';

// Bermuda coordinates
const BERMUDA_LAT = 32.3078;
const BERMUDA_LNG = -64.7505;

/**
 * Enhanced visibility calculation using real trajectory data when available
 */
export async function calculateEnhancedVisibility(launch: Launch): Promise<VisibilityData & { trajectoryData?: TrajectoryData }> {
  // Get trajectory data
  const trajectoryData = await getTrajectoryData(launch);
  
  // If we have real trajectory data, use it (Flight Club has priority over image analysis)
  if (trajectoryData.points.length > 0 && (trajectoryData.source === 'flightclub' || trajectoryData.source === 'spacelaunchschedule')) {
    return calculateVisibilityFromTrajectory(launch, trajectoryData);
  }
  
  // Fall back to original estimation method
  return calculateVisibilityFromEstimation(launch, trajectoryData);
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
  const isNight = isNightTime(launch.net);
  
  // Extract coordinates using helper function
  const coordinates = extractLaunchCoordinates(launch);
  
  // Validate coordinates before calculations
  if (!coordinates.available) {
    return {
      likelihood: 'none',
      reason: getCoordinateError(launch),
      trajectoryData
    };
  }
  
  // Basic distance check
  const distance = calculateDistance(
    BERMUDA_LAT, BERMUDA_LNG,
    coordinates.latitude, coordinates.longitude
  );
  
  // Validate distance calculation result
  if (isNaN(distance) || distance > 1200 || distance < 700) {
    return {
      likelihood: 'none',
      reason: 'Launch trajectory not visible from Bermuda (estimated)',
      trajectoryData
    };
  }

  // Use our own trajectory classification
  const trajectoryInfo = getTrajectoryInfoLocal(launch.pad.name, launch.mission.orbit?.name, launch.mission.name);
  const bearing = trajectoryInfo.bearing;
  
  let likelihood: 'high' | 'medium' | 'low' | 'none';
  let reason = '';
  
  if (isNight && trajectoryInfo.visibility === 'high') {
    likelihood = 'high';
    reason = `Night launch, ${trajectoryInfo.direction.toLowerCase()} trajectory (estimated). Look ${trajectoryInfo.direction.toLowerCase()}, low on horizon`;
  } else if (isNight && trajectoryInfo.visibility === 'medium') {
    likelihood = 'medium';
    reason = `Night launch, ${trajectoryInfo.direction.toLowerCase()} trajectory (estimated). Look ${trajectoryInfo.direction.toLowerCase()}`;
  } else if (!isNight && trajectoryInfo.visibility === 'high') {
    likelihood = 'medium';
    reason = `Daytime launch with ${trajectoryInfo.direction.toLowerCase()} trajectory (estimated). Harder to spot in sunlight`;
  } else if (!isNight && trajectoryInfo.visibility === 'medium') {
    likelihood = 'low';
    reason = `Daytime launch with ${trajectoryInfo.direction.toLowerCase()} trajectory (estimated). Very difficult to see`;
  } else {
    likelihood = 'low';
    reason = 'Limited visibility conditions (estimated)';
  }
  
  return {
    likelihood,
    reason,
    bearing: isNaN(bearing) ? undefined : Math.round(bearing),
    estimatedTimeVisible: isNight ? 'Start watching at T+6 min, visible until T+9 min (estimated)' : 'Difficult to see in daylight',
    trajectoryData
  };
}

// Helper functions (copied from original visibility service)
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

function isNightTime(launchTime: string): boolean {
  // Convert to Bermuda time and check if it's night
  const launchDate = new Date(launchTime);
  const bermudaTime = new Date(launchDate.getTime());
  
  const hour = bermudaTime.getHours();
  return hour < 6 || hour > 20; // Rough night time estimation
}

interface TrajectoryInfo {
  visibility: 'high' | 'medium' | 'low' | 'none';
  direction: 'Northeast' | 'East-Northeast' | 'East' | 'East-Southeast' | 'Southeast';
  bearing: number;
}

function getTrajectoryInfoLocal(padName: string, orbitType?: string, missionName?: string): TrajectoryInfo {
  // Use the comprehensive trajectory database
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { getTrajectorySpec, validateTrajectory } = require('./trajectoryDatabase');
  
  const spec = getTrajectorySpec(missionName || '', orbitType || '', padName);
  
  // Validate the trajectory against orbital mechanics
  if (!validateTrajectory(spec, padName)) {
    console.warn(`Invalid trajectory for ${missionName}: inclination=${spec.inclination}°, azimuth=${spec.azimuth}°`);
  }
  
  return {
    visibility: spec.visibility,
    direction: spec.direction,
    bearing: spec.bearing
  };
}

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