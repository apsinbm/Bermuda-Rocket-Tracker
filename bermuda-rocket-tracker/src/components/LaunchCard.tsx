import React, { useState } from 'react';
import { LaunchWithVisibility } from '../types';
import { formatLaunchTime, formatLaunchWindow, getCountdownTime } from '../utils/timeUtils';
import { getBearingDirection } from '../services/visibilityService';
import { getFriendlyLocation } from '../utils/launchPadInfo';
import { getTrackingExplanation } from '../utils/trackingExplanation';
import TrajectoryThumbnail from './TrajectoryThumbnail';
import TrajectoryVisualization from './TrajectoryVisualization';
import WeatherDisplay from './WeatherDisplay';
import InteractiveSkyMap from './InteractiveSkyMap';

interface LaunchCardProps {
  launch: LaunchWithVisibility;
}

const LaunchCard: React.FC<LaunchCardProps> = ({ launch }) => {
  const { date } = formatLaunchTime(launch.net);
  const launchWindow = formatLaunchWindow(launch.window_start, launch.window_end, launch.net);
  const countdown = getCountdownTime(launch.net); // Keep countdown using NET time as requested
  const [showTrajectory, setShowTrajectory] = useState(false);
  const [showSkyMap, setShowSkyMap] = useState(false);
  const [showWeatherDetail, setShowWeatherDetail] = useState(false);
  
  
  const getVisibilityColor = (likelihood: string) => {
    switch (likelihood) {
      case 'high': return 'bg-green-100 text-green-800 border-green-200';
      case 'medium': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'low': return 'bg-red-100 text-red-800 border-red-200';
      case 'none': return 'bg-gray-100 text-gray-800 border-gray-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };
  
  const getVisibilityText = (likelihood: string) => {
    switch (likelihood) {
      case 'high': return 'Likely Visible';
      case 'medium': return 'Possibly Visible';
      case 'low': return 'Unlikely Visible';
      case 'none': return 'Not Visible';
      default: return 'Unknown';
    }
  };

  const getTrajectoryConfidenceColor = (trajectoryDirection?: string, trajectoryImageUrl?: string) => {
    if (trajectoryImageUrl) {
      return 'bg-blue-100 text-blue-800 border-blue-200';
    } else if (trajectoryDirection && trajectoryDirection !== 'Unknown') {
      return 'bg-green-100 text-green-700 border-green-200';
    } else {
      return 'bg-gray-100 text-gray-600 border-gray-200';
    }
  };

  const getTrajectoryConfidenceText = (trajectoryDirection?: string, trajectoryImageUrl?: string) => {
    if (trajectoryImageUrl) {
      return '📊 Projected Path';
    } else if (trajectoryDirection && trajectoryDirection !== 'Unknown') {
      return '📡 Confirmed Path';  
    } else {
      return '🔍 Estimated Path';
    }
  };
  
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 border border-gray-200 dark:border-gray-700">
      {/* Header */}
      <div className="flex justify-between items-start mb-4">
        <div>
          <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-1">
            {launch.mission.name}
          </h3>
          <p className="text-gray-600 dark:text-gray-300">
            {launch.rocket.name}
          </p>
        </div>
        <div className="flex flex-col items-end space-y-2">
          <div className={`px-3 py-1 rounded-full text-sm font-medium border ${getVisibilityColor(launch.visibility.likelihood)}`}>
            {getVisibilityText(launch.visibility.likelihood)}
          </div>
          <div className={`px-2 py-1 rounded text-xs font-medium border ${getTrajectoryConfidenceColor(launch.visibility.trajectoryDirection, launch.visibility.trajectoryImageUrl)}`}>
            {getTrajectoryConfidenceText(launch.visibility.trajectoryDirection, launch.visibility.trajectoryImageUrl)}
          </div>
        </div>
      </div>
      
      {/* Launch Details */}
      <div className="space-y-3 mb-4">
        <div className="flex justify-between">
          <span className="text-gray-600 dark:text-gray-400">Date:</span>
          <span className="font-medium text-gray-900 dark:text-white">{date}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-600 dark:text-gray-400">
            {launchWindow.hasWindow ? 'Launch Window:' : 'Time (Bermuda):'}
          </span>
          <span className="font-medium text-gray-900 dark:text-white">
            {launchWindow.windowText} {launchWindow.timeZone}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-600 dark:text-gray-400">Launch Pad:</span>
          <span className="font-medium text-gray-900 dark:text-white text-right">
            {getFriendlyLocation(launch.pad.name)}
          </span>
        </div>
        {launch.mission.orbit && (
          <div className="flex justify-between">
            <span className="text-gray-600 dark:text-gray-400">Target Orbit:</span>
            <span className="font-medium text-gray-900 dark:text-white">
              {launch.mission.orbit.name}
            </span>
          </div>
        )}
      </div>
      
      
      {/* Visibility Information */}
      <div className="border-t border-gray-200 dark:border-gray-600 pt-4">
        <div className="flex justify-between items-start mb-2">
          {launch.visibility.trajectoryImageUrl && (
            <TrajectoryThumbnail
              imageUrl={launch.visibility.trajectoryImageUrl}
              trajectoryDirection={launch.visibility.trajectoryDirection}
              launchName={launch.mission.name}
            />
          )}
        </div>
        
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
          {launch.visibility.reason}
        </p>
        
        
        {/* Weather conditions */}
        <div className="mb-3">
          <WeatherDisplay launch={launch} showDetailed={false} />
        </div>

        {/* Beginner-friendly tracking explanation */}
        {launch.visibility.likelihood !== 'none' && (
          <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3 mb-2">
            <p className="text-sm text-blue-800 dark:text-blue-200">
              <strong>How to track:</strong> {getTrackingExplanation(launch)}
            </p>
          </div>
        )}
        
        {launch.visibility.trajectoryDirection && launch.visibility.trajectoryDirection !== 'Unknown' && (
          <div className="flex justify-between text-sm mb-1">
            <span className="text-gray-600 dark:text-gray-400">Trajectory:</span>
            <span className="font-medium text-gray-900 dark:text-white">
              {launch.visibility.trajectoryDirection}
            </span>
          </div>
        )}
        
        {launch.visibility.bearing && (
          <div className="flex justify-between text-sm">
            <span className="text-gray-600 dark:text-gray-400">Look towards:</span>
            <span className="font-medium text-gray-900 dark:text-white">
              {getBearingDirection(launch.visibility.bearing)} ({launch.visibility.bearing}°)
            </span>
          </div>
        )}
        
        {launch.visibility.estimatedTimeVisible && (
          <div className="flex justify-between text-sm mt-1">
            <span className="text-gray-600 dark:text-gray-400">Visible for:</span>
            <span className="font-medium text-gray-900 dark:text-white">
              {launch.visibility.estimatedTimeVisible}
            </span>
          </div>
        )}
        
        {/* Action Buttons for High Visibility Launches */}
        {(launch.visibility.likelihood === 'high' || launch.visibility.likelihood === 'medium') && (
          <div className="mt-3 grid grid-cols-3 gap-2">
            <button
              onClick={() => setShowTrajectory(!showTrajectory)}
              className="px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors text-sm font-medium"
            >
              {showTrajectory ? '📊 Hide Chart' : '📊 Trajectory'}
            </button>
            <button
              onClick={() => setShowSkyMap(!showSkyMap)}
              className="px-3 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors text-sm font-medium"
            >
              {showSkyMap ? '🗺️ Hide Map' : '🗺️ Sky Map'}
            </button>
            <button
              onClick={() => setShowWeatherDetail(!showWeatherDetail)}
              className="px-2 py-2 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white transition-all duration-200 text-sm font-medium shadow-lg border-2 border-amber-400 hover:shadow-xl transform hover:scale-105"
              style={{ 
                borderRadius: '20px / 14px',  // Oval octagon effect
                clipPath: 'polygon(20% 0%, 80% 0%, 100% 20%, 100% 80%, 80% 100%, 20% 100%, 0% 80%, 0% 20%)'
              }}
            >
              {showWeatherDetail ? '🌤️ Hide Weather' : '🌦️ Weather'}
            </button>
          </div>
        )}
      </div>
      
      {/* Live Stream Link */}
      {launch.livestream_url && (
        <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-600">
          <a
            href={launch.livestream_url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
          >
            <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
              <path d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" />
            </svg>
            Watch Live Stream
          </a>
        </div>
      )}
      
      {/* Countdown Timer - Bottom */}
      {!countdown.isLive && (
        <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-600">
          <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3">
            <div className="text-center">
              <div className="text-2xl font-bold text-gray-900 dark:text-white">
                {countdown.days > 0 && `${countdown.days}d `}
                {countdown.hours}h {countdown.minutes}m
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400">
                until launch
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* Trajectory Visualization Modal */}
      {showTrajectory && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
          <div className="max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <TrajectoryVisualization
              launch={launch}
              onClose={() => setShowTrajectory(false)}
            />
          </div>
        </div>
      )}

      {/* Interactive Sky Map Modal */}
      {showSkyMap && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
          <div className="max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <InteractiveSkyMap
              launch={launch}
              onClose={() => setShowSkyMap(false)}
            />
          </div>
        </div>
      )}

      {/* Detailed Weather Modal */}
      {showWeatherDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
          <div className="max-w-3xl w-full max-h-[90vh] overflow-y-auto">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl">
              <div className="flex justify-between items-center p-6 border-b border-gray-200 dark:border-gray-700">
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center">
                  🌦️ Weather Conditions for {launch.mission.name}
                </h2>
                <button
                  onClick={() => setShowWeatherDetail(false)}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <div className="p-6">
                <WeatherDisplay launch={launch} showDetailed={true} />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LaunchCard;