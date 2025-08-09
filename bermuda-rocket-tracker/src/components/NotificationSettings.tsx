/**
 * Notification Settings Component
 * Allows users to configure launch notifications
 */

import React, { useState, useEffect } from 'react';
import { notificationService, NotificationStatus, NotificationSettings as NotificationSettingsType } from '../services/notificationService';

interface NotificationSettingsProps {
  onClose?: () => void;
  className?: string;
}

const NotificationSettings: React.FC<NotificationSettingsProps> = ({
  onClose,
  className = ''
}) => {
  const [status, setStatus] = useState<NotificationStatus>(notificationService.getStatus());
  const [isTestingNotification, setIsTestingNotification] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  useEffect(() => {
    const unsubscribe = notificationService.subscribe(setStatus);
    return unsubscribe;
  }, []);

  const handleToggleEnabled = async () => {
    const newEnabled = !status.settings.enabled;
    
    if (newEnabled && status.permission === 'default') {
      // Will request permission automatically
      await notificationService.updateSettings({ enabled: newEnabled });
    } else if (newEnabled && status.permission === 'denied') {
      // Show instructions for enabling in browser
      setTestResult({
        success: false,
        message: 'Please enable notifications in your browser settings and refresh the page.'
      });
      return;
    } else {
      await notificationService.updateSettings({ enabled: newEnabled });
    }
  };

  const handleUpdateSettings = async (updates: Partial<NotificationSettingsType>) => {
    await notificationService.updateSettings(updates);
  };

  const handleTestNotification = async () => {
    setIsTestingNotification(true);
    setTestResult(null);

    try {
      await notificationService.testNotification();
      setTestResult({
        success: true,
        message: 'Test notification sent successfully! Check your notification area.'
      });
    } catch (error) {
      setTestResult({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to send test notification'
      });
    } finally {
      setIsTestingNotification(false);
    }
  };

  const getReminderTimeText = (minutes: number): string => {
    if (minutes >= 60) {
      const hours = Math.floor(minutes / 60);
      const remainingMinutes = minutes % 60;
      if (remainingMinutes === 0) {
        return `${hours} hour${hours > 1 ? 's' : ''}`;
      }
      return `${hours}h ${remainingMinutes}m`;
    }
    return `${minutes} minute${minutes > 1 ? 's' : ''}`;
  };

  const addReminderTime = () => {
    const timeStr = prompt('Enter reminder time in minutes (e.g., 30 for 30 minutes before launch):');
    if (timeStr) {
      const minutes = parseInt(timeStr, 10);
      if (!isNaN(minutes) && minutes > 0 && minutes <= 1440) { // Max 24 hours
        const newTimes = [...status.settings.reminderTimes, minutes].sort((a, b) => b - a);
        handleUpdateSettings({ reminderTimes: newTimes });
      } else {
        alert('Please enter a valid number between 1 and 1440 minutes.');
      }
    }
  };

  const removeReminderTime = (minutes: number) => {
    const newTimes = status.settings.reminderTimes.filter(t => t !== minutes);
    handleUpdateSettings({ reminderTimes: newTimes });
  };

  if (!status.supported) {
    return (
      <div className={`bg-white dark:bg-gray-800 rounded-lg p-6 ${className}`}>
        <div className="text-center">
          <div className="text-gray-400 text-4xl mb-4">🔕</div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
            Notifications Not Supported
          </h3>
          <p className="text-gray-600 dark:text-gray-400">
            Your browser doesn't support notifications. Please use a modern browser like Chrome, Firefox, or Safari.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-white dark:bg-gray-800 rounded-lg shadow-xl ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            🔔 Launch Notifications
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Get notified about upcoming visible rocket launches
          </p>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 text-xl"
          >
            ×
          </button>
        )}
      </div>

      <div className="p-6 space-y-6">
        {/* Permission Status */}
        <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
          <div>
            <div className="font-medium text-gray-900 dark:text-white">
              Notification Permission
            </div>
            <div className="text-sm text-gray-600 dark:text-gray-400">
              {status.permission === 'granted' && '✅ Granted - Notifications enabled'}
              {status.permission === 'denied' && '❌ Denied - Please enable in browser settings'}
              {status.permission === 'default' && '⏳ Not requested yet'}
            </div>
          </div>
          {status.permission === 'denied' && (
            <button
              onClick={() => window.location.reload()}
              className="px-3 py-1 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded"
            >
              Refresh Page
            </button>
          )}
        </div>

        {/* Enable/Disable Toggle */}
        <div className="flex items-center justify-between">
          <div>
            <div className="font-medium text-gray-900 dark:text-white">
              Enable Notifications
            </div>
            <div className="text-sm text-gray-600 dark:text-gray-400">
              Receive alerts for upcoming visible launches
            </div>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={status.settings.enabled}
              onChange={handleToggleEnabled}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
          </label>
        </div>

        {status.settings.enabled && (
          <>
            {/* High Visibility Only */}
            <div className="flex items-center justify-between">
              <div>
                <div className="font-medium text-gray-900 dark:text-white">
                  High Visibility Only
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  Only notify for launches with high or medium visibility
                </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={status.settings.highVisibilityOnly}
                  onChange={(e) => handleUpdateSettings({ highVisibilityOnly: e.target.checked })}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
              </label>
            </div>

            {/* Sound Enable */}
            <div className="flex items-center justify-between">
              <div>
                <div className="font-medium text-gray-900 dark:text-white">
                  Notification Sound
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  Play a sound with notifications
                </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={status.settings.soundEnabled}
                  onChange={(e) => handleUpdateSettings({ soundEnabled: e.target.checked })}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
              </label>
            </div>

            {/* Reminder Times */}
            <div>
              <div className="font-medium text-gray-900 dark:text-white mb-3">
                Reminder Times
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                When to send notifications before launch
              </div>
              
              <div className="space-y-2">
                {status.settings.reminderTimes.map((minutes) => (
                  <div key={minutes} className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-700 rounded">
                    <span className="text-gray-900 dark:text-white">
                      {getReminderTimeText(minutes)} before launch
                    </span>
                    <button
                      onClick={() => removeReminderTime(minutes)}
                      className="text-red-500 hover:text-red-700 text-sm px-2 py-1"
                    >
                      Remove
                    </button>
                  </div>
                ))}
                
                <button
                  onClick={addReminderTime}
                  className="w-full p-2 border border-dashed border-gray-300 dark:border-gray-600 rounded text-gray-600 dark:text-gray-400 hover:border-blue-500 hover:text-blue-500 transition-colors"
                >
                  + Add Reminder Time
                </button>
              </div>
            </div>

            {/* Test Notification */}
            <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
              <button
                onClick={handleTestNotification}
                disabled={isTestingNotification || status.permission !== 'granted'}
                className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white rounded-lg transition-colors"
              >
                {isTestingNotification ? '⏳ Sending...' : '🧪 Send Test Notification'}
              </button>
              
              {testResult && (
                <div className={`mt-3 p-3 rounded-lg text-sm ${
                  testResult.success 
                    ? 'bg-green-50 dark:bg-green-900/20 text-green-800 dark:text-green-200 border border-green-200 dark:border-green-800'
                    : 'bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-200 border border-red-200 dark:border-red-800'
                }`}>
                  {testResult.message}
                </div>
              )}
            </div>
          </>
        )}

        {/* Usage Tips */}
        <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
          <div className="font-medium text-gray-900 dark:text-white mb-2">
            💡 Tips
          </div>
          <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
            <li>• Notifications work even when the app is closed in your browser</li>
            <li>• Click on notifications to quickly view launch details</li>
            <li>• You can enable/disable notifications in your browser settings anytime</li>
            <li>• Notifications are only sent for launches visible from Bermuda</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default NotificationSettings;