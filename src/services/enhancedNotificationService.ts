/**
 * Enhanced Notification Service
 * 
 * Provides intelligent push notifications with weather-aware timing
 * and customizable reminder intervals
 */

import { LaunchWithVisibility } from '../types';
import { WeatherService } from './weatherService';

export interface NotificationSettings {
  enabled: boolean;
  reminders: {
    oneHour: boolean;
    thirtyMinutes: boolean;
    tenMinutes: boolean;
    fiveMinutes: boolean;
    atLaunch: boolean;
  };
  weatherAware: boolean;
  onlyHighVisibility: boolean;
  soundEnabled: boolean;
  vibrationEnabled: boolean;
  customMessage?: string;
}

export interface ScheduledNotification {
  id: string;
  launchId: string;
  launchName: string;
  scheduledTime: Date;
  type: 'reminder' | 'weather_update' | 'launch_alert';
  message: string;
  weatherFactor?: string;
}

export class EnhancedNotificationService {
  private static readonly STORAGE_KEY = 'bermuda-notification-settings';
  private static readonly SCHEDULED_KEY = 'bermuda-scheduled-notifications';
  private static registrationPromise: Promise<ServiceWorkerRegistration | null> | null = null;

  // Default notification settings
  private static readonly DEFAULT_SETTINGS: NotificationSettings = {
    enabled: false,
    reminders: {
      oneHour: true,
      thirtyMinutes: true,
      tenMinutes: true,
      fiveMinutes: true,
      atLaunch: false
    },
    weatherAware: true,
    onlyHighVisibility: false,
    soundEnabled: true,
    vibrationEnabled: true
  };

  static async initialize(): Promise<void> {
    if (!('serviceWorker' in navigator) || !('Notification' in window)) {
      console.warn('Push notifications not supported');
      return;
    }

    // Note: Service worker removed for now due to hardcoded asset paths
    // Will be re-implemented with proper Workbox integration in the future
    console.log('Notification service initialized without service worker');
    this.registrationPromise = Promise.resolve(null as any);
  }

  static async requestPermission(): Promise<boolean> {
    if (!('Notification' in window)) {
      console.warn('Notifications not supported');
      return false;
    }

    if (Notification.permission === 'granted') {
      return true;
    }

    if (Notification.permission === 'denied') {
      return false;
    }

    try {
      const permission = await Notification.requestPermission();
      return permission === 'granted';
    } catch (error) {
      console.error('Failed to request notification permission:', error);
      return false;
    }
  }

  static getSettings(): NotificationSettings {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      if (stored) {
        return { ...this.DEFAULT_SETTINGS, ...JSON.parse(stored) };
      }
    } catch (error) {
      console.error('Failed to load notification settings:', error);
    }
    return this.DEFAULT_SETTINGS;
  }

  static saveSettings(settings: NotificationSettings): void {
    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(settings));
    } catch (error) {
      console.error('Failed to save notification settings:', error);
    }
  }

  static async scheduleNotifications(launches: LaunchWithVisibility[]): Promise<void> {
    const settings = this.getSettings();
    
    if (!settings.enabled) {
      this.clearAllScheduledNotifications();
      return;
    }

    const hasPermission = await this.requestPermission();
    if (!hasPermission) {
      console.warn('Notification permission denied');
      return;
    }

    // Clear existing scheduled notifications
    this.clearAllScheduledNotifications();

    const scheduledNotifications: ScheduledNotification[] = [];

    for (const launch of launches) {
      // Skip launches with no visibility if setting is enabled
      if (settings.onlyHighVisibility && launch.visibility.likelihood === 'none') {
        continue;
      }

      const launchTime = new Date(launch.net);
      const now = new Date();

      // Only schedule notifications for future launches
      if (launchTime <= now) continue;

      const baseMessage = `🚀 ${launch.mission.name} launches in`;
      
      // Schedule reminder notifications
      if (settings.reminders.oneHour) {
        const oneHourBefore = new Date(launchTime.getTime() - 60 * 60 * 1000);
        if (oneHourBefore > now) {
          scheduledNotifications.push(await this.createNotification(
            launch, oneHourBefore, 'reminder', `${baseMessage} 1 hour!`
          ));
        }
      }

      if (settings.reminders.thirtyMinutes) {
        const thirtyMinBefore = new Date(launchTime.getTime() - 30 * 60 * 1000);
        if (thirtyMinBefore > now) {
          scheduledNotifications.push(await this.createNotification(
            launch, thirtyMinBefore, 'reminder', `${baseMessage} 30 minutes!`
          ));
        }
      }

      if (settings.reminders.tenMinutes) {
        const tenMinBefore = new Date(launchTime.getTime() - 10 * 60 * 1000);
        if (tenMinBefore > now) {
          const weatherInfo = settings.weatherAware ? await this.getWeatherInfo(launch) : '';
          scheduledNotifications.push(await this.createNotification(
            launch, tenMinBefore, 'reminder', 
            `${baseMessage} 10 minutes! ${weatherInfo}`, weatherInfo
          ));
        }
      }

      if (settings.reminders.fiveMinutes) {
        const fiveMinBefore = new Date(launchTime.getTime() - 5 * 60 * 1000);
        if (fiveMinBefore > now) {
          const weatherInfo = settings.weatherAware ? await this.getWeatherInfo(launch) : '';
          scheduledNotifications.push(await this.createNotification(
            launch, fiveMinBefore, 'reminder',
            `${baseMessage} 5 minutes! Get outside! ${weatherInfo}`, weatherInfo
          ));
        }
      }

      if (settings.reminders.atLaunch) {
        scheduledNotifications.push(await this.createNotification(
          launch, launchTime, 'launch_alert', `🚀 ${launch.mission.name} is launching NOW!`
        ));
      }

      // Schedule weather update 2 hours before high visibility launches
      if (settings.weatherAware && 
          (launch.visibility.likelihood === 'high' || launch.visibility.likelihood === 'medium')) {
        const twoHoursBefore = new Date(launchTime.getTime() - 2 * 60 * 60 * 1000);
        if (twoHoursBefore > now) {
          const weatherInfo = await this.getWeatherInfo(launch);
          scheduledNotifications.push(await this.createNotification(
            launch, twoHoursBefore, 'weather_update',
            `🌤️ Weather update: ${weatherInfo}`, weatherInfo
          ));
        }
      }
    }

    // Store scheduled notifications
    this.saveScheduledNotifications(scheduledNotifications);

    // Schedule with browser
    await this.scheduleWithBrowser(scheduledNotifications);

    console.log(`Scheduled ${scheduledNotifications.length} notifications for ${launches.length} launches`);
  }

  private static async createNotification(
    launch: LaunchWithVisibility, 
    scheduledTime: Date, 
    type: ScheduledNotification['type'], 
    message: string,
    weatherFactor?: string
  ): Promise<ScheduledNotification> {
    return {
      id: `${launch.id}-${type}-${scheduledTime.getTime()}`,
      launchId: launch.id,
      launchName: launch.mission.name,
      scheduledTime,
      type,
      message,
      weatherFactor
    };
  }

  private static async getWeatherInfo(launch: LaunchWithVisibility): Promise<string> {
    try {
      const weatherAssessment = await WeatherService.getWeatherForLaunch(new Date(launch.net));
      
      switch (weatherAssessment.overallRating) {
        case 'excellent':
          return '🌟 Perfect viewing conditions!';
        case 'good':
          return '👍 Good weather expected.';
        case 'fair':
          return '⚠️ Weather may affect visibility.';
        case 'poor':
        case 'very_poor':
          return '🌧️ Poor weather conditions expected.';
        default:
          return '';
      }
    } catch (error) {
      console.error('Failed to get weather info for notification:', error);
      return '';
    }
  }

  private static async scheduleWithBrowser(notifications: ScheduledNotification[]): Promise<void> {
    const settings = this.getSettings();
    
    for (const notification of notifications) {
      const timeUntilNotification = notification.scheduledTime.getTime() - Date.now();
      
      if (timeUntilNotification <= 0) continue;

      setTimeout(() => {
        this.showNotification(notification, settings);
      }, timeUntilNotification);
    }
  }

  private static async showNotification(
    notification: ScheduledNotification, 
    settings: NotificationSettings
  ): Promise<void> {
    try {
      const options: NotificationOptions = {
        body: notification.message,
        icon: '/rocket-icon-192.png', // You'd need to add this icon
        badge: '/rocket-badge-96.png', // You'd need to add this badge
        tag: notification.id,
        requireInteraction: notification.type === 'launch_alert',
        vibrate: settings.vibrationEnabled ? [200, 100, 200] : undefined,
        actions: [
          {
            action: 'view',
            title: 'View Launch',
            icon: '/action-view.png'
          },
          {
            action: 'dismiss',
            title: 'Dismiss'
          }
        ],
        data: {
          launchId: notification.launchId,
          type: notification.type,
          url: `/#launch-${notification.launchId}`
        }
      };

      // Try to use service worker first
      if (this.registrationPromise) {
        const registration = await this.registrationPromise;
        if (registration) {
          await registration.showNotification(
            `🚀 Bermuda Rocket Tracker`, 
            options
          );
          return;
        }
      }

      // Fallback to simple notification
      const browserNotification = new Notification(
        `🚀 ${notification.launchName}`, 
        {
          ...options,
          actions: undefined // Browser notifications don't support actions
        }
      );

      browserNotification.onclick = () => {
        window.focus();
        window.location.hash = `#launch-${notification.launchId}`;
        browserNotification.close();
      };

      // Auto-close after 10 seconds unless it's a launch alert
      if (notification.type !== 'launch_alert') {
        setTimeout(() => browserNotification.close(), 10000);
      }

    } catch (error) {
      console.error('Failed to show notification:', error);
    }
  }

  static getScheduledNotifications(): ScheduledNotification[] {
    try {
      const stored = localStorage.getItem(this.SCHEDULED_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch (error) {
      console.error('Failed to load scheduled notifications:', error);
      return [];
    }
  }

  private static saveScheduledNotifications(notifications: ScheduledNotification[]): void {
    try {
      localStorage.setItem(this.SCHEDULED_KEY, JSON.stringify(notifications));
    } catch (error) {
      console.error('Failed to save scheduled notifications:', error);
    }
  }

  static clearAllScheduledNotifications(): void {
    try {
      localStorage.removeItem(this.SCHEDULED_KEY);
    } catch (error) {
      console.error('Failed to clear scheduled notifications:', error);
    }
  }

  static async testNotification(): Promise<void> {
    const hasPermission = await this.requestPermission();
    if (!hasPermission) {
      alert('Please allow notifications to test');
      return;
    }

    const testNotification: ScheduledNotification = {
      id: 'test-notification',
      launchId: 'test',
      launchName: 'Test Launch',
      scheduledTime: new Date(),
      type: 'reminder',
      message: 'This is a test notification from Bermuda Rocket Tracker! 🚀'
    };

    await this.showNotification(testNotification, this.getSettings());
  }

  static async getNotificationStatus(): Promise<{
    supported: boolean;
    permission: NotificationPermission;
    serviceWorkerReady: boolean;
  }> {
    return {
      supported: 'Notification' in window && 'serviceWorker' in navigator,
      permission: 'Notification' in window ? Notification.permission : 'denied',
      serviceWorkerReady: !!(this.registrationPromise && await this.registrationPromise)
    };
  }
}