/**
 * React Hook for Dynamic Launch Data Updates
 * Automatically updates launch data based on proximity to launch time
 */

import { useState, useEffect, useCallback } from 'react';
import { Launch } from '../types';
import { launchDataService } from '../services/launchDataService';
import { getRefreshInterval, formatRefreshStatus } from '../services/launchUpdateScheduler';

interface LaunchDataState {
  launches: Launch[];
  loading: boolean;
  error: string | null;
  lastUpdated: number;
  refreshStatus: Array<{
    launchId: string;
    name: string;
    phase: string;
    nextUpdate: string;
    urgency: 'low' | 'medium' | 'high' | 'critical';
  }>;
}

export function useLaunchData() {
  const [state, setState] = useState<LaunchDataState>({
    launches: [],
    loading: true,
    error: null,
    lastUpdated: 0,
    refreshStatus: []
  });

  // Update launch data handler
  const updateLaunches = useCallback((launches: Launch[]) => {
    console.log(`[useLaunchData] updateLaunches called with ${launches.length} launches:`, launches.map(l => l.name));
    setState(prev => ({
      ...prev,
      launches,
      loading: false,
      error: null,
      lastUpdated: new Date().getTime()
    }));
  }, []);

  // Update refresh status
  const updateRefreshStatus = useCallback(() => {
    const statuses = launchDataService.getLaunchStatuses();
    const refreshStatus = statuses.map(status => {
      const schedule = getRefreshInterval(status.timeUntilLaunch);
      return {
        launchId: status.id,
        name: status.name,
        phase: status.refreshPhase,
        nextUpdate: formatRefreshStatus(schedule, status.nextUpdate),
        urgency: status.urgency
      };
    });

    setState(prev => ({
      ...prev,
      refreshStatus
    }));
  }, []);

  // Initialize and subscribe to updates
  useEffect(() => {
    let refreshStatusInterval: NodeJS.Timeout;

    const initializeData = async () => {
      try {
        console.log('[useLaunchData] Calling launchDataService.getLaunches()...');
        const launches = await launchDataService.getLaunches();
        console.log(`[useLaunchData] Received ${launches.length} launches:`, launches.map(l => l.name));
        updateLaunches(launches);
        
        // Update refresh status every second for UI
        refreshStatusInterval = setInterval(updateRefreshStatus, 1000);
        
      } catch (error) {
        console.error('[useLaunchData] Error in initializeData:', error);
        setState(prev => ({
          ...prev,
          loading: false,
          error: error instanceof Error ? error.message : 'Failed to load launch data'
        }));
      }
    };

    // Subscribe to launch data updates
    const unsubscribe = launchDataService.subscribe(updateLaunches);

    // Initialize
    initializeData();

    // Cleanup
    return () => {
      unsubscribe();
      if (refreshStatusInterval) {
        clearInterval(refreshStatusInterval);
      }
    };
  }, [updateLaunches, updateRefreshStatus]);

  // Force refresh function
  const forceRefresh = useCallback(async () => {
    setState(prev => ({ ...prev, loading: true }));
    try {
      await launchDataService.forceRefresh();
    } catch (error) {
      setState(prev => ({
        ...prev,
        loading: false,
        error: error instanceof Error ? error.message : 'Failed to refresh launch data'
      }));
    }
  }, []);

  // Force update specific launch
  const forceUpdateLaunch = useCallback(async (launchId: string) => {
    try {
      await launchDataService.forceUpdateLaunch(launchId);
    } catch (error) {
      console.error(`Failed to update launch ${launchId}:`, error);
    }
  }, []);

  return {
    launches: state.launches,
    loading: state.loading,
    error: state.error,
    lastUpdated: state.lastUpdated,
    refreshStatus: state.refreshStatus,
    forceRefresh,
    forceUpdateLaunch
  };
}

/**
 * Hook for getting urgency-based styling
 */
export function useUrgencyStyle(urgency: 'low' | 'medium' | 'high' | 'critical') {
  return {
    low: 'text-gray-600 bg-gray-100',
    medium: 'text-blue-600 bg-blue-100',
    high: 'text-orange-600 bg-orange-100',
    critical: 'text-red-600 bg-red-100 animate-pulse'
  }[urgency];
}