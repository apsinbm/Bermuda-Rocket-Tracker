import { Launch } from '../types';

const API_BASE = 'https://ll.thespacedevs.com/2.2.0';

// Cache management
interface LaunchCache {
  data: Launch[];
  timestamp: number;
  expiresAt: number;
}

let launchCache: LaunchCache | null = null;
const CACHE_DURATION = 60 * 60 * 1000; // 1 hour in milliseconds

export async function fetchSpaceXFloridaLaunches(limit: number = 15): Promise<Launch[]> {
  // Check cache first
  if (launchCache && Date.now() < launchCache.expiresAt) {
    console.log('Using cached launch data');
    return launchCache.data;
  }

  try {
    // Enhanced API call with SpaceX and Florida filtering
    const params = new URLSearchParams({
      limit: limit.toString(),
      launch_service_provider__name: 'SpaceX',
      pad__location__name__icontains: 'florida'
    });

    const response = await fetch(`${API_BASE}/launch/upcoming/?${params}`);
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    
    // Filter for Cape Canaveral and Kennedy Space Center specifically
    const floridaLaunches = data.results.filter((launch: Launch) => {
      const locationName = launch.pad.location.name.toLowerCase();
      return (
        locationName.includes('cape canaveral') ||
        locationName.includes('kennedy') ||
        locationName.includes('cafs') || // Cape Canaveral Air Force Station
        locationName.includes('ksc')   // Kennedy Space Center
      );
    });

    // Filter out completed launches by status
    const upcomingOnly = floridaLaunches.filter((launch: Launch) => {
      const status = launch.status.name.toLowerCase();
      return !(
        status.includes('successful') ||
        status.includes('failure') ||
        status.includes('partial failure') ||
        status.includes('on hold') ||
        status.includes('cancelled')
      );
    });

    // Update cache
    const now = Date.now();
    launchCache = {
      data: upcomingOnly,
      timestamp: now,
      expiresAt: now + CACHE_DURATION
    };

    console.log(`[LaunchService] Cached ${upcomingOnly.length} upcoming SpaceX Florida launches (filtered out completed)`);
    return upcomingOnly;

  } catch (error) {
    console.error('Error fetching SpaceX Florida launches:', error);
    
    // Return cached data if available, even if expired
    if (launchCache) {
      console.log('Using expired cache due to fetch error');
      return launchCache.data;
    }
    
    throw error;
  }
}

// Legacy function for backward compatibility
export async function fetchUpcomingLaunches(limit: number = 20): Promise<Launch[]> {
  return fetchSpaceXFloridaLaunches(limit);
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