/**
 * Cache Manager Component
 * Provides cache statistics, management controls, and cleanup utilities
 */

import React, { useState, useEffect } from 'react';
import { indexedDBCache, CacheStats } from '../services/indexedDBCache';

interface CacheManagerProps {
  onClose: () => void;
}

const CacheManager: React.FC<CacheManagerProps> = ({ onClose }) => {
  const [stats, setStats] = useState<CacheStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [clearing, setClearing] = useState(false);
  const [cleaningUp, setCleaningUp] = useState(false);

  // Load cache statistics
  const loadStats = async () => {
    try {
      setLoading(true);
      const cacheStats = await indexedDBCache.getStats();
      setStats(cacheStats);
    } catch (error) {
      console.error('[CacheManager] Failed to load cache stats:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStats();
  }, []);

  // Clear all cache data
  const handleClearAll = async () => {
    if (!window.confirm('Are you sure you want to clear all cached data? This will force fresh downloads on next load.')) {
      return;
    }

    try {
      setClearing(true);
      await indexedDBCache.clear();
      await loadStats(); // Reload stats
      alert('Cache cleared successfully!');
    } catch (error) {
      console.error('[CacheManager] Failed to clear cache:', error);
      alert('Failed to clear cache. See console for details.');
    } finally {
      setClearing(false);
    }
  };

  // Clean up expired entries
  const handleCleanup = async () => {
    try {
      setCleaningUp(true);
      const deletedCount = await indexedDBCache.cleanup();
      await loadStats(); // Reload stats
      
      if (deletedCount > 0) {
        alert(`Cleaned up ${deletedCount} expired cache entries.`);
      } else {
        alert('No expired entries found to clean up.');
      }
    } catch (error) {
      console.error('[CacheManager] Failed to cleanup cache:', error);
      alert('Failed to cleanup cache. See console for details.');
    } finally {
      setCleaningUp(false);
    }
  };

  // Format bytes to human readable
  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // Format hit rate percentage
  const formatHitRate = (hitRate: number): string => {
    return `${(hitRate * 100).toFixed(1)}%`;
  };

  // Get store display name
  const getStoreName = (storeName: string): string => {
    const storeNames: Record<string, string> = {
      flightClubData: 'Flight Club Telemetry',
      visibilityCache: 'Visibility Calculations',
      launchMatches: 'Launch Matches',
      telemetryData: 'Raw Telemetry',
      cacheMetadata: 'Cache Metadata'
    };
    return storeNames[storeName] || storeName;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex justify-between items-center p-6 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Cache Manager</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 text-2xl"
            aria-label="Close cache manager"
          >
            ×
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-140px)]">
          {loading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
              <p className="mt-4 text-gray-600 dark:text-gray-400">Loading cache statistics...</p>
            </div>
          ) : stats ? (
            <div className="space-y-6">
              {/* Overview Stats */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4">
                  <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                    {stats.totalEntries}
                  </div>
                  <div className="text-sm text-blue-600 dark:text-blue-400">Total Entries</div>
                </div>
                
                <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-4">
                  <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                    {formatBytes(stats.totalSize)}
                  </div>
                  <div className="text-sm text-green-600 dark:text-green-400">Total Size</div>
                </div>
                
                <div className="bg-purple-50 dark:bg-purple-900/20 rounded-lg p-4">
                  <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                    {formatHitRate(stats.hitRate)}
                  </div>
                  <div className="text-sm text-purple-600 dark:text-purple-400">Cache Hit Rate</div>
                </div>
              </div>

              {/* Store Breakdown */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Cache Stores</h3>
                <div className="space-y-3">
                  {Object.entries(stats.stores).map(([storeName, storeStats]) => (
                    <div key={storeName} className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
                      <div className="flex justify-between items-center">
                        <div>
                          <h4 className="font-medium text-gray-900 dark:text-white">
                            {getStoreName(storeName)}
                          </h4>
                          <div className="text-sm text-gray-600 dark:text-gray-400">
                            {storeStats.entries} entries • {formatBytes(storeStats.size)}
                          </div>
                        </div>
                        <div className="text-right text-sm text-gray-500 dark:text-gray-400">
                          {storeStats.entries > 0 && (
                            <>
                              <div>Oldest: {storeStats.oldestEntry ? new Date(storeStats.oldestEntry).toLocaleDateString() : 'N/A'}</div>
                              <div>Newest: {storeStats.newestEntry ? new Date(storeStats.newestEntry).toLocaleDateString() : 'N/A'}</div>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Cache Benefits */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Performance Benefits</h3>
                <div className="bg-gradient-to-r from-blue-50 to-green-50 dark:from-blue-900/20 dark:to-green-900/20 rounded-lg p-4">
                  <ul className="space-y-2 text-sm text-gray-700 dark:text-gray-300">
                    <li className="flex items-center">
                      <span className="w-2 h-2 bg-green-500 rounded-full mr-2"></span>
                      Flight Club telemetry data cached for 7 days - reduces API calls
                    </li>
                    <li className="flex items-center">
                      <span className="w-2 h-2 bg-blue-500 rounded-full mr-2"></span>
                      Visibility calculations cached for 6 hours - faster launch loading
                    </li>
                    <li className="flex items-center">
                      <span className="w-2 h-2 bg-purple-500 rounded-full mr-2"></span>
                      Launch matches cached for 24 hours - improved startup performance
                    </li>
                    <li className="flex items-center">
                      <span className="w-2 h-2 bg-orange-500 rounded-full mr-2"></span>
                      Automatic cleanup of expired entries - maintains optimal performance
                    </li>
                  </ul>
                </div>
              </div>

              {/* Actions */}
              <div className="flex flex-col sm:flex-row gap-3">
                <button
                  onClick={handleCleanup}
                  disabled={cleaningUp}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-4 py-2 rounded-lg font-medium transition-colors"
                >
                  {cleaningUp ? 'Cleaning up...' : 'Clean up expired entries'}
                </button>
                
                <button
                  onClick={loadStats}
                  disabled={loading}
                  className="flex-1 bg-gray-600 hover:bg-gray-700 disabled:opacity-50 text-white px-4 py-2 rounded-lg font-medium transition-colors"
                >
                  {loading ? 'Refreshing...' : 'Refresh stats'}
                </button>
                
                <button
                  onClick={handleClearAll}
                  disabled={clearing}
                  className="flex-1 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white px-4 py-2 rounded-lg font-medium transition-colors"
                >
                  {clearing ? 'Clearing...' : 'Clear all cache'}
                </button>
              </div>
            </div>
          ) : (
            <div className="text-center py-8">
              <p className="text-gray-600 dark:text-gray-400">Failed to load cache statistics</p>
              <button
                onClick={loadStats}
                className="mt-4 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-colors"
              >
                Retry
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CacheManager;