import { Launch } from '../types';

// Bermuda coordinates for distance calculations
const BERMUDA_LAT = 32.3078;
const BERMUDA_LNG = -64.7505;
const EARTH_RADIUS_KM = 6371;

export interface TrajectoryPoint {
  time: number; // seconds from liftoff
  latitude: number;
  longitude: number;
  altitude: number; // meters
  distance: number; // km from Bermuda
  bearing: number; // degrees from Bermuda
  visible: boolean; // within line-of-sight
}

export interface TrajectoryData {
  launchId: string;
  source: 'flightclub' | 'spacelaunchschedule' | 'celestrak' | 'none';
  points: TrajectoryPoint[];
  imageUrl?: string;
  trajectoryDirection?: 'Northeast' | 'East' | 'Southeast' | 'Unknown';
  realTelemetry?: boolean; // true if from Flight Club telemetry
  visibilityWindow?: {
    startTime: number;
    endTime: number;
    startBearing: number;
    endBearing: number;
    closestApproach: number; // km
  };
}

// Cache for trajectory data
const trajectoryCache = new Map<string, { data: TrajectoryData; expires: number }>();
const TRAJECTORY_CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Calculate great circle distance between two points
 */
function calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = EARTH_RADIUS_KM;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Calculate bearing from Bermuda to a point
 */
function calculateBearing(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const y = Math.sin(dLng) * Math.cos(lat2 * Math.PI / 180);
  const x = Math.cos(lat1 * Math.PI / 180) * Math.sin(lat2 * Math.PI / 180) -
    Math.sin(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.cos(dLng);
  let bearing = Math.atan2(y, x) * 180 / Math.PI;
  return (bearing + 360) % 360;
}

/**
 * Calculate line-of-sight visibility based on altitude
 * Formula: cos θ = R/(R+h) where R=6,371km, h=altitude in km
 */
function calculateVisibilityRadius(altitudeMeters: number): number {
  const altitudeKm = altitudeMeters / 1000;
  const theta = Math.acos(EARTH_RADIUS_KM / (EARTH_RADIUS_KM + altitudeKm));
  return EARTH_RADIUS_KM * theta;
}

/**
 * Process trajectory points and determine visibility from Bermuda
 * TODO: Will be used when we have real trajectory data from Flight Club or other sources
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function processTrajectoryPoints(points: Array<{time: number, lat: number, lng: number, alt: number}>): TrajectoryPoint[] {
  return points.map(point => {
    const distance = calculateDistance(BERMUDA_LAT, BERMUDA_LNG, point.lat, point.lng);
    const bearing = calculateBearing(BERMUDA_LAT, BERMUDA_LNG, point.lat, point.lng);
    const visibilityRadius = calculateVisibilityRadius(point.alt);
    const visible = distance <= visibilityRadius;

    return {
      time: point.time,
      latitude: point.lat,
      longitude: point.lng,
      altitude: point.alt,
      distance,
      bearing,
      visible
    };
  });
}

/**
 * Calculate visibility window from trajectory points
 */
function calculateVisibilityWindow(points: TrajectoryPoint[]): TrajectoryData['visibilityWindow'] {
  const visiblePoints = points.filter(p => p.visible);
  
  if (visiblePoints.length === 0) {
    return undefined;
  }

  const startPoint = visiblePoints[0];
  const endPoint = visiblePoints[visiblePoints.length - 1];
  const closestPoint = visiblePoints.reduce((closest, current) => 
    current.distance < closest.distance ? current : closest
  );

  return {
    startTime: startPoint.time,
    endTime: endPoint.time,
    startBearing: startPoint.bearing,
    endBearing: endPoint.bearing,
    closestApproach: closestPoint.distance
  };
}

/**
 * Determine trajectory direction from trajectory points
 */
function determineTrajectoryDirection(points: TrajectoryPoint[]): 'Northeast' | 'East' | 'Southeast' | 'Unknown' {
  if (points.length < 2) {
    return 'Unknown';
  }
  
  // Use first and last points to determine overall direction
  const startPoint = points[0];
  const endPoint = points[points.length - 1];
  
  // Calculate the overall bearing from start to end
  const overallBearing = calculateBearing(startPoint.latitude, startPoint.longitude, endPoint.latitude, endPoint.longitude);
  
  // Classify direction based on bearing
  if (overallBearing >= 15 && overallBearing <= 75) {
    return 'Northeast';
  } else if (overallBearing >= 75 && overallBearing <= 105) {
    return 'East';
  } else if (overallBearing >= 105 && overallBearing <= 165) {
    return 'Southeast';
  } else {
    return 'Unknown';
  }
}

/**
 * Fetch trajectory data from Flight Club telemetry API
 */
async function fetchFlightClubTrajectory(launchLibraryId: string): Promise<TrajectoryData | null> {
  try {
    // Import Flight Club service
    const { getCachedTelemetry, analyzeVisibility } = await import('./flightClubService');
    
    // Fetch telemetry data
    const telemetry = await getCachedTelemetry(launchLibraryId);
    
    if (telemetry.length === 0) {
      console.log(`No Flight Club telemetry available for launch ${launchLibraryId}`);
      return null;
    }
    
    // Analyze visibility
    const visibility = analyzeVisibility(telemetry);
    
    if (!visibility.isVisible) {
      console.log(`Launch ${launchLibraryId} not visible from Bermuda according to Flight Club data`);
      return {
        launchId: launchLibraryId,
        source: 'flightclub',
        points: [],
        realTelemetry: true
      };
    }
    
    // Convert telemetry to our trajectory format
    const points: TrajectoryPoint[] = telemetry.map(frame => {
      const distance = calculateDistance(BERMUDA_LAT, BERMUDA_LNG, frame.lat, frame.lon);
      const bearing = calculateBearing(BERMUDA_LAT, BERMUDA_LNG, frame.lat, frame.lon);
      const visibilityRadius = calculateVisibilityRadius(frame.alt);
      
      return {
        time: frame.time,
        latitude: frame.lat,
        longitude: frame.lon,
        altitude: frame.alt,
        distance,
        bearing,
        visible: distance <= visibilityRadius
      };
    });
    
    // Calculate visibility window
    const visibilityWindow = visibility.firstVisible && visibility.lastVisible ? {
      startTime: visibility.firstVisible.time,
      endTime: visibility.lastVisible.time,
      startBearing: visibility.firstVisible.bearing,
      endBearing: visibility.lastVisible.bearing,
      closestApproach: visibility.closestApproach?.distance_km || 0
    } : undefined;
    
    // Determine trajectory direction
    const trajectoryDirection = determineTrajectoryDirection(points);
    
    console.log(`Flight Club telemetry: ${points.length} points, visible ${visibility.firstVisible?.time}-${visibility.lastVisible?.time}s, closest ${visibility.closestApproach?.distance_km?.toFixed(1)}km`);
    
    return {
      launchId: launchLibraryId,
      source: 'flightclub',
      points,
      realTelemetry: true,
      trajectoryDirection,
      visibilityWindow
    };

  } catch (error) {
    console.error(`Error fetching Flight Club telemetry for ${launchLibraryId}:`, error);
    return null;
  }
}

/**
 * Convert mission name to URL slug format used by Space Launch Schedule
 */
function convertMissionNameToSlug(missionName: string): string {
  return missionName.toLowerCase()
    .replace(/starlink\s+group\s+/g, 'starlink-group-')
    .replace(/[^\w\s-]/g, '') // Remove special characters except spaces and hyphens
    .replace(/\s+/g, '-')     // Replace spaces with hyphens
    .replace(/-+/g, '-')      // Replace multiple hyphens with single hyphen
    .replace(/^-|-$/g, '');   // Remove leading/trailing hyphens
}

/**
 * Try to fetch trajectory image from Space Launch Schedule and analyze it
 */
async function fetchSpaceLaunchScheduleImage(launchLibraryId: string, launch?: Launch): Promise<string | null> {
  try {
    const possibleUrls: string[] = [];
    
    // If we have launch data, try to generate URLs from mission name and rocket
    if (launch) {
      const missionSlug = convertMissionNameToSlug(launch.mission.name);
      const rocketName = launch.rocket.name.toLowerCase().replace(/\s+/g, '-');
      
      // Add mission name-based URLs (most likely to work)
      possibleUrls.push(
        `https://www.spacelaunchschedule.com/launch/${missionSlug}/`,
        `https://www.spacelaunchschedule.com/launch/falcon-9-${missionSlug}/`,
        `https://www.spacelaunchschedule.com/launch/falcon-9-block-5-${missionSlug}/`,
        `https://www.spacelaunchschedule.com/launch/${rocketName}-${missionSlug}/`
      );
      
      console.log(`Trying Space Launch Schedule URLs for "${launch.mission.name}":`, possibleUrls.slice(0, 2));
    }
    
    // Add original UUID-based URLs as fallback
    possibleUrls.push(
      `https://www.spacelaunchschedule.com/launch/${launchLibraryId}/`,
      `https://www.spacelaunchschedule.com/launch/falcon-9-${launchLibraryId}/`,
      `https://www.spacelaunchschedule.com/launch/falcon-9-block-5-${launchLibraryId}/`
    );

    for (const url of possibleUrls) {
      try {
        const response = await fetch(url, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (compatible; BermudaRocketTracker/1.0)'
          }
        });

        if (response.ok) {
          const html = await response.text();
          
          // Enhanced regex to find trajectory images
          const imagePatterns = [
            /<img[^>]+src="([^"]*trajectory[^"]*\.(?:jpg|jpeg|png|gif))"[^>]*>/i,
            /<img[^>]+src="([^"]*trajecoty[^"]*\.(?:jpg|jpeg|png|gif))"[^>]*>/i, // Handle typos
            /<img[^>]+src="([^"]*flight[^"]*path[^"]*\.(?:jpg|jpeg|png|gif))"[^>]*>/i,
            /<img[^>]+src="([^"]*wp-content\/uploads\/[^"]*\.(?:jpg|jpeg|png|gif))"[^>]*>/i
          ];
          
          for (const pattern of imagePatterns) {
            const match = html.match(pattern);
            if (match && match[1]) {
              const imageUrl = match[1].startsWith('http') ? match[1] : `https://www.spacelaunchschedule.com${match[1]}`;
              console.log(`Found trajectory image for ${launchLibraryId}: ${imageUrl}`);
              return imageUrl;
            }
          }
        }
      } catch (error) {
        console.log(`Failed to fetch ${url}:`, error);
      }
    }

    return null;
  } catch (error) {
    console.error(`Error fetching Space Launch Schedule data for ${launchLibraryId}:`, error);
    return null;
  }
}

/**
 * Main function to get trajectory data for a launch
 */
export async function getTrajectoryData(launch: Launch): Promise<TrajectoryData> {
  const launchId = launch.id;
  
  // Check cache first
  const cached = trajectoryCache.get(launchId);
  if (cached && Date.now() < cached.expires) {
    return cached.data;
  }

  // Initialize result
  let trajectoryData: TrajectoryData = {
    launchId,
    source: 'none',
    points: []
  };

  // Try Flight Club first
  const flightClubData = await fetchFlightClubTrajectory(launchId);
  if (flightClubData) {
    trajectoryData = flightClubData;
  } else {
    // Try Space Launch Schedule image analysis
    const trajectoryImage = await fetchSpaceLaunchScheduleImage(launchId, launch);
    if (trajectoryImage) {
      try {
        // Import image analysis service dynamically to avoid dependency issues
        const { analyzeTrajectoryImage, getCachedAnalysis, cacheAnalysis } = await import('./imageAnalysisService');
        
        // Check if we have cached analysis for this image
        let analysis = getCachedAnalysis(trajectoryImage);
        
        if (!analysis) {
          // Perform image analysis
          console.log(`Analyzing trajectory image: ${trajectoryImage}`);
          analysis = await analyzeTrajectoryImage(trajectoryImage);
          
          // Cache the analysis result
          if (analysis.success) {
            cacheAnalysis(trajectoryImage, analysis);
          }
        }
        
        if (analysis.success && analysis.trajectoryPoints.length > 0) {
          // Convert analysis results to our trajectory format
          const points: TrajectoryPoint[] = analysis.trajectoryPoints.map((point, index) => {
            const distance = calculateDistance(BERMUDA_LAT, BERMUDA_LNG, point.lat, point.lng);
            const bearing = calculateBearing(BERMUDA_LAT, BERMUDA_LNG, point.lat, point.lng);
            const visibilityRadius = calculateVisibilityRadius(150000); // Assume 150km altitude
            
            return {
              time: index * 30, // Rough time estimate (30s intervals)
              latitude: point.lat,
              longitude: point.lng,
              altitude: 150000, // Rough altitude estimate in meters
              distance,
              bearing,
              visible: distance <= visibilityRadius
            };
          });
          
          trajectoryData = {
            launchId,
            source: 'spacelaunchschedule',
            points,
            imageUrl: trajectoryImage,
            trajectoryDirection: analysis.trajectoryDirection,
            visibilityWindow: calculateVisibilityWindow(points)
          };
          
          console.log(`Successfully analyzed trajectory: ${points.length} points, closest approach: ${analysis.closestApproachToBermuda?.distance.toFixed(1)}km`);
        } else {
          console.log(`Image analysis failed for ${trajectoryImage}: ${analysis.error || 'Unknown error'}`);
          trajectoryData = {
            launchId,
            source: 'spacelaunchschedule',
            points: [],
            imageUrl: trajectoryImage
          };
        }
      } catch (error) {
        console.error('Error during image analysis:', error);
        trajectoryData = {
          launchId,
          source: 'spacelaunchschedule',
          points: [],
          imageUrl: trajectoryImage
        };
      }
    }
  }

  // Cache the result
  trajectoryCache.set(launchId, {
    data: trajectoryData,
    expires: Date.now() + TRAJECTORY_CACHE_DURATION
  });

  return trajectoryData;
}

/**
 * Clear trajectory cache (useful for testing)
 */
export function clearTrajectoryCache(): void {
  trajectoryCache.clear();
}

/**
 * Get cache status for debugging
 */
export function getTrajectoryCache(): Map<string, { data: TrajectoryData; expires: number }> {
  return trajectoryCache;
}