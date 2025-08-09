/**
 * Performance Monitor Component
 * Shows real-time performance metrics for the optimized launch data service
 */

import React, { useState, useEffect } from 'react';
import { optimizedLaunchDataService } from '../services/optimizedLaunchDataService';

interface PerformanceMetrics {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  averageResponseTime: number;
  cacheAge: number;
  lastError?: string;
  schedulerMetrics: {
    activeLaunches: number;
    pendingUpdates: number;
    totalRetries: number;
    averageRetryCount: number;
  };
}

interface PerformanceMonitorProps {
  isVisible: boolean;
  onClose: () => void;
}

const PerformanceMonitor: React.FC<PerformanceMonitorProps> = ({ isVisible, onClose }) => {
  const [metrics, setMetrics] = useState<PerformanceMetrics | null>(null);
  const [refreshInterval, setRefreshInterval] = useState<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (isVisible) {
      // Initial load
      updateMetrics();
      
      // Set up refresh interval
      const interval = setInterval(updateMetrics, 1000);
      setRefreshInterval(interval);
      
      return () => {
        clearInterval(interval);
        setRefreshInterval(null);
      };
    } else {
      if (refreshInterval) {
        clearInterval(refreshInterval);
        setRefreshInterval(null);
      }
    }
  }, [isVisible]);

  const updateMetrics = () => {
    try {
      const currentMetrics = optimizedLaunchDataService.getMetrics();
      setMetrics(currentMetrics);
    } catch (error) {
      console.error('Failed to get performance metrics:', error);
    }
  };

  const formatTime = (ms: number): string => {
    if (ms < 1000) return `${ms.toFixed(0)}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    return `${(ms / 60000).toFixed(1)}m`;
  };

  const formatSuccessRate = (successful: number, total: number): string => {
    if (total === 0) return '0%';
    return `${((successful / total) * 100).toFixed(1)}%`;
  };

  if (!isVisible || !metrics) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
            ⚡ Performance Monitor
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 text-2xl"
          >
            ×
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* API Performance */}
          <div>
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
              📡 API Performance
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4">
                <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                  {metrics.totalRequests}
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400">Total Requests</div>
              </div>
              
              <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-4">
                <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                  {formatSuccessRate(metrics.successfulRequests, metrics.totalRequests)}
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400">Success Rate</div>
              </div>
              
              <div className="bg-yellow-50 dark:bg-yellow-900/20 rounded-lg p-4">
                <div className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">
                  {formatTime(metrics.averageResponseTime)}
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400">Avg Response</div>
              </div>
              
              <div className="bg-purple-50 dark:bg-purple-900/20 rounded-lg p-4">
                <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                  {formatTime(metrics.cacheAge)}
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400">Cache Age</div>
              </div>
            </div>
          </div>

          {/* Scheduler Performance */}
          <div>
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
              ⏰ Scheduler Performance
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-indigo-50 dark:bg-indigo-900/20 rounded-lg p-4">
                <div className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">
                  {metrics.schedulerMetrics.activeLaunches}
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400">Active Launches</div>
              </div>
              
              <div className="bg-orange-50 dark:bg-orange-900/20 rounded-lg p-4">
                <div className="text-2xl font-bold text-orange-600 dark:text-orange-400">
                  {metrics.schedulerMetrics.pendingUpdates}
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400">Pending Updates</div>
              </div>
              
              <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-4">
                <div className="text-2xl font-bold text-red-600 dark:text-red-400">
                  {metrics.schedulerMetrics.totalRetries}
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400">Total Retries</div>
              </div>
              
              <div className="bg-teal-50 dark:bg-teal-900/20 rounded-lg p-4">
                <div className="text-2xl font-bold text-teal-600 dark:text-teal-400">
                  {metrics.schedulerMetrics.averageRetryCount.toFixed(2)}
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400">Avg Retries</div>
              </div>
            </div>
          </div>

          {/* Error Information */}
          {metrics.lastError && (
            <div>
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
                ⚠️ Last Error
              </h3>
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
                <div className="text-sm text-red-800 dark:text-red-200 font-mono">
                  {metrics.lastError}
                </div>
              </div>
            </div>
          )}

          {/* Performance Tips */}
          <div>
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
              💡 Optimization Benefits
            </h3>
            <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
              <ul className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
                <li className="flex items-center">
                  <span className="text-green-500 mr-2">✅</span>
                  Batched API calls reduce server load and improve efficiency
                </li>
                <li className="flex items-center">
                  <span className="text-green-500 mr-2">✅</span>
                  Request deduplication prevents unnecessary duplicate calls
                </li>
                <li className="flex items-center">
                  <span className="text-green-500 mr-2">✅</span>
                  Exponential backoff handles temporary API failures gracefully
                </li>
                <li className="flex items-center">
                  <span className="text-green-500 mr-2">✅</span>
                  Adaptive caching reduces API calls based on launch urgency
                </li>
                <li className="flex items-center">
                  <span className="text-green-500 mr-2">✅</span>
                  Debounced UI updates prevent excessive re-renders
                </li>
              </ul>
            </div>
          </div>

          {/* Real-time Status */}
          <div className="text-center">
            <div className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-green-100 dark:bg-green-900/20 text-green-800 dark:text-green-200">
              <div className="w-2 h-2 bg-green-500 rounded-full mr-2 animate-pulse"></div>
              Live monitoring active
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PerformanceMonitor;