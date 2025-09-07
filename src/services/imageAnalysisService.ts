/**
 * Image Analysis Service for Trajectory Line Detection
 * Extracts rocket trajectory data from Space Launch Schedule images
 * Environment-aware implementation with fallback for non-browser environments
 */

import { isBrowser, hasCanvasSupport, createEnvironmentError } from '../utils/environmentUtils';
import { getTrajectoryMapping } from './trajectoryMappingService';
import { Launch } from '../types';

export interface GeoPoint {
  lat: number;
  lng: number;
}

export interface TrajectoryImageAnalysis {
  success: boolean;
  trajectoryPoints: GeoPoint[];
  closestApproachToBermuda: {
    point: GeoPoint;
    distance: number; // km
    bearing: number; // degrees from Bermuda
  } | null;
  imageUrl: string;
  analysisMethod: 'red-line-detection' | 'filename-analysis' | 'trajectory-mapping' | 'fallback' | 'error';
  trajectoryDirection?: 'Northeast' | 'East-Northeast' | 'East' | 'East-Southeast' | 'Southeast' | 'North' | 'South' | 'Unknown';
  error?: string;
}

// Color thresholds for red trajectory line detection
const RED_THRESHOLD = {
  minRed: 200,      // Minimum red channel value
  maxGreen: 100,    // Maximum green channel value
  maxBlue: 100,     // Maximum blue channel value
  tolerance: 30     // Color tolerance for variations
};

/**
 * Main function to analyze trajectory image and extract flight path
 * Environment-aware with multiple fallback strategies
 */
export async function analyzeTrajectoryImage(imageUrl: string, launch?: Launch): Promise<TrajectoryImageAnalysis> {
  try {
    
    // Environment check - use different strategies based on capabilities
    if (!isBrowser()) {
      return analyzeTrajectoryFromFilename(imageUrl, launch);
    }
    
    if (!hasCanvasSupport()) {
      return analyzeTrajectoryFromFilename(imageUrl, launch);
    }
    
    // Try browser-based image analysis
    try {
      const browserAnalysis = await analyzeBrowserImage(imageUrl);
      if (browserAnalysis.success) {
        return browserAnalysis;
      }
    } catch (browserError) {
    }
    
    // Fallback to filename-based analysis
    return analyzeTrajectoryFromFilename(imageUrl, launch);
    
  } catch (error) {
    console.error('[ImageAnalysis] Error analyzing trajectory image:', error);
    return {
      success: false,
      trajectoryPoints: [],
      closestApproachToBermuda: null,
      imageUrl,
      analysisMethod: 'error',
      error: error instanceof Error ? error.message : 'Unknown analysis error'
    };
  }
}

/**
 * Analyze trajectory from image URL filename and patterns
 * Works in any environment without browser dependencies
 */
async function analyzeTrajectoryFromFilename(imageUrl: string, launch?: Launch): Promise<TrajectoryImageAnalysis> {
  
  const filename = imageUrl.split('/').pop()?.toLowerCase() || '';
  const urlPath = imageUrl.toLowerCase();
  
  // Enhanced trajectory direction patterns in URLs/filenames
  const trajectoryPatterns = {
    northeast: [
      'northeast', 'ne-', 'north-east', 'north_east', 'neast',
      '045', '050', '051', '052', '053',
      'rtls', 'north', 'fl-north', 'trajecoty-fl-north', // Specific patterns from Space Launch Schedule
      'north-rtls', 'ne-rtls'
    ],
    east: [
      'east-', 'due-east', '_e_', '_e.', 'fl-east', 'trajecoty-fl-east',
      '090', '095', '100'
    ],
    southeast: [
      'southeast', 'se-', 'south-east', 'south_east', 'seast',
      '130', '135', '140', 'fl-south', 'trajecoty-fl-south',
      'south-rtls', 'se-rtls'
    ]
  };
  
  // Enhanced mission type patterns  
  const missionPatterns = {
    starlink: ['starlink', 'sl-', 'group-', 'starlink-group'],
    iss: ['iss', 'dragon', 'crew', 'cygnus', 'station'],
    gto: ['gto', 'geo', 'ussf', 'geosynchronous', 'geostationary', 'transfer-orbit'],
    x37b: ['x-37b', 'x37b', 'otv-', 'otv ', 'orbital-test-vehicle']
  };
  
  let trajectoryDirection: TrajectoryImageAnalysis['trajectoryDirection'] = 'Unknown';
  let analysisMethod: TrajectoryImageAnalysis['analysisMethod'] = 'filename-analysis';
  
  // Step 1: Check filename for trajectory direction clues
  if (trajectoryPatterns.northeast.some(pattern => filename.includes(pattern) || urlPath.includes(pattern))) {
    trajectoryDirection = 'Northeast';
  } else if (trajectoryPatterns.southeast.some(pattern => filename.includes(pattern) || urlPath.includes(pattern))) {
    trajectoryDirection = 'Southeast';
  } else if (trajectoryPatterns.east.some(pattern => filename.includes(pattern) || urlPath.includes(pattern))) {
    trajectoryDirection = 'East';
  }
  
  // Step 2: If we have launch data, use trajectory mapping service
  if (launch && trajectoryDirection === 'Unknown') {
    const trajectoryMapping = getTrajectoryMapping(launch);
    trajectoryDirection = trajectoryMapping.direction;
    analysisMethod = 'trajectory-mapping';
  }
  
  // Step 3: Fall back to mission type analysis using mission name
  if (trajectoryDirection === 'Unknown' && launch) {
    const missionName = launch.mission.name.toLowerCase();
    const launchName = launch.name?.toLowerCase() || '';
    
    if (missionPatterns.starlink.some(pattern => missionName.includes(pattern) || launchName.includes(pattern))) {
      trajectoryDirection = 'Northeast'; // Most Starlink missions
    } else if (missionPatterns.x37b.some(pattern => missionName.includes(pattern) || launchName.includes(pattern))) {
      trajectoryDirection = 'Northeast'; // X-37B missions typically northeast
    } else if (missionPatterns.iss.some(pattern => missionName.includes(pattern) || launchName.includes(pattern))) {
      trajectoryDirection = 'Northeast'; // ISS missions
    } else if (missionPatterns.gto.some(pattern => missionName.includes(pattern) || launchName.includes(pattern))) {
      trajectoryDirection = 'Southeast'; // GTO missions typically go southeast
    } else {
      trajectoryDirection = 'Northeast'; // Default assumption for most Florida launches
      analysisMethod = 'fallback';
    }
  }
  
  // Step 4: Final fallback based on filename patterns
  if (trajectoryDirection === 'Unknown') {
    if (missionPatterns.starlink.some(pattern => filename.includes(pattern))) {
      trajectoryDirection = 'Northeast'; // Most Starlink missions
    } else if (missionPatterns.iss.some(pattern => filename.includes(pattern))) {
      trajectoryDirection = 'Northeast'; // ISS missions  
    } else if (missionPatterns.gto.some(pattern => filename.includes(pattern))) {
      trajectoryDirection = 'Southeast'; // GTO missions
    } else {
      trajectoryDirection = 'Northeast'; // Default assumption
      analysisMethod = 'fallback';
    }
  }
  
  // Generate realistic trajectory points based on direction
  const trajectoryPoints = generateTrajectoryPoints(trajectoryDirection);
  const bermuda: GeoPoint = { lat: 32.3078, lng: -64.7505 };
  const closestApproach = findClosestApproach(trajectoryPoints);
  const bearing = calculateBearing(bermuda, closestApproach.point);
  
  
  return {
    success: true,
    trajectoryPoints,
    closestApproachToBermuda: {
      point: closestApproach.point,
      distance: closestApproach.distance,
      bearing
    },
    imageUrl,
    analysisMethod,
    trajectoryDirection
  };
}

/**
 * Browser-based image analysis using Canvas (original implementation)
 */
async function analyzeBrowserImage(imageUrl: string): Promise<TrajectoryImageAnalysis> {
  if (!hasCanvasSupport()) {
    throw createEnvironmentError('Canvas image analysis', 'current');
  }
  
  // Download and prepare image for analysis
  const imageAnalysis = await downloadAndPrepareImage(imageUrl);
  if (!imageAnalysis) {
    throw new Error('Failed to download or prepare image');
  }
  
  const { ctx, width, height } = imageAnalysis;
  
  // Extract red trajectory line pixels
  const redPixels = extractRedLinePixels(ctx, width, height);
  
  if (redPixels.length < 10) {
    throw new Error('Not enough red trajectory pixels found');
  }
  
  // Import coordinate utilities dynamically to avoid dependency issues
  const { pixelToGeo, validateTrajectoryCoordinates, findClosestApproach, FLORIDA_TRAJECTORY_MAP_BOUNDS } = 
    await import('../utils/coordinateUtils');
  
  // Convert pixels to geographic coordinates
  const trajectoryPoints = redPixels.map(pixel => 
    pixelToGeo(pixel, width, height, FLORIDA_TRAJECTORY_MAP_BOUNDS)
  );
  
  // Validate coordinates are reasonable
  if (!validateTrajectoryCoordinates(trajectoryPoints)) {
    throw new Error('Invalid trajectory coordinates detected');
  }
  
  // Calculate closest approach to Bermuda
  const bermuda: GeoPoint = { lat: 32.3078, lng: -64.7505 };
  const closestApproach = findClosestApproach(trajectoryPoints);
  
  // Calculate bearing from Bermuda to closest point
  const bearing = calculateBearing(bermuda, closestApproach.closestPoint);
  
  // Analyze trajectory direction
  const trajectoryDirection = analyzeTrajectoryDirection(trajectoryPoints);
  
  return {
    success: true,
    trajectoryPoints,
    closestApproachToBermuda: {
      point: closestApproach.closestPoint,
      distance: closestApproach.distance,
      bearing
    },
    imageUrl,
    analysisMethod: 'red-line-detection',
    trajectoryDirection
  };
}

/**
 * Download image and prepare Canvas for analysis
 */
async function downloadAndPrepareImage(imageUrl: string): Promise<{
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  width: number;
  height: number;
} | null> {
  try {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous'; // Handle CORS
      
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Could not get canvas context'));
          return;
        }
        
        ctx.drawImage(img, 0, 0);
        resolve({
          canvas, // Canvas is used for potential future enhancements
          ctx,
          width: img.width,
          height: img.height
        });
      };
      
      img.onerror = () => {
        reject(new Error(`Failed to load trajectory image: ${imageUrl}`));
      };
      
      // Add timeout to prevent hanging
      setTimeout(() => {
        reject(new Error('Image download timeout'));
      }, 10000);
      
      img.src = imageUrl;
    });
  } catch (error) {
    console.error('Error downloading trajectory image:', error);
    return null;
  }
}

/**
 * Extract red trajectory line pixels using color filtering
 */
function extractRedLinePixels(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number
): Array<{ x: number; y: number }> {
  const imageData = ctx.getImageData(0, 0, width, height);
  const data = imageData.data;
  const redPixels: Array<{ x: number; y: number }> = [];
  
  // Scan image for red pixels that match trajectory line criteria
  for (let y = 0; y < height; y += 2) { // Skip every other row for performance
    for (let x = 0; x < width; x += 2) { // Skip every other column for performance
      const index = (y * width + x) * 4;
      const r = data[index];
      const g = data[index + 1];
      const b = data[index + 2];
      const alpha = data[index + 3];
      
      // Check if pixel matches red trajectory line criteria
      if (alpha > 200 && // Not transparent
          r >= RED_THRESHOLD.minRed && // Strong red component
          g <= RED_THRESHOLD.maxGreen && // Low green component
          b <= RED_THRESHOLD.maxBlue) { // Low blue component
        
        // Additional check: ensure this isn't just random red noise
        // by requiring nearby red pixels (trajectory line continuity)
        if (hasNearbyRedPixels(data, width, height, x, y)) {
          redPixels.push({ x, y });
        }
      }
    }
  }
  
  // Sort pixels to create a continuous path (simple left-to-right sorting)
  return redPixels.sort((a, b) => a.x - b.x);
}

/**
 * Check if a pixel has nearby red pixels (trajectory line continuity)
 */
function hasNearbyRedPixels(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  centerX: number,
  centerY: number,
  radius: number = 3
): boolean {
  let redCount = 0;
  
  for (let dy = -radius; dy <= radius; dy++) {
    for (let dx = -radius; dx <= radius; dx++) {
      const x = centerX + dx;
      const y = centerY + dy;
      
      if (x >= 0 && x < width && y >= 0 && y < height) {
        const index = (y * width + x) * 4;
        const r = data[index];
        const g = data[index + 1];
        const b = data[index + 2];
        
        if (r >= RED_THRESHOLD.minRed && 
            g <= RED_THRESHOLD.maxGreen && 
            b <= RED_THRESHOLD.maxBlue) {
          redCount++;
        }
      }
    }
  }
  
  // Require at least 2 red pixels in the neighborhood (including center)
  return redCount >= 2;
}

/**
 * Generate trajectory points based on direction
 */
function generateTrajectoryPoints(direction: TrajectoryImageAnalysis['trajectoryDirection']): GeoPoint[] {
  const capeCanaveral: GeoPoint = { lat: 28.5, lng: -80.6 };
  const trajectoryPoints: GeoPoint[] = [];
  
  // Define end points based on trajectory direction
  let endLat: number, endLng: number;
  
  switch (direction) {
    case 'Northeast':
      endLat = 35;    // 35°N
      endLng = -65;   // 65°W
      break;
    case 'East-Northeast':
      endLat = 32;    // 32°N  
      endLng = -65;   // 65°W
      break;
    case 'East':
      endLat = 28.5;  // Same latitude
      endLng = -60;   // 60°W
      break;
    case 'East-Southeast':
      endLat = 25;    // 25°N
      endLng = -65;   // 65°W
      break;
    case 'Southeast':
      endLat = 22;    // 22°N
      endLng = -70;   // 70°W
      break;
    default:
      // Default northeast
      endLat = 35;
      endLng = -65;
  }
  
  // Generate trajectory points
  for (let i = 0; i <= 20; i++) {
    const t = i / 20; // 0 to 1
    const lat = capeCanaveral.lat + t * (endLat - capeCanaveral.lat);
    const lng = capeCanaveral.lng + t * (endLng - capeCanaveral.lng);
    trajectoryPoints.push({ lat, lng });
  }
  
  return trajectoryPoints;
}

/**
 * Find closest approach to Bermuda from trajectory points
 */
function findClosestApproach(trajectoryPoints: GeoPoint[]): { point: GeoPoint; distance: number } {
  const bermuda: GeoPoint = { lat: 32.3078, lng: -64.7505 };
  
  let closestPoint = trajectoryPoints[0];
  let minDistance = calculateDistance(bermuda, closestPoint);
  
  for (const point of trajectoryPoints) {
    const distance = calculateDistance(bermuda, point);
    if (distance < minDistance) {
      minDistance = distance;
      closestPoint = point;
    }
  }
  
  return { point: closestPoint, distance: minDistance };
}

/**
 * Calculate great circle distance between two points in km
 */
function calculateDistance(point1: GeoPoint, point2: GeoPoint): number {
  const R = 6371; // Earth's radius in km
  const dLat = (point2.lat - point1.lat) * Math.PI / 180;
  const dLng = (point2.lng - point1.lng) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(point1.lat * Math.PI / 180) * Math.cos(point2.lat * Math.PI / 180) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Create fallback analysis when image processing fails
 * Uses typical trajectory patterns based on known Florida launch characteristics
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function createFallbackAnalysis(imageUrl: string): TrajectoryImageAnalysis {
  
  const trajectoryPoints = generateTrajectoryPoints('Northeast');
  const closestApproach = findClosestApproach(trajectoryPoints);
  const bermuda: GeoPoint = { lat: 32.3078, lng: -64.7505 };
  const bearing = calculateBearing(bermuda, closestApproach.point);
  
  return {
    success: true,
    trajectoryPoints,
    closestApproachToBermuda: {
      point: closestApproach.point,
      distance: closestApproach.distance,
      bearing
    },
    imageUrl,
    analysisMethod: 'fallback',
    trajectoryDirection: 'Northeast'
  };
}

/**
 * Calculate bearing from point1 to point2
 */
function calculateBearing(point1: GeoPoint, point2: GeoPoint): number {
  const dLng = (point2.lng - point1.lng) * Math.PI / 180;
  const y = Math.sin(dLng) * Math.cos(point2.lat * Math.PI / 180);
  const x = Math.cos(point1.lat * Math.PI / 180) * Math.sin(point2.lat * Math.PI / 180) -
    Math.sin(point1.lat * Math.PI / 180) * Math.cos(point2.lat * Math.PI / 180) * Math.cos(dLng);
  
  let bearing = Math.atan2(y, x) * 180 / Math.PI;
  return (bearing + 360) % 360;
}

/**
 * Analyze trajectory direction based on trajectory points
 */
function analyzeTrajectoryDirection(trajectoryPoints: GeoPoint[]): 'Northeast' | 'East' | 'Southeast' | 'Unknown' {
  if (trajectoryPoints.length < 2) {
    return 'Unknown';
  }
  
  // Use first and last points to determine overall direction
  const startPoint = trajectoryPoints[0];
  const endPoint = trajectoryPoints[trajectoryPoints.length - 1];
  
  // Calculate the overall bearing from start to end
  const overallBearing = calculateBearing(startPoint, endPoint);
  
  // Classify direction based on bearing
  // Northeast: 0-90 degrees
  // East: 45-135 degrees (with preference for 90)
  // Southeast: 90-180 degrees
  
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
 * Cache analysis results to avoid repeated processing
 */
const analysisCache = new Map<string, { result: TrajectoryImageAnalysis; expires: number }>();
const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours

export function getCachedAnalysis(imageUrl: string): TrajectoryImageAnalysis | null {
  const cached = analysisCache.get(imageUrl);
  if (cached && Date.now() < cached.expires) {
    return cached.result;
  }
  return null;
}

export function cacheAnalysis(imageUrl: string, result: TrajectoryImageAnalysis): void {
  analysisCache.set(imageUrl, {
    result,
    expires: Date.now() + CACHE_DURATION
  });
}

/**
 * Clear analysis cache (useful for testing)
 */
export function clearAnalysisCache(): void {
  analysisCache.clear();
}