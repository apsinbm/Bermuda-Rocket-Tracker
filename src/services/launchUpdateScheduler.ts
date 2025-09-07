/**
 * Dynamic Launch Update Scheduler
 * Automatically adjusts refresh frequency based on proximity to launch
 */

export interface RefreshSchedule {
  interval: number; // milliseconds
  description: string;
  phase: string;
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
      interval: 30 * 1000, // 30 seconds
      description: 'Critical countdown - T-2 minutes',
      phase: 'critical'
    };
  }
  
  // Final approach - every minute
  if (minutes <= 8) {
    return {
      interval: 60 * 1000, // 1 minute
      description: 'Final approach - T-8 minutes',
      phase: 'final'
    };
  }
  
  // Pre-launch checks - every 2 minutes
  if (minutes <= 15) {
    return {
      interval: 2 * 60 * 1000, // 2 minutes
      description: 'Pre-launch checks - T-15 minutes',
      phase: 'prelaunch'
    };
  }
  
  // Launch imminent - every 5 minutes
  if (minutes <= 30) {
    return {
      interval: 5 * 60 * 1000, // 5 minutes
      description: 'Launch imminent - T-30 minutes',
      phase: 'imminent'
    };
  }
  
  // Final hour - every 10 minutes
  if (minutes <= 60) {
    return {
      interval: 10 * 60 * 1000, // 10 minutes
      description: 'Final countdown hour - T-1 hour',
      phase: 'countdown'
    };
  }
  
  // Launch day active - every 30 minutes
  if (hours <= 6) {
    return {
      interval: 30 * 60 * 1000, // 30 minutes
      description: 'Launch day active - T-6 hours',
      phase: 'active'
    };
  }
  
  // Launch day monitoring - every hour
  if (hours <= 12) {
    return {
      interval: 60 * 60 * 1000, // 1 hour
      description: 'Launch day monitoring - T-12 hours',
      phase: 'monitoring'
    };
  }
  
  // Launch preparation - every 6 hours
  if (hours <= 24) {
    return {
      interval: 6 * 60 * 60 * 1000, // 6 hours
      description: 'Launch preparation - T-24 hours',
      phase: 'preparation'
    };
  }
  
  // Standard monitoring - every 12 hours
  return {
    interval: 12 * 60 * 60 * 1000, // 12 hours
    description: 'Standard monitoring - >24 hours',
    phase: 'standard'
  };
}

/**
 * Launch Update Manager
 * Handles dynamic scheduling and data refresh
 */
export class LaunchUpdateManager {
  private timers: Map<string, NodeJS.Timeout> = new Map();
  private lastUpdate: Map<string, number> = new Map();
  private updateCallback: (launchId: string) => Promise<void>;
  
  constructor(updateCallback: (launchId: string) => Promise<void>) {
    this.updateCallback = updateCallback;
  }
  
  /**
   * Schedule updates for a specific launch
   */
  scheduleLaunchUpdates(launchId: string, launchTime: string): void {
    // Clear existing timer
    this.clearSchedule(launchId);
    
    const updateSchedule = () => {
      const now = new Date().getTime();
      const launch = new Date(launchTime).getTime();
      const timeUntilLaunch = launch - now;
      
      // If launch has passed, stop scheduling
      if (timeUntilLaunch < -30 * 60 * 1000) { // 30 minutes after launch
        this.clearSchedule(launchId);
        return;
      }
      
      const schedule = getRefreshInterval(timeUntilLaunch);
      
      
      // Update the data
      this.updateCallback(launchId).catch(error => {
        console.error(`Failed to update launch ${launchId}:`, error);
      });
      
      // Schedule next update
      const timer = setTimeout(() => {
        updateSchedule();
      }, schedule.interval);
      
      this.timers.set(launchId, timer);
      this.lastUpdate.set(launchId, now);
    };
    
    // Start the update cycle
    updateSchedule();
  }
  
  /**
   * Schedule updates for multiple launches
   */
  scheduleAllLaunches(launches: Array<{id: string, net: string}>): void {
    launches.forEach(launch => {
      this.scheduleLaunchUpdates(launch.id, launch.net);
    });
  }
  
  /**
   * Clear schedule for specific launch
   */
  clearSchedule(launchId: string): void {
    const timer = this.timers.get(launchId);
    if (timer) {
      clearTimeout(timer);
      this.timers.delete(launchId);
    }
  }
  
  /**
   * Clear all schedules
   */
  clearAllSchedules(): void {
    this.timers.forEach((timer) => clearTimeout(timer));
    this.timers.clear();
    this.lastUpdate.clear();
  }
  
  /**
   * Get status of all scheduled updates
   */
  getScheduleStatus(): Array<{launchId: string, lastUpdate: number, phase: string}> {
    const status: Array<{launchId: string, lastUpdate: number, phase: string}> = [];
    
    this.lastUpdate.forEach((lastUpdate, launchId) => {
      // This would need access to launch time to determine phase
      status.push({
        launchId,
        lastUpdate,
        phase: 'unknown' // Would be calculated based on current time vs launch time
      });
    });
    
    return status;
  }
  
  /**
   * Force immediate update for specific launch
   */
  async forceUpdate(launchId: string): Promise<void> {
    await this.updateCallback(launchId);
    this.lastUpdate.set(launchId, new Date().getTime());
  }
  
  /**
   * Get time until next update for a launch
   */
  getTimeUntilNextUpdate(launchId: string, launchTime: string): number {
    const now = new Date().getTime();
    const launch = new Date(launchTime).getTime();
    const timeUntilLaunch = launch - now;
    const schedule = getRefreshInterval(timeUntilLaunch);
    
    const lastUpdate = this.lastUpdate.get(launchId);
    if (!lastUpdate) {
      // If never updated, use the schedule interval
      return schedule.interval;
    }
    
    const timeSinceLastUpdate = now - lastUpdate;
    return Math.max(0, schedule.interval - timeSinceLastUpdate);
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
  const totalSeconds = Math.floor(nextUpdate / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  
  if (hours > 0) {
    if (minutes > 0) {
      return `Next update in ${hours}h ${minutes}m`;
    } else {
      return `Next update in ${hours}h`;
    }
  } else if (minutes > 0) {
    if (seconds > 0 && minutes < 5) {
      // Only show seconds for short durations
      return `Next update in ${minutes}m ${seconds}s`;
    } else {
      return `Next update in ${minutes}m`;
    }
  } else {
    return `Next update in ${seconds}s`;
  }
}