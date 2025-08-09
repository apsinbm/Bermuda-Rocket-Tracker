/**
 * Optimized Dynamic Launch Update Scheduler
 * Performance improvements over the base scheduler
 */

export interface RefreshSchedule {
  interval: number; // milliseconds
  description: string;
  phase: string;
}

export interface LaunchUpdateOptions {
  enableLogging?: boolean;
  maxRetries?: number;
  backoffMultiplier?: number;
  batchUpdateThreshold?: number;
}

/**
 * Get refresh interval based on time until launch
 */
export function getRefreshInterval(timeUntilLaunch: number): RefreshSchedule {
  const minutes = Math.floor(timeUntilLaunch / (1000 * 60));
  const hours = Math.floor(minutes / 60);
  
  // Critical countdown phase - every 30 seconds
  if (minutes <= 2) {
    return {
      interval: 30 * 1000,
      description: 'Critical countdown - T-2 minutes',
      phase: 'critical'
    };
  }
  
  // Final approach - every minute
  if (minutes <= 8) {
    return {
      interval: 60 * 1000,
      description: 'Final approach - T-8 minutes',
      phase: 'final'
    };
  }
  
  // Pre-launch checks - every 2 minutes
  if (minutes <= 15) {
    return {
      interval: 2 * 60 * 1000,
      description: 'Pre-launch checks - T-15 minutes',
      phase: 'prelaunch'
    };
  }
  
  // Launch imminent - every 5 minutes
  if (minutes <= 30) {
    return {
      interval: 5 * 60 * 1000,
      description: 'Launch imminent - T-30 minutes',
      phase: 'imminent'
    };
  }
  
  // Final hour - every 10 minutes
  if (minutes <= 60) {
    return {
      interval: 10 * 60 * 1000,
      description: 'Final countdown hour - T-1 hour',
      phase: 'countdown'
    };
  }
  
  // Launch day active - every 30 minutes
  if (hours <= 6) {
    return {
      interval: 30 * 60 * 1000,
      description: 'Launch day active - T-6 hours',
      phase: 'active'
    };
  }
  
  // Launch day monitoring - every hour
  if (hours <= 12) {
    return {
      interval: 60 * 60 * 1000,
      description: 'Launch day monitoring - T-12 hours',
      phase: 'monitoring'
    };
  }
  
  // Launch preparation - every 6 hours
  if (hours <= 24) {
    return {
      interval: 6 * 60 * 60 * 1000,
      description: 'Launch preparation - T-24 hours',
      phase: 'preparation'
    };
  }
  
  // Standard monitoring - every 12 hours
  return {
    interval: 12 * 60 * 60 * 1000,
    description: 'Standard monitoring - >24 hours',
    phase: 'standard'
  };
}

interface LaunchScheduleInfo {
  id: string;
  launchTime: string;
  timer?: NodeJS.Timeout;
  lastUpdate: number;
  retryCount: number;
  isUpdating: boolean;
}

/**
 * Optimized Launch Update Manager
 * Improvements: batching, debouncing, error recovery, memory management
 */
export class OptimizedLaunchUpdateManager {
  private launches: Map<string, LaunchScheduleInfo> = new Map();
  private updateCallback: (launchIds: string[]) => Promise<void>;
  private options: Required<LaunchUpdateOptions>;
  private batchTimer?: NodeJS.Timeout;
  private pendingUpdates: Set<string> = new Set();
  
  constructor(
    updateCallback: (launchIds: string[]) => Promise<void>,
    options: LaunchUpdateOptions = {}
  ) {
    this.updateCallback = updateCallback;
    this.options = {
      enableLogging: options.enableLogging ?? false,
      maxRetries: options.maxRetries ?? 3,
      backoffMultiplier: options.backoffMultiplier ?? 2,
      batchUpdateThreshold: options.batchUpdateThreshold ?? 100 // ms
    };
  }
  
  /**
   * Schedule updates for a specific launch with optimization
   */
  scheduleLaunchUpdates(launchId: string, launchTime: string): void {
    // Clear existing schedule
    this.clearSchedule(launchId);
    
    // Initialize launch info
    this.launches.set(launchId, {
      id: launchId,
      launchTime,
      lastUpdate: 0,
      retryCount: 0,
      isUpdating: false
    });
    
    // Start the optimized update cycle
    this.scheduleNextUpdate(launchId);
  }
  
  /**
   * Schedule the next update for a launch
   */
  private scheduleNextUpdate(launchId: string): void {
    const launchInfo = this.launches.get(launchId);
    if (!launchInfo) return;
    
    const now = new Date().getTime();
    const launch = new Date(launchInfo.launchTime).getTime();
    const timeUntilLaunch = launch - now;
    
    // Clean up completed launches (30 minutes after launch)
    if (timeUntilLaunch < -30 * 60 * 1000) {
      this.clearSchedule(launchId);
      return;
    }
    
    const schedule = getRefreshInterval(timeUntilLaunch);
    
    // Apply exponential backoff for failed updates
    const backoffInterval = schedule.interval * Math.pow(
      this.options.backoffMultiplier, 
      launchInfo.retryCount
    );
    
    if (this.options.enableLogging) {
      console.log(`[${launchId}] Next update in ${backoffInterval/1000}s - ${schedule.description}${launchInfo.retryCount > 0 ? ` (retry ${launchInfo.retryCount})` : ''}`);
    }
    
    // Schedule next update
    const timer = setTimeout(() => {
      this.triggerUpdate(launchId);
    }, backoffInterval);
    
    launchInfo.timer = timer;
  }
  
  /**
   * Trigger update with batching optimization
   */
  private triggerUpdate(launchId: string): void {
    const launchInfo = this.launches.get(launchId);
    if (!launchInfo || launchInfo.isUpdating) return;
    
    // Add to pending updates for batching
    this.pendingUpdates.add(launchId);
    
    // Clear existing batch timer
    if (this.batchTimer) {
      clearTimeout(this.batchTimer);
    }
    
    // Set batch timer
    this.batchTimer = setTimeout(() => {
      this.processBatchedUpdates();
    }, this.options.batchUpdateThreshold);
  }
  
  /**
   * Process all pending updates in a batch
   */
  private async processBatchedUpdates(): Promise<void> {
    if (this.pendingUpdates.size === 0) return;
    
    const launchIds = Array.from(this.pendingUpdates);
    this.pendingUpdates.clear();
    
    // Mark launches as updating
    launchIds.forEach(id => {
      const launch = this.launches.get(id);
      if (launch) {
        launch.isUpdating = true;
      }
    });
    
    try {
      await this.updateCallback(launchIds);
      
      // Reset retry counts and schedule next updates
      launchIds.forEach(id => {
        const launch = this.launches.get(id);
        if (launch) {
          launch.lastUpdate = new Date().getTime();
          launch.retryCount = 0;
          launch.isUpdating = false;
          this.scheduleNextUpdate(id);
        }
      });
      
    } catch (error) {
      if (this.options.enableLogging) {
        console.error(`Failed to update launches [${launchIds.join(', ')}]:`, error);
      }
      
      // Handle retry logic
      launchIds.forEach(id => {
        const launch = this.launches.get(id);
        if (launch) {
          launch.retryCount++;
          launch.isUpdating = false;
          
          // Only retry if under max retry limit
          if (launch.retryCount <= this.options.maxRetries) {
            this.scheduleNextUpdate(id);
          } else {
            if (this.options.enableLogging) {
              console.error(`Launch ${id} exceeded max retries, stopping updates`);
            }
            this.clearSchedule(id);
          }
        }
      });
    }
  }
  
  /**
   * Schedule updates for multiple launches
   */
  scheduleAllLaunches(launches: Array<{id: string, net: string}>): void {
    // Clear all existing schedules first
    this.clearAllSchedules();
    
    // Schedule each launch
    launches.forEach(launch => {
      this.scheduleLaunchUpdates(launch.id, launch.net);
    });
  }
  
  /**
   * Clear schedule for specific launch
   */
  clearSchedule(launchId: string): void {
    const launchInfo = this.launches.get(launchId);
    if (launchInfo?.timer) {
      clearTimeout(launchInfo.timer);
    }
    this.launches.delete(launchId);
    this.pendingUpdates.delete(launchId);
  }
  
  /**
   * Clear all schedules and pending operations
   */
  clearAllSchedules(): void {
    // Clear all timers
    this.launches.forEach((launch) => {
      if (launch.timer) {
        clearTimeout(launch.timer);
      }
    });
    
    // Clear batch timer
    if (this.batchTimer) {
      clearTimeout(this.batchTimer);
      this.batchTimer = undefined;
    }
    
    // Clear all data structures
    this.launches.clear();
    this.pendingUpdates.clear();
  }
  
  /**
   * Force immediate update for specific launch
   */
  async forceUpdate(launchId: string): Promise<void> {
    const launchInfo = this.launches.get(launchId);
    if (!launchInfo) return;
    
    // Reset retry count for forced updates
    launchInfo.retryCount = 0;
    
    // Add to pending updates
    this.pendingUpdates.add(launchId);
    
    // Process immediately without batching delay
    await this.processBatchedUpdates();
  }
  
  /**
   * Get time until next update for a launch
   */
  getTimeUntilNextUpdate(launchId: string, launchTime: string): number {
    const launchInfo = this.launches.get(launchId);
    if (!launchInfo) return 0;
    
    const now = new Date().getTime();
    const launch = new Date(launchTime).getTime();
    const timeUntilLaunch = launch - now;
    const schedule = getRefreshInterval(timeUntilLaunch);
    
    const timeSinceLastUpdate = now - launchInfo.lastUpdate;
    const backoffInterval = schedule.interval * Math.pow(
      this.options.backoffMultiplier, 
      launchInfo.retryCount
    );
    
    return Math.max(0, backoffInterval - timeSinceLastUpdate);
  }
  
  /**
   * Get performance metrics
   */
  getMetrics(): {
    activeLaunches: number;
    pendingUpdates: number;
    totalRetries: number;
    averageRetryCount: number;
  } {
    const launches = Array.from(this.launches.values());
    const totalRetries = launches.reduce((sum, launch) => sum + launch.retryCount, 0);
    
    return {
      activeLaunches: this.launches.size,
      pendingUpdates: this.pendingUpdates.size,
      totalRetries,
      averageRetryCount: launches.length > 0 ? totalRetries / launches.length : 0
    };
  }
}

/**
 * Get urgency level for UI indicators
 */
export function getUrgencyLevel(timeUntilLaunch: number): 'low' | 'medium' | 'high' | 'critical' {
  const minutes = Math.floor(timeUntilLaunch / (1000 * 60));
  
  if (minutes <= 15) return 'critical';
  if (minutes <= 60) return 'high';
  if (minutes <= 360) return 'medium'; // 6 hours
  return 'low';
}

/**
 * Format refresh status for display
 */
export function formatRefreshStatus(schedule: RefreshSchedule, nextUpdate: number): string {
  const nextUpdateMinutes = Math.floor(nextUpdate / (1000 * 60));
  const nextUpdateSeconds = Math.floor((nextUpdate % (1000 * 60)) / 1000);
  
  if (nextUpdateMinutes > 0) {
    return `Next update in ${nextUpdateMinutes}m ${nextUpdateSeconds}s`;
  } else {
    return `Next update in ${nextUpdateSeconds}s`;
  }
}