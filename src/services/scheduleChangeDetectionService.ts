/**
 * Schedule Change Detection Service
 * 
 * Detects and analyzes rocket launch schedule changes from multiple sources.
 * Compares current data against cached data to identify delays, advances, and scrubs.
 * Provides detailed change analysis for visibility impact calculations.
 */

import { Launch, LaunchWithDelayTracking, DelayEvent, ScheduleStatus, LaunchChanges } from '../types';
import { calculateVisibility } from './visibilityService';
import { formatLaunchTime } from '../utils/timeUtils';

// Cache for tracking previous launch data
interface LaunchSnapshot {
  id: string;
  net: string;
  window_start?: string;
  window_end?: string;
  status: {
    name: string;
    abbrev?: string;
  };
  lastChecked: Date;
  checkCount: number;
}

// In-memory cache of launch snapshots
const launchSnapshots = new Map<string, LaunchSnapshot>();

// Change detection thresholds (in minutes)
const CHANGE_THRESHOLDS = {
  MINOR_DELAY: 5,        // Changes < 5 minutes considered minor
  SIGNIFICANT_DELAY: 30, // Changes > 30 minutes considered significant
  MAJOR_DELAY: 120,      // Changes > 2 hours considered major
  WINDOW_SHIFT: 15       // Launch window shifts > 15 minutes
};

export interface ScheduleChangeResult {
  hasChanged: boolean;
  changeType: 'delay' | 'advance' | 'scrub' | 'window_shift' | 'status_change' | 'no_change';
  severity: 'minor' | 'significant' | 'major' | 'critical';
  oldLaunch: LaunchSnapshot;
  newLaunch: Launch;
  delayEvent?: DelayEvent;
  changes: {
    netChanged: boolean;
    windowChanged: boolean;
    statusChanged: boolean;
    delayMinutes: number;
    windowShiftMinutes?: number;
  };
  confidence: 'high' | 'medium' | 'low';
  recommendations: string[];
}

export class ScheduleChangeDetectionService {

  /**
   * Detect changes by comparing current launch data against cached snapshots
   */
  static detectChanges(currentLaunches: Launch[]): ScheduleChangeResult[] {
    const results: ScheduleChangeResult[] = [];
    
    
    for (const currentLaunch of currentLaunches) {
      const result = this.detectSingleLaunchChanges(currentLaunch);
      if (result.hasChanged) {
        results.push(result);
      }
      
      // Update snapshot regardless of changes
      this.updateSnapshot(currentLaunch);
    }
    
    // Clean up old snapshots
    this.cleanupOldSnapshots();
    
    return results;
  }

  /**
   * Detect changes for a single launch
   */
  static detectSingleLaunchChanges(currentLaunch: Launch): ScheduleChangeResult {
    const snapshot = launchSnapshots.get(currentLaunch.id);
    
    // No previous data - this is a new launch
    if (!snapshot) {
      return {
        hasChanged: false,
        changeType: 'no_change',
        severity: 'minor',
        oldLaunch: this.createSnapshotFromLaunch(currentLaunch),
        newLaunch: currentLaunch,
        changes: {
          netChanged: false,
          windowChanged: false,
          statusChanged: false,
          delayMinutes: 0
        },
        confidence: 'high',
        recommendations: ['New launch added to tracking system']
      };
    }

    return this.analyzeChanges(snapshot, currentLaunch);
  }

  /**
   * Analyze specific changes between snapshot and current data
   */
  private static analyzeChanges(snapshot: LaunchSnapshot, currentLaunch: Launch): ScheduleChangeResult {
    const changes = {
      netChanged: snapshot.net !== currentLaunch.net,
      windowChanged: this.hasWindowChanged(snapshot, currentLaunch),
      statusChanged: snapshot.status.name !== currentLaunch.status.name,
      delayMinutes: this.calculateDelayMinutes(snapshot.net, currentLaunch.net),
      windowShiftMinutes: this.calculateWindowShift(snapshot, currentLaunch)
    };

    // Determine change type and severity
    const { changeType, severity } = this.categorizeChange(changes, snapshot, currentLaunch);
    
    // Create delay event if NET changed
    let delayEvent: DelayEvent | undefined;
    if (changes.netChanged && Math.abs(changes.delayMinutes) >= CHANGE_THRESHOLDS.MINOR_DELAY) {
      delayEvent = {
        timestamp: new Date(),
        oldTime: snapshot.net,
        newTime: currentLaunch.net,
        delayMinutes: changes.delayMinutes,
        source: 'api',
        confidence: 'confirmed',
        reason: this.inferDelayReason(changes, currentLaunch)
      };
    }

    // Generate recommendations
    const recommendations = this.generateRecommendations(changeType, severity, changes, currentLaunch);
    
    // Determine confidence level
    const confidence = this.assessConfidence(changes, snapshot, currentLaunch);

    return {
      hasChanged: changeType !== 'no_change',
      changeType,
      severity,
      oldLaunch: snapshot,
      newLaunch: currentLaunch,
      delayEvent,
      changes,
      confidence,
      recommendations
    };
  }

  /**
   * Categorize the type and severity of change
   */
  private static categorizeChange(
    changes: LaunchChanges, 
    snapshot: LaunchSnapshot, 
    currentLaunch: Launch
  ): { changeType: ScheduleChangeResult['changeType']; severity: ScheduleChangeResult['severity'] } {
    
    // Check for scrub
    if (changes.statusChanged && this.isLaunchScrubbed(currentLaunch.status.name)) {
      return { changeType: 'scrub', severity: 'critical' };
    }

    // Check for NET changes (delays/advances)
    if (changes.netChanged) {
      const absDelayMinutes = Math.abs(changes.delayMinutes);
      
      if (absDelayMinutes >= CHANGE_THRESHOLDS.MAJOR_DELAY) {
        return { 
          changeType: changes.delayMinutes > 0 ? 'delay' : 'advance', 
          severity: 'major' 
        };
      } else if (absDelayMinutes >= CHANGE_THRESHOLDS.SIGNIFICANT_DELAY) {
        return { 
          changeType: changes.delayMinutes > 0 ? 'delay' : 'advance', 
          severity: 'significant' 
        };
      } else if (absDelayMinutes >= CHANGE_THRESHOLDS.MINOR_DELAY) {
        return { 
          changeType: changes.delayMinutes > 0 ? 'delay' : 'advance', 
          severity: 'minor' 
        };
      }
    }

    // Check for launch window shifts
    if (changes.windowChanged && changes.windowShiftMinutes && 
        Math.abs(changes.windowShiftMinutes) >= CHANGE_THRESHOLDS.WINDOW_SHIFT) {
      return { changeType: 'window_shift', severity: 'significant' };
    }

    // Check for status changes (without scrub)
    if (changes.statusChanged) {
      return { changeType: 'status_change', severity: 'minor' };
    }

    return { changeType: 'no_change', severity: 'minor' };
  }

  /**
   * Calculate delay in minutes between old and new NET times
   */
  private static calculateDelayMinutes(oldNet: string, newNet: string): number {
    const oldTime = new Date(oldNet);
    const newTime = new Date(newNet);
    return Math.round((newTime.getTime() - oldTime.getTime()) / (1000 * 60));
  }

  /**
   * Check if launch window has changed significantly
   */
  private static hasWindowChanged(snapshot: LaunchSnapshot, currentLaunch: Launch): boolean {
    const oldStart = snapshot.window_start;
    const newStart = currentLaunch.window_start;
    const oldEnd = snapshot.window_end;
    const newEnd = currentLaunch.window_end;

    return (oldStart !== newStart) || (oldEnd !== newEnd);
  }

  /**
   * Calculate launch window shift in minutes
   */
  private static calculateWindowShift(snapshot: LaunchSnapshot, currentLaunch: Launch): number | undefined {
    if (!snapshot.window_start || !currentLaunch.window_start) {
      return undefined;
    }

    const oldStart = new Date(snapshot.window_start);
    const newStart = new Date(currentLaunch.window_start);
    return Math.round((newStart.getTime() - oldStart.getTime()) / (1000 * 60));
  }

  /**
   * Check if launch status indicates scrub
   */
  private static isLaunchScrubbed(statusName: string): boolean {
    const scrubStatuses = [
      'Launch Failure',
      'Launch Cancelled',
      'Launch Scrubbed',
      'Cancelled',
      'Scrubbed',
      'Failure'
    ];
    
    return scrubStatuses.some(scrubStatus => 
      statusName.toLowerCase().includes(scrubStatus.toLowerCase())
    );
  }

  /**
   * Infer reason for delay based on change patterns
   */
  private static inferDelayReason(changes: LaunchChanges, currentLaunch: Launch): string | undefined {
    const delayMinutes = Math.abs(changes.delayMinutes);
    
    // Common delay patterns
    if (delayMinutes < 15) {
      return 'Minor timing adjustment';
    } else if (delayMinutes < 60) {
      return 'Technical or weather hold';
    } else if (delayMinutes < 24 * 60) {
      return 'Significant technical or weather issue';
    } else {
      return 'Major delay - likely technical or range conflict';
    }
  }

  /**
   * Generate actionable recommendations based on changes
   */
  private static generateRecommendations(
    changeType: ScheduleChangeResult['changeType'], 
    severity: ScheduleChangeResult['severity'],
    changes: LaunchChanges,
    currentLaunch: Launch
  ): string[] {
    const recommendations: string[] = [];

    switch (changeType) {
      case 'delay':
        if (severity === 'major') {
          recommendations.push('Recalculate visibility conditions for new launch time');
          recommendations.push('Notify users of significant delay impact');
          recommendations.push('Check if delay affects optimal viewing window');
        } else if (severity === 'significant') {
          recommendations.push('Update visibility calculations');
          recommendations.push('Inform users of timing change');
        } else {
          recommendations.push('Minor timing adjustment - verify visibility unchanged');
        }
        break;

      case 'advance':
        recommendations.push('Launch moved earlier - urgent visibility recalculation needed');
        recommendations.push('Alert users to earlier launch time');
        break;

      case 'scrub':
        recommendations.push('Launch scrubbed - remove from active monitoring');
        recommendations.push('Notify users of cancellation');
        break;

      case 'window_shift':
        recommendations.push('Launch window changed - reassess optimal viewing time');
        break;

      case 'status_change':
        recommendations.push('Monitor for additional schedule changes');
        break;
    }

    return recommendations;
  }

  /**
   * Assess confidence in change detection
   */
  private static assessConfidence(
    changes: LaunchChanges, 
    snapshot: LaunchSnapshot, 
    currentLaunch: Launch
  ): 'high' | 'medium' | 'low' {
    // High confidence for significant NET changes
    if (changes.netChanged && Math.abs(changes.delayMinutes) >= 15) {
      return 'high';
    }

    // High confidence for status changes
    if (changes.statusChanged) {
      return 'high';
    }

    // Medium confidence for minor changes
    if (changes.netChanged || changes.windowChanged) {
      return 'medium';
    }

    return 'low';
  }

  /**
   * Update snapshot with current launch data
   */
  private static updateSnapshot(launch: Launch): void {
    const snapshot: LaunchSnapshot = {
      id: launch.id,
      net: launch.net,
      window_start: launch.window_start,
      window_end: launch.window_end,
      status: { ...launch.status },
      lastChecked: new Date(),
      checkCount: (launchSnapshots.get(launch.id)?.checkCount || 0) + 1
    };
    
    launchSnapshots.set(launch.id, snapshot);
  }

  /**
   * Create snapshot from launch data
   */
  private static createSnapshotFromLaunch(launch: Launch): LaunchSnapshot {
    return {
      id: launch.id,
      net: launch.net,
      window_start: launch.window_start,
      window_end: launch.window_end,
      status: { ...launch.status },
      lastChecked: new Date(),
      checkCount: 1
    };
  }

  /**
   * Convert Launch to LaunchWithDelayTracking
   */
  static async convertToDelayTracking(
    launch: Launch, 
    changeResult: ScheduleChangeResult,
    existingTracking?: LaunchWithDelayTracking
  ): Promise<LaunchWithDelayTracking> {
    
    // Determine original NET (first time we saw this launch)
    const originalNet = existingTracking?.originalNet || changeResult.oldLaunch.net;
    
    // Build delay history
    let delayHistory: DelayEvent[] = existingTracking?.delayHistory || [];
    if (changeResult.delayEvent) {
      delayHistory = [...delayHistory, changeResult.delayEvent];
    }
    
    // Determine schedule status
    const scheduleStatus: ScheduleStatus = this.determineScheduleStatus(changeResult);
    
    // Calculate visibility and format time
    const visibility = await calculateVisibility(launch);
    const bermudaTime = formatLaunchTime(launch.net).bermudaTime;
    
    return {
      ...launch,
      visibility,
      bermudaTime,
      originalNet,
      currentNet: launch.net,
      lastUpdated: new Date(),
      delayHistory,
      scheduleStatus,
      pollingFrequency: 300000, // Default 5 minutes, will be overridden by polling service
      lastPolled: new Date(),
      priorityLevel: 'medium' // Will be recalculated based on proximity
    };
  }

  /**
   * Determine schedule status from change result
   */
  private static determineScheduleStatus(changeResult: ScheduleChangeResult): ScheduleStatus {
    switch (changeResult.changeType) {
      case 'scrub':
        return 'scrubbed';
      case 'delay':
        return 'delayed';
      case 'advance':
        return 'go';
      case 'no_change':
        return 'on-time';
      default:
        return 'unknown';
    }
  }

  /**
   * Clean up old snapshots to prevent memory leaks
   */
  private static cleanupOldSnapshots(): void {
    const now = Date.now();
    const CLEANUP_THRESHOLD = 7 * 24 * 60 * 60 * 1000; // 7 days
    
    let cleanedCount = 0;
    for (const [launchId, snapshot] of launchSnapshots) {
      if (now - snapshot.lastChecked.getTime() > CLEANUP_THRESHOLD) {
        launchSnapshots.delete(launchId);
        cleanedCount++;
      }
    }
    
  }

  /**
   * Get current snapshot cache statistics
   */
  static getCacheStats(): {
    totalSnapshots: number;
    averageCheckCount: number;
    oldestSnapshot: Date | null;
    newestSnapshot: Date | null;
  } {
    if (launchSnapshots.size === 0) {
      return {
        totalSnapshots: 0,
        averageCheckCount: 0,
        oldestSnapshot: null,
        newestSnapshot: null
      };
    }
    
    let totalCheckCount = 0;
    let oldest: Date | null = null;
    let newest: Date | null = null;
    
    for (const [, snapshot] of launchSnapshots) {
      totalCheckCount += snapshot.checkCount;
      
      if (!oldest || snapshot.lastChecked < oldest) {
        oldest = snapshot.lastChecked;
      }
      
      if (!newest || snapshot.lastChecked > newest) {
        newest = snapshot.lastChecked;
      }
    }
    
    return {
      totalSnapshots: launchSnapshots.size,
      averageCheckCount: totalCheckCount / launchSnapshots.size,
      oldestSnapshot: oldest,
      newestSnapshot: newest
    };
  }

  /**
   * Force clear all snapshots (useful for testing)
   */
  static clearSnapshots(): void {
    launchSnapshots.clear();
  }
}