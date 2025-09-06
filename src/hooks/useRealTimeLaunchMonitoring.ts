/**
 * Real-Time Launch Monitoring Hook
 * 
 * React hook that orchestrates real-time launch schedule monitoring.
 * Integrates dynamic polling, change detection, impact analysis, and notifications.
 * Provides comprehensive launch delay management for the UI.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { 
  LaunchWithDelayTracking, 
  DelayNotification, 
  LaunchMonitoringState, 
  LaunchMonitoringConfig,
  DelayImpactAnalysis 
} from '../types';
import { DynamicPollingService } from '../services/dynamicPollingService';
import { ScheduleChangeDetectionService } from '../services/scheduleChangeDetectionService';
import { DelayImpactAnalyzer } from '../services/delayImpactAnalyzer';
import { DelayNotificationService } from '../services/delayNotificationService';
import { useLaunchData } from './useLaunchData';

// Default monitoring configuration
const DEFAULT_CONFIG: LaunchMonitoringConfig = {
  enableRealTimePolling: true,
  enableDelayNotifications: true,
  enableVisibilityAlerts: true,
  pollingIntervals: {
    critical: 30000,   // 30 seconds
    high: 60000,       // 1 minute
    medium: 300000,    // 5 minutes
    low: 600000,       // 10 minutes
    default: 1800000   // 30 minutes
  },
  notificationThresholds: {
    minDelayMinutes: 5,
    significantDelayMinutes: 30,
    visibilityChangeRequired: false
  }
};

interface UseRealTimeLaunchMonitoringReturn {
  // Monitoring state
  monitoringState: LaunchMonitoringState;
  isMonitoring: boolean;
  
  // Tracked launches with delay information
  trackedLaunches: LaunchWithDelayTracking[];
  
  // Notifications
  notifications: DelayNotification[];
  unreadNotifications: number;
  
  // Control functions
  startMonitoring: (launches: LaunchWithDelayTracking[]) => void;
  stopMonitoring: () => void;
  pauseMonitoring: () => void;
  resumeMonitoring: () => void;
  updateConfig: (newConfig: Partial<LaunchMonitoringConfig>) => void;
  
  // Notification management
  clearNotifications: () => void;
  markNotificationAsRead: (index: number) => void;
  
  // Manual operations
  forceCheckForDelays: () => Promise<void>;
  simulateDelay: (launchId: string, delayMinutes: number) => Promise<DelayImpactAnalysis | null>;
  
  // Statistics
  getMonitoringStats: () => {
    activeLaunches: number;
    totalDelaysDetected: number;
    totalNotificationsSent: number;
    avgPollingFrequency: number;
  };
}

export function useRealTimeLaunchMonitoring(
  initialConfig?: Partial<LaunchMonitoringConfig>
): UseRealTimeLaunchMonitoringReturn {
  
  // State management
  const [config, setConfig] = useState<LaunchMonitoringConfig>({
    ...DEFAULT_CONFIG,
    ...initialConfig
  });
  
  const [monitoringState, setMonitoringState] = useState<LaunchMonitoringState>({
    activeMonitoring: new Map(),
    pollingIntervals: new Map(),
    config,
    lastGlobalUpdate: new Date(),
    notifications: [],
    stats: {
      totalDelaysDetected: 0,
      visibilityImprovements: 0,
      visibilityDegradations: 0,
      missedWindows: 0,
      gainedWindows: 0
    }
  });
  
  const [isMonitoring, setIsMonitoring] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [trackedLaunches, setTrackedLaunches] = useState<LaunchWithDelayTracking[]>([]);
  const [unreadNotificationCount, setUnreadNotificationCount] = useState(0);
  
  // Refs to prevent stale closures
  const configRef = useRef(config);
  const monitoringStateRef = useRef(monitoringState);
  
  // Update refs when state changes
  useEffect(() => {
    configRef.current = config;
    monitoringStateRef.current = monitoringState;
  }, [config, monitoringState]);
  
  // Initialize services on mount
  useEffect(() => {
    console.log('[RealTimeMonitoring] Initializing services');
    
    // Initialize notification service
    DelayNotificationService.initialize(config.notificationThresholds);
    
    // Update polling service configuration
    DynamicPollingService.updateConfig(config);
    
    return () => {
      // Cleanup on unmount
      console.log('[RealTimeMonitoring] Cleaning up services');
      DynamicPollingService.stopAllMonitoring();
    };
  }, []);
  
  // Handle schedule changes detected by polling
  const handleScheduleChange = useCallback(async (
    updatedLaunch: LaunchWithDelayTracking,
    oldTime: string,
    newTime: string
  ) => {
    console.log(`[RealTimeMonitoring] Schedule change detected: ${updatedLaunch.name}`);
    
    try {
      // Create schedule change result for impact analysis
      const scheduleChangeResult = {
        hasChanged: true,
        changeType: 'delay' as const,
        severity: 'significant' as const,
        oldLaunch: {
          id: updatedLaunch.id,
          name: updatedLaunch.name || updatedLaunch.mission?.name || 'Unknown Launch',
          net: oldTime,
          status: {
            id: (updatedLaunch.status as any).id || 1,
            name: updatedLaunch.status.name
          },
          lastChecked: new Date(),
          checkCount: 1
        },
        newLaunch: updatedLaunch,
        changes: {
          netChanged: true,
          windowChanged: false,
          statusChanged: false,
          delayMinutes: (new Date(newTime).getTime() - new Date(oldTime).getTime()) / (1000 * 60)
        },
        confidence: 'high' as const,
        recommendations: []
      };
      
      // Analyze delay impact
      const impactAnalysis = await DelayImpactAnalyzer.analyzeDelayImpact(
        updatedLaunch,
        scheduleChangeResult
      );
      
      // Update launch with impact analysis
      updatedLaunch.delayImpact = impactAnalysis;
      
      // Update tracked launches
      setTrackedLaunches(prev => {
        const newTracked = [...prev];
        const index = newTracked.findIndex(l => l.id === updatedLaunch.id);
        if (index >= 0) {
          newTracked[index] = updatedLaunch;
        } else {
          newTracked.push(updatedLaunch);
        }
        return newTracked;
      });
      
      // Process notifications
      const notifications = await DelayNotificationService.processDelayImpact(
        updatedLaunch,
        impactAnalysis
      );
      
      // Update state with new notifications
      setMonitoringState(prev => {
        const updatedStats = { ...prev.stats };
        
        // Update statistics
        updatedStats.totalDelaysDetected++;
        switch (impactAnalysis.impact) {
          case 'VISIBILITY_IMPROVED':
          case 'WINDOW_GAINED':
            updatedStats.visibilityImprovements++;
            updatedStats.gainedWindows++;
            break;
          case 'VISIBILITY_DEGRADED':
          case 'WINDOW_LOST':
            updatedStats.visibilityDegradations++;
            updatedStats.missedWindows++;
            break;
        }
        
        const newActiveMonitoring = new Map(prev.activeMonitoring);
        newActiveMonitoring.set(updatedLaunch.id, updatedLaunch);
        
        return {
          ...prev,
          activeMonitoring: newActiveMonitoring,
          lastGlobalUpdate: new Date(),
          notifications: [...prev.notifications, ...notifications],
          stats: updatedStats
        };
      });
      
      // Update unread notification count
      setUnreadNotificationCount(prev => prev + notifications.length);
      
      console.log(`[RealTimeMonitoring] ✅ Processed ${notifications.length} notifications for ${updatedLaunch.name}`);
      
    } catch (error) {
      console.error(`[RealTimeMonitoring] Error processing schedule change for ${updatedLaunch.name}:`, error);
    }
  }, []);
  
  // Start monitoring function
  const startMonitoring = useCallback((launches: LaunchWithDelayTracking[]) => {
    if (isPaused) {
      console.log('[RealTimeMonitoring] Cannot start - monitoring is paused');
      return;
    }
    
    console.log(`[RealTimeMonitoring] Starting monitoring for ${launches.length} launches`);
    
    setIsMonitoring(true);
    setTrackedLaunches(launches);
    
    // Start monitoring each launch
    launches.forEach(launch => {
      if (DynamicPollingService.shouldMonitorLaunch(launch)) {
        DynamicPollingService.startMonitoring(launch, handleScheduleChange);
        
        // Add to monitoring state
        setMonitoringState(prev => {
          const newActiveMonitoring = new Map(prev.activeMonitoring);
          newActiveMonitoring.set(launch.id, launch);
          return {
            ...prev,
            activeMonitoring: newActiveMonitoring
          };
        });
      }
    });
    
  }, [handleScheduleChange, isPaused]);
  
  // Stop monitoring function
  const stopMonitoring = useCallback(() => {
    console.log('[RealTimeMonitoring] Stopping all monitoring');
    
    DynamicPollingService.stopAllMonitoring();
    setIsMonitoring(false);
    setTrackedLaunches([]);
    
    setMonitoringState(prev => ({
      ...prev,
      activeMonitoring: new Map(),
      pollingIntervals: new Map()
    }));
  }, []);
  
  // Pause monitoring function
  const pauseMonitoring = useCallback(() => {
    console.log('[RealTimeMonitoring] Pausing monitoring');
    
    DynamicPollingService.stopAllMonitoring();
    setIsPaused(true);
    setIsMonitoring(false);
  }, []);
  
  // Resume monitoring function
  const resumeMonitoring = useCallback(() => {
    console.log('[RealTimeMonitoring] Resuming monitoring');
    
    setIsPaused(false);
    if (trackedLaunches.length > 0) {
      startMonitoring(trackedLaunches);
    }
  }, [trackedLaunches, startMonitoring]);
  
  // Update configuration
  const updateConfig = useCallback((newConfig: Partial<LaunchMonitoringConfig>) => {
    const updatedConfig = { ...config, ...newConfig };
    setConfig(updatedConfig);
    
    // Update services
    DynamicPollingService.updateConfig(updatedConfig);
    DelayNotificationService.initialize(updatedConfig.notificationThresholds);
    
    setMonitoringState(prev => ({
      ...prev,
      config: updatedConfig
    }));
    
    console.log('[RealTimeMonitoring] Configuration updated');
  }, [config]);
  
  // Force check for delays
  const forceCheckForDelays = useCallback(async () => {
    if (!isMonitoring) {
      console.log('[RealTimeMonitoring] Not monitoring - cannot force check');
      return;
    }
    
    console.log('[RealTimeMonitoring] Force checking for delays...');
    
    try {
      // Import launch service to get current data
      const { launchService } = await import('../services/launchService');
      const currentLaunches = await launchService.getLaunches();
      
      // Detect changes
      const changes = ScheduleChangeDetectionService.detectChanges(currentLaunches);
      
      console.log(`[RealTimeMonitoring] Found ${changes.length} schedule changes`);
      
      // Process each change
      for (const change of changes) {
        const trackedLaunch = trackedLaunches.find(l => l.id === change.newLaunch.id);
        if (trackedLaunch && change.delayEvent) {
          // Convert to delay tracking and trigger handler
          const updatedLaunch = await ScheduleChangeDetectionService.convertToDelayTracking(
            change.newLaunch,
            change,
            trackedLaunch
          );
          
          await handleScheduleChange(
            updatedLaunch,
            change.oldLaunch.net,
            change.newLaunch.net
          );
        }
      }
      
    } catch (error) {
      console.error('[RealTimeMonitoring] Error during forced delay check:', error);
    }
  }, [isMonitoring, trackedLaunches, handleScheduleChange]);
  
  // Simulate delay for testing
  const simulateDelay = useCallback(async (
    launchId: string, 
    delayMinutes: number
  ): Promise<DelayImpactAnalysis | null> => {
    const launch = trackedLaunches.find(l => l.id === launchId);
    if (!launch) {
      console.error(`[RealTimeMonitoring] Launch ${launchId} not found for simulation`);
      return null;
    }
    
    console.log(`[RealTimeMonitoring] Simulating ${delayMinutes} minute delay for ${launch.name}`);
    
    const originalTime = new Date(launch.net);
    const delayedTime = new Date(originalTime.getTime() + delayMinutes * 60 * 1000);
    
    return await DelayImpactAnalyzer.compareScenarios(
      launch,
      delayedTime.toISOString(),
      `${delayMinutes} minute delay simulation`
    );
  }, [trackedLaunches]);
  
  // Notification management
  const clearNotifications = useCallback(() => {
    setMonitoringState(prev => ({
      ...prev,
      notifications: []
    }));
    setUnreadNotificationCount(0);
    DelayNotificationService.clearNotificationQueue();
  }, []);
  
  const markNotificationAsRead = useCallback((index: number) => {
    setMonitoringState(prev => {
      const notifications = [...prev.notifications];
      if (index >= 0 && index < notifications.length) {
        // Mark as read (could add read property to notification type)
        setUnreadNotificationCount(prev => Math.max(0, prev - 1));
      }
      return prev;
    });
  }, []);
  
  // Statistics
  const getMonitoringStats = useCallback(() => {
    const pollingStats = DynamicPollingService.getMonitoringStats();
    const notificationStats = DelayNotificationService.getNotificationStats();
    
    return {
      activeLaunches: monitoringState.activeMonitoring.size,
      totalDelaysDetected: monitoringState.stats.totalDelaysDetected,
      totalNotificationsSent: monitoringState.notifications.length,
      avgPollingFrequency: pollingStats.avgResponseTime
    };
  }, [monitoringState]);
  
  // Periodic cleanup
  useEffect(() => {
    const cleanupInterval = setInterval(() => {
      DynamicPollingService.cleanup();
      DynamicPollingService.optimizePolling();
    }, 5 * 60 * 1000); // Every 5 minutes
    
    return () => clearInterval(cleanupInterval);
  }, []);
  
  return {
    monitoringState,
    isMonitoring: isMonitoring && !isPaused,
    trackedLaunches,
    notifications: monitoringState.notifications,
    unreadNotifications: unreadNotificationCount,
    startMonitoring,
    stopMonitoring,
    pauseMonitoring,
    resumeMonitoring,
    updateConfig,
    clearNotifications,
    markNotificationAsRead,
    forceCheckForDelays,
    simulateDelay,
    getMonitoringStats
  };
}