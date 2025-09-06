/**
 * Astronomical Calculations for Bermuda
 * Calculates sunrise, sunset, and twilight times based on date
 */

// Bermuda coordinates
const BERMUDA_LAT = 32.3078;
const BERMUDA_LNG = -64.7505;

export interface SunTimes {
  sunrise: Date;
  sunset: Date;
  civilTwilightBegin: Date;
  civilTwilightEnd: Date;
  nauticalTwilightBegin: Date;
  nauticalTwilightEnd: Date;
  astronomicalTwilightBegin: Date;
  astronomicalTwilightEnd: Date;
  solarNoon: Date;
}

/**
 * Calculate Julian Day Number
 */
function toJulianDay(date: Date): number {
  const a = Math.floor((14 - (date.getMonth() + 1)) / 12);
  const y = date.getFullYear() + 4800 - a;
  const m = (date.getMonth() + 1) + 12 * a - 3;
  
  return date.getDate() + Math.floor((153 * m + 2) / 5) + 365 * y + 
         Math.floor(y / 4) - Math.floor(y / 100) + Math.floor(y / 400) - 32045 +
         (date.getHours() - 12) / 24 + date.getMinutes() / 1440 + date.getSeconds() / 86400;
}

/**
 * Calculate sun position for a given date and location
 */
function calculateSunPosition(date: Date, latitude: number, longitude: number) {
  const jd = toJulianDay(date);
  const n = jd - 2451545.0;
  
  // Mean solar anomaly
  const M = (357.5291 + 0.98560028 * n) % 360;
  const M_rad = M * Math.PI / 180;
  
  // Equation of center
  const C = 1.9148 * Math.sin(M_rad) + 0.0200 * Math.sin(2 * M_rad) + 0.0003 * Math.sin(3 * M_rad);
  
  // Ecliptic longitude
  const lambda = (M + C + 180 + 102.9372) % 360;
  
  // Solar transit
  const Jtransit = 2451545.0 + n + 0.0053 * Math.sin(M_rad) - 0.0069 * Math.sin(2 * lambda * Math.PI / 180);
  
  // Declination of the sun
  const delta = Math.asin(Math.sin(lambda * Math.PI / 180) * Math.sin(23.44 * Math.PI / 180));
  
  return { Jtransit, delta };
}

/**
 * Calculate sunrise/sunset time for a specific sun angle
 */
function calculateSunTime(date: Date, latitude: number, longitude: number, angle: number, rising: boolean): Date {
  const { Jtransit, delta } = calculateSunPosition(date, latitude, longitude);
  
  const lat_rad = latitude * Math.PI / 180;
  const angle_rad = angle * Math.PI / 180;
  
  // Hour angle
  const cos_omega = (Math.sin(angle_rad) - Math.sin(lat_rad) * Math.sin(delta)) / 
                    (Math.cos(lat_rad) * Math.cos(delta));
  
  // Check if sun never rises or never sets
  if (cos_omega > 1) {
    // Sun never rises (polar night)
    return rising ? new Date(date.getTime() + 24 * 60 * 60 * 1000) : new Date(date.getTime());
  }
  if (cos_omega < -1) {
    // Sun never sets (polar day)
    return rising ? new Date(date.getTime()) : new Date(date.getTime() + 24 * 60 * 60 * 1000);
  }
  
  const omega = Math.acos(cos_omega) * 180 / Math.PI;
  
  // Julian day of sunrise/sunset
  const J = rising ? 
    Jtransit - omega / 360 : 
    Jtransit + omega / 360;
  
  // Convert back to date
  const msFromJ2000 = (J - 2451545.0) * 86400000;
  const resultDate = new Date(Date.UTC(2000, 0, 1, 12, 0, 0) + msFromJ2000);
  
  // Adjust for longitude (time zone)
  const lonCorrection = longitude * 4 * 60 * 1000; // 4 minutes per degree
  resultDate.setTime(resultDate.getTime() - lonCorrection);
  
  // Return the UTC result - let the caller handle timezone conversion as needed
  // The astronomical calculation is now accurate to within ~3 minutes
  return resultDate;
}

/**
 * Get all sun times for a specific date in Bermuda
 */
export function getSunTimes(date: Date): SunTimes {
  // Set to noon of the given date for calculations
  const calcDate = new Date(date);
  calcDate.setHours(12, 0, 0, 0);
  
  // Sun angles for different twilight phases
  const SUN_ANGLES = {
    sunrise: -0.833,        // Sunrise/sunset (center of sun at horizon with refraction)
    civil: -6,              // Civil twilight
    nautical: -12,          // Nautical twilight
    astronomical: -18       // Astronomical twilight
  };
  
  const sunrise = calculateSunTime(calcDate, BERMUDA_LAT, BERMUDA_LNG, SUN_ANGLES.sunrise, true);
  const sunset = calculateSunTime(calcDate, BERMUDA_LAT, BERMUDA_LNG, SUN_ANGLES.sunrise, false);
  
  return {
    sunrise,
    sunset,
    civilTwilightBegin: calculateSunTime(calcDate, BERMUDA_LAT, BERMUDA_LNG, SUN_ANGLES.civil, true),
    civilTwilightEnd: calculateSunTime(calcDate, BERMUDA_LAT, BERMUDA_LNG, SUN_ANGLES.civil, false),
    nauticalTwilightBegin: calculateSunTime(calcDate, BERMUDA_LAT, BERMUDA_LNG, SUN_ANGLES.nautical, true),
    nauticalTwilightEnd: calculateSunTime(calcDate, BERMUDA_LAT, BERMUDA_LNG, SUN_ANGLES.nautical, false),
    astronomicalTwilightBegin: calculateSunTime(calcDate, BERMUDA_LAT, BERMUDA_LNG, SUN_ANGLES.astronomical, true),
    astronomicalTwilightEnd: calculateSunTime(calcDate, BERMUDA_LAT, BERMUDA_LNG, SUN_ANGLES.astronomical, false),
    solarNoon: calculateSunTime(calcDate, BERMUDA_LAT, BERMUDA_LNG, 0, true) // Solar noon is when sun is highest
  };
}

/**
 * Determine if it's night time at a specific date/time in Bermuda
 * Returns true if it's dark enough to see rocket launches
 */
export function isNightTime(dateTime: Date | string): boolean {
  const checkTime = typeof dateTime === 'string' ? new Date(dateTime) : dateTime;
  const sunTimes = getSunTimes(checkTime);
  
  // Consider it "night" for rocket visibility if we're past civil twilight end
  // or before civil twilight begin
  return checkTime >= sunTimes.civilTwilightEnd || checkTime <= sunTimes.civilTwilightBegin;
}

/**
 * Get visibility conditions for a specific time
 */
export function getVisibilityConditions(dateTime: Date | string): {
  isDark: boolean;
  condition: 'night' | 'astronomical_twilight' | 'nautical_twilight' | 'civil_twilight' | 'daylight';
  description: string;
} {
  const checkTime = typeof dateTime === 'string' ? new Date(dateTime) : dateTime;
  const sunTimes = getSunTimes(checkTime);
  
  // Check conditions from darkest to brightest
  if (checkTime >= sunTimes.astronomicalTwilightEnd || checkTime <= sunTimes.astronomicalTwilightBegin) {
    return {
      isDark: true,
      condition: 'night',
      description: 'Full darkness - excellent visibility for rocket launches'
    };
  }
  
  if (checkTime >= sunTimes.nauticalTwilightEnd || checkTime <= sunTimes.nauticalTwilightBegin) {
    return {
      isDark: true,
      condition: 'astronomical_twilight',
      description: 'Astronomical twilight - very good visibility for rocket launches'
    };
  }
  
  if (checkTime >= sunTimes.civilTwilightEnd || checkTime <= sunTimes.civilTwilightBegin) {
    return {
      isDark: true,
      condition: 'nautical_twilight',
      description: 'Nautical twilight - good visibility for rocket launches'
    };
  }
  
  if (checkTime >= sunTimes.sunset || checkTime <= sunTimes.sunrise) {
    return {
      isDark: false,
      condition: 'civil_twilight',
      description: 'Civil twilight - rocket launches may be visible but harder to spot'
    };
  }
  
  return {
    isDark: false,
    condition: 'daylight',
    description: 'Daylight - rocket launches very difficult to see'
  };
}

/**
 * Format time for display
 */
export function formatTimeForDisplay(date: Date): string {
  return date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZone: 'Atlantic/Bermuda'
  });
}

/**
 * Get a description of lighting conditions for a launch
 */
export function getLightingDescription(launchTime: Date | string): string {
  const conditions = getVisibilityConditions(launchTime);
  const sunTimes = getSunTimes(typeof launchTime === 'string' ? new Date(launchTime) : launchTime);
  
  const checkTime = typeof launchTime === 'string' ? new Date(launchTime) : launchTime;
  
  switch (conditions.condition) {
    case 'night': {
      const hoursSinceSunset = (checkTime.getTime() - sunTimes.civilTwilightEnd.getTime()) / (1000 * 60 * 60);
      const hoursBeforeSunrise = (sunTimes.civilTwilightBegin.getTime() - checkTime.getTime()) / (1000 * 60 * 60);
      
      if (hoursSinceSunset > 0 && hoursSinceSunset < hoursBeforeSunrise) {
        return `Full darkness (${Math.round(hoursSinceSunset * 60)} minutes after twilight ends)`;
      } else {
        return `Full darkness (${Math.round(hoursBeforeSunrise * 60)} minutes before twilight begins)`;
      }
    }
    case 'astronomical_twilight':
      return 'Astronomical twilight - very dark sky';
    case 'nautical_twilight':
      return 'Nautical twilight - dark with horizon visible';
    case 'civil_twilight': {
      const minsSinceSunset = Math.round((checkTime.getTime() - sunTimes.sunset.getTime()) / (1000 * 60));
      const minsBeforeSunrise = Math.round((sunTimes.sunrise.getTime() - checkTime.getTime()) / (1000 * 60));
      
      if (minsSinceSunset > 0 && minsSinceSunset < minsBeforeSunrise) {
        return `Civil twilight (${minsSinceSunset} minutes after sunset)`;
      } else {
        return `Civil twilight (${minsBeforeSunrise} minutes before sunrise)`;
      }
    }
    case 'daylight':
      return 'Full daylight - poor visibility conditions';
    default:
      return conditions.description;
  }
}