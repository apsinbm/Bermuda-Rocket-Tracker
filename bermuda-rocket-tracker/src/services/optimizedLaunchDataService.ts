/**
 * Optimized Launch Data Service with Performance Improvements
 * - Batched API calls
 * - Request deduplication  
 * - Better error handling
 * - Memory management
 */

import { Launch } from '../types';
import { OptimizedLaunchUpdateManager, getRefreshInterval, getUrgencyLevel } from './optimizedLaunchUpdateScheduler';

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

interface ApiMetrics {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  averageResponseTime: number;
  lastError?: string;
}

export class OptimizedLaunchDataService {
  private cache: LaunchCache = {
    data: [],
    lastFetch: 0,
    nextScheduledUpdate: 0
  };
  
  private updateManager: OptimizedLaunchUpdateManager;
  private isUpdating: boolean = false;
  private subscribers: Array<(launches: Launch[]) => void> = [];
  private pendingRequests: Map<string, Promise<any>> = new Map();
  private metrics: ApiMetrics = {
    totalRequests: 0,
    successfulRequests: 0,
    failedRequests: 0,
    averageResponseTime: 0
  };
  private responseTimes: number[] = [];
  
  constructor() {
    this.updateManager = new OptimizedLaunchUpdateManager(
      this.batchUpdateLaunches.bind(this),
      {
        enableLogging: process.env.NODE_ENV === 'development',
        maxRetries: 3,
        backoffMultiplier: 1.5,
        batchUpdateThreshold: 200 // 200ms batching window
      }
    );
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
   * Notify all subscribers of data changes (debounced)
   */
  private notifySubscribers = this.debounce((): void => {
    this.subscribers.forEach(callback => callback([...this.cache.data]));
  }, 100);
  
  /**
   * Debounce helper function
   */
  private debounce<T extends (...args: any[]) => any>(
    func: T,
    delay: number
  ): (...args: Parameters<T>) => void {
    let timeoutId: NodeJS.Timeout;
    return (...args: Parameters<T>) => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => func(...args), delay);
    };
  }
  
  /**
   * Get current launch data with intelligent caching
   */
  async getLaunches(): Promise<Launch[]> {
    if (this.cache.data.length === 0 || this.shouldRefreshCache()) {
      await this.fetchAllLaunches();
    }
    
    return [...this.cache.data]; // Return copy to prevent mutations
  }
  
  /**
   * Check if cache should be refreshed with adaptive logic
   */
  private shouldRefreshCache(): boolean {
    const now = new Date().getTime();
    const cacheAge = now - this.cache.lastFetch;
    
    // Adaptive cache expiry based on upcoming launch urgency
    const upcomingLaunch = this.cache.data
      .map(launch => new Date(launch.net).getTime() - now)
      .filter(time => time > 0)
      .sort((a, b) => a - b)[0];
    
    if (upcomingLaunch) {
      const urgency = getUrgencyLevel(upcomingLaunch);
      const cacheThresholds = {
        critical: 1 * 60 * 1000,    // 1 minute
        high: 5 * 60 * 1000,       // 5 minutes
        medium: 15 * 60 * 1000,    // 15 minutes
        low: 30 * 60 * 1000        // 30 minutes
      };
      
      return cacheAge > cacheThresholds[urgency];
    }
    
    // Default: refresh if cache is older than 30 minutes
    return cacheAge > 30 * 60 * 1000;
  }
  
  /**
   * Fetch all launches with improved error handling and deduplication
   */
  private async fetchAllLaunches(): Promise<void> {
    const requestKey = 'fetchAllLaunches';
    
    // Return existing request if in progress
    if (this.pendingRequests.has(requestKey)) {
      return this.pendingRequests.get(requestKey);
    }
    
    if (this.isUpdating) return;
    
    const requestPromise = this.performLaunchFetch();
    this.pendingRequests.set(requestKey, requestPromise);
    
    try {
      await requestPromise;
    } finally {
      this.pendingRequests.delete(requestKey);
    }
  }
  
  /**
   * Perform the actual launch fetch with metrics tracking
   */
  private async performLaunchFetch(): Promise<void> {
    this.isUpdating = true;
    const startTime = Date.now();
    
    try {
      this.metrics.totalRequests++;
      
      const response = await fetch(
        'https://ll.thespacedevs.com/2.2.0/launch/upcoming/?format=json&limit=20&location__ids=27,12',
        {
          headers: {
            'Cache-Control': 'no-cache',
            'User-Agent': 'BermudaRocketTracker/1.0'
          }
        }
      );
      
      if (!response.ok) {
        throw new Error(`Launch Library API error: ${response.status} ${response.statusText}`);
      }
      
      const data = await response.json();
      const launches: Launch[] = data.results.map(this.mapLaunchData);
      
      // Filter for Florida launches only
      const floridaLaunches = launches.filter(this.isFloridaLaunch);
      
      this.cache = {
        data: floridaLaunches,
        lastFetch: new Date().getTime(),
        nextScheduledUpdate: new Date().getTime() + (12 * 60 * 60 * 1000) // 12 hours default
      };
      
      // Schedule dynamic updates for each launch
      this.scheduleLaunchUpdates();
      
      // Track metrics
      const responseTime = Date.now() - startTime;
      this.updateMetrics(responseTime, true);
      
      // Notify subscribers
      this.notifySubscribers();
      
      if (process.env.NODE_ENV === 'development') {
        console.log(`[OptimizedLaunchDataService] Updated ${floridaLaunches.length} Florida launches in ${responseTime}ms`);
      }
      
    } catch (error) {
      const responseTime = Date.now() - startTime;
      this.updateMetrics(responseTime, false, error instanceof Error ? error.message : 'Unknown error');
      
      console.error('[OptimizedLaunchDataService] Failed to fetch launches:', error);
      throw error;
    } finally {
      this.isUpdating = false;
    }
  }
  
  /**
   * Update performance metrics
   */
  private updateMetrics(responseTime: number, success: boolean, error?: string): void {
    this.responseTimes.push(responseTime);
    
    // Keep only last 100 response times for rolling average
    if (this.responseTimes.length > 100) {
      this.responseTimes.shift();
    }
    
    this.metrics.averageResponseTime = 
      this.responseTimes.reduce((sum, time) => sum + time, 0) / this.responseTimes.length;
    
    if (success) {
      this.metrics.successfulRequests++;
    } else {
      this.metrics.failedRequests++;
      this.metrics.lastError = error;
    }
  }
  
  /**
   * Map raw API data to Launch type
   */
  private mapLaunchData = (launch: any): Launch => ({
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
  });
  
  /**
   * Check if launch is from Florida
   */
  private isFloridaLaunch = (launch: Launch): boolean => {
    const location = launch.pad.location.name.toLowerCase();
    return location.includes('florida') ||
           location.includes('cape canaveral') ||
           location.includes('kennedy');
  };
  
  /**
   * Batched update for multiple launches (optimization)
   */
  private async batchUpdateLaunches(launchIds: string[]): Promise<void> {
    if (launchIds.length === 0) return;
    
    try {
      // For small batches, use individual requests
      if (launchIds.length <= 3) {
        await Promise.allSettled(
          launchIds.map(id => this.updateSingleLaunch(id))
        );
        return;
      }
      
      // For larger batches, consider if we should refetch all data
      // This is more efficient than many individual API calls
      await this.fetchAllLaunches();
      
    } catch (error) {
      console.error('[OptimizedLaunchDataService] Batch update failed:', error);
      throw error;
    }
  }
  
  /**
   * Update specific launch data with deduplication
   */
  private async updateSingleLaunch(launchId: string): Promise<void> {
    const requestKey = `updateLaunch-${launchId}`;
    
    // Return existing request if in progress
    if (this.pendingRequests.has(requestKey)) {
      return this.pendingRequests.get(requestKey);
    }
    
    const requestPromise = this.performSingleLaunchUpdate(launchId);
    this.pendingRequests.set(requestKey, requestPromise);
    
    try {
      await requestPromise;
    } finally {
      this.pendingRequests.delete(requestKey);
    }
  }
  
  /**
   * Perform single launch update
   */
  private async performSingleLaunchUpdate(launchId: string): Promise<void> {
    const startTime = Date.now();
    
    try {
      this.metrics.totalRequests++;
      
      const response = await fetch(
        `https://ll.thespacedevs.com/2.2.0/launch/${launchId}/?format=json`,
        {
          headers: {
            'Cache-Control': 'no-cache',
            'User-Agent': 'BermudaRocketTracker/1.0'
          }
        }
      );
      
      if (!response.ok) {
        throw new Error(`Launch Library API error: ${response.status} ${response.statusText}`);
      }
      
      const launchData = await response.json();
      const updatedLaunch = this.mapLaunchData(launchData);
      
      // Update the specific launch in cache
      const launchIndex = this.cache.data.findIndex(l => l.id === launchId);
      if (launchIndex !== -1) {
        this.cache.data[launchIndex] = updatedLaunch;
        
        // Track metrics
        const responseTime = Date.now() - startTime;
        this.updateMetrics(responseTime, true);
        
        // Notify subscribers
        this.notifySubscribers();
        
        if (process.env.NODE_ENV === 'development') {
          console.log(`[OptimizedLaunchDataService] Updated launch ${launchId}: ${updatedLaunch.name} in ${responseTime}ms`);
        }
      }
      
    } catch (error) {
      const responseTime = Date.now() - startTime;
      this.updateMetrics(responseTime, false, error instanceof Error ? error.message : 'Unknown error');
      
      console.error(`[OptimizedLaunchDataService] Failed to update launch ${launchId}:`, error);
      throw error;
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
   * Start periodic background updates with adaptive timing
   */
  private startPeriodicUpdates(): void {
    // Initial fetch
    this.fetchAllLaunches();
    
    // Set up adaptive refresh check
    const checkInterval = 30 * 1000; // Check every 30 seconds
    setInterval(() => {
      if (this.shouldRefreshCache()) {
        this.fetchAllLaunches();
      }
    }, checkInterval);
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
    await this.fetchAllLaunches();
  }
  
  /**
   * Force immediate update of specific launch
   */
  async forceUpdateLaunch(launchId: string): Promise<void> {
    await this.updateManager.forceUpdate(launchId);
  }
  
  /**
   * Get performance metrics
   */
  getMetrics(): ApiMetrics & {
    cacheAge: number;
    schedulerMetrics: ReturnType<OptimizedLaunchUpdateManager['getMetrics']>;
  } {
    return {
      ...this.metrics,
      cacheAge: Date.now() - this.cache.lastFetch,
      schedulerMetrics: this.updateManager.getMetrics()
    };
  }
  
  /**
   * Clean up resources
   */
  destroy(): void {
    this.updateManager.clearAllSchedules();
    this.subscribers = [];
    this.pendingRequests.clear();
  }
}

// Export singleton instance
export const optimizedLaunchDataService = new OptimizedLaunchDataService();