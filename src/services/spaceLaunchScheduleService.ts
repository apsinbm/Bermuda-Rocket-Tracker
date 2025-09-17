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
interface SpaceLaunchScheduleApiResponse {
  trajectoryImageUrl?: string;
  flightClubId?: string;
  trajectoryDirection?: SpaceLaunchScheduleData['trajectoryDirection'];
  trajectoryAvailable: boolean;
  confidence: SpaceLaunchScheduleData['confidence'];
  cached: boolean;
  lastChecked: string;
  warning?: string;
}

/**
 * Fetch trajectory data via secure proxy API
 */
export async function fetchSpaceLaunchScheduleData(launch: Launch): Promise<SpaceLaunchScheduleData> {
  const params = new URLSearchParams({
    missionName: launch.mission?.name || '',
    rocketName: launch.rocket?.name || '',
    launchId: launch.id
  });

  try {
    const response = await fetch(`/api/spacelaunchschedule?${params.toString()}`, {
      method: 'GET',
      headers: {
        Accept: 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`Proxy error ${response.status}`);
    }

    const data = await response.json() as SpaceLaunchScheduleApiResponse;

    return {
      trajectoryImageUrl: data.trajectoryImageUrl,
      flightClubId: data.flightClubId,
      trajectoryDirection: data.trajectoryDirection,
      trajectoryAvailable: data.trajectoryAvailable,
      confidence: data.confidence,
      lastChecked: new Date(data.lastChecked)
    };
  } catch (error) {
    console.error('[SpaceLaunchSchedule] Proxy fetch failed:', error);
    return {
      trajectoryAvailable: false,
      confidence: 'estimated',
      lastChecked: new Date()
    };
  }
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
}
