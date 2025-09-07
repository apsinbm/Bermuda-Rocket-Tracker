import { Launch } from '../types';

const API_BASE = 'https://ll.thespacedevs.com/2.2.0';

// Major launch providers operating from Florida
const FLORIDA_LAUNCH_PROVIDERS = [
  'SpaceX',
  'NASA',
  'United Launch Alliance', // ULA
  'Blue Origin',
  'Relativity Space',
  'Rocket Lab USA',
  'Northrop Grumman', // Antares/Cygnus
  'Boeing', // Starliner
  'Lockheed Martin',
  'Astra'
];

// Cache management
interface LaunchCache {
  data: Launch[];
  timestamp: number;
  expiresAt: number;
}

let launchCache: LaunchCache | null = null;
const CACHE_DURATION = 60 * 60 * 1000; // 1 hour in milliseconds

export async function fetchAllFloridaLaunches(limit: number = 30): Promise<Launch[]> {
  // Check cache first
  if (launchCache && Date.now() < launchCache.expiresAt) {
    return launchCache.data;
  }

  try {
    // Use location IDs for more accurate filtering (KSC=27, CCAFS=12)
    const params = new URLSearchParams({
      limit: (limit * 2).toString(), // Get more results since we'll filter
      location__ids: '27,12' // Kennedy Space Center, Cape Canaveral AFS
    });

    const response = await fetch(`${API_BASE}/launch/upcoming/?${params}`);
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    
    // Filter for major launch providers and upcoming status
    const filteredLaunches = data.results.filter((launch: Launch) => {
      // Check if launch provider is in our list
      const providerName = launch.launch_service_provider?.name || '';
      const isRelevantProvider = FLORIDA_LAUNCH_PROVIDERS.some(provider => 
        providerName.toLowerCase().includes(provider.toLowerCase()) ||
        provider.toLowerCase().includes(providerName.toLowerCase())
      );

      // Filter out completed/cancelled launches
      const status = launch.status.name.toLowerCase();
      const isUpcoming = !(
        status.includes('successful') ||
        status.includes('failure') ||
        status.includes('partial failure') ||
        status.includes('cancelled')
      );

      // Additional location validation (ensure it's actually Florida)
      const locationName = launch.pad.location.name.toLowerCase();
      const isFloridaLocation = (
        locationName.includes('kennedy') ||
        locationName.includes('cape canaveral') ||
        locationName.includes('florida') ||
        locationName.includes('ksc') ||
        locationName.includes('cafs') ||
        locationName.includes('ccafs')
      );

      return isRelevantProvider && isUpcoming && isFloridaLocation;
    });

    // Sort by launch date
    const sortedLaunches = filteredLaunches
      .sort((a: Launch, b: Launch) => new Date(a.net).getTime() - new Date(b.net).getTime())
      .slice(0, limit); // Limit final results

    // Update cache
    const now = Date.now();
    launchCache = {
      data: sortedLaunches,
      timestamp: now,
      expiresAt: now + CACHE_DURATION
    };

    // Log provider breakdown
    const providerCounts = sortedLaunches.reduce((acc: Record<string, number>, launch: Launch) => {
      const provider = launch.launch_service_provider?.name || 'Unknown';
      acc[provider] = (acc[provider] || 0) + 1;
      return acc;
    }, {});


    return sortedLaunches;

  } catch (error) {
    console.error('[LaunchService] Error fetching Florida launches:', error);
    
    // Return cached data if available, even if expired
    if (launchCache) {
      return launchCache.data;
    }
    
    throw error;
  }
}

// Legacy function for backward compatibility (SpaceX only)
export async function fetchSpaceXFloridaLaunches(limit: number = 15): Promise<Launch[]> {
  const allLaunches = await fetchAllFloridaLaunches(limit * 2);
  return allLaunches.filter(launch => 
    launch.launch_service_provider?.name.toLowerCase().includes('spacex')
  ).slice(0, limit);
}

// Main function for all providers
export async function fetchUpcomingLaunches(limit: number = 20): Promise<Launch[]> {
  return fetchAllFloridaLaunches(limit);
}

// Get launches by specific provider
export async function fetchLaunchesByProvider(providerName: string, limit: number = 10): Promise<Launch[]> {
  const allLaunches = await fetchAllFloridaLaunches(limit * 3);
  return allLaunches.filter(launch => 
    launch.launch_service_provider?.name.toLowerCase().includes(providerName.toLowerCase())
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
  getLaunches: fetchAllFloridaLaunches,
  getSpaceXLaunches: fetchSpaceXFloridaLaunches,
  getUpcomingLaunches: fetchUpcomingLaunches,
  getLaunchDetails: fetchLaunchDetails,
  getLaunchesByProvider: fetchLaunchesByProvider
};