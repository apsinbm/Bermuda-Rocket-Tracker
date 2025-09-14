/**
 * Flight Club Telemetry API Integration
 * Fetches real trajectory data for rocket launches from Flight Club
 */

// Constants
const BERMUDA_LAT = 32.3078;
const BERMUDA_LON = -64.7505;
const EARTH_RADIUS_M = 6_371_000; // meters

export interface TelemetryFrame {
  time: number;    // seconds from liftoff
  lat: number;     // latitude
  lon: number;     // longitude  
  alt: number;     // altitude in meters
}

export interface VisibilityResult {
  time: number;           // seconds from liftoff
  bearing: number;        // compass bearing in degrees
  distance_km: number;    // distance from Bermuda in km
  altitude_km: number;    // altitude in km
}

/**
 * Calculate horizon distance in km for a given altitude
 */
function horizonDistanceKm(altM: number): number {
  return EARTH_RADIUS_M * Math.acos(EARTH_RADIUS_M / (EARTH_RADIUS_M + altM)) / 1000;
}

/**
 * Haversine formula for great-circle distance in km
 */
function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const dlat = (lat2 - lat1) * Math.PI / 180;
  const dlon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dlat/2)**2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dlon/2)**2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS_M * c / 1000;
}

/**
 * Compute compass bearing in degrees from point 1 to point 2
 */
function computeBearing(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const dlon = (lon2 - lon1) * Math.PI / 180;
  const lat1Rad = lat1 * Math.PI / 180;
  const lat2Rad = lat2 * Math.PI / 180;
  const x = Math.sin(dlon) * Math.cos(lat2Rad);
  const y = Math.cos(lat1Rad) * Math.sin(lat2Rad) - Math.sin(lat1Rad) * Math.cos(lat2Rad) * Math.cos(dlon);
  return (Math.atan2(x, y) * 180 / Math.PI + 360) % 360;
}

/**
 * Fetch telemetry data from Flight Club using Launch Library ID
 */
export async function fetchFlightClubTelemetry(llId: string): Promise<TelemetryFrame[]> {
  try {
    const url = `https://flightclub.io/result/telemetry?llId=${llId}`;
    
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; BermudaRocketTracker/1.0)',
        'Accept': 'application/json'
      }
    });

    if (!response.ok) {
      return [];
    }

    const contentType = response.headers.get('content-type') || '';
    
    // Check if response is JSON
    if (contentType.includes('application/json')) {
      const telemetry = await response.json();
      if (Array.isArray(telemetry) && telemetry.length > 0) {
        return telemetry;
      }
    } else if (contentType.includes('text/html')) {
      // Flight Club API is returning HTML instead of JSON
      
      // Try to extract telemetry data from HTML (if embedded)
      const html = await response.text();
      const telemetryFromHtml = extractTelemetryFromHtml(html);
      
      if (telemetryFromHtml.length > 0) {
        return telemetryFromHtml;
      }
    }

    return [];

  } catch (error) {
    console.error(`[FlightClub] Error fetching telemetry for ${llId}:`, error);
    return [];
  }
}

/**
 * Try to extract telemetry data from HTML response
 * Flight Club sometimes embeds JSON data in script tags
 */
function extractTelemetryFromHtml(html: string): TelemetryFrame[] {
  try {
    // Look for JSON data in script tags
    const scriptPattern = /<script[^>]*>(.*?telemetry.*?)<\/script>/gis;
    const jsonPattern = /\[(.*?{.*?time.*?lat.*?lon.*?alt.*?}.*?)\]/gis;
    
    let match;
    while ((match = scriptPattern.exec(html)) !== null) {
      const scriptContent = match[1];
      const jsonMatch = jsonPattern.exec(scriptContent);
      
      if (jsonMatch) {
        try {
          const telemetryData = JSON.parse(`[${jsonMatch[1]}]`);
          if (Array.isArray(telemetryData) && telemetryData.length > 0) {
            // Validate telemetry frame structure
            const firstFrame = telemetryData[0];
            if (typeof firstFrame.time === 'number' && 
                typeof firstFrame.lat === 'number' && 
                typeof firstFrame.lon === 'number' && 
                typeof firstFrame.alt === 'number') {
              return telemetryData;
            }
          }
        } catch (parseError) {
        }
      }
    }
    
    // Alternative: look for data attributes or window variables
    const dataPattern = /window\.telemetryData\s*=\s*(\[.*?\]);/gis;
    const dataMatch = dataPattern.exec(html);
    
    if (dataMatch) {
      try {
        const telemetryData = JSON.parse(dataMatch[1]);
        if (Array.isArray(telemetryData)) {
          return telemetryData;
        }
      } catch (parseError) {
      }
    }
    
    return [];
  } catch (error) {
    return [];
  }
}

/**
 * Find the first time a rocket is visible from Bermuda
 */
export function findFirstVisibleFrame(telemetry: TelemetryFrame[]): VisibilityResult | null {
  for (const frame of telemetry) {
    const { lat, lon, alt, time } = frame;
    const distance = haversineKm(BERMUDA_LAT, BERMUDA_LON, lat, lon);
    const maxVisible = horizonDistanceKm(alt);
    
    if (distance <= maxVisible) {
      const bearing = computeBearing(BERMUDA_LAT, BERMUDA_LON, lat, lon);
      return {
        time,
        bearing,
        distance_km: distance,
        altitude_km: alt / 1000
      };
    }
  }
  return null;
}

/**
 * Find all visible frames within first 10 minutes (600 seconds)
 */
export function findAllVisibleFrames(telemetry: TelemetryFrame[], maxTime: number = 600): VisibilityResult[] {
  const visibleFrames: VisibilityResult[] = [];
  
  for (const frame of telemetry) {
    if (frame.time > maxTime) break; // Only check first 10 minutes
    
    const { lat, lon, alt, time } = frame;
    const distance = haversineKm(BERMUDA_LAT, BERMUDA_LON, lat, lon);
    const maxVisible = horizonDistanceKm(alt);
    
    if (distance <= maxVisible) {
      const bearing = computeBearing(BERMUDA_LAT, BERMUDA_LON, lat, lon);
      visibleFrames.push({
        time,
        bearing,
        distance_km: distance,
        altitude_km: alt / 1000
      });
    }
  }
  
  return visibleFrames;
}

/**
 * Get visibility window summary for a launch
 */
export interface VisibilityWindow {
  isVisible: boolean;
  firstVisible?: VisibilityResult;
  lastVisible?: VisibilityResult;
  totalVisibleFrames: number;
  closestApproach?: VisibilityResult;
}

export function analyzeVisibility(telemetry: TelemetryFrame[]): VisibilityWindow {
  const visibleFrames = findAllVisibleFrames(telemetry);
  
  if (visibleFrames.length === 0) {
    return {
      isVisible: false,
      totalVisibleFrames: 0
    };
  }
  
  // Find closest approach
  const closestApproach = visibleFrames.reduce((closest, current) => 
    current.distance_km < closest.distance_km ? current : closest
  );
  
  return {
    isVisible: true,
    firstVisible: visibleFrames[0],
    lastVisible: visibleFrames[visibleFrames.length - 1],
    totalVisibleFrames: visibleFrames.length,
    closestApproach
  };
}

/**
 * Cache for Flight Club telemetry data
 */
const telemetryCache = new Map<string, { data: TelemetryFrame[]; expires: number }>();
const TELEMETRY_CACHE_DURATION = 60 * 60 * 1000; // 1 hour

export async function getCachedTelemetry(llId: string): Promise<TelemetryFrame[]> {
  // Check cache first
  const cached = telemetryCache.get(llId);
  if (cached && Date.now() < cached.expires) {
    return cached.data;
  }
  
  // Fetch fresh data
  const telemetry = await fetchFlightClubTelemetry(llId);
  
  // Cache the result (even if empty, to avoid repeated failed requests)
  telemetryCache.set(llId, {
    data: telemetry,
    expires: Date.now() + TELEMETRY_CACHE_DURATION
  });
  
  return telemetry;
}