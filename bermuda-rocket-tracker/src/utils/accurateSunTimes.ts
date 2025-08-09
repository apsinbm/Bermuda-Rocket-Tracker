/**
 * Accurate sun times for Bermuda
 * Using SunCalc library for precise calculations with lookup table override for known dates
 * This provides accurate sunset/sunrise times for any date (past, present, future)
 */

import { getSunTimes } from './astronomicalCalculations';
import { getSimpleSunTimes, validateSunCalc } from './sunCalcTimes';

export interface AccurateSunTimes {
  sunrise: Date;
  sunset: Date;
  date: string;
}

// Accurate sunset times for Bermuda (Hamilton) in August 2025
// Source: https://www.timeanddate.com/sun/bermuda/hamilton?month=8
const AUGUST_2025_SUN_TIMES: { [key: string]: { sunrise: string; sunset: string } } = {
  '2025-08-01': { sunrise: '06:27', sunset: '20:13' },
  '2025-08-02': { sunrise: '06:28', sunset: '20:12' },
  '2025-08-03': { sunrise: '06:28', sunset: '20:12' },
  '2025-08-04': { sunrise: '06:29', sunset: '20:11' },
  '2025-08-05': { sunrise: '06:30', sunset: '20:10' },
  '2025-08-06': { sunrise: '06:31', sunset: '20:09' },
  '2025-08-07': { sunrise: '06:31', sunset: '20:08' },
  '2025-08-08': { sunrise: '06:32', sunset: '20:07' },
  '2025-08-09': { sunrise: '06:33', sunset: '20:07' },
  '2025-08-10': { sunrise: '06:34', sunset: '20:06' },
  '2025-08-11': { sunrise: '06:34', sunset: '20:05' },
  '2025-08-12': { sunrise: '06:35', sunset: '20:04' }, // USSF-106 date - sunset at 8:04 PM
  '2025-08-13': { sunrise: '06:36', sunset: '20:03' },
  '2025-08-14': { sunrise: '06:37', sunset: '20:02' },
  '2025-08-15': { sunrise: '06:37', sunset: '20:01' },
  // Add more dates as needed
};

/**
 * Get accurate sun times for a specific date in Bermuda
 * Falls back to the existing astronomical calculation if not in lookup table
 */
export function getAccurateSunTimes(date: Date): AccurateSunTimes {
  const dateKey = date.getFullYear() + '-' + 
                  String(date.getMonth() + 1).padStart(2, '0') + '-' + 
                  String(date.getDate()).padStart(2, '0');
  
  const sunData = AUGUST_2025_SUN_TIMES[dateKey];
  
  if (sunData) {
    // Use accurate lookup data
    const [sunriseHour, sunriseMinute] = sunData.sunrise.split(':').map(Number);
    const [sunsetHour, sunsetMinute] = sunData.sunset.split(':').map(Number);
    
    // Create dates in Bermuda timezone - the lookup data is already in ADT/AST
    // We need to create these as if they were in the local system time zone
    const sunrise = new Date(date.getFullYear(), date.getMonth(), date.getDate(), sunriseHour, sunriseMinute);
    const sunset = new Date(date.getFullYear(), date.getMonth(), date.getDate(), sunsetHour, sunsetMinute);
    
    return {
      sunrise,
      sunset,
      date: dateKey
    };
  }
  
  // Primary fallback: Use SunCalc for high-precision calculations
  if (validateSunCalc(date)) {
    try {
      const sunCalcTimes = getSimpleSunTimes(date);
      
      // SunCalc returns UTC times, convert to local representation
      const sunriseLocal = new Date(sunCalcTimes.sunrise.toLocaleString('en-US', { timeZone: 'Atlantic/Bermuda' }));
      const sunsetLocal = new Date(sunCalcTimes.sunset.toLocaleString('en-US', { timeZone: 'Atlantic/Bermuda' }));
      
      return {
        sunrise: sunriseLocal,
        sunset: sunsetLocal,
        date: dateKey
      };
    } catch (error) {
      console.warn('SunCalc calculation failed for', dateKey, ', trying custom calculation');
    }
  }
  
  // Secondary fallback: Use custom astronomical calculation
  try {
    const calculatedTimes = getSunTimes(date);
    
    // Convert UTC results to local Bermuda time
    const sunriseLocal = new Date(calculatedTimes.sunrise.toLocaleString('en-US', { timeZone: 'Atlantic/Bermuda' }));
    const sunsetLocal = new Date(calculatedTimes.sunset.toLocaleString('en-US', { timeZone: 'Atlantic/Bermuda' }));
    
    return {
      sunrise: sunriseLocal,
      sunset: sunsetLocal,
      date: dateKey
    };
  } catch (error) {
    console.warn('All calculations failed for', dateKey, ', using rough approximation');
    
    // Final fallback - rough approximations
    const year = date.getFullYear();
    const month = date.getMonth(); 
    const day = date.getDate();
    const sunrise = new Date(year, month, day, 6, 30);
    const sunset = new Date(year, month, day, 20, 0);
  
    return {
      sunrise,
      sunset,
      date: dateKey
    };
  }
}

/**
 * Check if we have accurate data for a specific date
 */
export function hasAccurateData(date: Date): boolean {
  const dateKey = date.getFullYear() + '-' + 
                  String(date.getMonth() + 1).padStart(2, '0') + '-' + 
                  String(date.getDate()).padStart(2, '0');
  
  return dateKey in AUGUST_2025_SUN_TIMES;
}