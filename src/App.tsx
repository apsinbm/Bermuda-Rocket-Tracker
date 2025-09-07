import React, { useState, useEffect } from 'react';
import { LaunchWithVisibility } from './types';
import { convertToBermudaTime } from './utils/timeUtils';
import { useLaunchData } from './hooks/useLaunchData';
import LaunchCard from './components/LaunchCard';
import NotificationSettings from './components/NotificationSettings';
import AnalyticsDashboard from './components/AnalyticsDashboard';
import WeatherDisplay from './components/WeatherDisplay';
import { notificationService } from './services/notificationService';
import { ExhaustPlumeVisibilityCalculator } from './services/ExhaustPlumeVisibilityCalculator';


function App() {
  const [processedLaunches, setProcessedLaunches] = useState<LaunchWithVisibility[]>([]);
  const [darkMode, setDarkMode] = useState(true);
  const [showMonitoring, setShowMonitoring] = useState(false);
  const [showNotificationSettings, setShowNotificationSettings] = useState(false);
  const [showAnalytics, setShowAnalytics] = useState(false);
  const [debugInfo, setDebugInfo] = useState<string>('');
  
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

      // Process each launch individually using simple visibility calculations
      const processedLaunches: LaunchWithVisibility[] = [];
      
      for (let i = 0; i < launches.length; i++) {
        const launch = launches[i];
        
        // Use exhaust plume physics-based visibility calculation
        const visibilityData = await ExhaustPlumeVisibilityCalculator.calculatePlumeVisibility(launch);
        
        const processedLaunch: LaunchWithVisibility = {
          ...launch,
          visibility: {
            likelihood: visibilityData.likelihood,
            reason: visibilityData.reason,
            bearing: visibilityData.bearing,
            trajectoryDirection: visibilityData.trajectoryDirection,
            estimatedTimeVisible: visibilityData.estimatedTimeVisible
          },
          bermudaTime: convertToBermudaTime(launch.net)
        };
        
        processedLaunches.push(processedLaunch);
      }
      
      
      // Log visibility distribution for debugging
      const visibilityStats = {
        high: processedLaunches.filter(l => l.visibility.likelihood === 'high').length,
        medium: processedLaunches.filter(l => l.visibility.likelihood === 'medium').length,
        low: processedLaunches.filter(l => l.visibility.likelihood === 'low').length,
        none: processedLaunches.filter(l => l.visibility.likelihood === 'none').length
      };
      
      // Log each launch result
      processedLaunches.forEach((launch, index) => {
        if (launch.visibility.bearing) {
        }
        if (launch.visibility.trajectoryDirection) {
        }
      });
      
      // Show up to 6 launches
      const launchesToShow = processedLaunches.slice(0, 6);
      setProcessedLaunches(launchesToShow);
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
  
  // Debug: Add window function to clear cache
  useEffect(() => {
    (window as any).clearLaunchCache = () => {
      localStorage.removeItem('bermuda-rocket-launches-db');
      localStorage.removeItem('bermuda-rocket-db-metadata');
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
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors">
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                🚀 Bermuda Rocket Launch Tracker
              </h1>
              <p className="text-gray-600 dark:text-gray-400 mt-1">
                Track Florida space launches passing Bermuda
              </p>
            </div>
            
            <div className="flex items-center space-x-4">
              {/* Notification settings */}
              <button
                onClick={() => setShowNotificationSettings(!showNotificationSettings)}
                className="px-3 py-2 rounded-lg bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors text-sm"
                title="Notification settings"
              >
                🔔 Notifications
              </button>
              
              {/* Analytics Dashboard */}
              <button
                onClick={() => setShowAnalytics(!showAnalytics)}
                className="px-3 py-2 rounded-lg bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors text-sm"
                title="View launch analytics"
              >
                📊 Analytics
              </button>
              
              {/* Monitoring toggle */}
              <button
                onClick={() => setShowMonitoring(!showMonitoring)}
                className="px-3 py-2 rounded-lg bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors text-sm"
                title="Toggle refresh monitoring"
              >
                🔍 Monitor
              </button>
              
              {/* Dark mode toggle */}
              <button
                onClick={() => setDarkMode(!darkMode)}
                className="p-2 rounded-lg bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                title="Toggle dark mode"
              >
                {darkMode ? '☀️' : '🌙'}
              </button>
              
              {/* Refresh button */}
              <button
                onClick={forceRefresh}
                disabled={loading}
                className={`px-4 py-2 text-white rounded-lg transition-colors ${
                  loading 
                    ? 'bg-gray-400 cursor-not-allowed' 
                    : 'bg-blue-600 hover:bg-blue-700'
                }`}
                title="Force refresh all data"
              >
                {loading ? '⏳ Loading...' : '🔄 Refresh'}
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
                          className="px-2 py-1 text-xs bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 rounded hover:bg-blue-200 dark:hover:bg-blue-800 transition-colors"
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
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
              <div className="max-w-6xl w-full max-h-[90vh] overflow-y-auto">
                <AnalyticsDashboard
                  launches={processedLaunches}
                  onClose={() => setShowAnalytics(false)}
                />
              </div>
            </div>
          )}
          
          {/* Notification Settings Modal */}
          {showNotificationSettings && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
              <div className="max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                <NotificationSettings
                  onClose={() => setShowNotificationSettings(false)}
                />
              </div>
            </div>
          )}
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {processedLaunches.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-6xl mb-4">🔍</div>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
              No Upcoming Launches Found
            </h2>
            <p className="text-gray-600 dark:text-gray-400">
              No upcoming launches from Florida launch pads are currently scheduled.
            </p>
            {debugInfo && (
              <div className="mt-4 p-4 bg-yellow-100 dark:bg-yellow-900 rounded-lg text-sm">
                <strong>Debug:</strong> {debugInfo}
              </div>
            )}
          </div>
        ) : (
          <>
            {/* Summary Stats */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
              <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm border border-gray-200 dark:border-gray-700">
                <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                  {processedLaunches.filter(l => l.visibility.likelihood === 'high').length}
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400">Likely Visible</div>
              </div>
              <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm border border-gray-200 dark:border-gray-700">
                <div className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">
                  {processedLaunches.filter(l => l.visibility.likelihood === 'medium').length}
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400">Possibly Visible</div>
              </div>
              <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm border border-gray-200 dark:border-gray-700">
                <div className="text-2xl font-bold text-orange-600 dark:text-orange-400">
                  {processedLaunches.filter(l => l.visibility.likelihood === 'low').length}
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400">Unlikely Visible</div>
              </div>
              <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm border border-gray-200 dark:border-gray-700">
                <div className="text-2xl font-bold text-gray-600 dark:text-gray-400">
                  {processedLaunches.length}
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400">Upcoming Launches</div>
              </div>
            </div>

            {/* Launch Cards */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
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
    </div>
  );
}

export default App;
