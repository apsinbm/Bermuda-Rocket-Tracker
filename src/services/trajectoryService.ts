import { Launch, TrajectoryPoint } from '../types';

// Bermuda coordinates for distance calculations
const BERMUDA_LAT = 32.3078;
const BERMUDA_LNG = -64.7505;
const EARTH_RADIUS_KM = 6371;


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
 * Calculate elevation angle above horizon from Bermuda's perspective
 * Returns positive angle if above horizon, negative if below horizon
 */
function calculateElevationAngle(distance: number, altitude: number): number {
  const R = EARTH_RADIUS_KM; // Earth radius in km
  
  // Account for Earth's curvature - distant objects appear lower
  const earthCurvature = (distance * distance) / (2 * R);
  const apparentAltitude = altitude / 1000 - earthCurvature; // Convert altitude to km
  
  // Calculate elevation angle using proper trigonometry
  const elevationRadians = Math.atan2(apparentAltitude, distance);
  const elevationDegrees = elevationRadians * 180 / Math.PI;
  
  // Return actual angle (can be negative if below horizon)
  return elevationDegrees;
}

/**
 * Determine rocket stage and engine status from Flight Club telemetry data
 * This will be enhanced to use actual Flight Club stage events when available
 */
function determineStageInfoFromTelemetry(timeSeconds: number, stageNumber?: number, events?: Array<{time: number, event: string, engineType?: string}>): { stage: TrajectoryPoint['stage'], engineStatus: TrajectoryPoint['engineStatus'] } {
  // If we have Flight Club stage number, use it
  if (stageNumber !== undefined) {
    if (stageNumber === 1) {
      // Check for MECO event to determine if engine is still burning
      const mecoEvent = events?.find(e => e.event === 'MECO' && e.time <= timeSeconds);
      return { 
        stage: 'first', 
        engineStatus: mecoEvent ? 'shutdown' : 'burning' 
      };
    } else if (stageNumber === 2) {
      // Check for SECO events to determine MVac status
      const secoEvent = events?.find(e => (e.event === 'SECO-1' || e.event === 'SECO-2') && e.time <= timeSeconds);
      return { 
        stage: secoEvent ? 'second-coast' : 'second-burn', 
        engineStatus: secoEvent ? 'shutdown' : 'burning' 
      };
    }
  }
  
  // Fallback to typical Falcon 9 flight profile timings when Flight Club data unavailable
  const FIRST_STAGE_BURN_END = 162; // ~2:42 - First stage MECO
  const STAGE_SEPARATION = 165; // ~2:45 - Stage separation
  const SECOND_STAGE_IGNITION = 168; // ~2:48 - Second stage MVac ignition  
  const SECOND_STAGE_BURN_END = 540; // ~9:00 - Second stage SECO-1
  
  if (timeSeconds <= FIRST_STAGE_BURN_END) {
    return { stage: 'first', engineStatus: 'burning' };
  } else if (timeSeconds <= STAGE_SEPARATION) {
    return { stage: 'first', engineStatus: 'shutdown' };
  } else if (timeSeconds <= SECOND_STAGE_IGNITION) {
    return { stage: 'separation', engineStatus: 'separation' };
  } else if (timeSeconds <= SECOND_STAGE_BURN_END) {
    return { stage: 'second-burn', engineStatus: 'burning' };
  } else {
    return { stage: 'second-coast', engineStatus: 'shutdown' };
  }
}

/**
 * Process trajectory points and determine visibility from Bermuda
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function processTrajectoryPoints(points: Array<{time: number, lat: number, lng: number, alt: number}>): TrajectoryPoint[] {
  return points.map(point => {
    const distance = calculateDistance(BERMUDA_LAT, BERMUDA_LNG, point.lat, point.lng);
    const bearing = calculateBearing(BERMUDA_LAT, BERMUDA_LNG, point.lat, point.lng);
    const elevationAngle = calculateElevationAngle(distance, point.alt);
    const visible = elevationAngle > 0; // Above horizon check
    const stageInfo = determineStageInfoFromTelemetry(point.time);

    return {
      time: point.time,
      latitude: point.lat,
      longitude: point.lng,
      altitude: point.alt,
      distance,
      bearing,
      aboveHorizon: visible,
      elevationAngle,
      visible,
      stage: stageInfo.stage,
      engineStatus: stageInfo.engineStatus
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
async function fetchFlightClubTrajectory(launchLibraryId: string, launch: Launch): Promise<TrajectoryData | null> {
  try {
    // Import Flight Club API service with enhanced telemetry
    const { FlightClubApiService } = await import('./flightClubApiService');
    
    // Find mission for this launch
    const missions = await FlightClubApiService.getMissions();
    const mission = missions.missions.find((m: any) => m.launchLibraryId === launchLibraryId);
    
    if (!mission) {
      console.log(`[FlightClub] No mission found for Launch Library ID: ${launchLibraryId}`);
      return null;
    }
    
    const primarySimId = mission.flightClubSimId || mission.id;
    const fallbackSimId = mission.flightClubSimId ? mission.id : undefined;

    // Get enhanced simulation data with stage information
    const simulationData = await FlightClubApiService.getSimulationData(primarySimId, launchLibraryId, {
      fallbackMissionId: fallbackSimId
    });
    
    if (!simulationData.enhancedTelemetry || simulationData.enhancedTelemetry.length === 0) {
      console.log(`[FlightClub] No telemetry data available for mission: ${mission.id}`);
      return null;
    }
    
    const telemetry = simulationData.enhancedTelemetry;
    
    // Check if any telemetry points are visible
    const hasVisiblePoints = telemetry.some(frame => frame.aboveHorizon);
    
    if (!hasVisiblePoints) {
      return {
        launchId: launchLibraryId,
        source: 'flightclub',
        points: [],
        realTelemetry: true
      };
    }
    
    // Convert enhanced telemetry to our trajectory format with stage information
    const points: TrajectoryPoint[] = telemetry.map((frame: any) => {
      // Enhanced telemetry already has calculated values
      const distance = frame.distanceFromBermuda;
      const bearing = frame.bearingFromBermuda;
      const visible = frame.aboveHorizon;
      
      // Use Flight Club stage data if available, otherwise fallback to time-based estimation
      const stageInfo = determineStageInfoFromTelemetry(frame.time, frame.stageNumber);
      
      return {
        time: frame.time,
        latitude: frame.latitude,
        longitude: frame.longitude,
        altitude: frame.altitude,
        distance,
        bearing,
        aboveHorizon: visible,
        elevationAngle: frame.elevationAngle || calculateElevationAngle(distance, frame.altitude),
        visible,
        stage: stageInfo.stage,
        engineStatus: stageInfo.engineStatus
      };
    });
    
    // Calculate visibility window from our processed points
    const visiblePoints = points.filter(p => p.visible);
    const visibilityWindow = visiblePoints.length > 0 ? {
      startTime: visiblePoints[0].time,
      endTime: visiblePoints[visiblePoints.length - 1].time,
      startBearing: visiblePoints[0].bearing,
      endBearing: visiblePoints[visiblePoints.length - 1].bearing,
      closestApproach: Math.min(...visiblePoints.map(p => p.distance))
    } : undefined;
    
    // Determine trajectory direction and validate against database
    const calculatedDirection = determineTrajectoryDirection(points);
    const trajectoryDirection = validateTrajectoryDirection(launch, calculatedDirection);
    
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
    // Generate comprehensive URL list
    const possibleUrls = launch ? generateSpaceLaunchScheduleUrls(launch) : [
      `https://www.spacelaunchschedule.com/launch/${launchLibraryId}/`,
      `https://www.spacelaunchschedule.com/launch/falcon-9-${launchLibraryId}/`
    ];

    // Try each URL with enhanced error handling and timeout
    for (let i = 0; i < possibleUrls.length; i++) {
      const url = possibleUrls[i];
      try {
        
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
        
        const response = await fetch(url, {
          headers: {
            // Removed 'User-Agent' - forbidden header in browsers, causes TypeError
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
          },
          signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (response.ok) {
          const html = await response.text();
          
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
                
                // Verify image exists and is accessible
                try {
                  const imageResponse = await fetch(imageUrl, { method: 'HEAD' });
                  if (imageResponse.ok) {
                    return imageUrl;
                  }
                } catch (imageError) {
                  // Image verification failed, continue searching
                }
              }
            }
          }
          
        } else {
          // HTTP error, try next URL
        }
      } catch (error) {
        // Request failed, continue to next URL
      }
    }

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
  
  // Check cache first with proximity-based expiration
  const cached = trajectoryCache.get(launchId);
  const cacheExpiry = getCacheExpiryForLaunch(launch.net);
  
  if (cached && Date.now() < cached.expires && cached.expires > cacheExpiry) {
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
  try {
    const { getCachedSpaceLaunchScheduleData } = await import('./spaceLaunchScheduleService');
    const slsData = await getCachedSpaceLaunchScheduleData(launch);
    
    if (slsData.flightClubId) {
      // Step 2: Use Flight Club ID to fetch telemetry
      const flightClubData = await fetchFlightClubTrajectory(slsData.flightClubId, launch);
      if (flightClubData) {
        trajectoryData = {
          ...flightClubData,
          confidence: 'confirmed',
          flightClubId: slsData.flightClubId,
          lastUpdated: new Date()
        };
      }
    } else if (slsData.trajectoryImageUrl) {
      // Step 3: Analyze trajectory image with environment-safe approach
      try {
        // Environment-safe image analysis import with fallback
        const { isBrowser } = await import('../utils/environmentUtils');
        
        if (isBrowser()) {
          const { analyzeTrajectoryImage, getCachedAnalysis, cacheAnalysis } = await import('./imageAnalysisService');
          
          let analysis = getCachedAnalysis(slsData.trajectoryImageUrl);
          
          if (!analysis) {
            analysis = await analyzeTrajectoryImage(slsData.trajectoryImageUrl, launch);
            
            if (analysis.success) {
              cacheAnalysis(slsData.trajectoryImageUrl, analysis);
            }
          }
          
          if (analysis.success && analysis.trajectoryPoints.length > 0) {
            const points: TrajectoryPoint[] = analysis.trajectoryPoints.map((point, index) => {
              const distance = calculateDistance(BERMUDA_LAT, BERMUDA_LNG, point.lat, point.lng);
              const bearing = calculateBearing(BERMUDA_LAT, BERMUDA_LNG, point.lat, point.lng);
              const elevationAngle = calculateElevationAngle(distance, 150000);
              
              // Determine stage for this trajectory point
              const stageInfo = determineStageInfoFromTelemetry(index * 30);
              
              return {
                time: index * 30,
                latitude: point.lat,
                longitude: point.lng,
                altitude: 150000,
                distance,
                bearing,
                aboveHorizon: elevationAngle > 0,
                elevationAngle,
                visible: elevationAngle > 0, // Above horizon check
                stage: stageInfo.stage,
                engineStatus: stageInfo.engineStatus
              };
            });
            
            // Validate trajectory direction against database mapping
            const validatedDirection = slsData.trajectoryDirection ? 
              validateTrajectoryDirection(launch, slsData.trajectoryDirection) : 
              (analysis.trajectoryDirection ? validateTrajectoryDirection(launch, analysis.trajectoryDirection) : analysis.trajectoryDirection);
            
            trajectoryData = {
              launchId,
              source: 'spacelaunchschedule',
              points,
              imageUrl: slsData.trajectoryImageUrl,
              trajectoryDirection: validatedDirection,
              confidence: 'projected',
              lastUpdated: new Date(),
              visibilityWindow: calculateVisibilityWindow(points)
            };
            
          }
        } else {
          // Server-safe filename analysis with validation
          const direction = analyzeTrajectoryFromFilename(slsData.trajectoryImageUrl, launch.mission.name);
          if (direction && direction !== 'Unknown') {
            const validatedDirection = validateTrajectoryDirection(launch, direction);
            const estimatedTrajectory = generateTrajectoryFromDirection(launch, validatedDirection as TrajectoryData['trajectoryDirection']);
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
      // Step 4: Use trajectory direction from filename with validation
      const validatedDirection = validateTrajectoryDirection(launch, slsData.trajectoryDirection);
      const estimatedTrajectory = generateTrajectoryFromDirection(launch, validatedDirection as TrajectoryData['trajectoryDirection']);
      trajectoryData = {
        ...estimatedTrajectory,
        confidence: 'projected',
        lastUpdated: new Date()
      };
    }
  } catch (error) {
    console.error(`Error fetching Space Launch Schedule data:`, error);
  }
  
  // Step 5: Fallback to mission-based trajectory generation
  if (trajectoryData.points.length === 0) {
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
      trajectoryData.trajectoryDirection = 'Northeast';
      trajectoryData.confidence = 'confirmed'; // High confidence override
    }
  }

  // Cache the result with proximity-based expiration
  trajectoryCache.set(launchId, {
    data: trajectoryData,
    expires: Date.now() + cacheExpiry
  });

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
    return 'Northeast';
  } else if (trajectoryPatterns.southeast.some(pattern => filename.includes(pattern) || urlPath.includes(pattern))) {
    return 'Southeast';
  } else if (trajectoryPatterns.east.some(pattern => filename.includes(pattern) || urlPath.includes(pattern))) {
    return 'East';
  }
  
  // Step 2: Mission type-based trajectory prediction
  if (missionPatterns.starlink.some(pattern => mission.includes(pattern))) {
    return 'Northeast'; // Most Starlink missions go northeast
  } else if (missionPatterns.iss.some(pattern => mission.includes(pattern))) {
    return 'Northeast'; // ISS missions go northeast (51.6° inclination)
  } else if (missionPatterns.gto.some(pattern => mission.includes(pattern))) {
    return 'Southeast'; // GTO missions typically go southeast
  }
  
  // Step 3: Default based on common patterns
  return 'Northeast'; // Most launches from Florida go northeast
}

/**
 * Validate external trajectory direction against database mapping
 * Returns database direction if they conflict, otherwise returns external direction
 */
function validateTrajectoryDirection(launch: Launch, externalDirection: string | undefined): TrajectoryData['trajectoryDirection'] {
  const { getTrajectoryMapping } = require('./trajectoryMappingService');
  const trajectoryMapping = getTrajectoryMapping(launch);
  
  // Handle undefined external direction
  if (!externalDirection) {
    return trajectoryMapping?.direction as TrajectoryData['trajectoryDirection'] || 'Unknown';
  }
  
  // If we have a high-confidence database mapping that differs from external data, use database
  if (trajectoryMapping && trajectoryMapping.confidence === 'high' && 
      trajectoryMapping.direction !== externalDirection) {
    console.log(`[TrajectoryService] Database override: External "${externalDirection}" → Database "${trajectoryMapping.direction}" for ${launch.name}`);
    
    // Clear any cached trajectory data for this launch since we're overriding the direction
    const cacheKey = launch.id;
    if (trajectoryCache.has(cacheKey)) {
      console.log(`[TrajectoryService] Clearing cached trajectory for ${launch.name} due to direction override`);
      trajectoryCache.delete(cacheKey);
    }
    
    return trajectoryMapping.direction as TrajectoryData['trajectoryDirection'];
  }
  
  // Debug logging to track validation
  if (launch.name.includes('Project Kuiper') || launch.name.includes('KA-03') || launch.mission.name.toLowerCase().includes('kuiper')) {
    console.log(`[TrajectoryService] Project Kuiper validation: Launch="${launch.name}", Mission="${launch.mission.name}", External="${externalDirection}", Database="${trajectoryMapping?.direction}", Confidence="${trajectoryMapping?.confidence}"`);
  }
  
  return externalDirection as TrajectoryData['trajectoryDirection'];
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
  
  // Use trajectory mapping from database (don't override with external data)
  const trajectoryMapping = getTrajectoryMapping(launch);
  // Note: Previously this function would override the database trajectory mapping
  // with external data, which could be incorrect. Now we trust the database.
  
  const trajectoryData = generateRealisticTrajectory(launch);
  // Use the trajectory direction from the database mapping, not external sources
  trajectoryData.trajectoryDirection = trajectoryMapping.direction as any;
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
    // Realistic velocity model for Falcon 9
    let velocity; // km/s
    let altitude; // meters
    
    if (t <= 162) {
      // First stage burn: 0 to ~2.4 km/s, 0 to ~80km altitude
      velocity = (t / 162) * 2.4;
      altitude = Math.pow(t / 162, 1.8) * 80000; // Non-linear altitude gain
    } else if (t <= 165) {
      // Stage separation: maintain velocity, slight altitude gain
      velocity = 2.4;
      altitude = 80000 + (t - 162) * 1000; // +3km during separation
    } else if (t <= 540) {
      // Second stage burn: 2.4 to ~7.8 km/s, 80km to ~200km
      const secondStageProgress = (t - 165) / (540 - 165);
      velocity = 2.4 + secondStageProgress * 5.4; // Reach orbital velocity
      altitude = 80000 + Math.pow(secondStageProgress, 1.2) * 120000; // Reach ~200km
    } else {
      // Coasting: maintain orbital velocity and altitude
      velocity = 7.8;
      altitude = 200000 + (t - 540) * 100; // Slight altitude increase
    }
    
    // Calculate distance traveled (integral of velocity over time)
    const distanceKm = t <= 30 ? t * 0.3 : // Start slow
                      t <= 162 ? Math.pow(t / 162, 2) * 2.4 * 162 : // First stage acceleration
                      t <= 165 ? 194 + (t - 162) * 2.4 : // Separation
                      194 + 7.2 + ((t - 165) / (540 - 165)) * 1800; // Second stage
    
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
    
    // Calculate distance and bearing from Bermuda
    const distance = calculateDistance(BERMUDA_LAT, BERMUDA_LNG, lat, lng);
    const bearing = calculateBearing(BERMUDA_LAT, BERMUDA_LNG, lat, lng);
    const elevationAngle = calculateElevationAngle(distance, altitude);
    
    // Enhanced visibility logic: ISS missions are visible at high altitudes
    // Second stage visibility starts when rocket is above atmosphere and lit by sun
    const isSecondStage = t > 165; // After stage separation
    const isHighAltitude = altitude > 80000; // Above 80km (above atmosphere)
    const hasReasonableElevation = elevationAngle > -2; // Allow slightly below horizon due to refraction
    const withinVisibilityRange = distance < 1500; // Within 1500km visibility range
    
    const visible = isSecondStage && isHighAltitude && hasReasonableElevation && withinVisibilityRange;
    
    // Determine stage for this trajectory point
    const stageInfo = determineStageInfoFromTelemetry(t);
    
    points.push({
      time: t,
      latitude: lat,
      longitude: lng,
      altitude,
      distance,
      bearing,
      aboveHorizon: visible,
      elevationAngle,
      visible,
      stage: stageInfo.stage,
      engineStatus: stageInfo.engineStatus,
      velocity: velocity * 1000 // Convert km/s to m/s for consistency
    });
  }
  
  const visibilityWindow = calculateVisibilityWindow(points);
  
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
 * Clear trajectory cache for Project Kuiper launches specifically
 */
export function clearProjectKuiperCache(): void {
  const kuiperKeys = Array.from(trajectoryCache.keys()).filter(key => 
    key.toLowerCase().includes('kuiper') || key.toLowerCase().includes('ka-')
  );
  
  kuiperKeys.forEach(key => {
    console.log(`[TrajectoryService] Clearing Project Kuiper cache for key: ${key}`);
    trajectoryCache.delete(key);
  });
  
  console.log(`[TrajectoryService] Cleared ${kuiperKeys.length} Project Kuiper trajectory cache entries`);
}

/**
 * Get cache status for debugging
 */
export function getTrajectoryCache(): Map<string, { data: TrajectoryData; expires: number }> {
  return trajectoryCache;
}
