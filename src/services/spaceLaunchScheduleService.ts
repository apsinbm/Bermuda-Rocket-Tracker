/**
 * Space Launch Schedule Service
 * Fetches trajectory data and images from spacelaunchschedule.com
 */

import { Launch } from '../types';

export interface SpaceLaunchScheduleData {
  trajectoryImageUrl?: string;
  flightClubId?: string;
  trajectoryDirection?: 'Northeast' | 'East' | 'Southeast' | 'North' | 'South';
  trajectoryAvailable: boolean;
  confidence: 'confirmed' | 'projected' | 'estimated';
  lastChecked: Date;
}

/**
 * Extract trajectory direction from image filename
 */
function extractDirectionFromImageName(imageUrl: string): SpaceLaunchScheduleData['trajectoryDirection'] | undefined {
  const filename = imageUrl.toLowerCase();
  
  // Check for specific direction indicators in filename - use more precise patterns
  // to avoid false matches like 'se' in 'ussf' or 'iss' in 'mission'
  if (filename.includes('northeast') || filename.includes('north_east') || filename.includes('_ne_') || filename.includes('_ne.') || filename.includes('rtls')) {
    return 'Northeast';
  }
  if (filename.includes('southeast') || filename.includes('south_east') || filename.includes('_se_') || filename.includes('_se.') || filename.includes('_sse_')) {
    return 'Southeast';
  }
  // Check for 'north' and 'south' without 'east' to avoid conflicts
  if (filename.includes('north') && !filename.includes('east')) {
    return 'Northeast'; // Default north to northeast for rocket launches
  }
  if (filename.includes('south') && !filename.includes('east')) {
    return 'Southeast'; // Default south to southeast for rocket launches
  }
  if (filename.includes('east') && !filename.includes('north') && !filename.includes('south')) {
    return 'East';
  }
  
  // Check for mission type indicators - use word boundaries to avoid false matches
  if (filename.includes('gto') || filename.includes('geo') || filename.includes('geosynchronous')) {
    return 'Southeast'; // GTO missions typically go southeast
  }
  // Use word boundaries for ISS to avoid matching 'iss' in words like 'mission'
  if (/\biss\b/.test(filename) || filename.includes('crew') || filename.includes('dragon')) {
    return 'Northeast'; // ISS missions go northeast
  }
  
  return undefined;
}

/**
 * Extract Flight Club Launch Library ID from URL or page content
 */
function extractFlightClubId(html: string): string | undefined {
  // Look for FlightClub URLs in the HTML
  const flightClubPattern = /flightclub\.io\/result\/(?:3d|2d|telemetry)\?llId=([a-f0-9-]+)/gi;
  const match = flightClubPattern.exec(html);
  
  if (match && match[1]) {
    console.log(`[SpaceLaunchSchedule] Found FlightClub ID: ${match[1]}`);
    return match[1];
  }
  
  // Also check for direct llId references
  const llIdPattern = /llId["\s:=]+([a-f0-9-]{36})/gi;
  const llIdMatch = llIdPattern.exec(html);
  
  if (llIdMatch && llIdMatch[1]) {
    console.log(`[SpaceLaunchSchedule] Found Launch Library ID: ${llIdMatch[1]}`);
    return llIdMatch[1];
  }
  
  return undefined;
}

/**
 * Generate Space Launch Schedule URL variations for a launch
 */
function generateSpaceLaunchScheduleUrls(launch: Launch): string[] {
  const missionSlug = launch.mission.name.toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^\w-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
    
  const rocketSlug = launch.rocket.name.toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^\w-]/g, '');
    
  const urls: string[] = [
    `https://www.spacelaunchschedule.com/launch/${missionSlug}/`,
    `https://www.spacelaunchschedule.com/launch/${rocketSlug}-${missionSlug}/`,
    `https://www.spacelaunchschedule.com/launch/${launch.id}/`
  ];
  
  // Add specific patterns for common mission types
  if (launch.mission.name.includes('OTV') || launch.mission.name.includes('X-37B')) {
    const otvMatch = launch.mission.name.match(/OTV-?(\d+)/i);
    if (otvMatch) {
      urls.unshift(`https://www.spacelaunchschedule.com/launch/otv-${otvMatch[1]}/`);
    }
  }
  
  if (launch.mission.name.includes('USSF')) {
    const ussfMatch = launch.mission.name.match(/USSF-?(\d+)/i);
    if (ussfMatch) {
      urls.unshift(`https://www.spacelaunchschedule.com/launch/ussf-${ussfMatch[1]}/`);
    }
  }
  
  return urls;
}

/**
 * Fetch trajectory data from Space Launch Schedule
 */
export async function fetchSpaceLaunchScheduleData(launch: Launch): Promise<SpaceLaunchScheduleData> {
  const urls = generateSpaceLaunchScheduleUrls(launch);
  
  console.log(`[SpaceLaunchSchedule] Fetching trajectory data for ${launch.mission.name}`);
  console.log(`[SpaceLaunchSchedule] Trying ${urls.length} URL variations`);
  
  for (const url of urls) {
    try {
      console.log(`[SpaceLaunchSchedule] Trying: ${url}`);
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);
      
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; BermudaRocketTracker/1.0)',
          'Accept': 'text/html,application/xhtml+xml'
        },
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        console.log(`[SpaceLaunchSchedule] HTTP ${response.status} for ${url}`);
        continue;
      }
      
      const html = await response.text();
      
      // Extract Flight Club ID if available
      const flightClubId = extractFlightClubId(html);
      
      // Search for trajectory images
      const imagePatterns = [
        /<img[^>]+src="([^"]*trajectory[^"]*\.(?:jpg|jpeg|png|gif|webp))"[^>]*>/gi,
        /<img[^>]+src="([^"]*trajecoty[^"]*\.(?:jpg|jpeg|png|gif|webp))"[^>]*>/gi,
        /<img[^>]+src="([^"]*flight[_-]?path[^"]*\.(?:jpg|jpeg|png|gif|webp))"[^>]*>/gi,
        /<img[^>]+src="([^"]*orbit[_-]?track[^"]*\.(?:jpg|jpeg|png|gif|webp))"[^>]*>/gi
      ];
      
      let trajectoryImageUrl: string | undefined;
      let trajectoryDirection: SpaceLaunchScheduleData['trajectoryDirection'] | undefined;
      
      for (const pattern of imagePatterns) {
        let match;
        while ((match = pattern.exec(html)) !== null) {
          if (match[1]) {
            const imageUrl = match[1].startsWith('http') 
              ? match[1] 
              : `https://www.spacelaunchschedule.com${match[1]}`;
            
            // Verify image exists
            try {
              const imgResponse = await fetch(imageUrl, { method: 'HEAD' });
              if (imgResponse.ok) {
                trajectoryImageUrl = imageUrl;
                trajectoryDirection = extractDirectionFromImageName(imageUrl);
                console.log(`[SpaceLaunchSchedule] Found trajectory image: ${imageUrl}`);
                console.log(`[SpaceLaunchSchedule] Extracted direction: ${trajectoryDirection || 'unknown'}`);
                break;
              }
            } catch (err) {
              console.log(`[SpaceLaunchSchedule] Failed to verify image: ${imageUrl}`);
            }
          }
        }
        if (trajectoryImageUrl) break;
      }
      
      // Check if page mentions trajectory data unavailable
      const trajectoryUnavailable = html.includes('trajectory information from FlightClub.io is currently unavailable') ||
                                   html.includes('trajectory details as soon as they are released');
      
      // Determine confidence level
      let confidence: SpaceLaunchScheduleData['confidence'] = 'estimated';
      if (flightClubId) {
        confidence = 'confirmed';
      } else if (trajectoryImageUrl) {
        confidence = 'projected';
      }
      
      return {
        trajectoryImageUrl,
        flightClubId,
        trajectoryDirection,
        trajectoryAvailable: !trajectoryUnavailable && (!!flightClubId || !!trajectoryImageUrl),
        confidence,
        lastChecked: new Date()
      };
      
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        console.log(`[SpaceLaunchSchedule] Request timeout for ${url}`);
      } else {
        console.log(`[SpaceLaunchSchedule] Error fetching ${url}:`, error);
      }
    }
  }
  
  // No data found from any URL
  console.log(`[SpaceLaunchSchedule] No trajectory data found for ${launch.mission.name}`);
  return {
    trajectoryAvailable: false,
    confidence: 'estimated',
    lastChecked: new Date()
  };
}

/**
 * Cache for Space Launch Schedule data with TTL based on launch proximity
 */
const slsDataCache = new Map<string, {
  data: SpaceLaunchScheduleData;
  expires: number;
}>();

/**
 * Get cache TTL based on launch proximity
 */
function getCacheTTL(launchTime: string): number {
  const now = Date.now();
  const launch = new Date(launchTime).getTime();
  const hoursUntilLaunch = (launch - now) / (1000 * 60 * 60);
  
  if (hoursUntilLaunch > 168) { // > 7 days
    return 24 * 60 * 60 * 1000; // 24 hours
  } else if (hoursUntilLaunch > 72) { // 3-7 days
    return 12 * 60 * 60 * 1000; // 12 hours
  } else if (hoursUntilLaunch > 24) { // 1-3 days
    return 6 * 60 * 60 * 1000; // 6 hours
  } else {
    return 2 * 60 * 60 * 1000; // 2 hours for imminent launches
  }
}

/**
 * Get Space Launch Schedule data with caching
 */
export async function getCachedSpaceLaunchScheduleData(launch: Launch): Promise<SpaceLaunchScheduleData> {
  const cacheKey = launch.id;
  const cached = slsDataCache.get(cacheKey);
  
  if (cached && Date.now() < cached.expires) {
    console.log(`[SpaceLaunchSchedule] Using cached data for ${launch.mission.name}`);
    return cached.data;
  }
  
  const data = await fetchSpaceLaunchScheduleData(launch);
  const ttl = getCacheTTL(launch.net);
  
  slsDataCache.set(cacheKey, {
    data,
    expires: Date.now() + ttl
  });
  
  return data;
}

/**
 * Clear cache for testing
 */
export function clearSpaceLaunchScheduleCache(): void {
  slsDataCache.clear();
  console.log('[SpaceLaunchSchedule] Cache cleared');
}