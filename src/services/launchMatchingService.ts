/**
 * Launch Matching Service
 * Matches FlightClub missions with Launch Library 2 data
 * Provides confidence scoring and validation safeguards
 */

import { Launch } from '../types';
import { FlightClubMission, flightClubApiService } from './flightClubApiService';

export type MatchConfidence = 'exact' | 'high' | 'medium' | 'low' | 'none';

export interface LaunchMatch {
  flightClubMission: FlightClubMission;
  confidence: MatchConfidence;
  score: number; // 0-100 confidence score
  matchReasons: string[]; // Reasons for the match
  validationWarnings?: string[]; // Any concerns about the match
}

export interface LaunchWithFlightClub extends Launch {
  flightClubMatch?: LaunchMatch;
  hasFlightClubData: boolean;
}

// Cache for match results
const matchCache = new Map<string, LaunchMatch>();
const MATCH_CACHE_DURATION = 60 * 60 * 1000; // 1 hour

class LaunchMatchingService {
  /**
   * Find the best FlightClub match for a Launch Library 2 launch
   */
  async findBestMatch(launch: Launch): Promise<LaunchMatch | null> {
    // Check cache first
    const cacheKey = `${launch.id}-${Date.now() < Date.now() + MATCH_CACHE_DURATION}`;
    if (matchCache.has(launch.id)) {
      console.log(`[LaunchMatching] Using cached match for ${launch.name}`);
      return matchCache.get(launch.id) || null;
    }

    console.log(`[LaunchMatching] Finding match for launch: ${launch.name}`);

    try {
      // Strategy 1: Exact match by Launch Library ID (most reliable)
      const exactMatch = await this.findExactMatch(launch);
      if (exactMatch) {
        const match = this.createMatchResult(exactMatch, 'exact', 100, 
          ['Exact Launch Library 2 ID match'], launch);
        matchCache.set(launch.id, match);
        return match;
      }

      // Strategy 2: Fuzzy matching by name, company, and date
      const fuzzyMatches = await this.findFuzzyMatches(launch);
      if (fuzzyMatches.length > 0) {
        const bestMatch = this.selectBestFuzzyMatch(fuzzyMatches, launch);
        if (bestMatch) {
          matchCache.set(launch.id, bestMatch);
          return bestMatch;
        }
      }

      console.log(`[LaunchMatching] No suitable match found for ${launch.name}`);
      return null;

    } catch (error) {
      console.error(`[LaunchMatching] Error finding match for ${launch.name}:`, error);
      return null;
    }
  }

  /**
   * Find exact match using Launch Library 2 ID
   */
  private async findExactMatch(launch: Launch): Promise<FlightClubMission | null> {
    try {
      const mission = await flightClubApiService.findMissionByLaunchLibraryId(launch.id);
      if (mission) {
        console.log(`[LaunchMatching] Exact match found: ${mission.description}`);
        return mission;
      }
    } catch (error) {
      console.error(`[LaunchMatching] Error in exact match for ${launch.name}:`, error);
    }
    return null;
  }

  /**
   * Find potential matches using fuzzy logic
   */
  private async findFuzzyMatches(launch: Launch): Promise<FlightClubMission[]> {
    const launchProvider = launch.rocket?.configuration?.launch_service_provider?.name || 
                          launch.launch_service_provider?.name || '';
    
    // Extract mission name from full launch name (remove rocket info)
    const missionName = this.extractMissionName(launch.name);
    
    console.log(`[LaunchMatching] Searching for: "${missionName}" by "${launchProvider}"`);

    try {
      const candidates = await flightClubApiService.searchMissionsByName(
        missionName, 
        launchProvider, 
        launch.net
      );

      console.log(`[LaunchMatching] Found ${candidates.length} candidates for fuzzy matching`);
      return candidates;

    } catch (error) {
      console.error(`[LaunchMatching] Error in fuzzy search:`, error);
      return [];
    }
  }

  /**
   * Select the best match from fuzzy search results
   */
  private selectBestFuzzyMatch(candidates: FlightClubMission[], launch: Launch): LaunchMatch | null {
    const launchProvider = launch.rocket?.configuration?.launch_service_provider?.name || 
                          launch.launch_service_provider?.name || '';
    const missionName = this.extractMissionName(launch.name);
    const launchDate = new Date(launch.net);

    let bestMatch: FlightClubMission | null = null;
    let bestScore = 0;
    let matchReasons: string[] = [];
    let validationWarnings: string[] = [];

    for (const candidate of candidates) {
      const score = this.calculateMatchScore(candidate, missionName, launchProvider, launchDate);
      const reasons = this.getMatchReasons(candidate, missionName, launchProvider, launchDate);
      const warnings = this.validateMatch(candidate, launch);

      console.log(`[LaunchMatching] Candidate "${candidate.description}" scored ${score.toFixed(1)}%`);

      if (score > bestScore) {
        bestScore = score;
        bestMatch = candidate;
        matchReasons = reasons;
        validationWarnings = warnings;
      }
    }

    if (bestMatch && bestScore >= 50) { // Minimum 50% confidence
      const confidence = this.scoreToConfidence(bestScore);
      return this.createMatchResult(bestMatch, confidence, bestScore, matchReasons, launch, validationWarnings);
    }

    return null;
  }

  /**
   * Calculate match score based on multiple factors
   */
  private calculateMatchScore(
    candidate: FlightClubMission, 
    missionName: string, 
    launchProvider: string, 
    launchDate: Date
  ): number {
    let score = 0;

    // Mission name similarity (40% weight)
    const nameSimilarity = this.calculateStringSimilarity(
      candidate.description.toLowerCase(), 
      missionName.toLowerCase()
    );
    score += nameSimilarity * 40;

    // Company match (30% weight)
    const companyMatch = this.calculateStringSimilarity(
      candidate.company.description.toLowerCase(),
      launchProvider.toLowerCase()
    );
    score += companyMatch * 30;

    // Date proximity (20% weight)
    const candidateDate = new Date(candidate.startDateTime);
    const dateDiff = Math.abs(candidateDate.getTime() - launchDate.getTime());
    const daysDiff = dateDiff / (1000 * 60 * 60 * 24);
    const dateScore = Math.max(0, 1 - (daysDiff / 30)); // 100% if same day, 0% if 30+ days apart
    score += dateScore * 20;

    // Vehicle match (10% weight) - bonus if available
    const vehicleSimilarity = this.calculateVehicleMatch(candidate, missionName);
    score += vehicleSimilarity * 10;

    return Math.min(100, Math.max(0, score));
  }

  /**
   * Get human-readable reasons for the match
   */
  private getMatchReasons(
    candidate: FlightClubMission, 
    missionName: string, 
    launchProvider: string, 
    launchDate: Date
  ): string[] {
    const reasons: string[] = [];
    
    const candidateDate = new Date(candidate.startDateTime);
    const daysDiff = Math.abs(candidateDate.getTime() - launchDate.getTime()) / (1000 * 60 * 60 * 24);

    if (candidate.company.description.toLowerCase().includes(launchProvider.toLowerCase())) {
      reasons.push(`Launch provider match: ${candidate.company.description}`);
    }

    if (daysDiff <= 1) {
      reasons.push('Launch date within 24 hours');
    } else if (daysDiff <= 7) {
      reasons.push(`Launch date within ${Math.round(daysDiff)} days`);
    }

    const nameSim = this.calculateStringSimilarity(candidate.description.toLowerCase(), missionName.toLowerCase());
    if (nameSim > 0.7) {
      reasons.push('High mission name similarity');
    } else if (nameSim > 0.5) {
      reasons.push('Moderate mission name similarity');
    }

    if (candidate.vehicle.description.toLowerCase().includes('falcon') && missionName.toLowerCase().includes('falcon')) {
      reasons.push('Vehicle type match');
    }

    return reasons;
  }

  /**
   * Validate match quality and detect potential issues
   */
  private validateMatch(candidate: FlightClubMission, launch: Launch): string[] {
    const warnings: string[] = [];

    // Check date difference
    const candidateDate = new Date(candidate.startDateTime);
    const launchDate = new Date(launch.net);
    const daysDiff = Math.abs(candidateDate.getTime() - launchDate.getTime()) / (1000 * 60 * 60 * 24);

    if (daysDiff > 7) {
      warnings.push(`Launch dates differ by ${Math.round(daysDiff)} days`);
    }

    // Check company mismatch
    const launchProvider = launch.rocket?.configuration?.launch_service_provider?.name || 
                          launch.launch_service_provider?.name || '';
    if (launchProvider && !candidate.company.description.toLowerCase().includes(launchProvider.toLowerCase())) {
      warnings.push(`Launch provider mismatch: ${launchProvider} vs ${candidate.company.description}`);
    }

    // Check if mission name is very different
    const missionName = this.extractMissionName(launch.name);
    const nameSim = this.calculateStringSimilarity(candidate.description.toLowerCase(), missionName.toLowerCase());
    if (nameSim < 0.3) {
      warnings.push('Mission names are significantly different');
    }

    return warnings;
  }

  /**
   * Extract mission name from full launch name (remove rocket info)
   */
  private extractMissionName(fullName: string): string {
    // Remove common rocket prefixes
    const rocketPrefixes = [
      'Falcon 9 Block 5 |',
      'Falcon 9 |',
      'Falcon Heavy |',
      'Atlas V |',
      'Delta IV Heavy |',
      'New Shepard |',
      'Electron |'
    ];

    let missionName = fullName;
    for (const prefix of rocketPrefixes) {
      if (missionName.includes(prefix)) {
        missionName = missionName.split(prefix)[1]?.trim() || missionName;
        break;
      }
    }

    return missionName;
  }

  /**
   * Calculate vehicle matching bonus
   */
  private calculateVehicleMatch(candidate: FlightClubMission, missionName: string): number {
    const candidateVehicle = candidate.vehicle.description.toLowerCase();
    const mission = missionName.toLowerCase();

    // Simple vehicle matching
    if (candidateVehicle.includes('falcon') && mission.includes('falcon')) return 1;
    if (candidateVehicle.includes('atlas') && mission.includes('atlas')) return 1;
    if (candidateVehicle.includes('delta') && mission.includes('delta')) return 1;
    if (candidateVehicle.includes('electron') && mission.includes('electron')) return 1;

    return 0;
  }

  /**
   * Calculate string similarity using a simple algorithm
   */
  private calculateStringSimilarity(str1: string, str2: string): number {
    if (str1 === str2) return 1;
    if (str1.length === 0 || str2.length === 0) return 0;

    // Simple substring matching with word overlap
    const words1 = str1.toLowerCase().split(/\s+/);
    const words2 = str2.toLowerCase().split(/\s+/);
    
    let matchingWords = 0;
    const totalWords = Math.max(words1.length, words2.length);

    for (const word1 of words1) {
      if (words2.some(word2 => word1.includes(word2) || word2.includes(word1))) {
        matchingWords++;
      }
    }

    return matchingWords / totalWords;
  }

  /**
   * Convert numeric score to confidence level
   */
  private scoreToConfidence(score: number): MatchConfidence {
    if (score >= 95) return 'exact';
    if (score >= 80) return 'high';
    if (score >= 60) return 'medium';
    if (score >= 40) return 'low';
    return 'none';
  }

  /**
   * Create a match result object
   */
  private createMatchResult(
    mission: FlightClubMission, 
    confidence: MatchConfidence, 
    score: number, 
    reasons: string[], 
    launch: Launch,
    warnings?: string[]
  ): LaunchMatch {
    console.log(`[LaunchMatching] Match created: ${launch.name} -> ${mission.description} (${confidence}, ${score.toFixed(1)}%)`);

    return {
      flightClubMission: mission,
      confidence,
      score,
      matchReasons: reasons,
      validationWarnings: warnings
    };
  }

  /**
   * Enrich launches with FlightClub data
   */
  async enrichLaunchesWithFlightClub(launches: Launch[]): Promise<LaunchWithFlightClub[]> {
    console.log(`[LaunchMatching] Enriching ${launches.length} launches with FlightClub data`);

    const enrichedLaunches: LaunchWithFlightClub[] = [];

    for (const launch of launches) {
      const match = await this.findBestMatch(launch);
      
      const enrichedLaunch: LaunchWithFlightClub = {
        ...launch,
        flightClubMatch: match || undefined,
        hasFlightClubData: !!match
      };

      enrichedLaunches.push(enrichedLaunch);

      if (match) {
        console.log(`[LaunchMatching] ✅ ${launch.name} matched with confidence: ${match.confidence}`);
      } else {
        console.log(`[LaunchMatching] ⚠️ ${launch.name} - no FlightClub match found`);
      }
    }

    const matchCount = enrichedLaunches.filter(l => l.hasFlightClubData).length;
    console.log(`[LaunchMatching] Successfully matched ${matchCount}/${launches.length} launches`);

    return enrichedLaunches;
  }

  /**
   * Clear match cache
   */
  clearCache(): void {
    matchCache.clear();
    console.log('[LaunchMatching] Match cache cleared');
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): { cachedMatches: number } {
    return { cachedMatches: matchCache.size };
  }

  /**
   * Validate a specific match manually
   */
  async validateSpecificMatch(launchId: string, flightClubMissionId: string): Promise<LaunchMatch | null> {
    try {
      const missions = await flightClubApiService.getMissions();
      const mission = missions.find(m => m.id === flightClubMissionId);
      
      if (!mission) {
        console.error(`[LaunchMatching] FlightClub mission ${flightClubMissionId} not found`);
        return null;
      }

      // Create a high-confidence manual match
      const match: LaunchMatch = {
        flightClubMission: mission,
        confidence: 'high',
        score: 90,
        matchReasons: ['Manual validation'],
        validationWarnings: ['Manually validated match - verify accuracy']
      };

      matchCache.set(launchId, match);
      console.log(`[LaunchMatching] Manual match created: ${launchId} -> ${flightClubMissionId}`);
      
      return match;

    } catch (error) {
      console.error(`[LaunchMatching] Error in manual validation:`, error);
      return null;
    }
  }
}

// Export singleton instance
export const launchMatchingService = new LaunchMatchingService();