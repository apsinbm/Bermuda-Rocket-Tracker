import React, { useState, useEffect } from 'react';
import { LaunchWithVisibility } from '../types';

interface AnalyticsData {
  totalLaunches: number;
  visibilityDistribution: {
    high: number;
    medium: number;
    low: number;
    none: number;
  };
  trajectoryStats: {
    [key: string]: number;
  };
  timeOfDayStats: {
    morning: number;
    afternoon: number;
    evening: number;
    night: number;
  };
  monthlyTrends: {
    [key: string]: number;
  };
}

interface AnalyticsDashboardProps {
  launches: LaunchWithVisibility[];
  onClose: () => void;
}

const AnalyticsDashboard: React.FC<AnalyticsDashboardProps> = ({ launches, onClose }) => {
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [selectedTab, setSelectedTab] = useState<'overview' | 'visibility' | 'trajectories' | 'timing'>('overview');

  useEffect(() => {
    if (launches.length === 0) return;

    // Debug: Check what visibility likelihood values we actually have
    const likelihoodCounts = launches.reduce((acc, launch) => {
      const likelihood = launch.visibility.likelihood;
      acc[likelihood] = (acc[likelihood] || 0) + 1;
      return acc;
    }, {} as { [key: string]: number });

    const visibilityDistribution = {
      high: launches.filter(l => l.visibility.likelihood === 'high').length,
      medium: launches.filter(l => l.visibility.likelihood === 'medium').length,
      low: launches.filter(l => l.visibility.likelihood === 'low').length,
      none: launches.filter(l => l.visibility.likelihood === 'none').length,
    };
    
    // Debug: Verify our calculations add up
    const totalCalculated = visibilityDistribution.high + visibilityDistribution.medium + visibilityDistribution.low + visibilityDistribution.none;
    
    if (totalCalculated !== launches.length) {
      console.warn('[Analytics] MISMATCH: Visibility categories do not add up to total launches!');
      // Show launches that don't match our expected categories
      const unmatchedLaunches = launches.filter(l => 
        !['high', 'medium', 'low', 'none'].includes(l.visibility.likelihood)
      );
      console.warn('[Analytics] Unmatched launches:', unmatchedLaunches.map(l => ({
        name: l.mission.name,
        likelihood: l.visibility.likelihood
      })));
    }

    const trajectoryStats: { [key: string]: number } = {};
    launches.forEach(launch => {
      const direction = launch.visibility.trajectoryDirection || 'Unknown';
      trajectoryStats[direction] = (trajectoryStats[direction] || 0) + 1;
    });

    const timeOfDayStats = {
      morning: 0,
      afternoon: 0,
      evening: 0,
      night: 0
    };

    const monthlyTrends: { [key: string]: number } = {};

    launches.forEach(launch => {
      const launchDate = new Date(launch.net);
      const hour = launchDate.getHours();
      const monthYear = launchDate.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
      
      monthlyTrends[monthYear] = (monthlyTrends[monthYear] || 0) + 1;

      if (hour >= 5 && hour < 12) {
        timeOfDayStats.morning++;
      } else if (hour >= 12 && hour < 17) {
        timeOfDayStats.afternoon++;
      } else if (hour >= 17 && hour < 21) {
        timeOfDayStats.evening++;
      } else {
        timeOfDayStats.night++;
      }
    });

    setAnalytics({
      totalLaunches: launches.length,
      visibilityDistribution,
      trajectoryStats,
      timeOfDayStats,
      monthlyTrends
    });
  }, [launches]);

  if (!analytics) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-4xl mx-auto">
        <div className="animate-pulse">Loading analytics...</div>
      </div>
    );
  }

  const getPercentage = (value: number) => ((value / analytics.totalLaunches) * 100).toFixed(1);

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex justify-between items-center p-6 border-b border-gray-200 dark:border-gray-700">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
            📊 Launch Analytics Dashboard
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Insights from {analytics.totalLaunches} upcoming launches
          </p>
        </div>
        <button
          onClick={onClose}
          className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
        >
          <svg className="w-6 h-6 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Tab Navigation */}
      <div className="px-6 pt-6">
        <div className="border-b border-gray-200 dark:border-gray-700">
          <nav className="-mb-px flex space-x-8">
            {[
              { id: 'overview', label: '🏠 Overview', count: analytics.totalLaunches },
              { id: 'visibility', label: '👁️ Visibility', count: analytics.visibilityDistribution.high + analytics.visibilityDistribution.medium },
              { id: 'trajectories', label: '🚀 Trajectories', count: Object.keys(analytics.trajectoryStats).length },
              { id: 'timing', label: '⏰ Timing', count: Object.keys(analytics.monthlyTrends).length }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setSelectedTab(tab.id as any)}
                className={`py-2 px-1 border-b-2 font-medium text-sm transition-colors ${
                  selectedTab === tab.id
                    ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                    : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                }`}
              >
                {tab.label}
                <span className="ml-2 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 px-2 py-1 rounded-full text-xs">
                  {tab.count}
                </span>
              </button>
            ))}
          </nav>
        </div>
      </div>

      {/* Tab Content */}
      <div className="p-6">
        {selectedTab === 'overview' && (
          <div className="space-y-6">
            {/* Quick Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900/20 dark:to-green-800/20 rounded-lg p-4">
                <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                  {analytics.visibilityDistribution.high}
                </div>
                <div className="text-sm text-green-700 dark:text-green-300">Likely Visible</div>
                <div className="text-xs text-green-600 dark:text-green-400 mt-1">
                  {getPercentage(analytics.visibilityDistribution.high)}% of launches
                </div>
              </div>
              
              <div className="bg-gradient-to-br from-yellow-50 to-yellow-100 dark:from-yellow-900/20 dark:to-yellow-800/20 rounded-lg p-4">
                <div className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">
                  {analytics.visibilityDistribution.medium}
                </div>
                <div className="text-sm text-yellow-700 dark:text-yellow-300">Possibly Visible</div>
                <div className="text-xs text-yellow-600 dark:text-yellow-400 mt-1">
                  {getPercentage(analytics.visibilityDistribution.medium)}% of launches
                </div>
              </div>
              
              <div className="bg-gradient-to-br from-orange-50 to-orange-100 dark:from-orange-900/20 dark:to-orange-800/20 rounded-lg p-4">
                <div className="text-2xl font-bold text-orange-600 dark:text-orange-400">
                  {analytics.visibilityDistribution.low}
                </div>
                <div className="text-sm text-orange-700 dark:text-orange-300">Unlikely Visible</div>
                <div className="text-xs text-orange-600 dark:text-orange-400 mt-1">
                  {getPercentage(analytics.visibilityDistribution.low)}% of launches
                </div>
              </div>
              
              <div className="bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900/20 dark:to-gray-800/20 rounded-lg p-4">
                <div className="text-2xl font-bold text-gray-600 dark:text-gray-400">
                  {analytics.visibilityDistribution.none}
                </div>
                <div className="text-sm text-gray-700 dark:text-gray-300">Not Visible</div>
                <div className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                  {getPercentage(analytics.visibilityDistribution.none)}% of launches
                </div>
              </div>
            </div>

            {/* Additional Overview Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20 rounded-lg p-4">
                <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                  {analytics.timeOfDayStats.evening + analytics.timeOfDayStats.night}
                </div>
                <div className="text-sm text-blue-700 dark:text-blue-300">Evening/Night</div>
                <div className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                  Prime viewing times
                </div>
              </div>
              
              <div className="bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-900/20 dark:to-purple-800/20 rounded-lg p-4">
                <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                  {Object.keys(analytics.trajectoryStats).length}
                </div>
                <div className="text-sm text-purple-700 dark:text-purple-300">Flight Paths</div>
                <div className="text-xs text-purple-600 dark:text-purple-400 mt-1">
                  Different trajectories
                </div>
              </div>
              
              <div className="bg-gradient-to-br from-indigo-50 to-indigo-100 dark:from-indigo-900/20 dark:to-indigo-800/20 rounded-lg p-4">
                <div className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">
                  {analytics.totalLaunches}
                </div>
                <div className="text-sm text-indigo-700 dark:text-indigo-300">Upcoming Launches</div>
                <div className="text-xs text-indigo-600 dark:text-indigo-400 mt-1">
                  Total from Florida
                </div>
              </div>
              
              <div className="bg-gradient-to-br from-teal-50 to-teal-100 dark:from-teal-900/20 dark:to-teal-800/20 rounded-lg p-4">
                <div className="text-2xl font-bold text-teal-600 dark:text-teal-400">
                  {analytics.visibilityDistribution.high + analytics.visibilityDistribution.medium}
                </div>
                <div className="text-sm text-teal-700 dark:text-teal-300">Viewable Total</div>
                <div className="text-xs text-teal-600 dark:text-teal-400 mt-1">
                  Likely + Possibly visible
                </div>
              </div>
            </div>

            {/* Best Launch Opportunities */}
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/10 dark:to-indigo-900/10 rounded-lg p-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                🌟 Best Viewing Opportunities
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <h4 className="font-medium text-gray-700 dark:text-gray-300 mb-2">Prime Time Launches</h4>
                  <div className="text-sm text-gray-600 dark:text-gray-400">
                    • <strong>{analytics.timeOfDayStats.evening}</strong> evening launches (5-9 PM)
                    <br />
                    • <strong>{analytics.timeOfDayStats.night}</strong> night launches (9 PM-5 AM)
                    <br />
                    • Total: <strong>{((analytics.timeOfDayStats.evening + analytics.timeOfDayStats.night) / analytics.totalLaunches * 100).toFixed(1)}%</strong> in optimal viewing window
                  </div>
                </div>
                <div>
                  <h4 className="font-medium text-gray-700 dark:text-gray-300 mb-2">Visibility Success Rate</h4>
                  <div className="text-sm text-gray-600 dark:text-gray-400">
                    • <strong>{getPercentage(analytics.visibilityDistribution.high + analytics.visibilityDistribution.medium)}%</strong> visible launches
                    <br />
                    • <strong>{getPercentage(analytics.visibilityDistribution.high)}%</strong> excellent conditions
                    <br />
                    • Based on exhaust plume physics
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {selectedTab === 'visibility' && (
          <div className="space-y-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              👁️ Visibility Analysis
            </h3>
            
            {/* Visibility Distribution Chart */}
            <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-6">
              <h4 className="font-medium text-gray-700 dark:text-gray-300 mb-4">Visibility Distribution</h4>
              <div className="space-y-3">
                {Object.entries(analytics.visibilityDistribution).map(([level, count]) => {
                  const percentage = (count / analytics.totalLaunches) * 100;
                  const colors = {
                    high: 'bg-green-500',
                    medium: 'bg-yellow-500',
                    low: 'bg-orange-500',
                    none: 'bg-gray-500'
                  };
                  const labels = {
                    high: '🌟 Excellent',
                    medium: '👍 Good',
                    low: '⚠️ Poor',
                    none: '❌ None'
                  };
                  
                  return (
                    <div key={level} className="flex items-center">
                      <div className="w-24 text-sm text-gray-600 dark:text-gray-400">
                        {labels[level as keyof typeof labels]}
                      </div>
                      <div className="flex-1 mx-4">
                        <div className="bg-gray-200 dark:bg-gray-600 rounded-full h-3">
                          <div
                            className={`h-3 rounded-full ${colors[level as keyof typeof colors]}`}
                            style={{ width: `${percentage}%` }}
                          />
                        </div>
                      </div>
                      <div className="text-sm font-medium text-gray-900 dark:text-white w-16 text-right">
                        {count} ({percentage.toFixed(1)}%)
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Physics Explanation */}
            <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-6">
              <h4 className="font-medium text-blue-900 dark:text-blue-100 mb-3">
                🔬 Exhaust Plume Physics
              </h4>
              <div className="text-sm text-blue-800 dark:text-blue-200 space-y-2">
                <p><strong>Excellent (Golden Hour):</strong> 0-30 minutes after sunset - maximum plume illumination</p>
                <p><strong>Good (Fading Window):</strong> 30-60 minutes after sunset - decreasing visibility</p>
                <p><strong>Poor:</strong> Deep night or daylight - minimal plume contrast</p>
                <p><strong>None:</strong> Unfavorable lighting conditions</p>
              </div>
            </div>
          </div>
        )}

        {selectedTab === 'trajectories' && (
          <div className="space-y-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              🚀 Flight Path Analysis
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {Object.entries(analytics.trajectoryStats).map(([direction, count]) => {
                const percentage = (count / analytics.totalLaunches) * 100;
                const directionEmojis: { [key: string]: string } = {
                  'Northeast': '↗️',
                  'East-Northeast': '🔼',
                  'East': '➡️',
                  'East-Southeast': '🔽',
                  'Southeast': '↘️',
                  'Unknown': '❓'
                };
                
                return (
                  <div key={direction} className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="font-medium text-gray-900 dark:text-white">
                        {directionEmojis[direction] || '🚀'} {direction}
                      </h4>
                      <span className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                        {count}
                      </span>
                    </div>
                    <div className="bg-gray-200 dark:bg-gray-600 rounded-full h-2 mb-2">
                      <div
                        className="bg-blue-500 h-2 rounded-full"
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                    <div className="text-sm text-gray-600 dark:text-gray-400">
                      {percentage.toFixed(1)}% of all launches
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {selectedTab === 'timing' && (
          <div className="space-y-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              ⏰ Launch Timing Patterns
            </h3>
            
            {/* Time of Day Distribution */}
            <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-6">
              <h4 className="font-medium text-gray-700 dark:text-gray-300 mb-4">Time of Day Distribution</h4>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {Object.entries(analytics.timeOfDayStats).map(([period, count]) => {
                  const percentage = (count / analytics.totalLaunches) * 100;
                  const periodEmojis = {
                    morning: '🌅',
                    afternoon: '☀️',
                    evening: '🌆',
                    night: '🌙'
                  };
                  const periodLabels = {
                    morning: 'Morning (5AM-12PM)',
                    afternoon: 'Afternoon (12PM-5PM)',
                    evening: 'Evening (5PM-9PM)',
                    night: 'Night (9PM-5AM)'
                  };
                  
                  return (
                    <div key={period} className="text-center">
                      <div className="text-3xl mb-2">{periodEmojis[period as keyof typeof periodEmojis]}</div>
                      <div className="text-2xl font-bold text-gray-900 dark:text-white">{count}</div>
                      <div className="text-sm text-gray-600 dark:text-gray-400">
                        {periodLabels[period as keyof typeof periodLabels]}
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        {percentage.toFixed(1)}%
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Monthly Trends */}
            <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-6">
              <h4 className="font-medium text-gray-700 dark:text-gray-300 mb-4">Monthly Launch Trends</h4>
              <div className="space-y-2">
                {Object.entries(analytics.monthlyTrends).map(([month, count]) => {
                  const percentage = (count / analytics.totalLaunches) * 100;
                  
                  return (
                    <div key={month} className="flex items-center">
                      <div className="w-20 text-sm text-gray-600 dark:text-gray-400">
                        {month}
                      </div>
                      <div className="flex-1 mx-4">
                        <div className="bg-gray-200 dark:bg-gray-600 rounded-full h-2">
                          <div
                            className="bg-indigo-500 h-2 rounded-full"
                            style={{ width: `${percentage}%` }}
                          />
                        </div>
                      </div>
                      <div className="text-sm font-medium text-gray-900 dark:text-white w-16 text-right">
                        {count} launches
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AnalyticsDashboard;