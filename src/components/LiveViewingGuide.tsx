/**
 * Live Viewing Guide Component
 * Comprehensive real-time launch viewing companion
 */

import React, { useState, useEffect, useCallback } from 'react';
import { LaunchWithVisibility } from '../types';
import LiveCountdown, { LaunchPhase } from './LiveCountdown';
import WeatherDisplay from './WeatherDisplay';

interface LiveViewingGuideProps {
  launch: LaunchWithVisibility;
  onClose: () => void;
}

interface ViewingTip {
  id: string;
  title: string;
  description: string;
  icon: string;
  importance: 'critical' | 'high' | 'medium' | 'low';
}

const LiveViewingGuide: React.FC<LiveViewingGuideProps> = ({ launch, onClose }) => {
  const [currentPhase, setCurrentPhase] = useState<LaunchPhase | null>(null);
  const [activeTab, setActiveTab] = useState<'countdown' | 'weather' | 'tips'>('countdown');
  const [hasNotificationPermission, setHasNotificationPermission] = useState(false);
  const [wakeLockSupported, setWakeLockSupported] = useState(false);
  const [wakeLock, setWakeLock] = useState<any>(null);

  // Check for wake lock support
  useEffect(() => {
    setWakeLockSupported('wakeLock' in navigator);
  }, []);

  // Request notification permission
  const requestNotificationPermission = useCallback(async () => {
    if ('Notification' in window) {
      const permission = await Notification.requestPermission();
      setHasNotificationPermission(permission === 'granted');
    }
  }, []);

  // Enable screen wake lock during critical phases
  const requestWakeLock = useCallback(async () => {
    if (wakeLockSupported && !wakeLock) {
      try {
        const newWakeLock = await (navigator as any).wakeLock.request('screen');
        setWakeLock(newWakeLock);
        console.log('[LiveViewingGuide] Screen wake lock enabled');
      } catch (error) {
        console.warn('[LiveViewingGuide] Wake lock failed:', error);
      }
    }
  }, [wakeLockSupported, wakeLock]);

  // Release wake lock
  const releaseWakeLock = useCallback(() => {
    if (wakeLock) {
      wakeLock.release();
      setWakeLock(null);
      console.log('[LiveViewingGuide] Screen wake lock released');
    }
  }, [wakeLock]);

  // Handle phase changes
  const handlePhaseChange = useCallback((phase: LaunchPhase) => {
    setCurrentPhase(phase);

    // Enable wake lock for critical phases
    if (phase.urgency === 'critical' && !wakeLock) {
      requestWakeLock();
    } else if (phase.urgency !== 'critical' && wakeLock) {
      releaseWakeLock();
    }

    // Send notifications for important phases
    if (hasNotificationPermission && phase.urgency === 'critical') {
      new Notification(`${launch.name} - ${phase.name}`, {
        body: phase.instructions || phase.description,
        icon: '/favicon.ico',
        tag: `launch-${launch.id}-${phase.id}`
      });
    }

    // Haptic feedback on mobile
    if ('vibrate' in navigator && phase.urgency === 'critical') {
      navigator.vibrate([200, 100, 200]);
    }
  }, [launch, hasNotificationPermission, wakeLock, requestWakeLock, releaseWakeLock]);

  // Cleanup wake lock on unmount
  useEffect(() => {
    return () => {
      releaseWakeLock();
    };
  }, [releaseWakeLock]);

  // Get viewing tips based on current phase and conditions
  const getViewingTips = (): ViewingTip[] => {
    const tips: ViewingTip[] = [];

    // Phase-specific tips
    if (currentPhase) {
      if (currentPhase.id === 'visibility-start' || currentPhase.id === 'visibility-peak') {
        tips.push({
          id: 'look-up',
          title: 'Look Up Now!',
          description: 'The rocket should be visible as a bright moving point of light. It may look like a fast-moving star.',
          icon: '👁️',
          importance: 'critical'
        });
      }

      if (currentPhase.timeFromLaunch > 0 && currentPhase.timeFromLaunch < 300) {
        tips.push({
          id: 'exhaust-plume',
          title: 'Watch for Exhaust Plume',
          description: 'Look for a bright orange/white flame at the base of the rocket, especially visible against dark sky.',
          icon: '🔥',
          importance: 'high'
        });
      }
    }

    // General viewing tips
    tips.push(
      {
        id: 'dark-adaptation',
        title: 'Preserve Night Vision',
        description: 'Avoid bright lights for 10-15 minutes before launch to improve your ability to see the rocket.',
        icon: '🌙',
        importance: 'medium'
      },
      {
        id: 'location',
        title: 'Find Clear View Southwest',
        description: 'Position yourself with an unobstructed view toward the southwest horizon where the rocket will first appear.',
        icon: '🧭',
        importance: 'high'
      },
      {
        id: 'tracking',
        title: 'Track the Movement',
        description: 'The rocket will move across the sky from southwest to northeast. Keep your eyes moving with it.',
        icon: '👀',
        importance: 'medium'
      },
      {
        id: 'binoculars',
        title: 'Use Binoculars (Optional)',
        description: 'Binoculars can help you see more detail, but the rocket is usually visible to the naked eye.',
        icon: '🔍',
        importance: 'low'
      }
    );

    // Weather-based tips
    if (launch.visibility.likelihood === 'low') {
      tips.push({
        id: 'weather-challenge',
        title: 'Challenging Conditions',
        description: 'Visibility may be reduced due to weather. Look for brief glimpses through cloud breaks.',
        icon: '☁️',
        importance: 'high'
      });
    }

    return tips.sort((a, b) => {
      const importance = { critical: 4, high: 3, medium: 2, low: 1 };
      return importance[b.importance] - importance[a.importance];
    });
  };

  const viewingTips = getViewingTips();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-75 p-2">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-2xl max-w-4xl w-full max-h-[95vh] overflow-hidden">
        {/* Header */}
        <div className="flex justify-between items-center p-4 border-b border-gray-200 dark:border-gray-700 bg-gradient-to-r from-blue-600 to-purple-600">
          <div className="text-white">
            <h2 className="text-xl font-bold">🚀 Live Viewing Guide</h2>
            <p className="text-sm opacity-90">{launch.name}</p>
          </div>
          <button
            onClick={onClose}
            className="text-white hover:text-gray-200 text-2xl transition-colors"
            aria-label="Close viewing guide"
          >
            ×
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
          {[
            { id: 'countdown', label: 'Countdown', icon: '⏱️' },
            { id: 'weather', label: 'Weather', icon: '🌤️' },
            { id: 'tips', label: 'Tips', icon: '💡' }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex-1 py-3 px-2 text-center text-sm font-medium transition-colors ${
                activeTab === tab.id
                  ? 'text-blue-600 dark:text-blue-400 bg-white dark:bg-gray-800 border-b-2 border-blue-600'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200'
              }`}
            >
              <div className="flex flex-col items-center space-y-1">
                <span>{tab.icon}</span>
                <span className="hidden sm:block">{tab.label}</span>
              </div>
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="p-4 overflow-y-auto max-h-[calc(95vh-200px)]">
          {activeTab === 'countdown' && (
            <div className="space-y-6">
              <LiveCountdown
                launch={launch}
                onPhaseChange={handlePhaseChange}
                showMilliseconds={currentPhase?.urgency === 'critical'}
              />

              {/* Quick Actions */}
              <div className="grid grid-cols-1 gap-3">
                <button
                  onClick={() => setActiveTab('tips')}
                  className="p-3 bg-orange-600 hover:bg-orange-700 text-white rounded-lg text-sm font-medium transition-colors"
                >
                  💡 Viewing Tips
                </button>
              </div>
            </div>
          )}


          {activeTab === 'weather' && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                Weather Conditions
              </h3>
              <WeatherDisplay 
                launch={launch}
                showDetailed={true}
              />
              
              <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4">
                <h4 className="font-medium text-blue-800 dark:text-blue-200 mb-2">
                  Viewing Conditions
                </h4>
                <div className="text-sm text-blue-700 dark:text-blue-300">
                  <p className="mb-2">
                    <span className="font-medium">Visibility:</span> {launch.visibility.likelihood.toUpperCase()}
                  </p>
                  <p>
                    {launch.visibility.reason}
                  </p>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'tips' && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                Viewing Tips & Instructions
              </h3>
              
              <div className="space-y-3">
                {viewingTips.map(tip => (
                  <div
                    key={tip.id}
                    className={`p-4 rounded-lg border-l-4 ${
                      tip.importance === 'critical' ? 'border-red-500 bg-red-50 dark:bg-red-900/20' :
                      tip.importance === 'high' ? 'border-orange-500 bg-orange-50 dark:bg-orange-900/20' :
                      tip.importance === 'medium' ? 'border-yellow-500 bg-yellow-50 dark:bg-yellow-900/20' :
                      'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                    }`}
                  >
                    <div className="flex items-start space-x-3">
                      <span className="text-2xl">{tip.icon}</span>
                      <div>
                        <h4 className={`font-medium ${
                          tip.importance === 'critical' ? 'text-red-800 dark:text-red-200' :
                          tip.importance === 'high' ? 'text-orange-800 dark:text-orange-200' :
                          tip.importance === 'medium' ? 'text-yellow-800 dark:text-yellow-200' :
                          'text-blue-800 dark:text-blue-200'
                        }`}>
                          {tip.title}
                        </h4>
                        <p className={`text-sm mt-1 ${
                          tip.importance === 'critical' ? 'text-red-700 dark:text-red-300' :
                          tip.importance === 'high' ? 'text-orange-700 dark:text-orange-300' :
                          tip.importance === 'medium' ? 'text-yellow-700 dark:text-yellow-300' :
                          'text-blue-700 dark:text-blue-300'
                        }`}>
                          {tip.description}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer Status Bar */}
        <div className="border-t border-gray-200 dark:border-gray-700 p-3 bg-gray-50 dark:bg-gray-900">
          <div className="flex justify-between items-center text-sm">
            <div className="flex items-center space-x-4">
              <span className="text-gray-600 dark:text-gray-400">
                Status: {currentPhase ? currentPhase.name : 'Waiting'}
              </span>
              {currentPhase?.urgency === 'critical' && (
                <span className="text-red-600 dark:text-red-400 animate-pulse font-medium">
                  ⚠️ CRITICAL PHASE
                </span>
              )}
            </div>
            
            <div className="flex items-center space-x-2 text-gray-500 dark:text-gray-400">
              {hasNotificationPermission && <span title="Notifications enabled">🔔</span>}
              {wakeLock && <span title="Screen wake lock active">📱</span>}
              {launch.visibility.likelihood === 'high' && <span title="High visibility expected">👁️</span>}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LiveViewingGuide;