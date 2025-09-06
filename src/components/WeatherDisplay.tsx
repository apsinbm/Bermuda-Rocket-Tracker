import React, { useState, useEffect } from 'react';
import { WeatherService, WeatherData, LaunchWeatherAssessment } from '../services/weatherService';
import { LaunchWithVisibility } from '../types';
import { formatTemperature } from '../utils/temperatureUtils';

interface WeatherDisplayProps {
  launch?: LaunchWithVisibility;
  showDetailed?: boolean;
}

const WeatherDisplay: React.FC<WeatherDisplayProps> = ({ launch, showDetailed = false }) => {
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [launchWeather, setLaunchWeather] = useState<LaunchWeatherAssessment | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadWeather = async () => {
      try {
        setLoading(true);
        setError(null);

        const currentWeather = await WeatherService.getCurrentWeather();
        setWeather(currentWeather);

        if (launch) {
          const launchAssessment = await WeatherService.getWeatherForLaunch(new Date(launch.net));
          setLaunchWeather(launchAssessment);
        }
      } catch (err) {
        setError('Failed to load weather data');
        console.error('Weather loading error:', err);
      } finally {
        setLoading(false);
      }
    };

    loadWeather();
  }, [launch]);

  if (loading) {
    return (
      <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4 animate-pulse">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 bg-blue-200 dark:bg-blue-700 rounded-full"></div>
          <div>
            <div className="h-4 bg-blue-200 dark:bg-blue-700 rounded w-24 mb-2"></div>
            <div className="h-3 bg-blue-200 dark:bg-blue-700 rounded w-32"></div>
          </div>
        </div>
      </div>
    );
  }

  if (error || !weather) {
    return (
      <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-4">
        <div className="flex items-center text-red-600 dark:text-red-400">
          <span className="text-lg mr-2">⚠️</span>
          <span className="text-sm">{error || 'Weather data unavailable'}</span>
        </div>
      </div>
    );
  }

  const getRatingColor = (rating: string) => {
    switch (rating) {
      case 'excellent': return 'text-green-600 dark:text-green-400';
      case 'good': return 'text-blue-600 dark:text-blue-400';
      case 'fair': return 'text-yellow-600 dark:text-yellow-400';
      case 'poor': 
      case 'very_poor': return 'text-red-600 dark:text-red-400';
      default: return 'text-gray-600 dark:text-gray-400';
    }
  };

  const getRatingBg = (rating: string) => {
    switch (rating) {
      case 'excellent': return 'bg-green-50 dark:bg-green-900/20';
      case 'good': return 'bg-blue-50 dark:bg-blue-900/20';
      case 'fair': return 'bg-yellow-50 dark:bg-yellow-900/20';
      case 'poor':
      case 'very_poor': return 'bg-red-50 dark:bg-red-900/20';
      default: return 'bg-gray-50 dark:bg-gray-900/20';
    }
  };

  // Show current weather only (compact view)
  if (!launch || !launchWeather) {
    return (
      <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <span className="text-2xl">{weather.current.icon}</span>
            <div>
              <div className="font-medium text-blue-900 dark:text-blue-100">
                Current Bermuda Weather
              </div>
              <div className="text-sm text-blue-700 dark:text-blue-300">
                {formatTemperature(weather.current.temperature)} • {weather.current.condition}
              </div>
            </div>
          </div>
          <div className="text-right">
            <div className="text-sm text-blue-700 dark:text-blue-300">
              {weather.current.cloudCover}% clouds
            </div>
            <div className="text-xs text-blue-600 dark:text-blue-400">
              {weather.current.visibility}km visibility
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Show detailed launch weather assessment
  return (
    <div className={`${getRatingBg(launchWeather.overallRating)} rounded-lg p-4`}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center space-x-3">
          {showDetailed && <span className="text-2xl">{weather.current.icon}</span>}
          <div>
            <div className={`font-semibold ${getRatingColor(launchWeather.overallRating)}`}>
              Weather for Launch
            </div>
            <div className={`text-sm ${getRatingColor(launchWeather.overallRating)} opacity-80`}>
              {launchWeather.overallRating.charAt(0).toUpperCase() + launchWeather.overallRating.slice(1)} conditions
            </div>
          </div>
        </div>
        <div 
          className={`px-3 py-2 text-xs font-bold border-2 transform transition-transform hover:scale-105 ${
            launchWeather.overallRating === 'excellent' ? 'bg-green-100 text-green-800 border-green-300' :
            launchWeather.overallRating === 'good' ? 'bg-blue-100 text-blue-800 border-blue-300' :
            launchWeather.overallRating === 'fair' ? 'bg-yellow-100 text-yellow-800 border-yellow-300' :
            'bg-red-100 text-red-800 border-red-300'
          }`}
          style={{ 
            clipPath: 'polygon(25% 0%, 75% 0%, 100% 50%, 75% 100%, 25% 100%, 0% 50%)',
            minWidth: '60px',
            textAlign: 'center'
          }}
        >
          {launchWeather.overallRating.toUpperCase()}
        </div>
      </div>

      <div className={`text-sm ${getRatingColor(launchWeather.overallRating)} mb-3`}>
        {launchWeather.recommendation}
      </div>

      {showDetailed && (
        <div className="space-y-3">
          {/* Weather Factors */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="bg-white dark:bg-gray-800 rounded p-3">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-medium text-gray-600 dark:text-gray-400">CLOUD COVER</span>
                <span className={`text-xs font-medium ${getRatingColor(launchWeather.factors.cloudCover.rating)}`}>
                  {launchWeather.factors.cloudCover.rating.toUpperCase()}
                </span>
              </div>
              <div className="text-lg font-bold text-gray-900 dark:text-white">
                {Math.round(launchWeather.factors.cloudCover.value)}%
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                {launchWeather.factors.cloudCover.impact}
              </div>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded p-3">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-medium text-gray-600 dark:text-gray-400">VISIBILITY</span>
                <span className={`text-xs font-medium ${getRatingColor(launchWeather.factors.visibility.rating)}`}>
                  {launchWeather.factors.visibility.rating.toUpperCase()}
                </span>
              </div>
              <div className="text-lg font-bold text-gray-900 dark:text-white">
                {Math.round(launchWeather.factors.visibility.value)}km
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                {launchWeather.factors.visibility.impact}
              </div>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded p-3">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-medium text-gray-600 dark:text-gray-400">PRECIPITATION</span>
                <span className={`text-xs font-medium ${getRatingColor(launchWeather.factors.precipitation.rating)}`}>
                  {launchWeather.factors.precipitation.rating.toUpperCase()}
                </span>
              </div>
              <div className="text-lg font-bold text-gray-900 dark:text-white">
                {Math.round(launchWeather.factors.precipitation.probability)}%
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                {launchWeather.factors.precipitation.impact}
              </div>
            </div>
          </div>

          {/* Detailed Forecast */}
          <div className="bg-white dark:bg-gray-800 rounded p-3">
            <h4 className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">DETAILED FORECAST</h4>
            <p className="text-sm text-gray-700 dark:text-gray-300">
              {launchWeather.detailedForecast}
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default WeatherDisplay;