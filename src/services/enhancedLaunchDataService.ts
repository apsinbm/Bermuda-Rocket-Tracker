/**
 * Enhanced Launch Data Service with Robust Error Handling
 * Uses the error handling service for network failures, API rate limits, and other issues
 */

import { Launch } from '../types';
import { errorHandlingService, EnhancedError, ErrorType } from './errorHandlingService';
import { LaunchUpdateManager, getRefreshInterval, getUrgencyLevel } from './launchUpdateScheduler';

interface LaunchCache {
  data: Launch[];
  lastFetch: number;
  nextScheduledUpdate: number;
  failureCount: number;
  lastFailure?: number;
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

interface ServiceHealth {
  status: 'healthy' | 'degraded' | 'unhealthy';
  lastSuccessfulFetch: number;
  consecutiveFailures: number;
  errorRate: number;
  message: string;
}

export class EnhancedLaunchDataService {
  private cache: LaunchCache = {
    data: [],
    lastFetch: 0,
    nextScheduledUpdate: 0,
    failureCount: 0
  };
  
  private updateManager: LaunchUpdateManager;
  private isUpdating: boolean = false;
  private subscribers: Array<(launches: Launch[]) => void> = [];
  private errorSubscribers: Array<(error: EnhancedError) => void> = [];
  private healthCheckInterval?: NodeJS.Timeout;
  
  constructor() {
    this.updateManager = new LaunchUpdateManager(this.updateLaunchData.bind(this));
    this.startPeriodicUpdates();
    this.startHealthMonitoring();
  }
  
  /**
   * Subscribe to launch data updates
   */
  subscribe(callback: (launches: Launch[]) => void): () => void {
    this.subscribers.push(callback);
    
    return () => {
      const index = this.subscribers.indexOf(callback);
      if (index > -1) {
        this.subscribers.splice(index, 1);
      }
    };
  }
  
  /**
   * Subscribe to error notifications
   */
  subscribeToErrors(callback: (error: EnhancedError) => void): () => void {
    this.errorSubscribers.push(callback);
    
    return () => {
      const index = this.errorSubscribers.indexOf(callback);
      if (index > -1) {
        this.errorSubscribers.splice(index, 1);
      }
    };
  }
  
  /**
   * Notify all subscribers of data changes
   */
  private notifySubscribers(): void {
    this.subscribers.forEach(callback => {
      try {
        callback([...this.cache.data]);
      } catch (error) {
        console.error('Error in subscriber callback:', error);
      }
    });
  }
  
  /**
   * Notify error subscribers
   */
  private notifyErrorSubscribers(error: EnhancedError): void {
    this.errorSubscribers.forEach(callback => {
      try {
        callback(error);
      } catch (err) {
        console.error('Error in error subscriber callback:', err);
      }
    });
  }
  
  /**
   * Get current launch data with intelligent fallback
   */
  async getLaunches(): Promise<Launch[]> {
    // Return cached data if available and not stale
    if (this.cache.data.length > 0 && !this.shouldRefreshCache()) {
      return [...this.cache.data];
    }
    
    try {
      await this.fetchLaunches();
      return [...this.cache.data];
    } catch (error) {
      // If we have cached data, return it even if refresh failed
      if (this.cache.data.length > 0) {
        console.warn('Using cached data due to fetch failure:', error instanceof EnhancedError ? error.userFriendlyMessage : error);
        return [...this.cache.data];
      }
      
      // No cached data available
      if (error instanceof EnhancedError) {
        this.notifyErrorSubscribers(error);
        throw error;
      }
      
      const enhancedError = new EnhancedError(errorHandlingService.classifyError(error));
      this.notifyErrorSubscribers(enhancedError);
      throw enhancedError;
    }
  }
  
  /**
   * Check if cache should be refreshed with adaptive logic
   */
  private shouldRefreshCache(): boolean {
    const now = new Date().getTime();
    
    // Don't refresh too frequently after failures
    if (this.cache.lastFailure && (now - this.cache.lastFailure) < this.getBackoffDelay()) {
      return false;
    }
    
    const cacheAge = now - this.cache.lastFetch;
    
    // Adaptive cache expiry based on failure count
    const baseThreshold = 5 * 60 * 1000; // 5 minutes
    const failureMultiplier = Math.min(this.cache.failureCount, 5);
    const threshold = baseThreshold * (1 + failureMultiplier * 0.5);
    
    return cacheAge > threshold;
  }
  
  /**
   * Get backoff delay based on failure count
   */
  private getBackoffDelay(): number {
    const baseDelay = 30 * 1000; // 30 seconds
    const maxDelay = 10 * 60 * 1000; // 10 minutes
    const delay = baseDelay * Math.pow(2, Math.min(this.cache.failureCount, 8));
    return Math.min(delay, maxDelay);
  }
  
  /**
   * Fetch launches with enhanced error handling
   */
  private async fetchLaunches(): Promise<void> {
    if (this.isUpdating) return;
    
    this.isUpdating = true;
    
    try {
      const response = await errorHandlingService.enhancedFetch(
        'https://ll.thespacedevs.com/2.2.0/launch/upcoming/?format=json&limit=20&location__ids=27,12',
        {
          timeout: 15000,
          headers: {
            'Cache-Control': 'no-cache',
            'User-Agent': 'BermudaRocketTracker/1.0',
            'Accept': 'application/json'
          }
        },
        {
          maxRetries: 3,
          baseDelay: 2000,
          maxDelay: 30000
        }
      );
      
      const data = await response.json();
      
      if (!data.results || !Array.isArray(data.results)) {
        throw new Error('Invalid API response format');
      }
      
      const launches: Launch[] = data.results.map(this.mapLaunchData).filter(Boolean);
      
      // Filter for Florida launches only
      const floridaLaunches = launches.filter(this.isFloridaLaunch);
      
      this.cache = {
        data: floridaLaunches,
        lastFetch: new Date().getTime(),
        nextScheduledUpdate: new Date().getTime() + (12 * 60 * 60 * 1000),
        failureCount: 0 // Reset failure count on success
      };
      
      // Schedule dynamic updates for each launch
      this.scheduleLaunchUpdates();
      
      // Notify subscribers
      this.notifySubscribers();
      
      if (process.env.NODE_ENV === 'development') {
        console.log(`[EnhancedLaunchDataService] Updated ${floridaLaunches.length} Florida launches`);
      }
      
    } catch (error) {
      this.cache.failureCount++;
      this.cache.lastFailure = new Date().getTime();
      
      if (error instanceof EnhancedError) {
        console.error('[EnhancedLaunchDataService] Enhanced error:', error.userFriendlyMessage);
        throw error;
      }
      
      const enhancedError = new EnhancedError(errorHandlingService.classifyError(error));
      console.error('[EnhancedLaunchDataService] Fetch failed:', enhancedError.userFriendlyMessage);
      throw enhancedError;
    } finally {
      this.isUpdating = false;
    }
  }
  
  /**
   * Map raw API data to Launch type with validation
   */
  private mapLaunchData = (launch: any): Launch | null => {
    try {
      if (!launch.id || !launch.name) {
        console.warn('Skipping launch with missing required fields:', launch.id);
        return null;
      }
      
      return {
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
          latitude: launch.pad?.latitude,
          longitude: launch.pad?.longitude,
          location: {
            name: launch.pad?.location?.name || 'Unknown Location',
            latitude: launch.pad?.location?.latitude,
            longitude: launch.pad?.location?.longitude
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
      };
    } catch (error) {
      console.warn('Error mapping launch data:', error, launch);
      return null;
    }
  };
  
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
   * Update specific launch data with enhanced error handling
   */
  private async updateLaunchData(launchId: string): Promise<void> {
    try {
      const response = await errorHandlingService.enhancedFetch(
        `https://ll.thespacedevs.com/2.2.0/launch/${launchId}/?format=json`,
        {
          timeout: 10000,
          headers: {
            'Cache-Control': 'no-cache',
            'User-Agent': 'BermudaRocketTracker/1.0',
            'Accept': 'application/json'
          }
        },
        {
          maxRetries: 2,
          baseDelay: 1000,
          maxDelay: 15000
        }
      );
      
      const launchData = await response.json();
      const updatedLaunch = this.mapLaunchData(launchData);
      
      if (!updatedLaunch) {
        throw new Error(`Invalid launch data received for ${launchId}`);
      }
      
      // Update the specific launch in cache
      const launchIndex = this.cache.data.findIndex(l => l.id === launchId);
      if (launchIndex !== -1) {
        this.cache.data[launchIndex] = updatedLaunch;
        
        // Notify subscribers
        this.notifySubscribers();
        
        if (process.env.NODE_ENV === 'development') {
          console.log(`[EnhancedLaunchDataService] Updated launch ${launchId}: ${updatedLaunch.name}`);
        }
      }
      
    } catch (error) {
      const enhancedError = error instanceof EnhancedError 
        ? error 
        : new EnhancedError(errorHandlingService.classifyError(error));
        
      console.error(`[EnhancedLaunchDataService] Failed to update launch ${launchId}:`, enhancedError.userFriendlyMessage);
      
      // Don't propagate individual launch update errors to avoid disrupting the service
      // Just log them and continue
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
   * Start periodic background updates with circuit breaker pattern
   */
  private startPeriodicUpdates(): void {
    // Initial fetch
    this.fetchLaunches().catch(error => {
      console.warn('Initial fetch failed:', error instanceof EnhancedError ? error.userFriendlyMessage : error);
    });
    
    // Set up periodic refresh with adaptive timing
    const checkInterval = 60 * 1000; // Check every minute
    setInterval(() => {
      if (this.shouldRefreshCache()) {
        this.fetchLaunches().catch(error => {
          // Errors are already logged and handled in fetchLaunches
        });
      }
    }, checkInterval);
  }
  
  /**
   * Start health monitoring
   */
  private startHealthMonitoring(): void {
    this.healthCheckInterval = setInterval(() => {
      const health = this.getHealthStatus();
      
      if (health.status === 'unhealthy' && process.env.NODE_ENV === 'development') {
        console.warn(`[EnhancedLaunchDataService] Service health: ${health.status} - ${health.message}`);
      }
    }, 5 * 60 * 1000); // Check every 5 minutes
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
   * Get service health status
   */
  getHealthStatus(): ServiceHealth {
    const now = new Date().getTime();
    const timeSinceLastSuccess = now - this.cache.lastFetch;
    const errorMetrics = errorHandlingService.getMetrics();
    
    let status: ServiceHealth['status'];
    let message: string;
    
    if (this.cache.failureCount === 0 && timeSinceLastSuccess < 30 * 60 * 1000) {
      status = 'healthy';
      message = 'Service is operating normally';
    } else if (this.cache.failureCount < 3 && timeSinceLastSuccess < 60 * 60 * 1000) {
      status = 'degraded';
      message = 'Service is experiencing intermittent issues';
    } else {
      status = 'unhealthy';
      message = 'Service is experiencing significant issues';
    }
    
    const errorRate = errorMetrics.totalErrors > 0 
      ? errorMetrics.totalErrors / (errorMetrics.totalErrors + errorMetrics.successfulRetries)
      : 0;
    
    return {
      status,
      lastSuccessfulFetch: this.cache.lastFetch,
      consecutiveFailures: this.cache.failureCount,
      errorRate,
      message
    };
  }
  
  /**
   * Force immediate update of all launches
   */
  async forceRefresh(): Promise<void> {
    // Reset failure count to allow immediate retry
    this.cache.failureCount = 0;
    delete this.cache.lastFailure;
    
    await this.fetchLaunches();
  }
  
  /**
   * Force immediate update of specific launch
   */
  async forceUpdateLaunch(launchId: string): Promise<void> {
    await this.updateManager.forceUpdate(launchId);
  }
  
  /**
   * Get comprehensive service metrics
   */
  getMetrics() {
    return {
      cache: { ...this.cache },
      health: this.getHealthStatus(),
      errorHandling: errorHandlingService.getMetrics(),
      scheduler: this.updateManager.getScheduleStatus()
    };
  }
  
  /**
   * Clean up resources
   */
  destroy(): void {
    this.updateManager.clearAllSchedules();
    this.subscribers = [];
    this.errorSubscribers = [];
    
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }
  }
}

// Export singleton instance
export const enhancedLaunchDataService = new EnhancedLaunchDataService();