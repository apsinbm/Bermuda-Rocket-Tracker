interface LaunchPadDetails {
  name: string;
  fullLocation: string;
  facility: string;
  state: string;
  description: string;
}

// Comprehensive launch pad information for Florida launches
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
  }
};

/**
 * Get detailed information about a launch pad
 */
export function getLaunchPadDetails(padName: string): LaunchPadDetails {
  // Try exact match first
  if (LAUNCH_PAD_DETAILS[padName]) {
    return LAUNCH_PAD_DETAILS[padName];
  }
  
  // Try partial matches
  const padKey = Object.keys(LAUNCH_PAD_DETAILS).find(key => 
    padName.toLowerCase().includes(key.toLowerCase()) ||
    key.toLowerCase().includes(padName.toLowerCase())
  );
  
  if (padKey) {
    return LAUNCH_PAD_DETAILS[padKey];
  }
  
  // Default fallback for unknown Florida pads
  return {
    name: padName,
    fullLocation: 'Florida, USA',
    facility: 'Florida Launch Facility',
    state: 'Florida',
    description: 'Launch facility in Florida'
  };
}

/**
 * Get a user-friendly location description
 */
export function getFriendlyLocation(padName: string): string {
  const details = getLaunchPadDetails(padName);
  return `${details.name}, ${details.fullLocation}`;
}

/**
 * Check if pad is at Kennedy Space Center vs Cape Canaveral
 */
export function isKennedySpaceCenter(padName: string): boolean {
  const details = getLaunchPadDetails(padName);
  return details.facility === 'Kennedy Space Center';
}