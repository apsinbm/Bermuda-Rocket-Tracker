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
  trajectoryDirection?: 'Northeast' | 'East-Northeast' | 'East' | 'East-Southeast' | 'Southeast' | 'North' | 'South' | 'Unknown';
  realTelemetry?: boolean; // true if from Flight Club telemetry
  confidence?: 'confirmed' | 'projected' | 'estimated'; // Data confidence level
  flightClubId?: string; // Launch Library ID for FlightClub
  lastUpdated?: Date; // When trajectory data was last fetched
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
function determineTrajectoryDirection(points: TrajectoryPoint[]): TrajectoryData['trajectoryDirection'] {
  if (points.length < 2) {
    return 'Unknown';
  }
  
  // Use first and last points to determine overall direction
  const startPoint = points[0];
  const endPoint = points[points.length - 1];
  
  // Calculate the overall bearing from start to end
  const overallBearing = calculateBearing(startPoint.latitude, startPoint.longitude, endPoint.latitude, endPoint.longitude);
  
  // Classify direction based on bearing with enhanced granularity
  if (overallBearing >= 15 && overallBearing <= 45) {
    return 'Northeast';
  } else if (overallBearing >= 45 && overallBearing <= 75) {
    return 'East-Northeast';
  } else if (overallBearing >= 75 && overallBearing <= 105) {
    return 'East';
  } else if (overallBearing >= 105 && overallBearing <= 135) {
    return 'East-Southeast';
  } else if (overallBearing >= 135 && overallBearing <= 165) {
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
    // Handle specific patterns
    .replace(/starlink\s+group\s+(\d+)-(\d+)/g, 'starlink-group-$1-$2')
    .replace(/starlink\s+group\s+(\d+)/g, 'starlink-group-$1')
    .replace(/starlink\s+/g, 'starlink-')
    .replace(/crew\s*-?\s*(\d+)/g, 'crew-$1')
    .replace(/crs\s*-?\s*(\d+)/g, 'crs-$1')
    .replace(/ussf\s*-?\s*(\d+)/g, 'ussf-$1')
    // Remove special characters except alphanumeric, spaces, and hyphens
    .replace(/[^\w\s-]/g, '')
    // Replace spaces with hyphens
    .replace(/\s+/g, '-')
    // Replace multiple hyphens with single hyphen
    .replace(/-+/g, '-')
    // Remove leading/trailing hyphens
    .replace(/^-|-$/g, '');
}

/**
 * Generate multiple possible URL variations for Space Launch Schedule
 */
function generateSpaceLaunchScheduleUrls(launch: Launch): string[] {
  const missionSlug = convertMissionNameToSlug(launch.mission.name);
  const rocketName = launch.rocket.name.toLowerCase().replace(/\s+/g, '-');
  const baseDate = new Date(launch.net);
  const year = baseDate.getFullYear();
  const month = String(baseDate.getMonth() + 1).padStart(2, '0');
  
  const urls: string[] = [];
  
  // Primary patterns based on actual Space Launch Schedule URL structure
  urls.push(
    // Mission name patterns
    `https://www.spacelaunchschedule.com/launch/${missionSlug}/`,
    `https://www.spacelaunchschedule.com/launch/${year}/${missionSlug}/`,
    `https://www.spacelaunchschedule.com/launch/${year}-${month}/${missionSlug}/`,
    
    // Rocket + mission patterns
    `https://www.spacelaunchschedule.com/launch/falcon-9-${missionSlug}/`,
    `https://www.spacelaunchschedule.com/launch/falcon-9-block-5-${missionSlug}/`,
    `https://www.spacelaunchschedule.com/launch/${rocketName}-${missionSlug}/`,
    
    // Date-based patterns
    `https://www.spacelaunchschedule.com/launch/${year}/${rocketName}-${missionSlug}/`,
    
    // Launch Library ID fallbacks
    `https://www.spacelaunchschedule.com/launch/${launch.id}/`,
    `https://www.spacelaunchschedule.com/launch/falcon-9-${launch.id}/`
  );
  
  return urls;
}

/**
 * Try to fetch trajectory image from Space Launch Schedule and analyze it
 */
async function fetchSpaceLaunchScheduleImage(launchLibraryId: string, launch?: Launch): Promise<string | null> {
  try {
    console.log(`[SpaceLaunchSchedule] Searching for trajectory image for launch ${launchLibraryId}`);
    
    // Generate comprehensive URL list
    const possibleUrls = launch ? generateSpaceLaunchScheduleUrls(launch) : [
      `https://www.spacelaunchschedule.com/launch/${launchLibraryId}/`,
      `https://www.spacelaunchschedule.com/launch/falcon-9-${launchLibraryId}/`
    ];

    console.log(`[SpaceLaunchSchedule] Trying ${possibleUrls.length} URLs for "${launch?.mission.name || launchLibraryId}"`);

    // Try each URL with enhanced error handling and timeout
    for (let i = 0; i < possibleUrls.length; i++) {
      const url = possibleUrls[i];
      try {
        console.log(`[SpaceLaunchSchedule] Trying URL ${i + 1}/${possibleUrls.length}: ${url}`);
        
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
        
        const response = await fetch(url, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (compatible; BermudaRocketTracker/1.0)',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
          },
          signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (response.ok) {
          const html = await response.text();
          console.log(`[SpaceLaunchSchedule] Successfully fetched HTML from ${url}, searching for images...`);
          
          // Enhanced image search patterns
          const imagePatterns = [
            // Direct trajectory image patterns
            /<img[^>]+src="([^"]*trajectory[^"]*\.(?:jpg|jpeg|png|gif|webp))"[^>]*>/gi,
            /<img[^>]+src="([^"]*trajecoty[^"]*\.(?:jpg|jpeg|png|gif|webp))"[^>]*>/gi, // Handle typos
            /<img[^>]+src="([^"]*flight[_-]?path[^"]*\.(?:jpg|jpeg|png|gif|webp))"[^>]*>/gi,
            /<img[^>]+src="([^"]*flight[_-]?profile[^"]*\.(?:jpg|jpeg|png|gif|webp))"[^>]*>/gi,
            
            // WordPress upload patterns (common for Space Launch Schedule)
            /<img[^>]+src="([^"]*wp-content\/uploads\/[^"]*\.(?:jpg|jpeg|png|gif|webp))"[^>]*>/gi,
            /<img[^>]+src="([^"]*uploads\/[^"]*trajectory[^"]*\.(?:jpg|jpeg|png|gif|webp))"[^>]*>/gi,
            
            // Generic launch-related images that might contain trajectory data
            /<img[^>]+src="([^"]*launch[_-]?profile[^"]*\.(?:jpg|jpeg|png|gif|webp))"[^>]*>/gi,
            /<img[^>]+src="([^"]*mission[_-]?profile[^"]*\.(?:jpg|jpeg|png|gif|webp))"[^>]*>/gi
          ];
          
          for (const pattern of imagePatterns) {
            let match;
            while ((match = pattern.exec(html)) !== null) {
              if (match[1]) {
                const imageUrl = match[1].startsWith('http') ? match[1] : `https://www.spacelaunchschedule.com${match[1]}`;
                console.log(`[SpaceLaunchSchedule] Found potential trajectory image: ${imageUrl}`);
                
                // Verify image exists and is accessible
                try {
                  const imageResponse = await fetch(imageUrl, { method: 'HEAD' });
                  if (imageResponse.ok) {
                    console.log(`[SpaceLaunchSchedule] Verified trajectory image for ${launchLibraryId}: ${imageUrl}`);
                    return imageUrl;
                  }
                } catch (imageError) {
                  console.log(`[SpaceLaunchSchedule] Image verification failed for ${imageUrl}:`, imageError);
                }
              }
            }
          }
          
          console.log(`[SpaceLaunchSchedule] No trajectory images found in HTML from ${url}`);
        } else {
          console.log(`[SpaceLaunchSchedule] HTTP ${response.status} for ${url}`);
        }
      } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') {
          console.log(`[SpaceLaunchSchedule] Request timeout for ${url}`);
        } else {
          console.log(`[SpaceLaunchSchedule] Failed to fetch ${url}:`, error);
        }
      }
    }

    console.log(`[SpaceLaunchSchedule] No trajectory image found for launch ${launchLibraryId} after trying ${possibleUrls.length} URLs`);
    return null;
  } catch (error) {
    console.error(`[SpaceLaunchSchedule] Error fetching trajectory data for ${launchLibraryId}:`, error);
    return null;
  }
}

/**
 * Main function to get trajectory data for a launch with enhanced online data fetching
 */
export async function getTrajectoryData(launch: Launch): Promise<TrajectoryData> {
  const launchId = launch.id;
  
  console.log(`[TrajectoryService] Getting trajectory data for launch ${launchId}: ${launch.name}`);
  
  // Check cache first with proximity-based expiration
  const cached = trajectoryCache.get(launchId);
  const cacheExpiry = getCacheExpiryForLaunch(launch.net);
  
  if (cached && Date.now() < cached.expires && cached.expires > cacheExpiry) {
    console.log(`[TrajectoryService] Using cached trajectory data for ${launchId}`);
    return cached.data;
  }

  // Initialize result
  let trajectoryData: TrajectoryData = {
    launchId,
    source: 'none',
    points: [],
    confidence: 'estimated',
    lastUpdated: new Date()
  };

  // Step 1: Try Space Launch Schedule for trajectory data (most comprehensive)
  console.log(`[TrajectoryService] Checking Space Launch Schedule for ${launchId}...`);
  try {
    const { getCachedSpaceLaunchScheduleData } = await import('./spaceLaunchScheduleService');
    const slsData = await getCachedSpaceLaunchScheduleData(launch);
    
    if (slsData.flightClubId) {
      // Step 2: Use Flight Club ID to fetch telemetry
      console.log(`[TrajectoryService] Found FlightClub ID: ${slsData.flightClubId}, fetching telemetry...`);
      const flightClubData = await fetchFlightClubTrajectory(slsData.flightClubId);
      if (flightClubData) {
        trajectoryData = {
          ...flightClubData,
          confidence: 'confirmed',
          flightClubId: slsData.flightClubId,
          lastUpdated: new Date()
        };
        console.log(`[TrajectoryService] Got confirmed FlightClub telemetry: ${flightClubData.points.length} points`);
      }
    } else if (slsData.trajectoryImageUrl) {
      // Step 3: Analyze trajectory image with environment-safe approach
      console.log(`[TrajectoryService] Found trajectory image: ${slsData.trajectoryImageUrl}`);
      try {
        // Environment-safe image analysis import with fallback
        const { isBrowser } = await import('../utils/environmentUtils');
        
        if (isBrowser()) {
          console.log('[TrajectoryService] Browser environment detected, attempting full image analysis');
          const { analyzeTrajectoryImage, getCachedAnalysis, cacheAnalysis } = await import('./imageAnalysisService');
          
          let analysis = getCachedAnalysis(slsData.trajectoryImageUrl);
          
          if (!analysis) {
            console.log(`Analyzing trajectory image: ${slsData.trajectoryImageUrl}`);
            analysis = await analyzeTrajectoryImage(slsData.trajectoryImageUrl, launch);
            
            if (analysis.success) {
              cacheAnalysis(slsData.trajectoryImageUrl, analysis);
            }
          }
          
          if (analysis.success && analysis.trajectoryPoints.length > 0) {
            const points: TrajectoryPoint[] = analysis.trajectoryPoints.map((point, index) => {
              const distance = calculateDistance(BERMUDA_LAT, BERMUDA_LNG, point.lat, point.lng);
              const bearing = calculateBearing(BERMUDA_LAT, BERMUDA_LNG, point.lat, point.lng);
              const visibilityRadius = calculateVisibilityRadius(150000);
              
              return {
                time: index * 30,
                latitude: point.lat,
                longitude: point.lng,
                altitude: 150000,
                distance,
                bearing,
                visible: distance <= visibilityRadius
              };
            });
            
            trajectoryData = {
              launchId,
              source: 'spacelaunchschedule',
              points,
              imageUrl: slsData.trajectoryImageUrl,
              trajectoryDirection: slsData.trajectoryDirection || analysis.trajectoryDirection,
              confidence: 'projected',
              lastUpdated: new Date(),
              visibilityWindow: calculateVisibilityWindow(points)
            };
            
            console.log(`[TrajectoryService] Browser-analyzed trajectory image: ${points.length} points, direction: ${trajectoryData.trajectoryDirection}`);
          }
        } else {
          console.log('[TrajectoryService] Server environment detected, using filename-based trajectory analysis');
          // Server-safe filename analysis
          const direction = analyzeTrajectoryFromFilename(slsData.trajectoryImageUrl, launch.mission.name);
          if (direction && direction !== 'Unknown') {
            console.log(`[TrajectoryService] Filename analysis determined: ${direction} trajectory`);
            const estimatedTrajectory = generateTrajectoryFromDirection(launch, direction);
            trajectoryData = {
              ...estimatedTrajectory,
              imageUrl: slsData.trajectoryImageUrl,
              confidence: 'projected',
              lastUpdated: new Date()
            };
          }
        }
      } catch (error) {
        console.error('Error analyzing trajectory image:', error);
      }
    } else if (slsData.trajectoryDirection) {
      // Step 4: Use trajectory direction from filename
      console.log(`[TrajectoryService] Using trajectory direction from Space Launch Schedule: ${slsData.trajectoryDirection}`);
      const estimatedTrajectory = generateTrajectoryFromDirection(launch, slsData.trajectoryDirection);
      trajectoryData = {
        ...estimatedTrajectory,
        confidence: 'projected',
        lastUpdated: new Date()
      };
    }
  } catch (error) {
    console.error(`[TrajectoryService] Error fetching Space Launch Schedule data:`, error);
  }
  
  // Step 5: Fallback to mission-based trajectory generation
  if (trajectoryData.points.length === 0) {
    console.log(`[TrajectoryService] No online data available, generating trajectory from mission type for ${launch.mission.name}`);
    trajectoryData = generateRealisticTrajectory(launch);
    trajectoryData.confidence = 'estimated';
    trajectoryData.lastUpdated = new Date();
  }

  // CRITICAL FIX: Override trajectory direction for X-37B missions to prevent external data from corrupting it
  const missionName = launch.mission.name.toLowerCase();
  const launchName = launch.name?.toLowerCase() || '';
  
  if (missionName.includes('x-37b') || missionName.includes('x37b') || 
      missionName.includes('otv-') || missionName.includes('otv ') ||
      missionName.includes('ussf-36') || missionName.includes('ussf 36') ||
      launchName.includes('x-37b') || launchName.includes('otv')) {
    
    if (trajectoryData.trajectoryDirection !== 'Northeast') {
      console.log(`[TrajectoryService] OVERRIDE: X-37B mission "${launch.mission.name}" trajectory direction corrected from ${trajectoryData.trajectoryDirection} to Northeast`);
      trajectoryData.trajectoryDirection = 'Northeast';
      trajectoryData.confidence = 'confirmed'; // High confidence override
    }
  }

  // Cache the result with proximity-based expiration
  trajectoryCache.set(launchId, {
    data: trajectoryData,
    expires: Date.now() + cacheExpiry
  });

  console.log(`[TrajectoryService] Final trajectory: ${trajectoryData.source} source, ${trajectoryData.confidence} confidence, ${trajectoryData.points.length} points, direction: ${trajectoryData.trajectoryDirection}`);
  return trajectoryData;
}

/**
 * Get cache expiry based on launch proximity
 */
function getCacheExpiryForLaunch(launchTime: string): number {
  const now = Date.now();
  const launch = new Date(launchTime).getTime();
  const hoursUntilLaunch = (launch - now) / (1000 * 60 * 60);
  
  if (hoursUntilLaunch > 168) { // > 7 days
    return 24 * 60 * 60 * 1000; // 24 hours
  } else if (hoursUntilLaunch > 72) { // 3-7 days
    return 12 * 60 * 60 * 1000; // 12 hours
  } else if (hoursUntilLaunch > 24) { // 1-3 days
    return 6 * 60 * 60 * 1000; // 6 hours
  } else if (hoursUntilLaunch > 2) { // 2-24 hours
    return 2 * 60 * 60 * 1000; // 2 hours
  } else {
    return 30 * 60 * 1000; // 30 minutes for imminent launches
  }
}

/**
 * Server-safe trajectory analysis from filename and URL patterns
 */
function analyzeTrajectoryFromFilename(imageUrl: string, missionName: string): TrajectoryData['trajectoryDirection'] {
  console.log(`[TrajectoryService] Analyzing trajectory from filename: ${imageUrl}`);
  
  const filename = imageUrl.split('/').pop()?.toLowerCase() || '';
  const urlPath = imageUrl.toLowerCase();
  const mission = missionName.toLowerCase();
  
  // Enhanced trajectory direction patterns
  const trajectoryPatterns = {
    northeast: [
      'northeast', 'north-east', 'ne-', '_ne_', '_ne.', 
      'rtls', 'north', // RTLS (Return to Launch Site) typically indicates northeast
      '045', '050', '051', 'neast'
    ],
    east: [
      'east-', 'due-east', '_e_', '_e.', 
      '090', '095', '100'
    ],
    southeast: [
      'southeast', 'south-east', 'se-', '_se_', '_se.', 
      '130', '135', '140', 'seast'
    ]
  };
  
  // Mission type patterns for enhanced accuracy
  const missionPatterns = {
    starlink: ['starlink', 'sl-', 'group-'],
    iss: ['iss', 'dragon', 'crew', 'cygnus'],
    gto: ['gto', 'geo', 'ussf', 'geosynchronous', 'geostationary']
  };
  
  // Step 1: Check filename for explicit trajectory direction
  if (trajectoryPatterns.northeast.some(pattern => filename.includes(pattern) || urlPath.includes(pattern))) {
    console.log(`[TrajectoryService] Filename indicates Northeast trajectory`);
    return 'Northeast';
  } else if (trajectoryPatterns.southeast.some(pattern => filename.includes(pattern) || urlPath.includes(pattern))) {
    console.log(`[TrajectoryService] Filename indicates Southeast trajectory`);
    return 'Southeast';
  } else if (trajectoryPatterns.east.some(pattern => filename.includes(pattern) || urlPath.includes(pattern))) {
    console.log(`[TrajectoryService] Filename indicates East trajectory`);
    return 'East';
  }
  
  // Step 2: Mission type-based trajectory prediction
  if (missionPatterns.starlink.some(pattern => mission.includes(pattern))) {
    console.log(`[TrajectoryService] Starlink mission detected, predicting Northeast trajectory`);
    return 'Northeast'; // Most Starlink missions go northeast
  } else if (missionPatterns.iss.some(pattern => mission.includes(pattern))) {
    console.log(`[TrajectoryService] ISS mission detected, predicting Northeast trajectory`);
    return 'Northeast'; // ISS missions go northeast (51.6° inclination)
  } else if (missionPatterns.gto.some(pattern => mission.includes(pattern))) {
    console.log(`[TrajectoryService] GTO mission detected, predicting Southeast trajectory`);
    return 'Southeast'; // GTO missions typically go southeast
  }
  
  // Step 3: Default based on common patterns
  console.log(`[TrajectoryService] Using default Northeast trajectory prediction`);
  return 'Northeast'; // Most launches from Florida go northeast
}

/**
 * Generate trajectory from known direction
 */
function generateTrajectoryFromDirection(launch: Launch, direction: TrajectoryData['trajectoryDirection']): TrajectoryData {
  const { getTrajectoryMapping } = require('./trajectoryMappingService');
  
  // Convert direction to azimuth
  const azimuthMap: Record<string, number> = {
    'Northeast': 45,
    'East-Northeast': 67,
    'East': 90,
    'East-Southeast': 112,
    'Southeast': 135,
    'North': 0,
    'South': 180,
    'Unknown': 50
  };
  
  const azimuth = direction ? (azimuthMap[direction] || 50) : 50;
  
  // Use existing trajectory generation but with known direction
  const trajectoryMapping = getTrajectoryMapping(launch);
  trajectoryMapping.azimuth = azimuth;
  trajectoryMapping.direction = direction as any;
  
  const trajectoryData = generateRealisticTrajectory(launch);
  trajectoryData.trajectoryDirection = direction as any;
  trajectoryData.source = 'spacelaunchschedule';
  
  return trajectoryData;
}

/**
 * Generate realistic trajectory data based on mission type and launch pad
 */
function generateRealisticTrajectory(launch: Launch): TrajectoryData {
  const { extractLaunchCoordinates } = require('../utils/launchCoordinates');
  const { getTrajectoryMapping } = require('./trajectoryMappingService');
  const coordinates = extractLaunchCoordinates(launch);
  
  if (!coordinates.available) {
    return {
      launchId: launch.id,
      source: 'none',
      points: []
    };
  }
  
  // Use trajectory mapping service for accurate azimuth calculation
  const trajectoryMapping = getTrajectoryMapping(launch);
  const azimuth = trajectoryMapping.azimuth;
  const trajectoryDirection = trajectoryMapping.direction;
  
  // Generate trajectory points over 10 minutes (600 seconds)
  const points: TrajectoryPoint[] = [];
  const startLat = coordinates.latitude;
  const startLng = coordinates.longitude;
  
  for (let t = 0; t <= 600; t += 30) { // Every 30 seconds
    // Calculate position along trajectory
    const distanceKm = t * 8; // ~8km per second average velocity
    const azimuthRad = azimuth * Math.PI / 180;
    
    // Project position using great circle math
    const angularDistance = distanceKm / EARTH_RADIUS_KM;
    const lat1Rad = startLat * Math.PI / 180;
    const lng1Rad = startLng * Math.PI / 180;
    
    const lat2Rad = Math.asin(
      Math.sin(lat1Rad) * Math.cos(angularDistance) +
      Math.cos(lat1Rad) * Math.sin(angularDistance) * Math.cos(azimuthRad)
    );
    
    const lng2Rad = lng1Rad + Math.atan2(
      Math.sin(azimuthRad) * Math.sin(angularDistance) * Math.cos(lat1Rad),
      Math.cos(angularDistance) - Math.sin(lat1Rad) * Math.sin(lat2Rad)
    );
    
    const lat = lat2Rad * 180 / Math.PI;
    const lng = lng2Rad * 180 / Math.PI;
    
    // Altitude increases over time
    const altitude = Math.max(0, (t - 120) * 300); // Start gaining altitude after T+2min
    
    // Calculate distance and bearing from Bermuda
    const distance = calculateDistance(BERMUDA_LAT, BERMUDA_LNG, lat, lng);
    const bearing = calculateBearing(BERMUDA_LAT, BERMUDA_LNG, lat, lng);
    const visibilityRadius = calculateVisibilityRadius(altitude);
    const visible = distance <= visibilityRadius && altitude > 50000; // Must be above 50km
    
    points.push({
      time: t,
      latitude: lat,
      longitude: lng,
      altitude,
      distance,
      bearing,
      visible
    });
  }
  
  const visibilityWindow = calculateVisibilityWindow(points);
  
  console.log(`[TrajectoryService] Generated realistic ${trajectoryDirection} trajectory: ${points.filter(p => p.visible).length} visible points`);
  
  return {
    launchId: launch.id,
    source: 'none', // Mark as generated, not real data
    points,
    trajectoryDirection,
    visibilityWindow,
    realTelemetry: false
  };
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