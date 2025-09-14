/**
 * Live Countdown Component
 * Provides real-time countdown with millisecond precision and launch phase indicators
 */

import React, { useState, useEffect, useCallback } from 'react';
import { LaunchWithVisibility } from '../types';

interface LiveCountdownProps {
  launch: LaunchWithVisibility;
  onPhaseChange?: (phase: LaunchPhase) => void;
  showMilliseconds?: boolean;
  compact?: boolean;
}

export interface LaunchPhase {
  id: string;
  name: string;
  description: string;
  timeFromLaunch: number; // seconds (negative = before launch, positive = after)
  urgency: 'low' | 'medium' | 'high' | 'critical';
  color: string;
  icon: string;
  instructions?: string;
}

const LAUNCH_PHASES: LaunchPhase[] = [
  {
    id: 'pre-launch',
    name: 'Pre-Launch',
    description: 'Launch preparations ongoing',
    timeFromLaunch: -3600, // 1 hour before
    urgency: 'low',
    color: 'text-blue-500',
    icon: '🚀',
    instructions: 'Get ready for an amazing show!'
  },
  {
    id: 'final-prep',
    name: 'Final Preparations', 
    description: 'Final launch preparations',
    timeFromLaunch: -1800, // 30 minutes before
    urgency: 'medium',
    color: 'text-yellow-500',
    icon: '⚡',
    instructions: 'Find a good viewing location with clear skies to the southwest'
  },
  {
    id: 'go-no-go',
    name: 'Go/No-Go Poll',
    description: 'Launch team polling for go/no-go',
    timeFromLaunch: -600, // 10 minutes before
    urgency: 'high',
    color: 'text-orange-500',
    icon: '✅',
    instructions: 'Get comfortable and prepare your viewing equipment'
  },
  {
    id: 'terminal-count',
    name: 'Terminal Count',
    description: 'Final countdown sequence initiated',
    timeFromLaunch: -300, // 5 minutes before
    urgency: 'high',
    color: 'text-red-500',
    icon: '⏱️',
    instructions: 'Look southwest toward the horizon - launch is imminent!'
  },
  {
    id: 'critical',
    name: 'Launch Imminent',
    description: 'Launch in final countdown',
    timeFromLaunch: -60, // 1 minute before
    urgency: 'critical',
    color: 'text-red-600 animate-pulse',
    icon: '🔥',
    instructions: 'LOOK SOUTHWEST NOW! Keep your eyes on the horizon!'
  },
  {
    id: 'liftoff',
    name: 'Liftoff!',
    description: 'Rocket has left the pad',
    timeFromLaunch: 0,
    urgency: 'critical',
    color: 'text-green-500 animate-bounce',
    icon: '🚀',
    instructions: 'Watch for the bright exhaust plume rising from the horizon!'
  },
  {
    id: 'max-q',
    name: 'Max-Q',
    description: 'Maximum aerodynamic pressure',
    timeFromLaunch: 60, // ~1 minute after liftoff
    urgency: 'high',
    color: 'text-blue-500',
    icon: '💨',
    instructions: 'Rocket experiencing maximum stress - watch for stage separation'
  },
  {
    id: 'visibility-start',
    name: 'Visibility Window',
    description: 'Rocket should now be visible from Bermuda',
    timeFromLaunch: 180, // ~3 minutes after liftoff
    urgency: 'critical',
    color: 'text-cyan-500 animate-pulse',
    icon: '👁️',
    instructions: 'LOOK UP! The rocket should be visible as a bright moving star!'
  },
  {
    id: 'meco',
    name: 'Main Engine Cutoff',
    description: 'First stage engines shut down',
    timeFromLaunch: 480, // ~8 minutes after liftoff
    urgency: 'medium',
    color: 'text-purple-500',
    icon: '⚪',
    instructions: 'You may see the engines cut off and stage separation'
  },
  {
    id: 'visibility-peak',
    name: 'Peak Visibility',
    description: 'Rocket at optimal viewing altitude',
    timeFromLaunch: 540, // ~9 minutes after liftoff
    urgency: 'high',
    color: 'text-yellow-400 animate-pulse',
    icon: '⭐',
    instructions: 'This is the best time to see the rocket - look for a bright moving point!'
  },
  {
    id: 'visibility-end',
    name: 'Visibility Fading',
    description: 'Rocket moving beyond visible range',
    timeFromLaunch: 720, // ~12 minutes after liftoff
    urgency: 'low',
    color: 'text-gray-500',
    icon: '🌅',
    instructions: 'The show is ending - rocket fading from view'
  }
];

export const LiveCountdown: React.FC<LiveCountdownProps> = ({
  launch,
  onPhaseChange,
  showMilliseconds = false,
  compact = false
}) => {
  const [currentTime, setCurrentTime] = useState(Date.now());
  const [currentPhase, setCurrentPhase] = useState<LaunchPhase | null>(null);
  const [isLive, setIsLive] = useState(false);

  // Calculate time difference
  const launchTime = new Date(launch.net).getTime();
  const timeDiff = launchTime - currentTime; // milliseconds until launch
  const secondsUntilLaunch = timeDiff / 1000;

  // Update current time every 100ms for smooth countdown
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(Date.now());
    }, showMilliseconds || Math.abs(secondsUntilLaunch) < 300 ? 100 : 1000); // High precision when < 5 minutes

    return () => clearInterval(interval);
  }, [secondsUntilLaunch, showMilliseconds]);

  // Determine current launch phase
  useEffect(() => {
    const newPhase = LAUNCH_PHASES
      .slice()
      .reverse() // Check from most recent phase backwards
      .find(phase => secondsUntilLaunch >= phase.timeFromLaunch);

    if (newPhase && newPhase.id !== currentPhase?.id) {
      setCurrentPhase(newPhase);
      if (onPhaseChange) {
        onPhaseChange(newPhase);
      }
    }

    // Determine if we're in "live" mode (launch happened)
    setIsLive(secondsUntilLaunch <= 0);
  }, [secondsUntilLaunch, currentPhase, onPhaseChange]);

  // Format countdown display
  const formatCountdown = useCallback(() => {
    const absSeconds = Math.abs(secondsUntilLaunch);
    
    if (isLive && absSeconds < 3600) {
      // Post-launch: Show T+ time
      const minutes = Math.floor(absSeconds / 60);
      const seconds = Math.floor(absSeconds % 60);
      const ms = Math.floor((absSeconds % 1) * 1000);
      
      if (showMilliseconds && absSeconds < 60) {
        return `T+${seconds.toString().padStart(2, '0')}.${ms.toString().padStart(3, '0')}`;
      }
      return `T+${minutes}:${seconds.toString().padStart(2, '0')}`;
    } else {
      // Pre-launch countdown
      const days = Math.floor(absSeconds / 86400);
      const hours = Math.floor((absSeconds % 86400) / 3600);
      const minutes = Math.floor((absSeconds % 3600) / 60);
      const seconds = Math.floor(absSeconds % 60);
      const ms = Math.floor((absSeconds % 1) * 1000);

      // Show milliseconds when < 1 minute
      if (showMilliseconds && absSeconds < 60) {
        return `T-${seconds.toString().padStart(2, '0')}.${ms.toString().padStart(3, '0')}`;
      }

      // Compact format
      if (compact) {
        if (days > 0) return `${days}d ${hours}h`;
        if (hours > 0) return `${hours}h ${minutes}m`;
        return `${minutes}m ${seconds}s`;
      }

      // Full format
      if (days > 0) {
        return `${days}d ${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
      }
      return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }
  }, [secondsUntilLaunch, isLive, showMilliseconds, compact]);

  // Get urgency-based styling
  const getUrgencyStyle = () => {
    if (!currentPhase) return 'text-gray-600 dark:text-gray-400';
    
    switch (currentPhase.urgency) {
      case 'critical':
        return 'text-red-600 dark:text-red-400 font-bold animate-pulse';
      case 'high':
        return 'text-orange-600 dark:text-orange-400 font-semibold';
      case 'medium':
        return 'text-yellow-600 dark:text-yellow-400';
      case 'low':
        return 'text-blue-600 dark:text-blue-400';
      default:
        return 'text-gray-600 dark:text-gray-400';
    }
  };

  if (compact) {
    return (
      <div className="flex items-center space-x-2">
        <span className={`font-mono font-bold ${getUrgencyStyle()}`}>
          {formatCountdown()}
        </span>
        {currentPhase && (
          <span className="text-sm" title={currentPhase.description}>
            {currentPhase.icon}
          </span>
        )}
      </div>
    );
  }

  return (
    <div className="bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-900 rounded-lg p-6 border border-gray-200 dark:border-gray-700">
      {/* Main Countdown Display */}
      <div className="text-center mb-4">
        <div className={`text-6xl md:text-8xl font-mono font-bold ${getUrgencyStyle()} transition-all duration-300`}>
          {formatCountdown()}
        </div>
        <div className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          {isLive ? 'Mission Elapsed Time' : 'Time to Launch'}
        </div>
      </div>

      {/* Current Phase Indicator */}
      {currentPhase && (
        <div className={`text-center p-4 rounded-lg bg-gradient-to-r ${
          currentPhase.urgency === 'critical' ? 'from-red-100 to-orange-100 dark:from-red-900/20 dark:to-orange-900/20' :
          currentPhase.urgency === 'high' ? 'from-orange-100 to-yellow-100 dark:from-orange-900/20 dark:to-yellow-900/20' :
          currentPhase.urgency === 'medium' ? 'from-yellow-100 to-blue-100 dark:from-yellow-900/20 dark:to-blue-900/20' :
          'from-blue-100 to-gray-100 dark:from-blue-900/20 dark:to-gray-900/20'
        } border border-gray-200 dark:border-gray-600`}>
          <div className="flex items-center justify-center space-x-3 mb-2">
            <span className="text-2xl">{currentPhase.icon}</span>
            <h3 className={`text-lg font-semibold ${currentPhase.color}`}>
              {currentPhase.name}
            </h3>
          </div>
          <p className="text-sm text-gray-600 dark:text-gray-300 mb-2">
            {currentPhase.description}
          </p>
          {currentPhase.instructions && (
            <p className={`text-sm font-medium ${
              currentPhase.urgency === 'critical' ? 'text-red-700 dark:text-red-300 animate-pulse' : 
              'text-gray-700 dark:text-gray-300'
            }`}>
              {currentPhase.instructions}
            </p>
          )}
        </div>
      )}

      {/* Next Phase Preview */}
      {!isLive && currentPhase && (
        <div className="mt-4 text-center text-xs text-gray-500 dark:text-gray-400">
          {(() => {
            const currentIndex = LAUNCH_PHASES.findIndex(p => p.id === currentPhase.id);
            const nextPhase = LAUNCH_PHASES[currentIndex + 1];
            if (nextPhase) {
              const timeToNext = nextPhase.timeFromLaunch - secondsUntilLaunch;
              const minutesToNext = Math.floor(Math.abs(timeToNext) / 60);
              return `Next: ${nextPhase.name} ${minutesToNext > 0 ? `in ${minutesToNext}m` : 'soon'}`;
            }
            return null;
          })()}
        </div>
      )}
    </div>
  );
};

export default LiveCountdown;