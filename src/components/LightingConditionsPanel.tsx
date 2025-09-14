/**
 * Lighting Conditions Panel Component
 * Advanced lighting analysis for rocket launch photography
 */

import React, { useState, useEffect, useCallback } from 'react';
import { LaunchWithVisibility } from '../types';
import { GovernmentSolarService } from '../services/governmentSolarService';

interface LightingConditionsPanelProps {
  launch: LaunchWithVisibility;
}

interface SolarData {
  sunrise: string;
  sunset: string;
  civilTwilightBegin: string;
  civilTwilightEnd: string;
  nauticalTwilightBegin: string;
  nauticalTwilightEnd: string;
  astronomicalTwilightBegin: string;
  astronomicalTwilightEnd: string;
  solarNoon: string;
}

interface LightingAnalysis {
  timeOfDay: 'night' | 'astronomical' | 'nautical' | 'civil' | 'golden' | 'day' | 'blue-hour';
  quality: 'excellent' | 'good' | 'fair' | 'poor';
  recommendations: string[];
  sunAngle: number;
  moonPhase: number;
  optimalSettings: {
    iso: number;
    aperture: number;
    shutterSpeed: string;
  };
}

const LightingConditionsPanel: React.FC<LightingConditionsPanelProps> = ({ launch }) => {
  const [solarData, setSolarData] = useState<SolarData | null>(null);
  const [lightingAnalysis, setLightingAnalysis] = useState<LightingAnalysis | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Calculate moon phase (simplified)
  const calculateMoonPhase = useCallback((date: Date): number => {
    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    const day = date.getDate();
    
    // Simplified moon phase calculation
    const totalDays = Math.floor(365.25 * year) + Math.floor(30.44 * month) + day;
    const moonCycle = 29.53058867; // Average lunar cycle
    const phase = ((totalDays % moonCycle) / moonCycle);
    
    return Math.round(phase * 100) / 100;
  }, []);

  // Calculate sun angle above horizon
  const calculateSunAngle = useCallback((launchTime: Date, solarData: SolarData): number => {
    const launchHour = launchTime.getHours() + launchTime.getMinutes() / 60;
    const sunriseTime = new Date(`${launchTime.toDateString()} ${solarData.sunrise}`);
    const sunsetTime = new Date(`${launchTime.toDateString()} ${solarData.sunset}`);
    const solarNoonTime = new Date(`${launchTime.toDateString()} ${solarData.solarNoon}`);
    
    const sunriseHour = sunriseTime.getHours() + sunriseTime.getMinutes() / 60;
    const sunsetHour = sunsetTime.getHours() + sunsetTime.getMinutes() / 60;
    const noonHour = solarNoonTime.getHours() + solarNoonTime.getMinutes() / 60;
    
    if (launchHour < sunriseHour || launchHour > sunsetHour) {
      return -10; // Below horizon
    }
    
    // Approximate sun angle (simplified calculation)
    const timeFromNoon = Math.abs(launchHour - noonHour);
    const maxAngle = 60; // Approximate max sun angle for Bermuda in summer
    const angle = maxAngle * Math.cos((timeFromNoon / 6) * (Math.PI / 2));
    
    return Math.round(angle * 10) / 10;
  }, []);

  // Analyze lighting conditions
  const analyzeLighting = useCallback((launchTime: Date, solarData: SolarData): LightingAnalysis => {
    const launchTimeStr = launchTime.toTimeString().slice(0, 8);
    
    // Determine time of day category
    let timeOfDay: LightingAnalysis['timeOfDay'] = 'night';
    let quality: LightingAnalysis['quality'] = 'fair';
    let recommendations: string[] = [];
    
    const times = {
      astronomicalStart: new Date(`${launchTime.toDateString()} ${solarData.astronomicalTwilightBegin}`),
      nauticalStart: new Date(`${launchTime.toDateString()} ${solarData.nauticalTwilightBegin}`),
      civilStart: new Date(`${launchTime.toDateString()} ${solarData.civilTwilightBegin}`),
      sunrise: new Date(`${launchTime.toDateString()} ${solarData.sunrise}`),
      sunset: new Date(`${launchTime.toDateString()} ${solarData.sunset}`),
      civilEnd: new Date(`${launchTime.toDateString()} ${solarData.civilTwilightEnd}`),
      nauticalEnd: new Date(`${launchTime.toDateString()} ${solarData.nauticalTwilightEnd}`),
      astronomicalEnd: new Date(`${launchTime.toDateString()} ${solarData.astronomicalTwilightEnd}`)
    };

    // Golden hour calculation (1 hour after sunrise, 1 hour before sunset)
    const goldenHourMorning = new Date(times.sunrise.getTime() + 60 * 60 * 1000);
    const goldenHourEvening = new Date(times.sunset.getTime() - 60 * 60 * 1000);

    if (launchTime >= times.sunrise && launchTime <= times.sunset) {
      if (launchTime <= goldenHourMorning || launchTime >= goldenHourEvening) {
        timeOfDay = 'golden';
        quality = 'excellent';
        recommendations = [
          'Golden hour lighting - perfect for dramatic shots',
          'Lower ISO (100-400) with balanced exposure',
          'Rocket exhaust will be highly visible',
          'Include landscape elements for scale'
        ];
      } else {
        timeOfDay = 'day';
        quality = 'good';
        recommendations = [
          'Daylight conditions - use fast shutter speeds',
          'Higher shutter speed (1/1000s+) to freeze motion',
          'Moderate ISO (200-800) depending on lens',
          'May need exposure compensation for bright exhaust'
        ];
      }
    } else if (launchTime >= times.civilStart && launchTime < times.sunrise ||
               launchTime > times.sunset && launchTime <= times.civilEnd) {
      timeOfDay = 'civil';
      quality = 'excellent';
      recommendations = [
        'Civil twilight - excellent for photography',
        'Balanced sky and ground illumination',
        'Medium ISO (400-800) with moderate shutter speeds',
        'Perfect time for exhaust plume visibility'
      ];
    } else if (launchTime >= times.nauticalStart && launchTime < times.civilStart ||
               launchTime > times.civilEnd && launchTime <= times.nauticalEnd) {
      timeOfDay = 'nautical';
      quality = 'good';
      recommendations = [
        'Nautical twilight - good for launch photography',
        'Higher ISO (800-1600) may be needed',
        'Longer exposures possible (1-30 seconds)',
        'Exhaust plume will be very prominent'
      ];
    } else if (launchTime >= times.astronomicalStart && launchTime < times.nauticalStart ||
               launchTime > times.nauticalEnd && launchTime <= times.astronomicalEnd) {
      timeOfDay = 'astronomical';
      quality = 'fair';
      recommendations = [
        'Astronomical twilight - challenging but rewarding',
        'High ISO (1600+) or long exposures needed',
        'Consider star trail effects',
        'Foreground may need separate exposure'
      ];
    } else {
      timeOfDay = 'night';
      quality = 'poor';
      recommendations = [
        'Full darkness - most challenging conditions',
        'Very high ISO (3200+) or very long exposures',
        'Focus on rocket exhaust trail',
        'Consider multiple exposure blending'
      ];
    }

    // Blue hour check (20 minutes after sunset/before sunrise)
    const blueHourEvening = new Date(times.sunset.getTime() + 20 * 60 * 1000);
    const blueHourMorning = new Date(times.sunrise.getTime() - 20 * 60 * 1000);
    
    if ((launchTime >= times.sunset && launchTime <= blueHourEvening) ||
        (launchTime >= blueHourMorning && launchTime <= times.sunrise)) {
      timeOfDay = 'blue-hour';
      quality = 'excellent';
      recommendations = [
        'Blue hour - premium photography conditions',
        'Perfect balance of sky and artificial lighting',
        'Medium-high ISO (800-1600) with stable tripod',
        'Ideal for iconic rocket photography'
      ];
    }

    const sunAngle = calculateSunAngle(launchTime, solarData);
    const moonPhase = calculateMoonPhase(launchTime);

    // Optimal settings based on conditions
    let optimalSettings = {
      iso: 400,
      aperture: 8,
      shutterSpeed: '1/500s'
    };

    switch (timeOfDay) {
      case 'night':
      case 'astronomical':
        optimalSettings = { iso: 1600, aperture: 2.8, shutterSpeed: '30s' };
        break;
      case 'nautical':
        optimalSettings = { iso: 800, aperture: 4, shutterSpeed: '15s' };
        break;
      case 'civil':
      case 'blue-hour':
        optimalSettings = { iso: 400, aperture: 5.6, shutterSpeed: '2s' };
        break;
      case 'golden':
        optimalSettings = { iso: 200, aperture: 8, shutterSpeed: '1/250s' };
        break;
      case 'day':
        optimalSettings = { iso: 400, aperture: 8, shutterSpeed: '1/1000s' };
        break;
    }

    return {
      timeOfDay,
      quality,
      recommendations,
      sunAngle,
      moonPhase,
      optimalSettings
    };
  }, [calculateSunAngle, calculateMoonPhase]);

  // Load solar data
  useEffect(() => {
    const loadSolarData = async () => {
      try {
        setLoading(true);
        setError(null);
        
        const launchDate = new Date(launch.net);
        const data = await GovernmentSolarService.getSolarDataForDate(launchDate);
        
        // Convert to our interface format
        const formattedData: SolarData = {
          sunrise: data.sunrise,
          sunset: data.sunset,
          civilTwilightBegin: data.civil_twilight_begin,
          civilTwilightEnd: data.civil_twilight_end,
          nauticalTwilightBegin: data.nautical_twilight_begin,
          nauticalTwilightEnd: data.nautical_twilight_end,
          astronomicalTwilightBegin: data.astronomical_twilight_begin,
          astronomicalTwilightEnd: data.astronomical_twilight_end,
          solarNoon: data.solar_noon
        };

        setSolarData(formattedData);
        
        const analysis = analyzeLighting(launchDate, formattedData);
        setLightingAnalysis(analysis);
        
      } catch (err) {
        setError('Failed to load solar data');
        console.error('[LightingConditions] Solar data error:', err);
      } finally {
        setLoading(false);
      }
    };

    loadSolarData();
  }, [launch.net, analyzeLighting]);

  if (loading) {
    return (
      <div className="space-y-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
          Lighting Conditions
        </h3>
        <div className="animate-pulse space-y-4">
          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded"></div>
          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4"></div>
          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/2"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
          Lighting Conditions
        </h3>
        <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-4">
          <p className="text-red-700 dark:text-red-300">⚠️ {error}</p>
        </div>
      </div>
    );
  }

  if (!solarData || !lightingAnalysis) return null;

  const launchTime = new Date(launch.net);
  const formatTime = (timeStr: string) => {
    return new Date(`${launchTime.toDateString()} ${timeStr}`).toLocaleTimeString([], { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  const getQualityColor = (quality: string) => {
    switch (quality) {
      case 'excellent': return 'text-green-600 dark:text-green-400';
      case 'good': return 'text-blue-600 dark:text-blue-400';
      case 'fair': return 'text-yellow-600 dark:text-yellow-400';
      case 'poor': return 'text-red-600 dark:text-red-400';
      default: return 'text-gray-600 dark:text-gray-400';
    }
  };

  const getTimeOfDayIcon = (timeOfDay: string) => {
    switch (timeOfDay) {
      case 'night': return '🌙';
      case 'astronomical': return '⭐';
      case 'nautical': return '🌌';
      case 'civil': return '🌅';
      case 'golden': return '🌄';
      case 'day': return '☀️';
      case 'blue-hour': return '🌆';
      default: return '🌍';
    }
  };

  return (
    <div className="space-y-6">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
        Lighting Conditions Analysis
      </h3>

      {/* Primary Analysis */}
      <div className="bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 rounded-lg p-4 border-l-4 border-blue-500">
        <div className="flex items-center space-x-3 mb-3">
          <span className="text-3xl">{getTimeOfDayIcon(lightingAnalysis.timeOfDay)}</span>
          <div>
            <h4 className="font-semibold text-gray-900 dark:text-white capitalize">
              {lightingAnalysis.timeOfDay.replace('-', ' ')} Conditions
            </h4>
            <p className={`text-sm font-medium ${getQualityColor(lightingAnalysis.quality)}`}>
              Photography Quality: {lightingAnalysis.quality.toUpperCase()}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
          <div>
            <span className="font-medium text-gray-700 dark:text-gray-300">Launch Time:</span>
            <div className="text-gray-900 dark:text-white">{formatTime(launchTime.toTimeString().slice(0, 8))}</div>
          </div>
          <div>
            <span className="font-medium text-gray-700 dark:text-gray-300">Sun Angle:</span>
            <div className="text-gray-900 dark:text-white">
              {lightingAnalysis.sunAngle > 0 ? `${lightingAnalysis.sunAngle}° above horizon` : 'Below horizon'}
            </div>
          </div>
          <div>
            <span className="font-medium text-gray-700 dark:text-gray-300">Moon Phase:</span>
            <div className="text-gray-900 dark:text-white">{Math.round(lightingAnalysis.moonPhase * 100)}% illuminated</div>
          </div>
        </div>
      </div>

      {/* Solar Times Schedule */}
      <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border">
        <h4 className="font-medium text-gray-900 dark:text-white mb-3">📅 Solar Schedule</h4>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div>
            <div className="font-medium text-gray-700 dark:text-gray-300">Sunrise</div>
            <div className="text-orange-600 dark:text-orange-400">{formatTime(solarData.sunrise)}</div>
          </div>
          <div>
            <div className="font-medium text-gray-700 dark:text-gray-300">Solar Noon</div>
            <div className="text-yellow-600 dark:text-yellow-400">{formatTime(solarData.solarNoon)}</div>
          </div>
          <div>
            <div className="font-medium text-gray-700 dark:text-gray-300">Sunset</div>
            <div className="text-orange-600 dark:text-orange-400">{formatTime(solarData.sunset)}</div>
          </div>
          <div>
            <div className="font-medium text-gray-700 dark:text-gray-300">Civil Twilight</div>
            <div className="text-blue-600 dark:text-blue-400">
              {formatTime(solarData.civilTwilightBegin)} - {formatTime(solarData.civilTwilightEnd)}
            </div>
          </div>
        </div>
      </div>

      {/* Optimal Camera Settings */}
      <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-4">
        <h4 className="font-medium text-green-800 dark:text-green-200 mb-3">
          📸 Recommended Camera Settings
        </h4>
        <div className="grid grid-cols-3 gap-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-green-700 dark:text-green-300">
              ISO {lightingAnalysis.optimalSettings.iso}
            </div>
            <div className="text-xs text-green-600 dark:text-green-400">Sensitivity</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-green-700 dark:text-green-300">
              f/{lightingAnalysis.optimalSettings.aperture}
            </div>
            <div className="text-xs text-green-600 dark:text-green-400">Aperture</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-green-700 dark:text-green-300">
              {lightingAnalysis.optimalSettings.shutterSpeed}
            </div>
            <div className="text-xs text-green-600 dark:text-green-400">Shutter Speed</div>
          </div>
        </div>
      </div>

      {/* Recommendations */}
      <div className="bg-yellow-50 dark:bg-yellow-900/20 rounded-lg p-4">
        <h4 className="font-medium text-yellow-800 dark:text-yellow-200 mb-3">
          💡 Photography Recommendations
        </h4>
        <ul className="space-y-2 text-sm text-yellow-700 dark:text-yellow-300">
          {lightingAnalysis.recommendations.map((rec, index) => (
            <li key={index} className="flex items-start space-x-2">
              <span className="text-yellow-600 dark:text-yellow-400 mt-0.5">•</span>
              <span>{rec}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* Additional Tips */}
      <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
        <h4 className="font-medium text-gray-900 dark:text-white mb-3">
          🎯 Additional Lighting Tips
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-gray-700 dark:text-gray-300">
          <div>
            <h5 className="font-medium mb-2">For This Launch:</h5>
            <ul className="space-y-1">
              <li>• Exhaust plume will be most visible during {lightingAnalysis.timeOfDay} conditions</li>
              <li>• {lightingAnalysis.sunAngle > 0 ? 'Backlight from sun may affect exposure' : 'No sun interference - ideal for long exposures'}</li>
              <li>• Moon illumination: {lightingAnalysis.moonPhase > 0.5 ? 'bright moon will provide natural fill light' : 'dark moon conditions - rely on rocket light'}</li>
            </ul>
          </div>
          <div>
            <h5 className="font-medium mb-2">General Tips:</h5>
            <ul className="space-y-1">
              <li>• Bracket exposures for HDR processing options</li>
              <li>• Use manual focus set to infinity</li>
              <li>• Enable electronic first curtain shutter</li>
              <li>• Consider graduated neutral density filters</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LightingConditionsPanel;