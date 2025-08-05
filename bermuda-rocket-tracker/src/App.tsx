import React, { useState, useEffect } from 'react';
import { LaunchWithVisibility } from './types';
import { calculateEnhancedVisibility } from './services/enhancedVisibilityService';
import { convertToBermudaTime } from './utils/timeUtils';
import { useLaunchData } from './hooks/useLaunchData';
import LaunchCard from './components/LaunchCard';

function App() {
  const [processedLaunches, setProcessedLaunches] = useState<LaunchWithVisibility[]>([]);
  const [darkMode, setDarkMode] = useState(false);
  const [showMonitoring, setShowMonitoring] = useState(false);
  
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

  // Process launches with visibility calculations when raw launch data changes
  useEffect(() => {
    const processLaunches = async () => {
      if (launches.length === 0) {
        setProcessedLaunches([]);
        return;
      }

      const launchesWithVisibility: LaunchWithVisibility[] = [];
      
      for (const launch of launches) {
        try {
          const visibilityData = await calculateEnhancedVisibility(launch);
          launchesWithVisibility.push({
            ...launch,
            visibility: visibilityData,
            bermudaTime: convertToBermudaTime(launch.net)
          });
        } catch (error) {
          console.error(`Error calculating visibility for launch ${launch.id}:`, error);
          // Fall back to basic visibility calculation
          const { calculateVisibility } = await import('./services/visibilityService');
          launchesWithVisibility.push({
            ...launch,
            visibility: calculateVisibility(launch),
            bermudaTime: convertToBermudaTime(launch.net)
          });
        }
      }
      
      // Filter out past launches and limit to 6
      const now = new Date();
      const upcomingOnly = launchesWithVisibility
        .filter(launch => new Date(launch.net) > now)
        .sort((a, b) => new Date(a.net).getTime() - new Date(b.net).getTime())
        .slice(0, 6);
      
      setProcessedLaunches(upcomingOnly);
    };

    processLaunches();
  }, [launches]);

  // Dark mode toggle
  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [darkMode]);

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
                🚀 Bermuda Rocket Tracker
              </h1>
              <p className="text-gray-600 dark:text-gray-400 mt-1">
                Track rocket launches visible from Bermuda
              </p>
            </div>
            
            <div className="flex items-center space-x-4">
              {/* Monitoring toggle */}
              <button
                onClick={() => setShowMonitoring(!showMonitoring)}
                className="px-3 py-2 rounded-lg bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors text-sm"
                title="Toggle refresh monitoring"
              >
                📊 Monitor
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
              Last updated: {new Date(lastUpdated).toLocaleTimeString()} • Dynamic refresh active 🔄
            </p>
          )}
          
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
                Refresh frequency automatically increases as launch approaches: 12h → 6h → 1h → 30m → 10m → 5m → 2m → 1m → 30s
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
                <LaunchCard key={launch.id} launch={launch} />
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
