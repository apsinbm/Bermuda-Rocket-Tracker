/**
 * Notification Service for Bermuda Rocket Tracker
 * Handles browser notifications for upcoming visible launches
 */

import { LaunchWithVisibility } from '../types';

export interface NotificationSettings {
  enabled: boolean;
  highVisibilityOnly: boolean;
  reminderTimes: number[]; // minutes before launch
  soundEnabled: boolean;
}

export interface NotificationStatus {
  permission: NotificationPermission;
  supported: boolean;
  settings: NotificationSettings;
}

export class NotificationService {
  private settings: NotificationSettings;
  private scheduledNotifications: Map<string, NodeJS.Timeout[]> = new Map();
  private subscribers: Array<(status: NotificationStatus) => void> = [];

  constructor() {
    this.settings = this.loadSettings();
    this.setupVisibilityChangeHandler();
  }

  /**
   * Load notification settings from localStorage
   */
  private loadSettings(): NotificationSettings {
    const saved = localStorage.getItem('bermuda-rocket-notifications');
    if (saved) {
      try {
        return { ...this.getDefaultSettings(), ...JSON.parse(saved) };
      } catch (error) {
        console.warn('Failed to load notification settings:', error);
      }
    }
    return this.getDefaultSettings();
  }

  /**
   * Get default notification settings
   */
  private getDefaultSettings(): NotificationSettings {
    return {
      enabled: false,
      highVisibilityOnly: true,
      reminderTimes: [60, 15, 5], // 1 hour, 15 minutes, 5 minutes before
      soundEnabled: true
    };
  }

  /**
   * Save notification settings to localStorage
   */
  private saveSettings(): void {
    try {
      localStorage.setItem('bermuda-rocket-notifications', JSON.stringify(this.settings));
      this.notifySubscribers();
    } catch (error) {
      console.error('Failed to save notification settings:', error);
    }
  }

  /**
   * Check if notifications are supported
   */
  isSupported(): boolean {
    return 'Notification' in window;
  }

  /**
   * Get current notification permission status
   */
  getPermission(): NotificationPermission {
    return this.isSupported() ? Notification.permission : 'denied';
  }

  /**
   * Request notification permission
   */
  async requestPermission(): Promise<NotificationPermission> {
    if (!this.isSupported()) {
      return 'denied';
    }

    try {
      const permission = await Notification.requestPermission();
      this.notifySubscribers();
      return permission;
    } catch (error) {
      console.error('Failed to request notification permission:', error);
      return 'denied';
    }
  }

  /**
   * Get current notification status
   */
  getStatus(): NotificationStatus {
    return {
      permission: this.getPermission(),
      supported: this.isSupported(),
      settings: { ...this.settings }
    };
  }

  /**
   * Update notification settings
   */
  async updateSettings(newSettings: Partial<NotificationSettings>): Promise<void> {
    this.settings = { ...this.settings, ...newSettings };

    // If enabling notifications, request permission
    if (newSettings.enabled && this.getPermission() === 'default') {
      const permission = await this.requestPermission();
      if (permission !== 'granted') {
        this.settings.enabled = false;
      }
    }

    this.saveSettings();
  }

  /**
   * Schedule notifications for launches
   */
  scheduleNotifications(launches: LaunchWithVisibility[]): void {
    // Clear existing notifications
    this.clearAllNotifications();

    if (!this.settings.enabled || this.getPermission() !== 'granted') {
      return;
    }

    const now = new Date().getTime();

    launches.forEach(launch => {
      // Skip if not visible enough
      if (this.settings.highVisibilityOnly && launch.visibility.likelihood !== 'high' && launch.visibility.likelihood !== 'medium') {
        return;
      }

      const launchTime = new Date(launch.net).getTime();
      const timeUntilLaunch = launchTime - now;

      // Skip past launches
      if (timeUntilLaunch <= 0) {
        return;
      }

      const timers: NodeJS.Timeout[] = [];

      // Schedule reminder notifications
      this.settings.reminderTimes.forEach(minutesBefore => {
        const reminderTime = launchTime - (minutesBefore * 60 * 1000);
        const timeUntilReminder = reminderTime - now;

        if (timeUntilReminder > 0) {
          const timer = setTimeout(() => {
            this.showNotification(launch, minutesBefore);
          }, timeUntilReminder);

          timers.push(timer);
        }
      });

      // Schedule launch notification
      if (timeUntilLaunch > 0 && timeUntilLaunch <= 2 * 60 * 1000) { // Within 2 minutes
        const timer = setTimeout(() => {
          this.showLaunchNotification(launch);
        }, timeUntilLaunch);

        timers.push(timer);
      }

      if (timers.length > 0) {
        this.scheduledNotifications.set(launch.id, timers);
      }
    });

  }

  /**
   * Show reminder notification
   */
  private showNotification(launch: LaunchWithVisibility, minutesBefore: number): void {
    if (!this.settings.enabled || this.getPermission() !== 'granted') {
      return;
    }

    const timeText = minutesBefore >= 60 
      ? `${Math.floor(minutesBefore / 60)} hour${Math.floor(minutesBefore / 60) > 1 ? 's' : ''}`
      : `${minutesBefore} minute${minutesBefore > 1 ? 's' : ''}`;

    const notification = new Notification(`🚀 Launch Reminder`, {
      body: `${launch.name} launches in ${timeText} and is ${launch.visibility.likelihood === 'high' ? 'likely' : 'possibly'} visible from Bermuda!`,
      icon: '/logo192.png',
      badge: '/logo192.png',
      tag: `launch-reminder-${launch.id}-${minutesBefore}`,
      requireInteraction: minutesBefore <= 15, // Require interaction for close reminders
      actions: [
        { action: 'view', title: 'View Details' },
        { action: 'dismiss', title: 'Dismiss' }
      ],
      data: {
        launchId: launch.id,
        type: 'reminder',
        minutesBefore
      }
    });

    // Handle notification click
    notification.onclick = () => {
      window.focus();
      notification.close();
      
      // Scroll to launch card
      const launchElement = document.getElementById(`launch-${launch.id}`);
      if (launchElement) {
        launchElement.scrollIntoView({ behavior: 'smooth' });
      }
    };

    // Auto-close after 10 seconds for non-urgent reminders
    if (minutesBefore > 15) {
      setTimeout(() => {
        notification.close();
      }, 10000);
    }

    // Play sound if enabled
    if (this.settings.soundEnabled) {
      this.playNotificationSound();
    }
  }

  /**
   * Show launch notification (at launch time)
   */
  private showLaunchNotification(launch: LaunchWithVisibility): void {
    if (!this.settings.enabled || this.getPermission() !== 'granted') {
      return;
    }

    const notification = new Notification(`🚀 Launch Now!`, {
      body: `${launch.name} is launching now! Look ${launch.visibility.bearing ? this.getBearingDirection(launch.visibility.bearing) : 'toward the sky'} for the best view.`,
      icon: '/logo192.png',
      badge: '/logo192.png',
      tag: `launch-now-${launch.id}`,
      requireInteraction: true,
      actions: [
        { action: 'view', title: 'View Live' },
        { action: 'dismiss', title: 'Dismiss' }
      ],
      data: {
        launchId: launch.id,
        type: 'launch'
      }
    });

    notification.onclick = () => {
      window.focus();
      notification.close();
      
      // Open live stream if available
      if (launch.livestream_url) {
        window.open(launch.livestream_url, '_blank');
      }
    };

    // Play sound
    if (this.settings.soundEnabled) {
      this.playNotificationSound(true); // More urgent sound
    }
  }

  /**
   * Play notification sound
   */
  private playNotificationSound(urgent = false): void {
    try {
      // Create audio context and generate a simple beep
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);

      oscillator.frequency.setValueAtTime(urgent ? 800 : 400, audioContext.currentTime);
      oscillator.type = 'sine';

      gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);

      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.5);
    } catch (error) {
      console.warn('Failed to play notification sound:', error);
    }
  }

  /**
   * Get bearing direction text
   */
  private getBearingDirection(bearing: number): string {
    const directions = [
      'North', 'NNE', 'NE', 'ENE', 'East', 'ESE', 'SE', 'SSE',
      'South', 'SSW', 'SW', 'WSW', 'West', 'WNW', 'NW', 'NNW'
    ];
    const index = Math.round(bearing / 22.5) % 16;
    return directions[index];
  }

  /**
   * Clear all scheduled notifications
   */
  clearAllNotifications(): void {
    this.scheduledNotifications.forEach(timers => {
      timers.forEach(timer => clearTimeout(timer));
    });
    this.scheduledNotifications.clear();
  }

  /**
   * Clear notifications for specific launch
   */
  clearNotifications(launchId: string): void {
    const timers = this.scheduledNotifications.get(launchId);
    if (timers) {
      timers.forEach(timer => clearTimeout(timer));
      this.scheduledNotifications.delete(launchId);
    }
  }

  /**
   * Subscribe to status changes
   */
  subscribe(callback: (status: NotificationStatus) => void): () => void {
    this.subscribers.push(callback);
    
    return () => {
      const index = this.subscribers.indexOf(callback);
      if (index > -1) {
        this.subscribers.splice(index, 1);
      }
    };
  }

  /**
   * Notify subscribers of status changes
   */
  private notifySubscribers(): void {
    const status = this.getStatus();
    this.subscribers.forEach(callback => {
      try {
        callback(status);
      } catch (error) {
        console.error('Error in notification subscriber:', error);
      }
    });
  }

  /**
   * Handle page visibility changes
   */
  private setupVisibilityChangeHandler(): void {
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden && this.settings.enabled) {
        // Page became visible - user might have clicked a notification
        // Could implement logic to highlight relevant launch here
      }
    });
  }

  /**
   * Test notification (for user to verify it works)
   */
  async testNotification(): Promise<boolean> {
    if (!this.isSupported()) {
      throw new Error('Notifications not supported');
    }

    if (this.getPermission() !== 'granted') {
      const permission = await this.requestPermission();
      if (permission !== 'granted') {
        throw new Error('Notification permission denied');
      }
    }

    try {
      const notification = new Notification('🚀 Test Notification', {
        body: 'Notifications are working! You\'ll be notified of upcoming visible launches.',
        icon: '/logo192.png',
        tag: 'test-notification'
      });

      setTimeout(() => notification.close(), 5000);

      if (this.settings.soundEnabled) {
        this.playNotificationSound();
      }

      return true;
    } catch (error) {
      console.error('Test notification failed:', error);
      throw error;
    }
  }

  /**
   * Get scheduled notification count
   */
  getScheduledCount(): number {
    return this.scheduledNotifications.size;
  }

  /**
   * Clean up resources
   */
  destroy(): void {
    this.clearAllNotifications();
    this.subscribers = [];
  }
}

// Export singleton instance
export const notificationService = new NotificationService();