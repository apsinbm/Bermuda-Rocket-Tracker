/**
 * Bermuda Time Service
 * 
 * Centralizes all time zone handling for Bermuda (Atlantic/Bermuda).
 * Provides consistent time zone calculations with proper DST handling.
 * Replaces manual UTC offset calculations throughout the app.
 */

// Bermuda timezone constant
const BERMUDA_TIMEZONE = 'Atlantic/Bermuda';

// Bermuda coordinates
export const BERMUDA_COORDINATES = {
  latitude: 32.2949,
  longitude: -64.7823
};

export interface BermudaTimeInfo {
  utcTime: Date;
  bermudaTime: Date;
  bermudaTimeString: string;
  utcOffset: number;
  isDST: boolean;
  timeZoneName: string;
}

export class BermudaTimeService {
  
  /**
   * Convert UTC time to Bermuda local time
   */
  static toBermudaTime(utcDate: Date | string): BermudaTimeInfo {
    const utcTime = typeof utcDate === 'string' ? new Date(utcDate) : utcDate;
    
    // Use Intl.DateTimeFormat for proper timezone conversion
    const bermudaFormatter = new Intl.DateTimeFormat('en-US', {
      timeZone: BERMUDA_TIMEZONE,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    });
    
    const bermudaTimeString = bermudaFormatter.format(utcTime);
    
    // Create Bermuda Date object
    const [datePart, timePart] = bermudaTimeString.split(', ');
    const [month, day, year] = datePart.split('/');
    const [hour, minute, second] = timePart.split(':');
    
    const bermudaTime = new Date(
      parseInt(year),
      parseInt(month) - 1, // Month is 0-indexed
      parseInt(day),
      parseInt(hour),
      parseInt(minute),
      parseInt(second)
    );
    
    // Calculate UTC offset
    const utcOffset = this.getUTCOffset(utcTime);
    
    // Determine if DST is active
    const isDST = this.isDaylightSavingTime(utcTime);
    
    return {
      utcTime,
      bermudaTime,
      bermudaTimeString,
      utcOffset,
      isDST,
      timeZoneName: isDST ? 'ADT' : 'AST'
    };
  }
  
  /**
   * Get current Bermuda time
   */
  static getCurrentBermudaTime(): BermudaTimeInfo {
    return this.toBermudaTime(new Date());
  }
  
  /**
   * Format time in Bermuda timezone
   */
  static formatBermudaTime(utcDate: Date | string, format: 'full' | 'date' | 'time' | 'datetime' = 'datetime'): string {
    const utcTime = typeof utcDate === 'string' ? new Date(utcDate) : utcDate;
    
    const options: Intl.DateTimeFormatOptions = {
      timeZone: BERMUDA_TIMEZONE
    };
    
    switch (format) {
      case 'full':
        options.weekday = 'long';
        options.year = 'numeric';
        options.month = 'long';
        options.day = 'numeric';
        options.hour = '2-digit';
        options.minute = '2-digit';
        options.timeZoneName = 'short';
        break;
      case 'date':
        options.year = 'numeric';
        options.month = 'short';
        options.day = 'numeric';
        break;
      case 'time':
        options.hour = '2-digit';
        options.minute = '2-digit';
        options.timeZoneName = 'short';
        break;
      case 'datetime':
      default:
        options.year = 'numeric';
        options.month = 'short';
        options.day = 'numeric';
        options.hour = '2-digit';
        options.minute = '2-digit';
        options.timeZoneName = 'short';
        break;
    }
    
    return new Intl.DateTimeFormat('en-US', options).format(utcTime);
  }
  
  /**
   * Check if it's currently night time in Bermuda
   */
  static isNightTime(utcDate?: Date | string): boolean {
    const time = utcDate ? (typeof utcDate === 'string' ? new Date(utcDate) : utcDate) : new Date();
    const bermudaInfo = this.toBermudaTime(time);
    const hour = bermudaInfo.bermudaTime.getHours();
    
    // Night time is from 6 PM (18:00) to 6 AM (06:00) in Bermuda local time
    return hour >= 18 || hour < 6;
  }
  
  /**
   * Get UTC offset for Bermuda at a given time (accounting for DST)
   */
  static getUTCOffset(utcDate: Date): number {
    // Use a temporary date to determine the offset
    const tempFormatter = new Intl.DateTimeFormat('en', {
      timeZone: BERMUDA_TIMEZONE,
      timeZoneName: 'longOffset'
    });
    
    const formatted = tempFormatter.format(utcDate);
    const offsetMatch = formatted.match(/GMT([+-]\d{1,2})/);
    
    if (offsetMatch) {
      return parseInt(offsetMatch[1]);
    }
    
    // Fallback: Bermuda is UTC-4 in DST (March-November), UTC-4 standard
    // Note: Bermuda does not observe DST as of 2024, so it's always UTC-4
    return -4;
  }
  
  /**
   * Check if Daylight Saving Time is active for Bermuda
   */
  static isDaylightSavingTime(utcDate: Date): boolean {
    // As of 2024, Bermuda no longer observes DST
    // They stay on Atlantic Daylight Time (UTC-3) year-round
    // However, this may change, so we use proper detection
    
    const january = new Date(utcDate.getFullYear(), 0, 1);
    const july = new Date(utcDate.getFullYear(), 6, 1);
    
    const janOffset = this.getTimezoneOffset(january);
    const julyOffset = this.getTimezoneOffset(july);
    
    const currentOffset = this.getTimezoneOffset(utcDate);
    
    // If current offset differs from January, DST is likely active
    return currentOffset !== janOffset;
  }
  
  /**
   * Get timezone offset in minutes for Bermuda
   */
  private static getTimezoneOffset(date: Date): number {
    // Create a date in Bermuda timezone
    const utcDate = new Date(date.toLocaleString("en-US", { timeZone: "UTC" }));
    const bermudaDate = new Date(date.toLocaleString("en-US", { timeZone: BERMUDA_TIMEZONE }));
    
    return (utcDate.getTime() - bermudaDate.getTime()) / (1000 * 60);
  }
  
  /**
   * Calculate time difference from now to a future date in Bermuda time
   */
  static getTimeUntil(futureDate: Date | string): {
    totalMinutes: number;
    hours: number;
    minutes: number;
    days: number;
    timeString: string;
  } {
    const now = new Date();
    const target = typeof futureDate === 'string' ? new Date(futureDate) : futureDate;
    
    const diffMs = target.getTime() - now.getTime();
    const totalMinutes = Math.floor(diffMs / (1000 * 60));
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    const days = Math.floor(hours / 24);
    const remainingHours = hours % 24;
    
    let timeString = '';
    if (days > 0) {
      timeString = `${days}d ${remainingHours}h ${minutes}m`;
    } else if (hours > 0) {
      timeString = `${hours}h ${minutes}m`;
    } else if (minutes > 0) {
      timeString = `${minutes}m`;
    } else if (totalMinutes <= 0) {
      timeString = 'Now';
    } else {
      timeString = '< 1m';
    }
    
    return {
      totalMinutes,
      hours,
      minutes,
      days,
      timeString
    };
  }
  
  /**
   * Get sunrise and sunset times for Bermuda
   * Uses proper timezone handling
   */
  static async getSunTimes(date?: Date): Promise<{
    sunrise: Date;
    sunset: Date;
    civilTwilightBegin: Date;
    civilTwilightEnd: Date;
    nauticalTwilightBegin: Date;
    nauticalTwilightEnd: Date;
    astronomicalTwilightBegin: Date;
    astronomicalTwilightEnd: Date;
  }> {
    const targetDate = date || new Date();
    const dateStr = targetDate.toISOString().split('T')[0];
    
    try {
      // Use sunrise-sunset.org API with Bermuda coordinates
      const response = await fetch(
        `https://api.sunrise-sunset.org/json?lat=${BERMUDA_COORDINATES.latitude}&lng=${BERMUDA_COORDINATES.longitude}&date=${dateStr}&formatted=0`
      );
      
      if (!response.ok) {
        throw new Error('Failed to fetch sun times');
      }
      
      const data = await response.json();
      
      if (data.status !== 'OK') {
        throw new Error('Sun times API returned error');
      }
      
      return {
        sunrise: new Date(data.results.sunrise),
        sunset: new Date(data.results.sunset),
        civilTwilightBegin: new Date(data.results.civil_twilight_begin),
        civilTwilightEnd: new Date(data.results.civil_twilight_end),
        nauticalTwilightBegin: new Date(data.results.nautical_twilight_begin),
        nauticalTwilightEnd: new Date(data.results.nautical_twilight_end),
        astronomicalTwilightBegin: new Date(data.results.astronomical_twilight_begin),
        astronomicalTwilightEnd: new Date(data.results.astronomical_twilight_end)
      };
    } catch (error) {
      console.warn('Failed to fetch sun times from API, using fallback calculation');
      
      // Fallback using rough calculations
      // This is approximate for Bermuda's latitude
      const day = targetDate.getDate();
      const month = targetDate.getMonth() + 1;
      const year = targetDate.getFullYear();
      
      // Rough sunrise/sunset times for Bermuda (32.3°N)
      const sunriseHour = 6 + Math.sin((month - 3) * Math.PI / 6) * 1.5;
      const sunsetHour = 18 - Math.sin((month - 3) * Math.PI / 6) * 1.5;
      
      const sunrise = new Date(year, month - 1, day, Math.floor(sunriseHour), (sunriseHour % 1) * 60);
      const sunset = new Date(year, month - 1, day, Math.floor(sunsetHour), (sunsetHour % 1) * 60);
      
      // Rough twilight calculations (30-90 minutes before/after)
      const civilTwilightBegin = new Date(sunrise.getTime() - 30 * 60 * 1000);
      const civilTwilightEnd = new Date(sunset.getTime() + 30 * 60 * 1000);
      const nauticalTwilightBegin = new Date(sunrise.getTime() - 60 * 60 * 1000);
      const nauticalTwilightEnd = new Date(sunset.getTime() + 60 * 60 * 1000);
      const astronomicalTwilightBegin = new Date(sunrise.getTime() - 90 * 60 * 1000);
      const astronomicalTwilightEnd = new Date(sunset.getTime() + 90 * 60 * 1000);
      
      return {
        sunrise,
        sunset,
        civilTwilightBegin,
        civilTwilightEnd,
        nauticalTwilightBegin,
        nauticalTwilightEnd,
        astronomicalTwilightBegin,
        astronomicalTwilightEnd
      };
    }
  }
}