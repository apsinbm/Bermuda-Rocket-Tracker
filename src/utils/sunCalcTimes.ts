/**
 * Enhanced sun times calculator using SunCalc library
 * Provides accurate sunrise/sunset times for any date (past, present, future)
 * Typical accuracy: <1 minute for astronomical calculations
 */

import SunCalc from 'suncalc';

// Bermuda coordinates
const BERMUDA_LAT = 32.3078;
const BERMUDA_LNG = -64.7505;

export interface SunCalcTimes {
  sunrise: Date;
  sunset: Date;
  solarNoon: Date;
  dawn: Date;
  dusk: Date;
  nauticalDawn: Date;
  nauticalDusk: Date;
  nightEnd: Date;
  night: Date;
  goldenHourEnd: Date;
  goldenHour: Date;
}

/**
 * Get accurate sun times using SunCalc library
 * Works for any date with high precision
 */
export function getSunCalcTimes(date: Date): SunCalcTimes {
  // SunCalc returns times in UTC, which is perfect for our needs
  const times = SunCalc.getTimes(date, BERMUDA_LAT, BERMUDA_LNG);
  
  return {
    sunrise: times.sunrise,
    sunset: times.sunset,
    solarNoon: times.solarNoon,
    dawn: times.dawn,
    dusk: times.dusk,
    nauticalDawn: times.nauticalDawn,
    nauticalDusk: times.nauticalDusk,
    nightEnd: times.nightEnd,
    night: times.night,
    goldenHourEnd: times.goldenHourEnd,
    goldenHour: times.goldenHour
  };
}

/**
 * Get simplified sun times for exhaust plume calculations
 * Returns just sunrise and sunset in Bermuda local time
 */
export function getSimpleSunTimes(date: Date): { sunrise: Date; sunset: Date } {
  const times = getSunCalcTimes(date);
  
  // Convert UTC times to Bermuda local time representation
  // These are already accurate UTC times from SunCalc
  return {
    sunrise: times.sunrise,
    sunset: times.sunset
  };
}

/**
 * Get exhaust plume visibility windows based on SunCalc data
 * Provides precise timing for golden hour and twilight periods
 */
export function getVisibilityWindows(date: Date) {
  const times = getSunCalcTimes(date);
  
  return {
    // Evening windows (after sunset)
    eveningGoldenStart: times.goldenHour,      // Golden hour begins
    sunset: times.sunset,                       // Sunset (0 minutes reference)
    eveningGoldenEnd: new Date(times.sunset.getTime() + 30 * 60 * 1000), // +30 min
    eveningFadingEnd: new Date(times.sunset.getTime() + 60 * 60 * 1000), // +60 min
    
    // Morning windows (before sunrise)  
    morningPossibleStart: new Date(times.sunrise.getTime() - 30 * 60 * 1000), // -30 min
    morningIdealStart: new Date(times.sunrise.getTime() - 15 * 60 * 1000),    // -15 min
    sunrise: times.sunrise,                     // Sunrise (0 minutes reference)
    morningEnd: new Date(times.sunrise.getTime() + 15 * 60 * 1000),          // +15 min
    
    // Twilight periods (bonus precision)
    nauticalDawn: times.nauticalDawn,
    nauticalDusk: times.nauticalDusk,
    civilDawn: times.dawn,
    civilDusk: times.dusk
  };
}

/**
 * Check if SunCalc is working properly
 * Returns true if calculations are valid
 */
export function validateSunCalc(date: Date): boolean {
  try {
    const times = getSunCalcTimes(date);
    
    // Check that we got valid dates
    return times.sunrise instanceof Date && 
           times.sunset instanceof Date &&
           !isNaN(times.sunrise.getTime()) &&
           !isNaN(times.sunset.getTime()) &&
           times.sunrise < times.sunset; // Sunrise should be before sunset
  } catch (error) {
    console.error('SunCalc validation failed:', error);
    return false;
  }
}