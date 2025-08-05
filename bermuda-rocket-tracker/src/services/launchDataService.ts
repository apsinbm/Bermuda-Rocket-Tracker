/**
 * Launch Data Service with Dynamic Updates
 * Handles fetching and caching launch data with automatic refresh scheduling
 */

import { Launch } from '../types';
import { LaunchUpdateManager, getRefreshInterval, getUrgencyLevel } from './launchUpdateScheduler';

interface LaunchCache {
  data: Launch[];
  lastFetch: number;
  nextScheduledUpdate: number;
}

interface LaunchStatus {
  id: string;
  name: string;
  launchTime: string;
  timeUntilLaunch: number;
  urgency: 'low' | 'medium' | 'high' | 'critical';
  refreshPhase: string;
  nextUpdate: number;
  lastUpdated: number;
}

export class LaunchDataService {
  private cache: LaunchCache = {
    data: [],
    lastFetch: 0,
    nextScheduledUpdate: 0
  };
  
  private updateManager: LaunchUpdateManager;
  private isUpdating: boolean = false;
  private subscribers: Array<(launches: Launch[]) => void> = [];
  
  constructor() {
    this.updateManager = new LaunchUpdateManager(this.updateLaunchData.bind(this));
    this.startPeriodicUpdates();
  }
  
  /**
   * Subscribe to launch data updates
   */
  subscribe(callback: (launches: Launch[]) => void): () => void {
    this.subscribers.push(callback);
    
    // Return unsubscribe function
    return () => {
      const index = this.subscribers.indexOf(callback);
      if (index > -1) {
        this.subscribers.splice(index, 1);
      }
    };
  }
  
  /**
   * Notify all subscribers of data changes
   */
  private notifySubscribers(): void {
    this.subscribers.forEach(callback => callback(this.cache.data));
  }
  
  /**
   * Get current launch data
   */
  async getLaunches(): Promise<Launch[]> {
    if (this.cache.data.length === 0 || this.shouldRefreshCache()) {
      await this.fetchLaunches();
    }
    
    return this.cache.data;
  }
  
  /**
   * Check if cache should be refreshed
   */
  private shouldRefreshCache(): boolean {
    const now = new Date().getTime();
    const cacheAge = now - this.cache.lastFetch;
    
    // Refresh if cache is older than 5 minutes
    return cacheAge > 5 * 60 * 1000;
  }
  
  /**
   * Fetch launches from Launch Library API
   */
  private async fetchLaunches(): Promise<void> {
    if (this.isUpdating) return;
    
    this.isUpdating = true;
    
    try {
      console.log('[LaunchDataService] Fetching launch data...');
      
      const response = await fetch(
        'https://ll.thespacedevs.com/2.2.0/launch/upcoming/?format=json&limit=20&location__ids=27,12'
      );
      
      if (!response.ok) {
        throw new Error(`Launch Library API error: ${response.status}`);
      }
      
      const data = await response.json();
      const launches: Launch[] = data.results.map((launch: any) => ({
        id: launch.id,
        name: launch.name,
        mission: {
          name: launch.mission?.name || launch.name,
          description: launch.mission?.description || 'No description available',
          orbit: {
            name: launch.mission?.orbit?.name || 'Unknown'
          }
        },
        rocket: {
          name: launch.rocket?.configuration?.name || 'Unknown Rocket'
        },
        pad: {
          name: launch.pad?.name || 'Unknown Pad',
          location: {
            name: launch.pad?.location?.name || 'Unknown Location'
          }
        },
        net: launch.net,
        window_start: launch.window_start,
        window_end: launch.window_end,
        status: {
          name: launch.status?.name || 'Unknown',
          abbrev: launch.status?.abbrev || 'UNK'
        },
        image: launch.image,
        webcast_live: launch.webcast_live
      }));
      
      // Filter for Florida launches only
      const floridaLaunches = launches.filter(launch => 
        launch.pad.location.name.toLowerCase().includes('florida') ||
        launch.pad.location.name.toLowerCase().includes('cape canaveral') ||
        launch.pad.location.name.toLowerCase().includes('kennedy')
      );
      
      this.cache = {
        data: floridaLaunches,
        lastFetch: new Date().getTime(),
        nextScheduledUpdate: new Date().getTime() + (12 * 60 * 60 * 1000) // 12 hours default
      };
      
      // Schedule dynamic updates for each launch
      this.scheduleLaunchUpdates();
      
      // Notify subscribers
      this.notifySubscribers();
      
      console.log(`[LaunchDataService] Updated ${floridaLaunches.length} Florida launches`);
      
    } catch (error) {
      console.error('[LaunchDataService] Failed to fetch launches:', error);
    } finally {
      this.isUpdating = false;
    }
  }
  
  /**
   * Schedule dynamic updates for all launches
   */
  private scheduleLaunchUpdates(): void {
    const launchSchedule = this.cache.data.map(launch => ({
      id: launch.id,
      net: launch.net
    }));
    
    this.updateManager.scheduleAllLaunches(launchSchedule);
  }
  
  /**
   * Update specific launch data (called by scheduler)
   */
  private async updateLaunchData(launchId: string): Promise<void> {
    try {
      console.log(`[LaunchDataService] Updating launch ${launchId}...`);
      
      const response = await fetch(
        `https://ll.thespacedevs.com/2.2.0/launch/${launchId}/?format=json`
      );
      
      if (!response.ok) {
        throw new Error(`Launch Library API error: ${response.status}`);
      }
      
      const launchData = await response.json();
      
      // Update the specific launch in cache
      const launchIndex = this.cache.data.findIndex(l => l.id === launchId);
      if (launchIndex !== -1) {
        const updatedLaunch: Launch = {
          id: launchData.id,
          name: launchData.name,
          mission: {
            name: launchData.mission?.name || launchData.name,
            description: launchData.mission?.description || 'No description available',
            orbit: {
              name: launchData.mission?.orbit?.name || 'Unknown'
            }
          },
          rocket: {
            name: launchData.rocket?.configuration?.name || 'Unknown Rocket'
          },
          pad: {
            name: launchData.pad?.name || 'Unknown Pad',
            location: {
              name: launchData.pad?.location?.name || 'Unknown Location'
            }
          },
          net: launchData.net,
          window_start: launchData.window_start,
          window_end: launchData.window_end,
          status: {
            name: launchData.status?.name || 'Unknown',
            abbrev: launchData.status?.abbrev || 'UNK'
          },
          image: launchData.image,
          webcast_live: launchData.webcast_live
        };
        
        this.cache.data[launchIndex] = updatedLaunch;
        
        // Notify subscribers
        this.notifySubscribers();
        
        console.log(`[LaunchDataService] Updated launch ${launchId}: ${updatedLaunch.name}`);
      }
      
    } catch (error) {
      console.error(`[LaunchDataService] Failed to update launch ${launchId}:`, error);
    }
  }
  
  /**
   * Start periodic background updates
   */
  private startPeriodicUpdates(): void {
    // Initial fetch
    this.fetchLaunches();
    
    // Set up periodic refresh check every minute
    setInterval(() => {
      if (this.shouldRefreshCache()) {
        this.fetchLaunches();
      }
    }, 60 * 1000); // Check every minute
  }
  
  /**
   * Get launch status information for monitoring
   */
  getLaunchStatuses(): LaunchStatus[] {
    const now = new Date().getTime();
    
    return this.cache.data.map(launch => {
      const launchTime = new Date(launch.net).getTime();
      const timeUntilLaunch = launchTime - now;
      const schedule = getRefreshInterval(timeUntilLaunch);
      const nextUpdate = this.updateManager.getTimeUntilNextUpdate(launch.id, launch.net);
      
      return {
        id: launch.id,
        name: launch.name,
        launchTime: launch.net,
        timeUntilLaunch,
        urgency: getUrgencyLevel(timeUntilLaunch),
        refreshPhase: schedule.phase,
        nextUpdate,
        lastUpdated: this.cache.lastFetch
      };
    });
  }
  
  /**
   * Force immediate update of all launches
   */
  async forceRefresh(): Promise<void> {
    await this.fetchLaunches();
  }
  
  /**
   * Force immediate update of specific launch
   */
  async forceUpdateLaunch(launchId: string): Promise<void> {
    await this.updateManager.forceUpdate(launchId);
  }
  
  /**
   * Clean up resources
   */
  destroy(): void {
    this.updateManager.clearAllSchedules();
    this.subscribers = [];
  }
}

// Export singleton instance
export const launchDataService = new LaunchDataService();