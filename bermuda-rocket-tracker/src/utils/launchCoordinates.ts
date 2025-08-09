import { Launch } from '../types';

// Known Florida launch pad coordinates as fallback
const FLORIDA_LAUNCH_PADS: Record<string, { latitude: number; longitude: number }> = {
  // Kennedy Space Center
  'LC-39A': { latitude: 28.6080, longitude: -80.6040 },
  'LC-39B': { latitude: 28.6270, longitude: -80.6210 },
  'Pad 39A': { latitude: 28.6080, longitude: -80.6040 },
  'Launch Complex 39A': { latitude: 28.6080, longitude: -80.6040 },
  
  // Cape Canaveral Space Force Station  
  'SLC-40': { latitude: 28.5624, longitude: -80.5774 },
  'Space Launch Complex 40': { latitude: 28.5624, longitude: -80.5774 },
  'SLC-41': { latitude: 28.5835, longitude: -80.5835 },
  'Space Launch Complex 41': { latitude: 28.5835, longitude: -80.5835 },
  'SLC-37B': { latitude: 28.5315, longitude: -80.5660 },
  'Space Launch Complex 37B': { latitude: 28.5315, longitude: -80.5660 },
  
  // Blue Origin / Future pads
  'LC-36': { latitude: 28.5394, longitude: -80.5679 },
  'Launch Complex 36': { latitude: 28.5394, longitude: -80.5679 }
};

export interface LaunchCoordinates {
  latitude: number;
  longitude: number;
  available: boolean;
}

/**
 * Get hardcoded coordinates for known Florida launch pads
 */
function getHardcodedPadCoordinates(padName: string): { latitude: number; longitude: number } | null {
  // Try exact match first
  if (FLORIDA_LAUNCH_PADS[padName]) {
    return FLORIDA_LAUNCH_PADS[padName];
  }
  
  // Try partial matches for different naming variations
  const padKey = Object.keys(FLORIDA_LAUNCH_PADS).find(key => 
    padName.toLowerCase().includes(key.toLowerCase()) ||
    key.toLowerCase().includes(padName.toLowerCase())
  );
  
  if (padKey) {
    return FLORIDA_LAUNCH_PADS[padKey];
  }
  
  return null;
}

/**
 * Safely extract and convert launch pad coordinates from Launch data
 * Handles both API structures:
 * - New: pad.latitude/longitude as strings
 * - Old: pad.location.latitude/longitude as numbers
 */
export function extractLaunchCoordinates(launch: Launch): LaunchCoordinates {
  // Try new API structure first (pad.latitude/longitude as strings)
  if (launch.pad.latitude && launch.pad.longitude) {
    const lat = parseFloat(launch.pad.latitude);
    const lng = parseFloat(launch.pad.longitude);
    
    if (!isNaN(lat) && !isNaN(lng)) {
      return {
        latitude: lat,
        longitude: lng,
        available: true
      };
    }
  }
  
  // Fall back to old API structure (pad.location.latitude/longitude as numbers)
  const padLocation = launch.pad.location;
  if (padLocation.latitude && padLocation.longitude && 
      !isNaN(padLocation.latitude) && !isNaN(padLocation.longitude)) {
    return {
      latitude: padLocation.latitude,
      longitude: padLocation.longitude,
      available: true
    };
  }
  
  // Fall back to hardcoded coordinates for known Florida launch pads
  const hardcodedCoords = getHardcodedPadCoordinates(launch.pad.name);
  if (hardcodedCoords) {
    return {
      latitude: hardcodedCoords.latitude,
      longitude: hardcodedCoords.longitude,
      available: true
    };
  }
  
  // No valid coordinates found
  return {
    latitude: 0,
    longitude: 0,
    available: false
  };
}

/**
 * Check if launch has valid coordinates
 */
export function hasValidCoordinates(launch: Launch): boolean {
  return extractLaunchCoordinates(launch).available;
}

/**
 * Get coordinate validation error message
 */
export function getCoordinateError(launch: Launch): string {
  const coords = extractLaunchCoordinates(launch);
  
  if (coords.available) {
    return '';
  }
  
  // Check what data is available to provide specific error
  if (!launch.pad.latitude && !launch.pad.longitude && 
      !launch.pad.location.latitude && !launch.pad.location.longitude) {
    return 'Launch pad coordinates and trajectory not yet available';
  }
  
  if (launch.pad.latitude && launch.pad.longitude) {
    return `Invalid coordinate format: lat=${launch.pad.latitude}, lng=${launch.pad.longitude}`;
  }
  
  if (launch.pad.location.latitude && launch.pad.location.longitude) {
    return `Invalid coordinate values: lat=${launch.pad.location.latitude}, lng=${launch.pad.location.longitude}`;
  }
  
  return 'Launch pad coordinates and trajectory not yet available';
}