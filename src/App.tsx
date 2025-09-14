import React, { useState, useEffect } from 'react';
import { LaunchWithVisibility } from './types';
import { convertToBermudaTime } from './utils/timeUtils';
import { detectPlatform, respectsReducedMotion } from './utils/platformUtils';
import { useLaunchData } from './hooks/useLaunchData';
import LaunchCard from './components/LaunchCard';
import NotificationSettings from './components/NotificationSettings';
import AnalyticsDashboard from './components/AnalyticsDashboard';
import CacheManager from './components/CacheManager';
import WeatherDisplay from './components/WeatherDisplay';
import DelayNotificationPanel from './components/DelayNotificationPanel';
import { notificationService } from './services/notificationService';
import { ExhaustPlumeVisibilityCalculator } from './services/ExhaustPlumeVisibilityCalculator';
import { cacheInitializer } from './services/cacheInitializer';
import { clearProjectKuiperCache } from './services/trajectoryService';


function App() {
  const [processedLaunches, setProcessedLaunches] = useState<LaunchWithVisibility[]>([]);
  const [darkMode, setDarkMode] = useState(true);
  const [showMonitoring, setShowMonitoring] = useState(false);
  const [showNotificationSettings, setShowNotificationSettings] = useState(false);
  const [showAnalytics, setShowAnalytics] = useState(false);
  const [showCacheManager, setShowCacheManager] = useState(false);
  const [debugInfo, setDebugInfo] = useState<string>('');
  const [platform, setPlatform] = useState(() => detectPlatform());
  
  // Use the dynamic launch data service
  const { 
    launches, 
    loading, 
    error, 
    lastUpdated, 
    refreshStatus, 
    forceRefresh, 
    forceUpdateLaunch 
  } = useLaunchData();

  // Debug: Track hook status
  useEffect(() => {
    setDebugInfo(prev => `Hook Status: Loading=${loading}, Error=${error}, Launches=${launches.length}, Last Updated=${lastUpdated ? new Date(lastUpdated).toLocaleTimeString() : 'never'}`);
  }, [loading, error, launches.length, lastUpdated]);

  // Process launches with proper visibility calculations
  useEffect(() => {
    const processLaunches = async () => {
      
      if (launches.length === 0) {
        setProcessedLaunches([]);
        return;
      }

      // Only process the first 6 launches we'll actually display (in chronological order)
      const launchesToProcess = launches.slice(0, 6);
      console.log(`[App] Processing ${launchesToProcess.length} launches (showing first 6 of ${launches.length} total)`);
      
      // Process these 6 launches in parallel for much faster loading
      const processedLaunches = await Promise.all(
        launchesToProcess.map(async (launch, index) => {
          try {
            console.log(`[App] Processing launch ${index + 1}/${launchesToProcess.length}: ${launch.name}`);
            
            // Use basic visibility calculation with error handling
            const { calculateVisibility } = await import('./services/visibilityService');
            const visibilityData = await calculateVisibility(launch);
            
            const processedLaunch: LaunchWithVisibility = {
              ...launch,
              visibility: visibilityData,
              bermudaTime: convertToBermudaTime(launch.net),
              // Preserve Flight Club data if available
              flightClubMatch: (launch as any).flightClubMatch,
              hasFlightClubData: (launch as any).hasFlightClubData || false
            };
            
            console.log(`[App] Completed processing: ${launch.name} - ${visibilityData.likelihood} visibility`);
            return processedLaunch;
          } catch (error) {
            console.error(`[App] Failed to calculate visibility for launch ${launch.name}:`, error);
            
            // Return launch with fallback visibility data
            const fallbackLaunch: LaunchWithVisibility = {
              ...launch,
              visibility: {
                likelihood: 'low',
                reason: 'Visibility calculation failed - error in processing',
                bearing: 225, // Default northeast
                trajectoryDirection: 'Northeast',
                estimatedTimeVisible: 'Unable to calculate - check logs',
                dataSource: 'estimated' as const,
                score: 0.1,
                factors: ['Error occurred during calculation']
              },
              bermudaTime: convertToBermudaTime(launch.net),
              flightClubMatch: (launch as any).flightClubMatch,
              hasFlightClubData: (launch as any).hasFlightClubData || false
            };
            
            return fallbackLaunch;
          }
        })
      );
      
      // Log visibility distribution for debugging
      const visibilityStats = {
        high: processedLaunches.filter(l => l.visibility.likelihood === 'high').length,
        medium: processedLaunches.filter(l => l.visibility.likelihood === 'medium').length,
        low: processedLaunches.filter(l => l.visibility.likelihood === 'low').length,
        none: processedLaunches.filter(l => l.visibility.likelihood === 'none').length
      };
      
      console.log(`[App] Visibility stats for ${processedLaunches.length} launches:`, visibilityStats);
      
      setProcessedLaunches(processedLaunches);
    };

    processLaunches();
  }, [launches]);

  // Schedule notifications when processed launches change
  useEffect(() => {
    if (processedLaunches.length > 0) {
      notificationService.scheduleNotifications(processedLaunches);
    }
  }, [processedLaunches]);

  // Dark mode toggle
  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [darkMode]);
  
  // Platform detection and updates
  useEffect(() => {
    const updatePlatform = () => setPlatform(detectPlatform());
    
    window.addEventListener('resize', updatePlatform);
    window.addEventListener('orientationchange', updatePlatform);
    
    return () => {
      window.removeEventListener('resize', updatePlatform);
      window.removeEventListener('orientationchange', updatePlatform);
    };
  }, []);

  // Initialize cache system on startup
  useEffect(() => {
    let mounted = true;

    const initializeCache = async () => {
      try {
        await cacheInitializer.initialize();
        if (mounted) {
          console.log('[App] Cache system initialized successfully');
        }
      } catch (error) {
        if (mounted) {
          console.warn('[App] Cache initialization failed, continuing without cache:', error);
        }
      }
    };

    initializeCache();

    // Cleanup on unmount
    return () => {
      mounted = false;
      cacheInitializer.shutdown();
    };
  }, []);

  // Debug: Add window function to clear cache
  useEffect(() => {
    (window as any).clearLaunchCache = () => {
      localStorage.removeItem('bermuda-rocket-launches-db');
      localStorage.removeItem('bermuda-rocket-db-metadata');
    };
    
    (window as any).clearProjectKuiperCache = () => {
      clearProjectKuiperCache();
      console.log('Project Kuiper trajectory cache cleared. Refresh the page to see updated data.');
    };
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Loading rocket launches...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center max-w-md mx-auto px-4">
          <div className="text-red-500 text-6xl mb-4">⚠️</div>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
            Failed to Load Launches
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mb-4">{error}</p>
          <button
            onClick={forceRefresh}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors min-h-touch touch-manipulation tap-highlight-transparent"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen transition-colors font-smoothing-antialiased overflow-scrolling-touch ${
      platform.isMobile ? 'bg-gray-50 dark:bg-near-black' : 'bg-gray-50 dark:bg-gray-900'
    } ${platform.prefersReducedMotion ? '' : 'transition-colors duration-200'}`}>
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700 pt-safe-top">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 pl-safe-left pr-safe-right">
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center space-y-4 sm:space-y-0">
            <div className="min-w-0 flex-1">
              <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">
                🚀 Bermuda Rocket Launch Tracker
              </h1>
              <p className="text-gray-600 dark:text-gray-400 mt-1 text-sm sm:text-base">
                Track Florida space launches passing Bermuda
              </p>
            </div>
            
            <div className="flex items-center justify-center sm:justify-end space-x-2 sm:space-x-4 flex-wrap gap-2">
              {/* Notification settings */}
              <button
                onClick={() => setShowNotificationSettings(!showNotificationSettings)}
                className="px-2 sm:px-3 py-2 rounded-lg bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors text-xs sm:text-sm whitespace-nowrap min-h-touch min-w-touch touch-manipulation tap-highlight-transparent"
                title="Notification settings"
              >
                <span className="sm:hidden">🔔</span>
                <span className="hidden sm:inline">🔔 Notifications</span>
              </button>
              
              {/* Analytics Dashboard */}
              <button
                onClick={() => setShowAnalytics(!showAnalytics)}
                className="px-2 sm:px-3 py-2 rounded-lg bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors text-xs sm:text-sm whitespace-nowrap min-h-touch min-w-touch touch-manipulation tap-highlight-transparent"
                title="View launch analytics"
              >
                <span className="sm:hidden">📊</span>
                <span className="hidden sm:inline">📊 Analytics</span>
              </button>
              
              {/* Cache Manager */}
              <button
                onClick={() => setShowCacheManager(!showCacheManager)}
                className="px-2 sm:px-3 py-2 rounded-lg bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors text-xs sm:text-sm whitespace-nowrap min-h-touch min-w-touch touch-manipulation tap-highlight-transparent"
                title="Manage cache and performance"
              >
                <span className="sm:hidden">💾</span>
                <span className="hidden sm:inline">💾 Cache</span>
              </button>
              
              {/* Monitoring toggle */}
              <button
                onClick={() => setShowMonitoring(!showMonitoring)}
                className="px-2 sm:px-3 py-2 rounded-lg bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors text-xs sm:text-sm whitespace-nowrap min-h-touch min-w-touch touch-manipulation tap-highlight-transparent"
                title="Toggle refresh monitoring"
              >
                <span className="sm:hidden">🔍</span>
                <span className="hidden sm:inline">🔍 Monitor</span>
              </button>
              
              {/* Dark mode toggle */}
              <button
                onClick={() => setDarkMode(!darkMode)}
                className="p-2 rounded-lg bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors min-h-touch min-w-touch touch-manipulation tap-highlight-transparent"
                title="Toggle dark mode"
              >
                {darkMode ? '☀️' : '🌙'}
              </button>
              
              {/* Refresh button */}
              <button
                onClick={forceRefresh}
                disabled={loading}
                className={`px-2 sm:px-4 py-2 text-white rounded-lg transition-colors text-xs sm:text-sm whitespace-nowrap min-h-touch touch-manipulation tap-highlight-transparent ${
                  loading 
                    ? 'bg-gray-400 cursor-not-allowed' 
                    : 'bg-blue-600 hover:bg-blue-700'
                }`}
                title="Force refresh all data"
              >
                <span className="sm:hidden">{loading ? '⏳' : '🔄'}</span>
                <span className="hidden sm:inline">{loading ? '⏳ Loading...' : '🔄 Refresh'}</span>
              </button>
            </div>
          </div>
          
          {lastUpdated && (
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
              Last updated: {new Date(lastUpdated).toLocaleTimeString()}
            </p>
          )}

          {/* Current Weather Widget */}
          <div className="mt-4">
            <WeatherDisplay showDetailed={false} />
          </div>
          
          {/* Monitoring Dashboard */}
          {showMonitoring && refreshStatus.length > 0 && (
            <div className="mt-4 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">
                🚀 Launch Monitoring Status
              </h3>
              <div className="space-y-2">
                {refreshStatus.map((status) => {
                  const urgencyStyles = {
                    low: 'text-gray-600 bg-gray-100',
                    medium: 'text-blue-600 bg-blue-100',
                    high: 'text-orange-600 bg-orange-100',
                    critical: 'text-red-600 bg-red-100 animate-pulse'
                  };
                  const urgencyStyle = urgencyStyles[status.urgency];
                  
                  return (
                    <div key={status.launchId} className="flex items-center justify-between text-sm">
                      <div className="flex items-center space-x-2">
                        <span 
                          className={`px-2 py-1 rounded text-xs font-medium ${urgencyStyle}`}
                        >
                          {status.urgency.toUpperCase()}
                        </span>
                        <span className="text-gray-900 dark:text-white font-medium">
                          {status.name}
                        </span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <span className="text-gray-600 dark:text-gray-400">
                          {status.nextUpdate}
                        </span>
                        <button
                          onClick={() => forceUpdateLaunch(status.launchId)}
                          className="px-2 py-1 text-xs bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 rounded hover:bg-blue-200 dark:hover:bg-blue-800 transition-colors min-h-touch touch-manipulation tap-highlight-transparent"
                          title="Force update this launch"
                        >
                          Update
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="mt-3 text-xs text-gray-500 dark:text-gray-400">
                Smart database refresh: 24h → 12h → 2h → 30m → 10m as launch approaches (no rate limiting)
              </div>
            </div>
          )}
          
          {/* Analytics Dashboard Modal */}
          {showAnalytics && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-2 sm:p-4">
              <div className="max-w-6xl w-full max-h-[95vh] sm:max-h-[90vh] overflow-y-auto">
                <AnalyticsDashboard
                  launches={processedLaunches}
                  onClose={() => setShowAnalytics(false)}
                />
              </div>
            </div>
          )}
          
          {/* Cache Manager Modal */}
          {showCacheManager && (
            <CacheManager onClose={() => setShowCacheManager(false)} />
          )}
          
          {/* Notification Settings Modal */}
          {showNotificationSettings && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-2 sm:p-4">
              <div className="max-w-2xl w-full max-h-[95vh] sm:max-h-[90vh] overflow-y-auto">
                <NotificationSettings
                  onClose={() => setShowNotificationSettings(false)}
                />
              </div>
            </div>
          )}
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-2 sm:px-4 md:px-6 lg:px-8 py-4 sm:py-8">
        {processedLaunches.length === 0 ? (
          <div className="text-center py-8 sm:py-12">
            <div className="text-4xl sm:text-6xl mb-4">🔍</div>
            <h2 className="text-lg sm:text-xl font-semibold text-gray-900 dark:text-white mb-2">
              No Upcoming Launches Found
            </h2>
            <p className="text-gray-600 dark:text-gray-400 text-sm sm:text-base px-4">
              No upcoming launches from Florida launch pads are currently scheduled.
            </p>
            {debugInfo && (
              <div className="mt-4 p-3 sm:p-4 bg-yellow-100 dark:bg-yellow-900 rounded-lg text-xs sm:text-sm mx-4">
                <strong>Debug:</strong> {debugInfo}
              </div>
            )}
          </div>
        ) : (
          <>
            {/* Summary Stats */}
            <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 mb-6 sm:mb-8">
              <div className="bg-white dark:bg-gray-800 rounded-lg p-3 sm:p-4 shadow-sm border border-gray-200 dark:border-gray-700">
                <div className="text-xl sm:text-2xl font-bold text-green-600 dark:text-green-400">
                  {processedLaunches.filter(l => l.visibility.likelihood === 'high').length}
                </div>
                <div className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">Likely Visible</div>
              </div>
              <div className="bg-white dark:bg-gray-800 rounded-lg p-3 sm:p-4 shadow-sm border border-gray-200 dark:border-gray-700">
                <div className="text-xl sm:text-2xl font-bold text-yellow-600 dark:text-yellow-400">
                  {processedLaunches.filter(l => l.visibility.likelihood === 'medium').length}
                </div>
                <div className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">Possibly Visible</div>
              </div>
              <div className="bg-white dark:bg-gray-800 rounded-lg p-3 sm:p-4 shadow-sm border border-gray-200 dark:border-gray-700">
                <div className="text-xl sm:text-2xl font-bold text-orange-600 dark:text-orange-400">
                  {processedLaunches.filter(l => l.visibility.likelihood === 'low').length}
                </div>
                <div className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">Unlikely Visible</div>
              </div>
              <div className="bg-white dark:bg-gray-800 rounded-lg p-3 sm:p-4 shadow-sm border border-gray-200 dark:border-gray-700">
                <div className="text-xl sm:text-2xl font-bold text-gray-600 dark:text-gray-400">
                  {processedLaunches.length}
                </div>
                <div className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">Upcoming Launches</div>
              </div>
            </div>

            {/* Launch Cards */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
              {processedLaunches.map((launch) => (
                <div key={launch.id} id={`launch-${launch.id}`}>
                  <LaunchCard launch={launch} />
                </div>
              ))}
            </div>
          </>
        )}
      </main>

      {/* Footer */}
      <footer className="bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 mt-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="text-center text-sm text-gray-600 dark:text-gray-400">
            <p>
              Visibility calculations are estimates based on launch trajectory and time of day.
            </p>
          </div>
        </div>
      </footer>

      {/* Delay Notification Panel */}
      <DelayNotificationPanel />
    </div>
  );
}

export default App;
