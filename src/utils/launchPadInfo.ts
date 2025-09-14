interface LaunchPadDetails {
  name: string;
  fullLocation: string;
  facility: string;
  state: string;
  description: string;
}

// Comprehensive launch pad information for East Coast launches
const LAUNCH_PAD_DETAILS: Record<string, LaunchPadDetails> = {
  // SpaceX Pads
  'SLC-40': {
    name: 'Space Launch Complex 40',
    fullLocation: 'Cape Canaveral Space Force Station, Florida',
    facility: 'Cape Canaveral SFS',
    state: 'Florida',
    description: 'SpaceX Falcon 9 launch pad for commercial satellites and cargo missions'
  },
  'LC-39A': {
    name: 'Launch Complex 39A',
    fullLocation: 'Kennedy Space Center, Florida',
    facility: 'Kennedy Space Center',
    state: 'Florida', 
    description: 'Historic Apollo/Shuttle pad, now used by SpaceX for Crew Dragon and Falcon Heavy'
  },
  'Pad 39A': {
    name: 'Launch Complex 39A',
    fullLocation: 'Kennedy Space Center, Florida',
    facility: 'Kennedy Space Center',
    state: 'Florida',
    description: 'Historic Apollo/Shuttle pad, now used by SpaceX for Crew Dragon and Falcon Heavy'
  },
  
  // ULA Pads
  'SLC-41': {
    name: 'Space Launch Complex 41',
    fullLocation: 'Cape Canaveral Space Force Station, Florida',
    facility: 'Cape Canaveral SFS',
    state: 'Florida',
    description: 'ULA Atlas V launch pad for military and commercial payloads'
  },
  'SLC-37B': {
    name: 'Space Launch Complex 37B',
    fullLocation: 'Cape Canaveral Space Force Station, Florida', 
    facility: 'Cape Canaveral SFS',
    state: 'Florida',
    description: 'ULA Delta IV Heavy launch pad for national security missions'
  },
  
  // Blue Origin
  'LC-36': {
    name: 'Launch Complex 36',
    fullLocation: 'Cape Canaveral Space Force Station, Florida',
    facility: 'Cape Canaveral SFS', 
    state: 'Florida',
    description: 'Blue Origin New Glenn launch pad (under construction)'
  },
  
  // Wallops Flight Facility (Virginia) - Rocket Lab and Antares
  'Rocket Lab Launch Complex 2': {
    name: 'Rocket Lab Launch Complex 2',
    fullLocation: 'Wallops Flight Facility, Virginia',
    facility: 'Wallops Flight Facility',
    state: 'Virginia',
    description: 'Rocket Lab Electron launch pad at Wallops for East Coast missions'
  },
  'Launch Complex 2': {
    name: 'Launch Complex 2',
    fullLocation: 'Wallops Flight Facility, Virginia',
    facility: 'Wallops Flight Facility',
    state: 'Virginia',
    description: 'Rocket Lab Electron launch pad at Wallops for East Coast missions'
  },
  'LC-2': {
    name: 'Launch Complex 2',
    fullLocation: 'Wallops Flight Facility, Virginia',
    facility: 'Wallops Flight Facility',
    state: 'Virginia',
    description: 'Rocket Lab Electron launch pad at Wallops for East Coast missions'
  },
  'Pad 0A': {
    name: 'Antares Launch Pad 0A',
    fullLocation: 'Wallops Flight Facility, Virginia',
    facility: 'Wallops Flight Facility',
    state: 'Virginia',
    description: 'Northrop Grumman Antares rocket launch pad for ISS cargo missions'
  }
};

/**
 * Get detailed information about a launch pad
 * For unknown pads, uses API location data instead of hardcoded fallback
 */
export function getLaunchPadDetails(padName: string, apiLocationData?: any): LaunchPadDetails {
  // Try exact match first
  if (Object.prototype.hasOwnProperty.call(LAUNCH_PAD_DETAILS, padName)) {
    return LAUNCH_PAD_DETAILS[padName as keyof typeof LAUNCH_PAD_DETAILS];
  }
  
  // Try partial matches
  const padKey = Object.keys(LAUNCH_PAD_DETAILS).find(key => 
    padName.toLowerCase().includes(key.toLowerCase()) ||
    key.toLowerCase().includes(padName.toLowerCase())
  );
  
  if (padKey && Object.prototype.hasOwnProperty.call(LAUNCH_PAD_DETAILS, padKey)) {
    return LAUNCH_PAD_DETAILS[padKey as keyof typeof LAUNCH_PAD_DETAILS];
  }
  
  // If API location data is available, use it instead of hardcoded fallback
  if (apiLocationData) {
    const locationName = apiLocationData.name || 'Unknown Location';
    const countryCode = apiLocationData.country_code || 'US';
    const stateName = getStateFromLocationName(locationName);
    
    return {
      name: padName,
      fullLocation: `${locationName}, ${countryCode}`,
      facility: locationName,
      state: stateName,
      description: `Launch facility at ${locationName}`
    };
  }
  
  // Fallback for unknown East Coast pads (should rarely be used)
  return {
    name: padName,
    fullLocation: 'East Coast, USA',
    facility: 'East Coast Launch Facility',
    state: 'Unknown',
    description: 'East Coast launch facility'
  };
}

/**
 * Helper function to extract state from location name
 */
function getStateFromLocationName(locationName: string): string {
  const name = locationName.toLowerCase();
  if (name.includes('florida') || name.includes('kennedy') || name.includes('cape canaveral')) {
    return 'Florida';
  }
  if (name.includes('virginia') || name.includes('wallops')) {
    return 'Virginia';
  }
  return 'Unknown';
}

/**
 * Get a user-friendly location description
 */
export function getFriendlyLocation(padName: string, apiLocationData?: any): string {
  const details = getLaunchPadDetails(padName, apiLocationData);
  return `${details.name}, ${details.fullLocation}`;
}

/**
 * Check if pad is at Kennedy Space Center vs Cape Canaveral
 */
export function isKennedySpaceCenter(padName: string): boolean {
  const details = getLaunchPadDetails(padName);
  return details.facility === 'Kennedy Space Center';
}