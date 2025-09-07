/**
 * Delay Notification Service
 * 
 * Manages user notifications for launch schedule changes and visibility impacts.
 * Provides multiple notification channels and smart notification logic.
 * Prevents notification spam while ensuring critical updates reach users.
 */

import { 
  DelayNotification, 
  DelayNotificationType, 
  DelayImpactAnalysis, 
  LaunchWithDelayTracking,
  LaunchMonitoringConfig
} from '../types';

// Notification channel interfaces
interface NotificationChannel {
  send(notification: DelayNotification): Promise<boolean>;
  isAvailable(): boolean;
}

// In-app notification queue
const notificationQueue: DelayNotification[] = [];

// Notification history for duplicate prevention
const notificationHistory = new Map<string, Date>();

// Rate limiting for notifications
const RATE_LIMITS = {
  SAME_LAUNCH_MINUTES: 15,    // Min 15 minutes between notifications for same launch
  GLOBAL_PER_HOUR: 20,        // Max 20 notifications per hour globally
  CRITICAL_OVERRIDE: true     // Critical notifications can override rate limits
};

export class DelayNotificationService {
  private static channels = new Map<string, NotificationChannel>();
  private static config: LaunchMonitoringConfig['notificationThresholds'] = {
    minDelayMinutes: 5,
    significantDelayMinutes: 30,
    visibilityChangeRequired: false
  };

  /**
   * Initialize notification service with configuration
   */
  static initialize(config?: Partial<LaunchMonitoringConfig['notificationThresholds']>): void {
    if (config) {
      this.config = { ...this.config, ...config };
    }
    
    // Register default notification channels
    this.registerChannel('in-app', new InAppNotificationChannel());
    this.registerChannel('browser', new BrowserNotificationChannel());
    
  }

  /**
   * Register a notification channel
   */
  static registerChannel(name: string, channel: NotificationChannel): void {
    this.channels.set(name, channel);
  }

  /**
   * Process delay impact and create appropriate notifications
   */
  static async processDelayImpact(
    launch: LaunchWithDelayTracking,
    impactAnalysis: DelayImpactAnalysis
  ): Promise<DelayNotification[]> {
    
    
    // Don't notify if not needed
    if (!impactAnalysis.shouldNotify) {
      return [];
    }
    
    // Generate notifications based on impact
    const notifications = this.generateNotifications(launch, impactAnalysis);
    
    // Filter notifications based on rate limits and duplicates
    const filteredNotifications = this.applyRateLimiting(notifications);
    
    // Send notifications through channels
    const sentNotifications: DelayNotification[] = [];
    for (const notification of filteredNotifications) {
      const sent = await this.sendNotification(notification);
      if (sent) {
        sentNotifications.push(notification);
        this.recordNotificationHistory(notification);
      }
    }
    
    return sentNotifications;
  }

  /**
   * Generate notifications based on delay impact analysis
   */
  private static generateNotifications(
    launch: LaunchWithDelayTracking,
    impactAnalysis: DelayImpactAnalysis
  ): DelayNotification[] {
    
    const notifications: DelayNotification[] = [];
    
    // Determine notification type and priority
    const { type, priority } = this.determineNotificationTypeAndPriority(impactAnalysis);
    
    // Create primary notification
    const primaryNotification: DelayNotification = {
      type,
      launch,
      message: impactAnalysis.userMessage,
      priority,
      timestamp: new Date(),
      shouldPush: this.shouldSendPushNotification(impactAnalysis, priority),
      shouldShow: true
    };
    
    notifications.push(primaryNotification);
    
    // Add secondary notifications for complex scenarios
    if (impactAnalysis.severity === 'critical' && impactAnalysis.impact === 'WINDOW_LOST') {
      // Additional notification about loss of viewing opportunity
      notifications.push({
        type: 'WINDOW_LOST',
        launch,
        message: this.generateWindowLostMessage(launch, impactAnalysis),
        priority: 'high',
        timestamp: new Date(),
        shouldPush: true,
        shouldShow: true
      });
    }
    
    if (impactAnalysis.impact === 'VISIBILITY_IMPROVED' && impactAnalysis.severity === 'significant') {
      // Positive reinforcement notification
      notifications.push({
        type: 'VISIBILITY_IMPROVED',
        launch,
        message: this.generateImprovementMessage(launch, impactAnalysis),
        priority: 'medium',
        timestamp: new Date(),
        shouldPush: false,
        shouldShow: true
      });
    }
    
    return notifications;
  }

  /**
   * Determine notification type and priority from impact analysis
   */
  private static determineNotificationTypeAndPriority(
    impactAnalysis: DelayImpactAnalysis
  ): { type: DelayNotificationType; priority: 'high' | 'medium' | 'low' } {
    
    switch (impactAnalysis.impact) {
      case 'WINDOW_LOST':
        return { type: 'WINDOW_LOST', priority: 'high' };
        
      case 'WINDOW_GAINED':
        return { type: 'WINDOW_GAINED', priority: 'high' };
        
      case 'VISIBILITY_IMPROVED':
        return { type: 'VISIBILITY_IMPROVED', priority: 'medium' };
        
      case 'VISIBILITY_DEGRADED':
        return { 
          type: 'VISIBILITY_DEGRADED', 
          priority: impactAnalysis.severity === 'critical' ? 'high' : 'medium' 
        };
        
      case 'MINOR_CHANGE':
        return { type: 'MINOR_DELAY', priority: 'low' };
        
      case 'NO_IMPACT':
        return { type: 'DELAY_DETECTED', priority: 'low' };
        
      default:
        return { type: 'DELAY_DETECTED', priority: 'medium' };
    }
  }

  /**
   * Generate specialized message for window lost scenarios
   */
  private static generateWindowLostMessage(
    launch: LaunchWithDelayTracking,
    impactAnalysis: DelayImpactAnalysis
  ): string {
    
    if (launch.scheduleStatus === 'scrubbed') {
      return `🚀 ${launch.name} has been scrubbed. We'll monitor for any rescheduling announcements and notify you of new opportunities.`;
    }
    
    return `📅 ${launch.name} delay moved the launch outside optimal viewing conditions. ` +
           `Consider checking other upcoming launches for viewing opportunities.`;
  }

  /**
   * Generate positive message for visibility improvements
   */
  private static generateImprovementMessage(
    launch: LaunchWithDelayTracking,
    impactAnalysis: DelayImpactAnalysis
  ): string {
    
    return `🎯 ${launch.name} delay created a better viewing opportunity! ` +
           `The new timing provides ${impactAnalysis.newVisibility.likelihood} visibility. ` +
           `Check the updated viewing instructions for best results.`;
  }

  /**
   * Determine if push notification should be sent
   */
  private static shouldSendPushNotification(
    impactAnalysis: DelayImpactAnalysis,
    priority: 'high' | 'medium' | 'low'
  ): boolean {
    
    // Always push critical impacts
    if (impactAnalysis.severity === 'critical') {
      return true;
    }
    
    // Push high priority notifications
    if (priority === 'high') {
      return true;
    }
    
    // Push significant visibility changes
    if (impactAnalysis.impact === 'VISIBILITY_IMPROVED' || 
        impactAnalysis.impact === 'VISIBILITY_DEGRADED') {
      return true;
    }
    
    // Don't push minor changes
    return false;
  }

  /**
   * Apply rate limiting to prevent notification spam
   */
  private static applyRateLimiting(notifications: DelayNotification[]): DelayNotification[] {
    const now = new Date();
    const filtered: DelayNotification[] = [];
    
    for (const notification of notifications) {
      // Check if we've sent a similar notification recently
      const historyKey = `${notification.launch.id}-${notification.type}`;
      const lastSent = notificationHistory.get(historyKey);
      
      if (lastSent) {
        const minutesSinceLastSent = (now.getTime() - lastSent.getTime()) / (1000 * 60);
        
        // Skip if within rate limit window (unless critical)
        if (minutesSinceLastSent < RATE_LIMITS.SAME_LAUNCH_MINUTES) {
          if (notification.priority !== 'high' || !RATE_LIMITS.CRITICAL_OVERRIDE) {
            continue;
          }
        }
      }
      
      // Check global hourly rate limit
      if (this.checkGlobalRateLimit(now)) {
        if (notification.priority !== 'high' || !RATE_LIMITS.CRITICAL_OVERRIDE) {
          continue;
        }
      }
      
      filtered.push(notification);
    }
    
    return filtered;
  }

  /**
   * Check global rate limit
   */
  private static checkGlobalRateLimit(now: Date): boolean {
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
    let recentNotifications = 0;
    
    for (const [, timestamp] of notificationHistory) {
      if (timestamp > oneHourAgo) {
        recentNotifications++;
      }
    }
    
    return recentNotifications >= RATE_LIMITS.GLOBAL_PER_HOUR;
  }

  /**
   * Send notification through available channels
   */
  private static async sendNotification(notification: DelayNotification): Promise<boolean> {
    let sent = false;
    
    // Send through in-app channel (always)
    const inAppChannel = this.channels.get('in-app');
    if (inAppChannel?.isAvailable()) {
      try {
        await inAppChannel.send(notification);
        sent = true;
      } catch (error) {
        console.error(`[DelayNotification] In-app notification failed:`, error);
      }
    }
    
    // Send push notification if requested
    if (notification.shouldPush) {
      const browserChannel = this.channels.get('browser');
      if (browserChannel?.isAvailable()) {
        try {
          await browserChannel.send(notification);
          sent = true;
        } catch (error) {
          console.error(`[DelayNotification] Browser notification failed:`, error);
        }
      }
    }
    
    return sent;
  }

  /**
   * Record notification in history
   */
  private static recordNotificationHistory(notification: DelayNotification): void {
    const historyKey = `${notification.launch.id}-${notification.type}`;
    notificationHistory.set(historyKey, notification.timestamp);
    
    // Clean up old history entries
    this.cleanupNotificationHistory();
  }

  /**
   * Clean up old notification history
   */
  private static cleanupNotificationHistory(): void {
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    
    for (const [key, timestamp] of notificationHistory) {
      if (timestamp < oneDayAgo) {
        notificationHistory.delete(key);
      }
    }
  }

  /**
   * Get current notification queue
   */
  static getNotificationQueue(): DelayNotification[] {
    return [...notificationQueue];
  }

  /**
   * Clear notification queue
   */
  static clearNotificationQueue(): void {
    notificationQueue.length = 0;
  }

  /**
   * Get notification statistics
   */
  static getNotificationStats(): {
    queueSize: number;
    historySize: number;
    channelCount: number;
    availableChannels: string[];
  } {
    const availableChannels: string[] = [];
    for (const [name, channel] of this.channels) {
      if (channel.isAvailable()) {
        availableChannels.push(name);
      }
    }
    
    return {
      queueSize: notificationQueue.length,
      historySize: notificationHistory.size,
      channelCount: this.channels.size,
      availableChannels
    };
  }
}

/**
 * In-app notification channel - shows notifications in the UI
 */
class InAppNotificationChannel implements NotificationChannel {
  async send(notification: DelayNotification): Promise<boolean> {
    // Add to in-app queue
    notificationQueue.push(notification);
    
    // Keep queue size manageable
    if (notificationQueue.length > 50) {
      notificationQueue.splice(0, 10); // Remove oldest 10
    }
    
    return true;
  }
  
  isAvailable(): boolean {
    return true; // Always available
  }
}

/**
 * Browser notification channel - uses browser's notification API
 */
class BrowserNotificationChannel implements NotificationChannel {
  private permission: NotificationPermission = 'default';
  
  constructor() {
    this.checkPermission();
  }
  
  async send(notification: DelayNotification): Promise<boolean> {
    if (!this.isAvailable()) {
      return false;
    }
    
    try {
      // Create browser notification
      const browserNotification = new Notification(
        `🚀 ${notification.launch.name}`,
        {
          body: notification.message,
          icon: '/logo192.png',
          tag: `launch-${notification.launch.id}`, // Prevent duplicates
          requireInteraction: notification.priority === 'high',
          timestamp: notification.timestamp.getTime()
        }
      );
      
      // Auto-close after 10 seconds (except for high priority)
      if (notification.priority !== 'high') {
        setTimeout(() => browserNotification.close(), 10000);
      }
      
      return true;
      
    } catch (error) {
      console.error(`[BrowserNotification] Failed to send:`, error);
      return false;
    }
  }
  
  isAvailable(): boolean {
    return 'Notification' in window && this.permission === 'granted';
  }
  
  private async checkPermission(): Promise<void> {
    if ('Notification' in window) {
      this.permission = Notification.permission;
      
      if (this.permission === 'default') {
        try {
          this.permission = await Notification.requestPermission();
        } catch (error) {
            this.permission = 'denied';
        }
      }
    }
  }
}