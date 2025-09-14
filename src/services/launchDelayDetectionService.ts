/**
 * Launch Delay Detection Service
 * 
 * Detects when launches are delayed, rescheduled, or cancelled
 * and provides user notifications about schedule changes.
 */

import { Launch } from '../types';
import { launchDatabase } from './launchDatabase';

export interface LaunchScheduleChange {
  launchId: string;
  launchName: string;
  changeType: 'delay' | 'advance' | 'cancellation' | 'status_change';
  originalTime: string;
  newTime: string;
  originalStatus: string;
  newStatus: string;
  delayMinutes: number;
  detectedAt: number;
  reason?: string;
}

export interface DelayNotification {
  id: string;
  launchId: string;
  message: string;
  type: 'delay' | 'cancellation' | 'major_delay' | 'minor_delay';
  timestamp: number;
  acknowledged: boolean;
}

export class LaunchDelayDetectionService {
  private readonly STORAGE_KEY = 'bermuda-launch-schedule-changes';
  private readonly NOTIFICATIONS_KEY = 'bermuda-delay-notifications';
  private subscribers: Array<(changes: LaunchScheduleChange[]) => void> = [];

  /**
   * Compare current launches with cached versions to detect changes
   */
  detectScheduleChanges(currentLaunches: Launch[]): LaunchScheduleChange[] {
    const changes: LaunchScheduleChange[] = [];
    const cachedEntries = launchDatabase.getAllEntries();
    
    for (const currentLaunch of currentLaunches) {
      const cachedEntry = cachedEntries.find(entry => entry.id === currentLaunch.id);
      
      if (cachedEntry) {
        const change = this.compareSchedules(cachedEntry.data, currentLaunch);
        if (change) {
          changes.push(change);
          this.logScheduleChange(change);
        }
      }
    }
    
    // Store detected changes
    if (changes.length > 0) {
      this.storeScheduleChanges(changes);
      this.notifySubscribers(changes);
      this.createUserNotifications(changes);
    }
    
    return changes;
  }

  /**
   * Compare two launch schedules to detect changes
   */
  private compareSchedules(cached: Launch, current: Launch): LaunchScheduleChange | null {
    const originalTime = new Date(cached.net);
    const newTime = new Date(current.net);
    const timeDifference = newTime.getTime() - originalTime.getTime();
    const delayMinutes = Math.round(timeDifference / (1000 * 60));
    
    // Significant time change (more than 5 minutes)
    if (Math.abs(delayMinutes) > 5) {
      return {
        launchId: current.id,
        launchName: current.name,
        changeType: delayMinutes > 0 ? 'delay' : 'advance',
        originalTime: cached.net,
        newTime: current.net,
        originalStatus: cached.status?.name || 'Unknown',
        newStatus: current.status?.name || 'Unknown',
        delayMinutes,
        detectedAt: Date.now(),
        reason: this.inferDelayReason(delayMinutes, current.status?.name)
      };
    }
    
    // Status change without time change
    if (cached.status?.name !== current.status?.name) {
      return {
        launchId: current.id,
        launchName: current.name,
        changeType: current.status?.name?.toLowerCase().includes('cancel') ? 'cancellation' : 'status_change',
        originalTime: cached.net,
        newTime: current.net,
        originalStatus: cached.status?.name || 'Unknown',
        newStatus: current.status?.name || 'Unknown',
        delayMinutes: 0,
        detectedAt: Date.now()
      };
    }
    
    return null;
  }

  /**
   * Infer the likely reason for a delay based on timing and status
   */
  private inferDelayReason(delayMinutes: number, status?: string): string {
    if (delayMinutes > 1440) { // More than 24 hours
      return 'Major schedule adjustment or technical issue';
    } else if (delayMinutes > 120) { // More than 2 hours
      return 'Weather delay or range conflict';
    } else if (delayMinutes > 30) {
      return 'Technical hold or operational delay';
    } else {
      return 'Minor schedule adjustment';
    }
  }

  /**
   * Create user-friendly notifications for schedule changes
   */
  private createUserNotifications(changes: LaunchScheduleChange[]): void {
    const notifications: DelayNotification[] = [];
    
    for (const change of changes) {
      let message = '';
      let type: DelayNotification['type'] = 'delay';
      
      switch (change.changeType) {
        case 'delay':
          if (change.delayMinutes > 1440) { // > 24 hours
            message = `🚀 ${change.launchName} delayed by ${Math.round(change.delayMinutes / 60 / 24)} days`;
            type = 'major_delay';
          } else if (change.delayMinutes > 60) {
            message = `🚀 ${change.launchName} delayed by ${Math.round(change.delayMinutes / 60)} hours`;
            type = 'delay';
          } else {
            message = `🚀 ${change.launchName} delayed by ${change.delayMinutes} minutes`;
            type = 'minor_delay';
          }
          break;
          
        case 'advance':
          message = `🚀 ${change.launchName} moved earlier by ${Math.abs(change.delayMinutes)} minutes`;
          type = 'minor_delay';
          break;
          
        case 'cancellation':
          message = `❌ ${change.launchName} has been cancelled`;
          type = 'cancellation';
          break;
          
        case 'status_change':
          message = `📊 ${change.launchName} status: ${change.originalStatus} → ${change.newStatus}`;
          type = 'minor_delay';
          break;
      }
      
      const notification: DelayNotification = {
        id: `${change.launchId}-${change.detectedAt}`,
        launchId: change.launchId,
        message,
        type,
        timestamp: change.detectedAt,
        acknowledged: false
      };
      
      notifications.push(notification);
    }
    
    this.storeNotifications(notifications);
  }

  /**
   * Get all unacknowledged delay notifications
   */
  getUnacknowledgedNotifications(): DelayNotification[] {
    try {
      const stored = localStorage.getItem(this.NOTIFICATIONS_KEY);
      if (!stored) return [];
      
      const notifications: DelayNotification[] = JSON.parse(stored);
      return notifications.filter(n => !n.acknowledged);
    } catch (error) {
      console.error('Failed to load delay notifications:', error);
      return [];
    }
  }

  /**
   * Mark a notification as acknowledged
   */
  acknowledgeNotification(notificationId: string): void {
    try {
      const stored = localStorage.getItem(this.NOTIFICATIONS_KEY);
      if (!stored) return;
      
      const notifications: DelayNotification[] = JSON.parse(stored);
      const notification = notifications.find(n => n.id === notificationId);
      
      if (notification) {
        notification.acknowledged = true;
        localStorage.setItem(this.NOTIFICATIONS_KEY, JSON.stringify(notifications));
      }
    } catch (error) {
      console.error('Failed to acknowledge notification:', error);
    }
  }

  /**
   * Get schedule change history for a launch
   */
  getScheduleHistory(launchId: string): LaunchScheduleChange[] {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      if (!stored) return [];
      
      const changes: LaunchScheduleChange[] = JSON.parse(stored);
      return changes
        .filter(change => change.launchId === launchId)
        .sort((a, b) => b.detectedAt - a.detectedAt);
    } catch (error) {
      console.error('Failed to load schedule history:', error);
      return [];
    }
  }

  /**
   * Subscribe to schedule change notifications
   */
  subscribe(callback: (changes: LaunchScheduleChange[]) => void): () => void {
    this.subscribers.push(callback);
    return () => {
      const index = this.subscribers.indexOf(callback);
      if (index > -1) this.subscribers.splice(index, 1);
    };
  }

  /**
   * Clear old schedule changes and notifications
   */
  cleanup(): void {
    const oneWeekAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
    
    // Clean old schedule changes
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      if (stored) {
        const changes: LaunchScheduleChange[] = JSON.parse(stored);
        const recentChanges = changes.filter(change => change.detectedAt > oneWeekAgo);
        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(recentChanges));
      }
    } catch (error) {
      console.error('Failed to cleanup schedule changes:', error);
    }
    
    // Clean old notifications
    try {
      const stored = localStorage.getItem(this.NOTIFICATIONS_KEY);
      if (stored) {
        const notifications: DelayNotification[] = JSON.parse(stored);
        const recentNotifications = notifications.filter(n => n.timestamp > oneWeekAgo);
        localStorage.setItem(this.NOTIFICATIONS_KEY, JSON.stringify(recentNotifications));
      }
    } catch (error) {
      console.error('Failed to cleanup notifications:', error);
    }
  }

  // Private helper methods
  private logScheduleChange(change: LaunchScheduleChange): void {
    console.log(`[DelayDetection] Schedule change detected:`, {
      launch: change.launchName,
      type: change.changeType,
      delay: `${change.delayMinutes} minutes`,
      from: change.originalTime,
      to: change.newTime
    });
  }

  private storeScheduleChanges(changes: LaunchScheduleChange[]): void {
    try {
      const existing = localStorage.getItem(this.STORAGE_KEY);
      const allChanges = existing ? JSON.parse(existing) : [];
      allChanges.push(...changes);
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(allChanges));
    } catch (error) {
      console.error('Failed to store schedule changes:', error);
    }
  }

  private storeNotifications(notifications: DelayNotification[]): void {
    try {
      const existing = localStorage.getItem(this.NOTIFICATIONS_KEY);
      const allNotifications = existing ? JSON.parse(existing) : [];
      allNotifications.push(...notifications);
      localStorage.setItem(this.NOTIFICATIONS_KEY, JSON.stringify(allNotifications));
    } catch (error) {
      console.error('Failed to store notifications:', error);
    }
  }

  private notifySubscribers(changes: LaunchScheduleChange[]): void {
    this.subscribers.forEach(callback => {
      try {
        callback(changes);
      } catch (error) {
        console.error('Error notifying schedule change subscriber:', error);
      }
    });
  }
}

// Export singleton instance
export const launchDelayDetectionService = new LaunchDelayDetectionService();