/**
 * Flight Club API Service - Client Side
 * 
 * Interfaces with the secure Vercel proxy endpoints for Flight Club data
 * Provides telemetry-driven visibility calculations
 */

// Types
export interface FlightClubMission {
  id: string;
  description: string;
  startDateTime: string;
  company: {
    id: string;
    description: string;
  };
  display: boolean;
  flightClubSimId: string;
  launchLibraryId?: string;
  vehicle: {
    description: string;
  };
}

export interface EnhancedTelemetryFrame {
  time: number; // seconds from liftoff
  latitude: number;
  longitude: number;
  altitude: number; // meters
  speed: number; // m/s
  distanceFromBermuda: number; // km
  bearingFromBermuda: number; // degrees
  aboveHorizon: boolean;
  elevationAngle: number; // degrees above horizon
  stageNumber: number;
  velocityVector?: {
    magnitude: number; // km/s
    direction: number; // degrees
  };
}

export interface VisibilitySummary {
  firstVisible: number | null; // T+ seconds
  lastVisible: number | null; // T+ seconds  
  peakVisibility: number | null; // T+ seconds (closest approach)
  totalDuration: number; // seconds
  closestApproach: {
    distance: number; // km
    bearing: number; // degrees
    time: number; // T+ seconds
  };
  visibleFrameCount: number;
}

export interface StageEvent {
  time: number; // T+ seconds
  event: string; // 'MECO', 'Stage Sep', 'SECO', etc.
  stageNumber: number;
  description?: string;
  engineType?: 'Merlin' | 'MVac' | 'Unknown'; // Engine type for specific event tracking
}

export interface ProcessedSimulationData {
  missionId: string;
  enhancedTelemetry: EnhancedTelemetryFrame[];
  visibilitySummary: VisibilitySummary;
  stageEvents: StageEvent[];
  lastUpdated: string;
  cached: boolean;
  warning?: string;
}

export interface MissionsResponse {
  missions: FlightClubMission[];
  lastUpdated: string;
  cached: boolean;
  warning?: string;
}

// Service class
export class FlightClubApiService {
  private static readonly BASE_URL = '/api/flightclub';
  // SECURITY: Removed hardcoded API key - use proxy in all environments
  private static readonly DEV_FALLBACK_API_KEY = null;
  
  /**
   * Demo/Mock mode for when API is unavailable
   */
  private static DEMO_MODE = false;
  
  /**
   * Sample FlightClub mission for demonstration
   */
  private static DEMO_MISSION: FlightClubMission = {
    id: 'demo-starlink-mission',
    description: 'Starlink Group Demo Mission',
    startDateTime: new Date().toISOString(),
    company: {
      id: 'spacex',
      description: 'SpaceX'
    },
    display: true,
    flightClubSimId: 'demo-sim-001',
    launchLibraryId: 'demo-launch-001',
    vehicle: {
      description: 'Falcon 9 Block 5'
    }
  };
  
  /**
   * Generate sample telemetry data for demo mode
   */
  private static generateDemoTelemetry(): EnhancedTelemetryFrame[] {
    const frames: EnhancedTelemetryFrame[] = [];
    const CAPE_LAT = 28.4158;
    const CAPE_LNG = -80.6081;
    
    // Generate trajectory from Cape Canaveral to northeast
    for (let t = 0; t <= 600; t += 10) { // 10 minutes of flight
      const progress = t / 600;
      
      // Realistic Falcon 9 altitude model (same as trajectoryService.ts)
      let alt: number;
      let velocity: number; // km/s
      
      if (t <= 162) {
        // First stage burn: 0 to ~2.4 km/s, 0 to ~80km altitude
        velocity = (t / 162) * 2.4;
        alt = Math.pow(t / 162, 1.8) * 80000; // Non-linear altitude gain
      } else if (t <= 165) {
        // Stage separation: maintain velocity, slight altitude gain
        velocity = 2.4;
        alt = 80000 + (t - 162) * 1000; // +3km during separation
      } else if (t <= 540) {
        // Second stage burn: 2.4 to ~7.8 km/s, 80km to ~200km
        const secondStageProgress = (t - 165) / (540 - 165);
        velocity = 2.4 + secondStageProgress * 5.4; // Reach orbital velocity
        alt = 80000 + Math.pow(secondStageProgress, 1.2) * 120000; // Reach ~200km
      } else {
        // Coasting: maintain orbital velocity and altitude
        velocity = 7.8;
        alt = 200000 + (t - 540) * 100; // Slight altitude increase
      }
      
      // Simulate rocket trajectory (northeast from Cape Canaveral)
      const lat = CAPE_LAT + progress * 15; // Move northeast
      const lng = CAPE_LNG + progress * 10;
      
      // Calculate distance and bearing from Bermuda
      const distance = this.calculateDistance(32.3078, -64.7505, lat, lng);
      const bearing = this.calculateBearing(32.3078, -64.7505, lat, lng);
      const elevation = this.calculateElevationAngle(distance, alt);
      
      frames.push({
        time: t,
        latitude: lat,
        longitude: lng,
        altitude: alt,
        speed: velocity * 1000, // Convert km/s to m/s
        distanceFromBermuda: distance,
        bearingFromBermuda: bearing,
        aboveHorizon: elevation > 0,
        elevationAngle: elevation,
        stageNumber: t < 165 ? 1 : 2, // Stage 1 until separation at T+165s
        velocityVector: {
          magnitude: velocity, // km/s (realistic Falcon 9 velocity)
          direction: 45 // Northeast
        }
      });
    }
    
    return frames;
  }
  
  /**
   * Helper functions for demo telemetry generation
   */
  private static calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const R = 6371; // Earth's radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLng / 2) * Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }
  
  private static calculateBearing(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const lat1Rad = lat1 * Math.PI / 180;
    const lat2Rad = lat2 * Math.PI / 180;
    const y = Math.sin(dLng) * Math.cos(lat2Rad);
    const x = Math.cos(lat1Rad) * Math.sin(lat2Rad) - Math.sin(lat1Rad) * Math.cos(lat2Rad) * Math.cos(dLng);
    const bearing = Math.atan2(y, x) * 180 / Math.PI;
    return (bearing + 360) % 360;
  }
  
  private static calculateElevationAngle(distance: number, altitude: number): number {
    const R = 6371; // Earth radius in km
    const earthCurvature = (distance * distance) / (2 * R);
    const apparentAltitude = altitude / 1000 - earthCurvature;
    const elevationRadians = Math.atan2(apparentAltitude, distance);
    return elevationRadians * 180 / Math.PI;
  }
  
  /**
   * SECURITY: Always use proxy - removed direct API access
   * In development, ensure you run 'vercel dev' instead of 'npm start'
   */

  // SECURITY: Removed direct API access - always use secure proxy

  // SECURITY: Removed direct simulation API access - always use secure proxy

  /**
   * Enable demo mode for development/testing
   */
  static enableDemoMode(enable: boolean = true) {
    this.DEMO_MODE = enable;
    console.log(`[FlightClub] Demo mode ${enable ? 'enabled' : 'disabled'}`);
  }

  /**
   * Fetch all available missions from Flight Club
   */
  static async getMissions(): Promise<MissionsResponse> {
    // Check if in demo mode
    if (this.DEMO_MODE) {
      console.log('[FlightClub] Using demo mode - returning sample missions');
      return {
        missions: [this.DEMO_MISSION],
        lastUpdated: new Date().toISOString(),
        cached: false,
        warning: 'Demo mode active - using sample data'
      };
    }
    
    try {
      const response = await fetch(`${this.BASE_URL}/missions`, {
        method: 'GET',
        headers: {
          'Accept': 'application/json'
        }
      });
      
      if (!response.ok) {
        // Auto-enable demo mode if API is unavailable
        console.warn(`[FlightClub] API unavailable (${response.status}), enabling demo mode`);
        this.enableDemoMode(true);
        return this.getMissions(); // Recursive call with demo mode
      }
      
      const data = await response.json();
      console.log(`[FlightClub] Fetched ${data.missions?.length || 0} missions (cached: ${data.cached})`);
      
      return data;
    } catch (error) {
      console.error('[FlightClub] Failed to fetch missions:', error);
      console.warn('[FlightClub] Falling back to demo mode');
      this.enableDemoMode(true);
      return this.getMissions(); // Recursive call with demo mode
    }
  }
  
  /**
   * Fetch detailed simulation data for a specific mission with caching
   */
  static async getSimulationData(missionId: string, launchId?: string): Promise<ProcessedSimulationData> {
    if (!missionId) {
      throw new Error('Mission ID is required');
    }
    
    // Check if in demo mode or if this is the demo mission
    if (this.DEMO_MODE || missionId === 'demo-starlink-mission') {
      console.log('[FlightClub] Using demo mode - generating sample simulation data');
      const demoTelemetry = this.generateDemoTelemetry();
      const visibleFrames = demoTelemetry.filter(f => f.aboveHorizon);
      const closestFrame = demoTelemetry.reduce((closest, current) => 
        current.distanceFromBermuda < closest.distanceFromBermuda ? current : closest
      );
      
      return {
        missionId,
        enhancedTelemetry: demoTelemetry,
        visibilitySummary: {
          firstVisible: visibleFrames[0]?.time || null,
          lastVisible: visibleFrames[visibleFrames.length - 1]?.time || null,
          peakVisibility: closestFrame.time,
          totalDuration: visibleFrames.length * 10, // 10 second intervals
          closestApproach: {
            distance: closestFrame.distanceFromBermuda,
            bearing: closestFrame.bearingFromBermuda,
            time: closestFrame.time
          },
          visibleFrameCount: visibleFrames.length
        },
        stageEvents: [
          { time: 0, event: 'Liftoff', stageNumber: 1, description: 'Mission start' },
          { time: 180, event: 'MECO-1', stageNumber: 1, engineType: 'Merlin' },
          { time: 185, event: 'Stage Sep', stageNumber: 1 },
          { time: 195, event: 'SES-1', stageNumber: 2, engineType: 'MVac' },
          { time: 520, event: 'SECO-1', stageNumber: 2, engineType: 'MVac' }
        ],
        lastUpdated: new Date().toISOString(),
        cached: false,
        warning: 'Demo mode active - using simulated trajectory data'
      };
    }
    
    // Try to get from cache first
    if (launchId) {
      try {
        const { indexedDBCache } = await import('./indexedDBCache');
        const cachedData = await indexedDBCache.getFlightClubData(launchId, missionId);
        if (cachedData) {
          console.log(`[FlightClub] Using cached simulation data for ${missionId}`);
          return cachedData;
        }
      } catch (cacheError) {
        console.warn('[FlightClub] Cache read failed, fetching from API:', cacheError);
      }
    }
    
    try {
      console.log(`[FlightClub] Attempting to fetch simulation data for missionId: ${missionId}`);
      const response = await fetch(`${this.BASE_URL}/simulation/${encodeURIComponent(missionId)}`, {
        method: 'GET',
        headers: {
          'Accept': 'application/json'
        }
      });
      
      if (!response.ok) {
        const errorMessage = `API request failed: ${response.status} ${response.statusText}`;
        console.warn(`[FlightClub] ${errorMessage} for missionId: ${missionId}`);
        
        if (response.status === 404) {
          throw new Error(`Mission not found or no simulation data available (ID: ${missionId})`);
        }
        throw new Error(errorMessage);
      }
      
      const data = await response.json();
      
      // Cache the data if launchId is provided
      if (launchId && data) {
        try {
          const { indexedDBCache } = await import('./indexedDBCache');
          await indexedDBCache.cacheFlightClubData(launchId, missionId, data);
          console.log(`[FlightClub] Cached simulation data for ${missionId}`);
        } catch (cacheError) {
          console.warn('[FlightClub] Cache write failed:', cacheError);
        }
      }
      
      // Log successful fetch
      console.log(`[FlightClub] ✓ Successfully fetched simulation for ${missionId}: ${data.enhancedTelemetry?.length || 0} frames, ${data.visibilitySummary?.visibleFrameCount || 0} visible`);
      
      return data;
    } catch (error) {
      console.error(`[FlightClub] ✗ Failed to fetch simulation for ${missionId}:`, error);
      throw error;
    }
  }
  
  /**
   * Manual mission mappings for common name mismatches
   */
  private static MISSION_MAPPINGS: Record<string, string> = {
    // SpaceX Starlink patterns
    'starlink group': 'starlink',
    'starlink mission': 'starlink',
    'starship ils-1': 'starship ils1',
    'crew-9': 'crew 9',
    'crew-10': 'crew 10',
    // Europa Clipper patterns
    'europa clipper': 'europa clipper mission',
    // Add more mappings as needed
  };

  /**
   * Normalize mission name for better matching
   */
  private static normalizeMissionName(name: string): string {
    return name
      .toLowerCase()
      .replace(/[\s\-_]+/g, ' ')  // Normalize spaces/dashes/underscores
      .replace(/group\s+\d+[-\s]*\d+/, 'group')  // "Group 10-6" → "Group"
      .replace(/mission\s*\d*/, '')  // Remove "Mission" suffix
      .replace(/\s+/g, ' ')  // Normalize multiple spaces
      .trim();
  }

  /**
   * Check if names match using SpaceX-specific patterns
   */
  private static isSpaceXMatch(launchName: string, missionName: string): boolean {
    const launch = this.normalizeMissionName(launchName);
    const mission = this.normalizeMissionName(missionName);
    
    // Check manual mappings first
    for (const [pattern, replacement] of Object.entries(this.MISSION_MAPPINGS)) {
      if (launch.includes(pattern)) {
        return mission.includes(replacement);
      }
    }
    
    // Starlink group matching
    if (launch.includes('starlink') && mission.includes('starlink')) {
      return true; // All Starlink missions are similar enough
    }
    
    // Crew mission matching
    const crewMatch = launch.match(/crew[-\s]*(\d+)/i);
    if (crewMatch) {
      const crewNumber = crewMatch[1];
      return mission.includes(`crew ${crewNumber}`) || mission.includes(`crew-${crewNumber}`);
    }
    
    return false;
  }

  /**
   * Match a Launch Library launch with Flight Club mission
   */
  static async findMissionForLaunch(launchId: string, launchName: string): Promise<FlightClubMission | null> {
    try {
      const missionsResponse = await this.getMissions();
      const missions = missionsResponse.missions;
      
      // In demo mode, always return demo mission for SpaceX launches
      if (this.DEMO_MODE && launchName.toLowerCase().includes('starlink')) {
        console.log(`[FlightClub] Demo mode: returning demo mission for ${launchName}`);
        return this.DEMO_MISSION;
      }
      
      console.log(`[FlightClub] Searching for mission matching: "${launchName}" (ID: ${launchId})`);
      console.log(`[FlightClub] Available missions: ${missions.length} ${missionsResponse.cached ? '(cached)' : '(fresh)'}`);
      
      // First try to match by Launch Library ID
      const byId = missions.find(m => m.launchLibraryId === launchId);
      if (byId) {
        console.log(`[FlightClub] ✓ Matched ${launchName} by Launch Library ID: ${byId.id} - ${byId.description}`);
        return byId;
      }
      
      // Then try to match by exact name
      const launchNameLower = launchName.toLowerCase();
      const byExactName = missions.find(m => {
        const missionName = m.description.toLowerCase();
        return missionName === launchNameLower;
      });
      
      if (byExactName) {
        console.log(`[FlightClub] ✓ Matched ${launchName} by exact name: ${byExactName.id} - ${byExactName.description}`);
        return byExactName;
      }
      
      // Try partial name matching (both ways)
      const byPartialName = missions.find(m => {
        const missionName = m.description.toLowerCase();
        return missionName.includes(launchNameLower) || launchNameLower.includes(missionName);
      });
      
      if (byPartialName) {
        console.log(`[FlightClub] ✓ Matched ${launchName} by partial name: ${byPartialName.id} - ${byPartialName.description}`);
        return byPartialName;
      }
      
      // Try SpaceX-specific matching patterns
      const bySpaceXMatch = missions.find(m => this.isSpaceXMatch(launchName, m.description));
      
      if (bySpaceXMatch) {
        console.log(`[FlightClub] ✓ Matched ${launchName} by SpaceX pattern: ${bySpaceXMatch.id} - ${bySpaceXMatch.description}`);
        return bySpaceXMatch;
      }
      
      // Try word-based matching for complex names (fallback)
      const launchWords = launchNameLower.split(/[\s\-_]+/).filter(w => w.length > 2);
      const byWordMatch = missions.find(m => {
        const missionWords = m.description.toLowerCase().split(/[\s\-_]+/).filter(w => w.length > 2);
        return launchWords.some(lw => missionWords.some(mw => lw.includes(mw) || mw.includes(lw)));
      });
      
      if (byWordMatch) {
        console.log(`[FlightClub] ✓ Matched ${launchName} by word similarity: ${byWordMatch.id} - ${byWordMatch.description}`);
        return byWordMatch;
      }
      
      // Log some example missions for debugging
      const recentMissions = missions.slice(0, 10).map(m => `${m.id}: ${m.description}`);
      console.log(`[FlightClub] ✗ No match found for "${launchName}". Recent missions:`, recentMissions);
      
      return null;
      
    } catch (error) {
      console.error(`[FlightClub] Error matching launch ${launchName}:`, error);
      return null;
    }
  }
  
  /**
   * Get enhanced visibility data for a launch
   */
  static async getEnhancedVisibilityData(missionId: string): Promise<{
    hasData: boolean;
    visibilitySummary: VisibilitySummary;
    telemetryFrames: EnhancedTelemetryFrame[];
    stageEvents: StageEvent[];
  }> {
    try {
      const simulationData = await this.getSimulationData(missionId);
      
      return {
        hasData: true,
        visibilitySummary: simulationData.visibilitySummary,
        telemetryFrames: simulationData.enhancedTelemetry,
        stageEvents: simulationData.stageEvents
      };
      
    } catch (error) {
      console.error(`[FlightClub] No enhanced data for mission ${missionId}:`, error);
      
      return {
        hasData: false,
        visibilitySummary: {
          firstVisible: null,
          lastVisible: null,
          peakVisibility: null,
          totalDuration: 0,
          closestApproach: { distance: 0, bearing: 0, time: 0 },
          visibleFrameCount: 0
        },
        telemetryFrames: [],
        stageEvents: []
      };
    }
  }
  
  /**
   * Utility: Convert bearing to compass direction
   */
  static bearingToCompass(bearing: number): string {
    const directions = [
      'North', 'NNE', 'NE', 'ENE', 'East', 'ESE', 'SE', 'SSE',
      'South', 'SSW', 'SW', 'WSW', 'West', 'WNW', 'NW', 'NNW'
    ];
    const index = Math.round(bearing / 22.5) % 16;
    return directions[index];
  }
  
  /**
   * Utility: Format time from T+ seconds to readable format
   */
  static formatTplusTime(seconds: number): string {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.round(seconds % 60);
    return `T+${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  }
  
  /**
   * Utility: Generate viewing instructions from telemetry
   */
  static generateViewingInstructions(simulationData: ProcessedSimulationData): {
    initialDirection: string;
    peakDirection: string;
    trackingPath: string;
    optimalViewingTime: string;
    instructions: string;
  } {
    const { visibilitySummary, enhancedTelemetry } = simulationData;
    
    if (!visibilitySummary.firstVisible) {
      return {
        initialDirection: 'Not visible',
        peakDirection: 'Not visible',
        trackingPath: 'Not visible from Bermuda',
        optimalViewingTime: 'Not applicable',
        instructions: 'This launch will not be visible from Bermuda due to trajectory path and Earth\'s curvature.'
      };
    }
    
    // Find key telemetry points
    const firstVisibleFrame = enhancedTelemetry.find(f => f.time >= visibilitySummary.firstVisible!);
    const peakFrame = enhancedTelemetry.find(f => f.time >= visibilitySummary.peakVisibility!);
    
    const initialDirection = firstVisibleFrame ? this.bearingToCompass(firstVisibleFrame.bearingFromBermuda) : 'Unknown';
    const peakDirection = peakFrame ? this.bearingToCompass(peakFrame.bearingFromBermuda) : 'Unknown';
    
    // Create tracking path
    const trackingPath = initialDirection === peakDirection 
      ? `Remains in ${initialDirection}`
      : `${initialDirection} → ${peakDirection}`;
    
    const optimalViewingTime = peakFrame 
      ? `${this.formatTplusTime(peakFrame.time)} (${Math.round(peakFrame.elevationAngle)}° elevation)`
      : 'Unknown';
    
    const instructions = `Start looking ${initialDirection.toLowerCase()} at ${this.formatTplusTime(visibilitySummary.firstVisible!)}. Peak visibility at ${optimalViewingTime}, distance ${Math.round(visibilitySummary.closestApproach.distance)}km. Track ${trackingPath.toLowerCase()} until ${this.formatTplusTime(visibilitySummary.lastVisible!)}.`;
    
    return {
      initialDirection,
      peakDirection,
      trackingPath,
      optimalViewingTime,
      instructions
    };
  }
}