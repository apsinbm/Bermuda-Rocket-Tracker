/**
 * Delay Notification Panel Component
 * 
 * Shows users when launches have been delayed, rescheduled, or cancelled
 * with clear messaging and acknowledgment capabilities.
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { launchDelayDetectionService, DelayNotification } from '../services/launchDelayDetectionService';

const DelayNotificationPanel: React.FC = () => {
  const [notifications, setNotifications] = useState<DelayNotification[]>([]);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Load unacknowledged notifications
    const loadNotifications = () => {
      const unacknowledged = launchDelayDetectionService.getUnacknowledgedNotifications();
      setNotifications(unacknowledged);
      setIsVisible(unacknowledged.length > 0);
    };

    loadNotifications();

    // Subscribe to new schedule changes
    const unsubscribe = launchDelayDetectionService.subscribe((changes) => {
      loadNotifications(); // Reload notifications when changes occur
    });

    return unsubscribe;
  }, []);

  const handleAcknowledge = (notificationId: string) => {
    launchDelayDetectionService.acknowledgeNotification(notificationId);
    setNotifications(prev => prev.filter(n => n.id !== notificationId));
    
    // Hide panel if no more notifications
    if (notifications.length <= 1) {
      setIsVisible(false);
    }
  };

  const handleAcknowledgeAll = () => {
    notifications.forEach(notification => {
      launchDelayDetectionService.acknowledgeNotification(notification.id);
    });
    setNotifications([]);
    setIsVisible(false);
  };

  const getNotificationIcon = (type: DelayNotification['type']): string => {
    switch (type) {
      case 'cancellation': return '❌';
      case 'major_delay': return '⏰';
      case 'delay': return '🕐';
      case 'minor_delay': return '⏱️';
      default: return '📢';
    }
  };

  const getNotificationColor = (type: DelayNotification['type']): string => {
    switch (type) {
      case 'cancellation': return 'bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-800';
      case 'major_delay': return 'bg-orange-50 border-orange-200 dark:bg-orange-900/20 dark:border-orange-800';
      case 'delay': return 'bg-yellow-50 border-yellow-200 dark:bg-yellow-900/20 dark:border-yellow-800';
      case 'minor_delay': return 'bg-blue-50 border-blue-200 dark:bg-blue-900/20 dark:border-blue-800';
      default: return 'bg-gray-50 border-gray-200 dark:bg-gray-900/20 dark:border-gray-800';
    }
  };

  const formatTimestamp = (timestamp: number): string => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMinutes = Math.floor((now.getTime() - timestamp) / (1000 * 60));

    if (diffMinutes < 1) return 'Just now';
    if (diffMinutes < 60) return `${diffMinutes}m ago`;
    if (diffMinutes < 1440) return `${Math.floor(diffMinutes / 60)}h ago`;
    return date.toLocaleDateString();
  };

  if (!isVisible || notifications.length === 0) {
    return null;
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -50 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -50 }}
        className="fixed top-4 right-4 z-50 w-96 max-w-[90vw]"
      >
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
          {/* Header */}
          <div className="bg-gradient-to-r from-orange-500 to-red-500 text-white p-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <span className="text-lg">⚠️</span>
                <h3 className="font-semibold">Schedule Updates</h3>
              </div>
              <div className="flex items-center space-x-2">
                <span className="text-xs bg-white/20 px-2 py-1 rounded">
                  {notifications.length}
                </span>
                <button
                  onClick={() => setIsVisible(false)}
                  className="text-white/80 hover:text-white text-xl leading-none"
                  aria-label="Close notifications"
                >
                  ×
                </button>
              </div>
            </div>
          </div>

          {/* Notifications List */}
          <div className="max-h-96 overflow-y-auto">
            {notifications.map((notification, index) => (
              <motion.div
                key={notification.id}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.1 }}
                className={`p-3 border-b border-gray-100 dark:border-gray-700 last:border-b-0 ${getNotificationColor(notification.type)}`}
              >
                <div className="flex items-start space-x-3">
                  <span className="text-lg flex-shrink-0 mt-0.5">
                    {getNotificationIcon(notification.type)}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-900 dark:text-gray-100 leading-relaxed">
                      {notification.message}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      {formatTimestamp(notification.timestamp)}
                    </p>
                  </div>
                  <button
                    onClick={() => handleAcknowledge(notification.id)}
                    className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 text-sm flex-shrink-0"
                    aria-label="Acknowledge notification"
                  >
                    ✓
                  </button>
                </div>
              </motion.div>
            ))}
          </div>

          {/* Footer Actions */}
          {notifications.length > 1 && (
            <div className="bg-gray-50 dark:bg-gray-800 p-3 border-t border-gray-200 dark:border-gray-700">
              <button
                onClick={handleAcknowledgeAll}
                className="w-full text-sm text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 py-1 transition-colors"
              >
                Acknowledge All
              </button>
            </div>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  );
};

export default DelayNotificationPanel;