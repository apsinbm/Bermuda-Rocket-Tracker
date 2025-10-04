import { Launch } from '../types';

const API_BASE = 'https://ll.thespacedevs.com/2.2.0';

// Note: App now supports ALL launch providers operating from East Coast facilities
// No provider filtering - any company can launch from visible East Coast sites

// Cache management
interface LaunchCache {
  data: Launch[];
  timestamp: number;
  expiresAt: number;
}

let launchCache: LaunchCache | null = null;
const CACHE_DURATION = 60 * 60 * 1000; // 1 hour in milliseconds

export function clearLaunchCache(): void {
  launchCache = null;
}

export async function fetchAllEastCoastLaunches(limit: number = 30): Promise<Launch[]> {
  // Check cache first - ensure cached data has enough entries for requested limit
  if (launchCache && Date.now() < launchCache.expiresAt && launchCache.data.length >= limit) {
    return launchCache.data.slice(0, limit);
  }

  try {
    // Use location IDs for East Coast facilities visible from Bermuda
    // KSC=27, CCAFS=12, Wallops=21
    const params = new URLSearchParams({
      limit: (limit * 2).toString(), // Get more results since we'll filter
      location__ids: '27,12,21' // Kennedy Space Center, Cape Canaveral AFS, Wallops Flight Facility
    });

    const response = await fetch(`${API_BASE}/launch/upcoming/?${params}`);
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    
    // Filter for upcoming status and East Coast locations (all providers welcome)
    const filteredLaunches = data.results.filter((launch: Launch) => {
      const statusName = launch.status?.name?.toLowerCase?.() ?? '';
      if (!statusName) {
        console.warn('[LaunchService] Launch missing status, skipping', launch.id);
        return false;
      }

      // Filter out completed/cancelled launches
      const isUpcoming = !(
        statusName.includes('successful') ||
        statusName.includes('failure') ||
        statusName.includes('partial failure') ||
        statusName.includes('cancelled')
      );

      const pad = launch.pad;
      const locationName = pad?.location?.name;
      if (!pad || !locationName) {
        console.warn('[LaunchService] Launch missing pad/location data, skipping visibility filtering', launch.id, launch.name);
        return false;
      }

      const normalizedLocation = locationName.toLowerCase();
      const isEastCoastLocation = (
        // Florida facilities
        normalizedLocation.includes('kennedy') ||
        normalizedLocation.includes('cape canaveral') ||
        normalizedLocation.includes('florida') ||
        normalizedLocation.includes('ksc') ||
        normalizedLocation.includes('cafs') ||
        normalizedLocation.includes('ccafs') ||
        // Virginia facilities  
        normalizedLocation.includes('wallops') ||
        normalizedLocation.includes('virginia') ||
        // Generic East Coast terms
        normalizedLocation.includes('east coast') ||
        normalizedLocation.includes('eastern shore')
      );

      // Log all providers for debugging
      const provider = launch.launch_service_provider?.name || 'Unknown';
      console.log(`[LaunchService] Found launch: ${launch.name} by ${provider} from ${locationName} - Upcoming: ${isUpcoming}, East Coast: ${isEastCoastLocation}`);

      return isUpcoming && isEastCoastLocation;
    });

    // Sort by launch date (keep ALL launches for cache)
    const sortedLaunches = filteredLaunches
      .sort((a: Launch, b: Launch) => new Date(a.net).getTime() - new Date(b.net).getTime());

    // Update cache with ALL filtered launches
    const now = Date.now();
    launchCache = {
      data: sortedLaunches,
      timestamp: now,
      expiresAt: now + CACHE_DURATION
    };

    // Return only the requested limit
    const limitedResults = sortedLaunches.slice(0, limit);

    // Log provider breakdown (using limited results)
    const providerCounts = limitedResults.reduce((acc: Record<string, number>, launch: Launch) => {
      const provider = launch.launch_service_provider?.name || 'Unknown';
      acc[provider] = (acc[provider] || 0) + 1;
      return acc;
    }, {});

    console.log(`[LaunchService] Returning ${limitedResults.length} of ${sortedLaunches.length} cached East Coast launches:`, providerCounts);

    return limitedResults;

  } catch (error) {
    console.error('[LaunchService] Error fetching East Coast launches:', error);
    
    // Return cached data if available, even if expired
    if (launchCache) {
      return launchCache.data;
    }
    
    throw error;
  }
}

// Legacy function for backward compatibility (SpaceX only from Florida)
export async function fetchSpaceXFloridaLaunches(limit: number = 15): Promise<Launch[]> {
  const allLaunches = await fetchAllEastCoastLaunches(limit * 2);
  return allLaunches.filter(launch => {
    const providerName = launch.launch_service_provider?.name?.toLowerCase?.() || '';
    const provider = providerName.includes('spacex');
    const location = launch.pad.location.name.toLowerCase();
    const isFloridaOnly = location.includes('florida') || location.includes('kennedy') || location.includes('cape canaveral');
    return provider && isFloridaOnly;
  }).slice(0, limit);
}

// Alias for backward compatibility
export async function fetchAllFloridaLaunches(limit: number = 30): Promise<Launch[]> {
  return fetchAllEastCoastLaunches(limit);
}

// Main function for all providers from East Coast
export async function fetchUpcomingLaunches(limit: number = 20): Promise<Launch[]> {
  return fetchAllEastCoastLaunches(limit);
}

// Get launches by specific provider from East Coast
export async function fetchLaunchesByProvider(providerName: string, limit: number = 10): Promise<Launch[]> {
  const allLaunches = await fetchAllEastCoastLaunches(limit * 3);
  return allLaunches.filter(launch => 
    (launch.launch_service_provider?.name?.toLowerCase?.() || '').includes(providerName.toLowerCase())
  ).slice(0, limit);
}

export async function fetchLaunchDetails(launchId: string): Promise<Launch> {
  try {
    const response = await fetch(`${API_BASE}/launch/${launchId}/`);
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error fetching launch details:', error);
    throw error;
  }
}

// Export launchService object for compatibility with existing imports
export const launchService = {
  getLaunches: fetchAllEastCoastLaunches,
  getEastCoastLaunches: fetchAllEastCoastLaunches,
  getFloridaLaunches: fetchAllFloridaLaunches, // Backward compatibility
  getSpaceXLaunches: fetchSpaceXFloridaLaunches,
  getUpcomingLaunches: fetchUpcomingLaunches,
  getLaunchDetails: fetchLaunchDetails,
  getLaunchesByProvider: fetchLaunchesByProvider
};
