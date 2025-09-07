/**
 * FlightClub.io API Integration Service
 * Provides authenticated access to real rocket trajectory data
 */

const FLIGHTCLUB_API_KEY = 'apitn_p43xs5ha3';
const FLIGHTCLUB_BASE_URL = 'https://api.flightclub.io/v3';

// Cache duration constants
const MISSION_CACHE_DURATION = 30 * 60 * 1000; // 30 minutes
const TRAJECTORY_CACHE_DURATION = 60 * 60 * 1000; // 1 hour

export interface FlightClubMission {
  id: string;
  description: string;
  startDateTime: string; // ISO date string
  company: {
    id: string;
    description: string;
  };
  display: boolean;
  flightClubSimId: string;
  launchLibraryId?: string; // Key field for matching with Launch Library 2
  vehicle: {
    description: string;
  };
  sequences?: unknown[];
  landingZones?: unknown[];
}

export interface FlightClubTelemetryFrame {
  time: number; // seconds from liftoff
  latitude: number;
  longitude: number;
  altitude: number; // meters
  speed: number; // m/s
}

export interface FlightClubTrajectoryData {
  missionId: string;
  simulationId: string;
  launchLibraryId?: string;
  description: string;
  company: string;
  vehicle: string;
  stages: Array<{
    stageNumber: number;
    telemetry: FlightClubTelemetryFrame[];
  }>;
}

export interface MissionCache {
  data: FlightClubMission[];
  lastFetch: number;
  expiresAt: number;
}

export interface TrajectoryCache {
  [missionId: string]: {
    data: FlightClubTrajectoryData;
    lastFetch: number;
    expiresAt: number;
  };
}

class FlightClubApiService {
  private missionCache: MissionCache | null = null;
  private trajectoryCache: TrajectoryCache = {};

  /**
   * Make authenticated request to FlightClub API
   */
  private async makeRequest<T>(endpoint: string): Promise<T> {
    const url = `${FLIGHTCLUB_BASE_URL}${endpoint}`;
    
    
    try {
      const response = await fetch(url, {
        headers: {
          'X-Api-Key': FLIGHTCLUB_API_KEY,
          'Accept': 'application/json',
          'User-Agent': 'BermudaRocketTracker/1.0'
        }
      });

      if (!response.ok) {
        throw new Error(`FlightClub API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      return data as T;
      
    } catch (error) {
      console.error(`[FlightClub API] Failed to fetch ${endpoint}:`, error);
      throw error;
    }
  }

  /**
   * Fetch all available missions from FlightClub
   */
  async getMissions(forceRefresh: boolean = false): Promise<FlightClubMission[]> {
    // Check cache first
    if (!forceRefresh && this.missionCache && Date.now() < this.missionCache.expiresAt) {
      return this.missionCache.data;
    }

    try {
      const missions = await this.makeRequest<FlightClubMission[]>('/mission/projected');
      
      // Update cache
      this.missionCache = {
        data: missions,
        lastFetch: Date.now(),
        expiresAt: Date.now() + MISSION_CACHE_DURATION
      };

      return missions;
      
    } catch (error) {
      // Return cached data if available on error
      if (this.missionCache) {
        return this.missionCache.data;
      }
      
      console.error('[FlightClub API] No cached missions available');
      return [];
    }
  }

  /**
   * Fetch trajectory data for a specific mission
   */
  async getTrajectoryData(missionId: string, forceRefresh: boolean = false): Promise<FlightClubTrajectoryData | null> {
    // Check cache first
    const cached = this.trajectoryCache[missionId];
    if (!forceRefresh && cached && Date.now() < cached.expiresAt) {
      return cached.data;
    }

    try {
      const trajectory = await this.makeRequest<FlightClubTrajectoryData>(`/simulation/lite?missionId=${missionId}`);
      
      // Validate trajectory data
      if (this.isValidTrajectoryData(trajectory)) {
        // Update cache
        this.trajectoryCache[missionId] = {
          data: trajectory,
          lastFetch: Date.now(),
          expiresAt: Date.now() + TRAJECTORY_CACHE_DURATION
        };

        return trajectory;
      } else {
        console.warn(`[FlightClub API] Invalid trajectory data for mission ${missionId}`);
        return null;
      }
      
    } catch (error) {
      // Return cached data if available on error
      if (cached) {
        return cached.data;
      }
      
      console.error(`[FlightClub API] Failed to get trajectory for mission ${missionId}:`, error);
      return null;
    }
  }

  /**
   * Find missions by Launch Library 2 ID
   */
  async findMissionByLaunchLibraryId(launchLibraryId: string): Promise<FlightClubMission | null> {
    try {
      const missions = await this.getMissions();
      const match = missions.find(mission => mission.launchLibraryId === launchLibraryId);
      
      if (match) {
        return match;
      }
      
      return null;
      
    } catch (error) {
      console.error(`[FlightClub API] Error finding mission by LL2 ID ${launchLibraryId}:`, error);
      return null;
    }
  }

  /**
   * Search missions by name and company (fuzzy matching)
   */
  async searchMissionsByName(missionName: string, company?: string, launchDate?: string): Promise<FlightClubMission[]> {
    try {
      const missions = await this.getMissions();
      const searchName = missionName.toLowerCase();
      const searchCompany = company?.toLowerCase();
      
      const matches = missions.filter(mission => {
        const missionDesc = mission.description.toLowerCase();
        const missionCompany = mission.company.description.toLowerCase();
        
        // Check name similarity
        const nameMatch = missionDesc.includes(searchName) || 
                         this.calculateSimilarity(missionDesc, searchName) > 0.7;
        
        // Check company match if provided
        const companyMatch = !searchCompany || missionCompany.includes(searchCompany);
        
        // Check date proximity if provided (within 7 days)
        let dateMatch = true;
        if (launchDate) {
          const missionDate = new Date(mission.startDateTime);
          const targetDate = new Date(launchDate);
          const timeDiff = Math.abs(missionDate.getTime() - targetDate.getTime());
          const daysDiff = timeDiff / (1000 * 60 * 60 * 24);
          dateMatch = daysDiff <= 7;
        }
        
        return nameMatch && companyMatch && dateMatch;
      });

      return matches;
      
    } catch (error) {
      console.error(`[FlightClub API] Error searching missions by name:`, error);
      return [];
    }
  }

  /**
   * Get recent missions (within last 30 days and next 90 days)
   */
  async getRecentMissions(): Promise<FlightClubMission[]> {
    try {
      const missions = await this.getMissions();
      const now = new Date();
      const thirtyDaysAgo = new Date(now.getTime() - (30 * 24 * 60 * 60 * 1000));
      const ninetyDaysFromNow = new Date(now.getTime() + (90 * 24 * 60 * 60 * 1000));
      
      const recentMissions = missions.filter(mission => {
        const missionDate = new Date(mission.startDateTime);
        return missionDate >= thirtyDaysAgo && missionDate <= ninetyDaysFromNow;
      });

      return recentMissions;
      
    } catch (error) {
      console.error('[FlightClub API] Error getting recent missions:', error);
      return [];
    }
  }

  /**
   * Validate trajectory data integrity
   */
  private isValidTrajectoryData(trajectory: FlightClubTrajectoryData): boolean {
    if (!trajectory.stages || trajectory.stages.length === 0) {
      return false;
    }

    // Check if any stage has telemetry data
    const hasValidTelemetry = trajectory.stages.some(stage => 
      stage.telemetry && stage.telemetry.length > 0
    );

    if (!hasValidTelemetry) {
      return false;
    }

    // Validate first few telemetry points
    const firstStage = trajectory.stages.find(stage => stage.telemetry && stage.telemetry.length > 0);
    if (firstStage) {
      const firstFrame = firstStage.telemetry[0];
      
      // Check if coordinates are reasonable (should be near Florida for our use case)
      const lat = firstFrame.latitude;
      const lon = firstFrame.longitude;
      
      // Florida is roughly 25-31°N, 80-87°W
      const nearFlorida = lat >= 24 && lat <= 32 && lon >= -88 && lon <= -79;
      
      if (!nearFlorida) {
        console.warn(`[FlightClub API] Trajectory starts outside Florida area: ${lat}, ${lon}`);
        // Still return true - might be a valid launch from other locations
      }
    }

    return true;
  }

  /**
   * Calculate string similarity using simple algorithm
   */
  private calculateSimilarity(str1: string, str2: string): number {
    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;
    
    if (longer.length === 0) return 1.0;
    
    const editDistance = this.levenshteinDistance(longer, shorter);
    return (longer.length - editDistance) / longer.length;
  }

  /**
   * Calculate Levenshtein distance between two strings
   */
  private levenshteinDistance(str1: string, str2: string): number {
    const matrix = Array(str2.length + 1).fill(null).map(() => 
      Array(str1.length + 1).fill(null)
    );

    for (let i = 0; i <= str1.length; i++) matrix[0][i] = i;
    for (let j = 0; j <= str2.length; j++) matrix[j][0] = j;

    for (let j = 1; j <= str2.length; j++) {
      for (let i = 1; i <= str1.length; i++) {
        const substitutionCost = str1[i - 1] === str2[j - 1] ? 0 : 1;
        matrix[j][i] = Math.min(
          matrix[j][i - 1] + 1, // insertion
          matrix[j - 1][i] + 1, // deletion
          matrix[j - 1][i - 1] + substitutionCost // substitution
        );
      }
    }

    return matrix[str2.length][str1.length];
  }

  /**
   * Clear all caches
   */
  clearCache(): void {
    this.missionCache = null;
    this.trajectoryCache = {};
  }

  /**
   * Get cache status for debugging
   */
  getCacheStatus(): { missions: boolean; trajectories: number } {
    const missionsValid = this.missionCache && Date.now() < this.missionCache.expiresAt;
    const validTrajectories = Object.values(this.trajectoryCache)
      .filter(cache => Date.now() < cache.expiresAt).length;

    return {
      missions: !!missionsValid,
      trajectories: validTrajectories
    };
  }
}

// Export singleton instance
export const flightClubApiService = new FlightClubApiService();