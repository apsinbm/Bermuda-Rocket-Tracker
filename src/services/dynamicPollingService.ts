/**
 * Dynamic Polling Service
 * 
 * Implements aggressive, proximity-based polling for real-time launch schedule monitoring.
 * Polling frequency increases as launch time approaches to catch last-minute delays.
 * Balances real-time responsiveness with API rate limits and battery usage.
 */

import { LaunchWithDelayTracking, LaunchMonitoringConfig } from '../types';
import { calculateVisibility } from './visibilityService';
import { formatLaunchTime } from '../utils/timeUtils';

// Default polling configuration - optimized for real-time delay detection
const DEFAULT_CONFIG: LaunchMonitoringConfig = {
  enableRealTimePolling: true,
  enableDelayNotifications: true,
  enableVisibilityAlerts: true,
  pollingIntervals: {
    critical: 30000,   // 30 seconds (< 30 minutes to launch)
    high: 60000,       // 1 minute (< 2 hours to launch)
    medium: 300000,    // 5 minutes (< 6 hours to launch)
    low: 600000,       // 10 minutes (< 24 hours to launch)
    default: 1800000   // 30 minutes (> 24 hours to launch)
  },
  notificationThresholds: {
    minDelayMinutes: 5,           // Don't notify for delays < 5 minutes
    significantDelayMinutes: 30,  // Mark as "significant" if > 30 minutes
    visibilityChangeRequired: false // Notify for all delays, not just visibility changes
  }
};

// Active polling intervals - maps launch ID to timer
const activePollingIntervals = new Map<string, NodeJS.Timeout>();

// Polling statistics for optimization
interface PollingStats {
  totalPolls: number;
  delaysDetected: number;
  lastOptimization: Date;
  avgResponseTime: number;
}

const pollingStats = new Map<string, PollingStats>();

export class DynamicPollingService {
  private static config: LaunchMonitoringConfig = DEFAULT_CONFIG;
  private static onScheduleChangeCallback?: (launch: LaunchWithDelayTracking, oldTime: string, newTime: string) => void;

  /**
   * Start monitoring a launch with dynamic polling frequency
   */
  static startMonitoring(
    launch: LaunchWithDelayTracking,
    onScheduleChange?: (launch: LaunchWithDelayTracking, oldTime: string, newTime: string) => void
  ): void {
    
    this.onScheduleChangeCallback = onScheduleChange;
    
    // Stop existing monitoring for this launch
    this.stopMonitoring(launch.id);
    
    // Initialize polling stats
    pollingStats.set(launch.id, {
      totalPolls: 0,
      delaysDetected: 0,
      lastOptimization: new Date(),
      avgResponseTime: 0
    });
    
    // Start polling
    this.scheduleNextPoll(launch);
  }

  /**
   * Stop monitoring a specific launch
   */
  static stopMonitoring(launchId: string): void {
    
    const interval = activePollingIntervals.get(launchId);
    if (interval) {
      clearTimeout(interval);
      activePollingIntervals.delete(launchId);
    }
    
    pollingStats.delete(launchId);
  }

  /**
   * Stop all active monitoring
   */
  static stopAllMonitoring(): void {
    
    for (const [launchId] of activePollingIntervals) {
      this.stopMonitoring(launchId);
    }
  }

  /**
   * Update configuration
   */
  static updateConfig(newConfig: Partial<LaunchMonitoringConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  /**
   * Get current configuration
   */
  static getConfig(): LaunchMonitoringConfig {
    return { ...this.config };
  }

  /**
   * Calculate optimal polling interval based on time to launch
   */
  static calculatePollingInterval(launchTime: Date): number {
    const now = Date.now();
    const timeToLaunch = new Date(launchTime).getTime() - now;
    const intervals = this.config.pollingIntervals;

    // Determine interval based on proximity to launch
    if (timeToLaunch < 30 * 60 * 1000) {
      return intervals.critical;   // 30 seconds - critical window
    } else if (timeToLaunch < 2 * 60 * 60 * 1000) {
      return intervals.high;       // 1 minute - high priority
    } else if (timeToLaunch < 6 * 60 * 60 * 1000) {
      return intervals.medium;     // 5 minutes - medium priority
    } else if (timeToLaunch < 24 * 60 * 60 * 1000) {
      return intervals.low;        // 10 minutes - low priority
    } else {
      return intervals.default;    // 30 minutes - distant launches
    }
  }

  /**
   * Determine priority level based on time to launch
   */
  static calculatePriorityLevel(launchTime: Date): 'critical' | 'high' | 'medium' | 'low' {
    const now = Date.now();
    const timeToLaunch = new Date(launchTime).getTime() - now;

    if (timeToLaunch < 30 * 60 * 1000) return 'critical';   // < 30 minutes
    if (timeToLaunch < 2 * 60 * 60 * 1000) return 'high';   // < 2 hours
    if (timeToLaunch < 6 * 60 * 60 * 1000) return 'medium'; // < 6 hours
    return 'low'; // < 24 hours or more
  }

  /**
   * Schedule the next poll for a launch
   */
  private static scheduleNextPoll(launch: LaunchWithDelayTracking): void {
    if (!this.config.enableRealTimePolling) {
      return;
    }

    const interval = this.calculatePollingInterval(new Date(launch.net));
    const priorityLevel = this.calculatePriorityLevel(new Date(launch.net));
    
    
    const timeout = setTimeout(async () => {
      await this.performPoll(launch);
    }, interval);
    
    activePollingIntervals.set(launch.id, timeout);
  }

  /**
   * Perform a single poll for schedule updates
   */
  private static async performPoll(launch: LaunchWithDelayTracking): Promise<void> {
    const pollStart = Date.now();
    const stats = pollingStats.get(launch.id);
    
    try {
      
      // Import launch service to check for updates
      const { launchService } = await import('./launchService');
      
      // Fetch latest launch data
      const updatedLaunches = await launchService.getLaunches();
      const updatedLaunch = updatedLaunches.find(l => l.id === launch.id);
      
      if (updatedLaunch) {
        const oldTime = launch.net;
        const newTime = updatedLaunch.net;
        
        // Check if schedule changed
        if (oldTime !== newTime) {
          
          // Update statistics
          if (stats) {
            stats.delaysDetected++;
          }
          
          // Calculate visibility and format time for updated launch
          const visibility = await calculateVisibility(updatedLaunch);
          const bermudaTime = formatLaunchTime(updatedLaunch.net).bermudaTime;
          
          // Create updated launch with delay tracking
          const updatedLaunchWithTracking: LaunchWithDelayTracking = {
            ...updatedLaunch,
            visibility,
            bermudaTime,
            originalNet: launch.originalNet,
            currentNet: newTime,
            lastUpdated: new Date(),
            delayHistory: [...launch.delayHistory],
            scheduleStatus: this.determineScheduleStatus(oldTime, newTime),
            pollingFrequency: this.calculatePollingInterval(new Date(newTime)),
            lastPolled: new Date(),
            priorityLevel: this.calculatePriorityLevel(new Date(newTime))
          };
          
          // Add delay event to history
          const delayMinutes = (new Date(newTime).getTime() - new Date(oldTime).getTime()) / (1000 * 60);
          const delayEvent = {
            timestamp: new Date(),
            oldTime,
            newTime,
            delayMinutes,
            source: 'api' as const,
            confidence: 'confirmed' as const
          };
          updatedLaunchWithTracking.delayHistory.push(delayEvent);
          
          // Notify callback about the change
          if (this.onScheduleChangeCallback) {
            this.onScheduleChangeCallback(updatedLaunchWithTracking, oldTime, newTime);
          }
          
          // Continue monitoring with updated launch data
          this.scheduleNextPoll(updatedLaunchWithTracking);
        } else {
          // No change, continue monitoring with existing data
          this.scheduleNextPoll(launch);
        }
        
        // Update launch metadata
        launch.lastPolled = new Date();
        launch.pollingFrequency = this.calculatePollingInterval(new Date(launch.net));
        launch.priorityLevel = this.calculatePriorityLevel(new Date(launch.net));
        
      } else {
        this.stopMonitoring(launch.id);
      }
      
    } catch (error) {
      console.error(`[DynamicPolling] Error polling ${launch.name}:`, error);
      
      // Continue polling even on errors, but with exponential backoff
      const backoffInterval = Math.min(this.calculatePollingInterval(new Date(launch.net)) * 2, 300000); // Max 5 minutes
      
      const timeout = setTimeout(async () => {
        await this.performPoll(launch);
      }, backoffInterval);
      
      activePollingIntervals.set(launch.id, timeout);
    } finally {
      // Update statistics
      if (stats) {
        stats.totalPolls++;
        const pollDuration = Date.now() - pollStart;
        stats.avgResponseTime = (stats.avgResponseTime * (stats.totalPolls - 1) + pollDuration) / stats.totalPolls;
      }
    }
  }

  /**
   * Determine schedule status based on time changes
   */
  private static determineScheduleStatus(oldTime: string, newTime: string): 'on-time' | 'delayed' | 'scrubbed' | 'go' | 'hold' | 'unknown' {
    const oldDate = new Date(oldTime);
    const newDate = new Date(newTime);
    const delayMinutes = (newDate.getTime() - oldDate.getTime()) / (1000 * 60);
    
    if (Math.abs(delayMinutes) < 5) {
      return 'on-time'; // Minor adjustment
    } else if (delayMinutes > 0) {
      return 'delayed'; // Pushed later
    } else {
      return 'go'; // Moved earlier
    }
  }

  /**
   * Get monitoring statistics
   */
  static getMonitoringStats(): { 
    activeLaunches: number; 
    totalPolls: number; 
    totalDelaysDetected: number; 
    avgResponseTime: number;
    launchStats: Array<{ launchId: string; stats: PollingStats }>;
  } {
    let totalPolls = 0;
    let totalDelaysDetected = 0;
    let totalResponseTime = 0;
    const launchStats: Array<{ launchId: string; stats: PollingStats }> = [];
    
    for (const [launchId, stats] of pollingStats) {
      totalPolls += stats.totalPolls;
      totalDelaysDetected += stats.delaysDetected;
      totalResponseTime += stats.avgResponseTime * stats.totalPolls;
      launchStats.push({ launchId, stats });
    }
    
    return {
      activeLaunches: activePollingIntervals.size,
      totalPolls,
      totalDelaysDetected,
      avgResponseTime: totalPolls > 0 ? totalResponseTime / totalPolls : 0,
      launchStats
    };
  }

  /**
   * Optimize polling based on historical data and performance
   */
  static optimizePolling(): void {
    
    for (const [launchId, stats] of pollingStats) {
      // If we've detected delays frequently, increase polling frequency slightly
      if (stats.delaysDetected > 0 && stats.totalPolls > 10) {
        const delayRate = stats.delaysDetected / stats.totalPolls;
        if (delayRate > 0.1) { // > 10% delay rate
          // Reduce intervals by 25% for high-delay launches
          this.config.pollingIntervals.critical = Math.max(15000, this.config.pollingIntervals.critical * 0.75);
          this.config.pollingIntervals.high = Math.max(30000, this.config.pollingIntervals.high * 0.75);
        }
      }
      
      // If response times are high, slightly reduce polling frequency to avoid overwhelming API
      if (stats.avgResponseTime > 5000) { // > 5 second response time
        this.config.pollingIntervals.critical = Math.min(60000, this.config.pollingIntervals.critical * 1.25);
        this.config.pollingIntervals.high = Math.min(120000, this.config.pollingIntervals.high * 1.25);
      }
      
      stats.lastOptimization = new Date();
    }
  }

  /**
   * Check if launch should be monitored based on proximity and status
   */
  static shouldMonitorLaunch(launch: LaunchWithDelayTracking): boolean {
    const now = Date.now();
    const launchTime = new Date(launch.net).getTime();
    const timeToLaunch = launchTime - now;
    
    // Don't monitor past launches
    if (timeToLaunch < -60 * 60 * 1000) { // 1 hour after launch
      return false;
    }
    
    // Don't monitor scrubbed launches
    if (launch.scheduleStatus === 'scrubbed') {
      return false;
    }
    
    // Monitor all launches within 7 days
    if (timeToLaunch < 7 * 24 * 60 * 60 * 1000) {
      return true;
    }
    
    return false;
  }

  /**
   * Clean up completed or expired monitoring
   */
  static cleanup(): void {
    const now = Date.now();
    const expiredLaunches: string[] = [];
    
    for (const [launchId] of pollingStats) {
      const stats = pollingStats.get(launchId);
      if (stats && now - stats.lastOptimization.getTime() > 7 * 24 * 60 * 60 * 1000) { // 7 days old
        expiredLaunches.push(launchId);
      }
    }
    
    expiredLaunches.forEach(launchId => {
      this.stopMonitoring(launchId);
    });
    
  }
}