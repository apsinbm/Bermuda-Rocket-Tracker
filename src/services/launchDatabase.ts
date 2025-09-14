/**
 * Launch Database Service
 * Local storage-based database for caching launch data to avoid API rate limits
 */

import { Launch } from '../types';

interface LaunchCacheEntry {
  id: string;
  data: Launch;
  sourceUrl: string;
  firstFetched: number;
  lastUpdated: number;
  nextScheduledCheck: number;
  checkCount: number;
  phase: 'initial' | 'daily' | 'half-daily' | 'hourly' | 'frequent' | 'critical';
}

interface DatabaseMetadata {
  lastFullScan: number;
  totalLaunches: number;
  version: string;
  sources: string[];
}

export class LaunchDatabase {
  private readonly STORAGE_KEY = 'bermuda-rocket-launches-db';
  private readonly METADATA_KEY = 'bermuda-rocket-db-metadata';
  private readonly VERSION = '1.0.0';

  /**
   * Get all cached launches (including past launches for debugging)
   */
  getAllLaunches(): Launch[] {
    const entries = this.getAllEntries();
    
    // Return ALL cached launches - let the service handle filtering
    const allLaunches = entries
      .sort((a, b) => new Date(a.data.net).getTime() - new Date(b.data.net).getTime())
      .map(entry => entry.data);
    
    return allLaunches; // Return all launches, service will filter
  }

  /**
   * Get launches that need checking based on schedule
   */
  getLaunchesNeedingUpdate(): LaunchCacheEntry[] {
    const entries = this.getAllEntries();
    const now = Date.now();
    
    return entries.filter(entry => 
      now >= entry.nextScheduledCheck && 
      new Date(entry.data.net) > new Date() // Only future launches
    );
  }

  /**
   * Save or update a launch in the database
   */
  saveLaunch(launch: Launch, sourceUrl: string): void {
    const entries = this.getAllEntries();
    const existingIndex = entries.findIndex(entry => entry.id === launch.id);
    const now = Date.now();
    
    if (existingIndex >= 0) {
      // Update existing entry
      const existing = entries[existingIndex];
      entries[existingIndex] = {
        ...existing,
        data: launch,
        lastUpdated: now,
        nextScheduledCheck: this.calculateNextCheck(launch, existing.checkCount + 1),
        checkCount: existing.checkCount + 1,
        phase: this.calculatePhase(launch, existing.checkCount + 1)
      };
    } else {
      // Create new entry
      const newEntry: LaunchCacheEntry = {
        id: launch.id,
        data: launch,
        sourceUrl,
        firstFetched: now,
        lastUpdated: now,
        nextScheduledCheck: this.calculateNextCheck(launch, 0),
        checkCount: 0,
        phase: this.calculatePhase(launch, 0)
      };
      entries.push(newEntry);
    }

    this.saveAllEntries(entries);
    this.updateMetadata();
  }

  /**
   * Calculate next check time based on launch proximity and check count
   */
  private calculateNextCheck(launch: Launch, checkCount: number): number {
    const now = Date.now();
    const launchTime = new Date(launch.net).getTime();
    const timeUntilLaunch = launchTime - now;
    
    // If launch is in the past, don't schedule more checks
    if (timeUntilLaunch <= 0) {
      return now + (7 * 24 * 60 * 60 * 1000); // Check again in a week
    }

    const hoursUntilLaunch = timeUntilLaunch / (60 * 60 * 1000);

    // Phase 1: More than 48 hours away - check once every 24 hours
    if (hoursUntilLaunch > 48) {
      return now + (24 * 60 * 60 * 1000); // 24 hours
    }
    
    // Phase 2: 24-48 hours away - check every 12 hours
    if (hoursUntilLaunch > 24) {
      return now + (12 * 60 * 60 * 1000); // 12 hours
    }
    
    // Phase 3: 6-24 hours away - check every 2 hours
    if (hoursUntilLaunch > 6) {
      return now + (2 * 60 * 60 * 1000); // 2 hours
    }
    
    // Phase 4: 1-6 hours away - check every 30 minutes
    if (hoursUntilLaunch > 1) {
      return now + (30 * 60 * 1000); // 30 minutes
    }
    
    // Phase 5: Less than 1 hour - check every 10 minutes
    return now + (10 * 60 * 1000); // 10 minutes
  }

  /**
   * Determine the current phase based on launch proximity
   */
  private calculatePhase(launch: Launch, checkCount: number): LaunchCacheEntry['phase'] {
    const now = Date.now();
    const launchTime = new Date(launch.net).getTime();
    const hoursUntilLaunch = (launchTime - now) / (60 * 60 * 1000);

    if (hoursUntilLaunch > 48) return 'daily';
    if (hoursUntilLaunch > 24) return 'half-daily';
    if (hoursUntilLaunch > 6) return 'hourly';
    if (hoursUntilLaunch > 1) return 'frequent';
    return 'critical';
  }

  /**
   * Clean up old launches and expired data
   */
  cleanup(): void {
    const entries = this.getAllEntries();
    const now = Date.now();
    const oneWeekAgo = now - (7 * 24 * 60 * 60 * 1000);
    
    // Remove launches that happened more than a week ago
    const cleanedEntries = entries.filter(entry => {
      const launchTime = new Date(entry.data.net).getTime();
      return launchTime > oneWeekAgo;
    });

    this.saveAllEntries(cleanedEntries);
    this.updateMetadata();
  }

  /**
   * Get database statistics
   */
  getStats(): {
    totalLaunches: number;
    upcomingLaunches: number;
    needingUpdate: number;
    phases: Record<string, number>;
    oldestEntry: number;
    newestEntry: number;
  } {
    const entries = this.getAllEntries();
    const upcoming = entries.filter(entry => new Date(entry.data.net) > new Date());
    const needingUpdate = this.getLaunchesNeedingUpdate();
    
    const phases = entries.reduce((acc, entry) => {
      acc[entry.phase] = (acc[entry.phase] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const timestamps = entries.map(entry => entry.firstFetched);
    
    return {
      totalLaunches: entries.length,
      upcomingLaunches: upcoming.length,
      needingUpdate: needingUpdate.length,
      phases,
      oldestEntry: timestamps.length > 0 ? Math.min(...timestamps) : 0,
      newestEntry: timestamps.length > 0 ? Math.max(...timestamps) : 0
    };
  }

  /**
   * Export database for debugging
   */
  export() {
    return {
      entries: this.getAllEntries(),
      metadata: this.getMetadata(),
      stats: this.getStats()
    };
  }

  /**
   * Clear all data (for testing/reset)
   */
  clear(): void {
    console.log('[LaunchDatabase] Clearing all stored launch data');
    localStorage.removeItem(this.STORAGE_KEY);
    localStorage.removeItem(this.METADATA_KEY);
  }

  /**
   * Clear cache but preserve metadata
   */
  public clearCache(): void {
    console.log('[LaunchDatabase] Clearing launch cache, preserving metadata');
    const metadata = this.getMetadata();
    localStorage.removeItem(this.STORAGE_KEY);
    // Preserve metadata with updated timestamp
    const updatedMetadata = {
      ...metadata,
      lastFullScan: Date.now(),
      totalLaunches: 0
    };
    localStorage.setItem(this.METADATA_KEY, JSON.stringify(updatedMetadata));
  }

  /**
   * Get all cache entries (for schedule change detection)
   */
  public getAllEntries(): LaunchCacheEntry[] {
    try {
      const data = localStorage.getItem(this.STORAGE_KEY);
      return data ? JSON.parse(data) : [];
    } catch (error) {
      console.error('Failed to load launch database:', error);
      return [];
    }
  }

  private saveAllEntries(entries: LaunchCacheEntry[]): void {
    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(entries));
    } catch (error) {
      console.error('Failed to save launch database:', error);
    }
  }

  private getMetadata(): DatabaseMetadata {
    try {
      const data = localStorage.getItem(this.METADATA_KEY);
      return data ? JSON.parse(data) : {
        lastFullScan: 0,
        totalLaunches: 0,
        version: this.VERSION,
        sources: []
      };
    } catch (error) {
      console.error('Failed to load database metadata:', error);
      return {
        lastFullScan: 0,
        totalLaunches: 0,
        version: this.VERSION,
        sources: []
      };
    }
  }

  private updateMetadata(): void {
    const entries = this.getAllEntries();
    const sourceSet = new Set(entries.map(entry => entry.sourceUrl));
    const sources = Array.from(sourceSet);
    
    const metadata: DatabaseMetadata = {
      lastFullScan: Date.now(),
      totalLaunches: entries.length,
      version: this.VERSION,
      sources
    };

    try {
      localStorage.setItem(this.METADATA_KEY, JSON.stringify(metadata));
    } catch (error) {
      console.error('Failed to save database metadata:', error);
    }
  }
}

// Export singleton instance
export const launchDatabase = new LaunchDatabase();