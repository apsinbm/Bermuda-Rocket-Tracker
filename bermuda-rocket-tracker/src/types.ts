export interface Launch {
  id: string;
  name: string;
  rocket: {
    name: string;
  };
  pad: {
    name: string;
    latitude?: string;    // API returns coordinates as strings directly on pad
    longitude?: string;   // API returns coordinates as strings directly on pad
    location: {
      name: string;
      latitude?: number;  // Keep for backward compatibility
      longitude?: number; // Keep for backward compatibility
    };
  };
  net: string; // Network Event Time
  mission: {
    name: string;
    orbit?: {
      name: string;
    };
    description?: string;
  };
  livestream_url?: string;
  status: {
    name: string;
    abbrev?: string;
  };
  window_start?: string;
  window_end?: string;
  image?: string;
  webcast_live?: boolean;
}

export interface VisibilityData {
  likelihood: 'high' | 'medium' | 'low' | 'none';
  reason: string;
  bearing?: number; // compass direction from Bermuda
  estimatedTimeVisible?: string;
  trajectoryImageUrl?: string;
  trajectoryDirection?: 'Northeast' | 'East-Northeast' | 'East' | 'East-Southeast' | 'Southeast' | 'North' | 'South' | 'Unknown';
  score?: number; // visibility score (0-1)
  factors?: string[]; // array of factors affecting visibility
}

export interface LaunchWithVisibility extends Launch {
  visibility: VisibilityData;
  bermudaTime: string;
}

export interface LaunchPad {
  name: string;
  location: {
    latitude: number;
    longitude: number;
  };
  typicalAzimuth: number[]; // Range of typical launch azimuths
  description: string;
}