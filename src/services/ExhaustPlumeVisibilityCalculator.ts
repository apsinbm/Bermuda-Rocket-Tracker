/**
 * Exhaust Plume Visibility Calculator
 * 
 * Implements rocket visibility based on exhaust plume illumination physics:
 * - Visibility depends on sunlight reaching the rocket's exhaust plume
 * - Ground must be in shadow while rocket is still in sunlight at high altitude
 * - Specific time windows around sunrise and sunset provide optimal viewing
 */

import { Launch, VisibilityData, USNOSolarData } from '../types';
import { getAccurateSunTimes } from '../utils/accurateSunTimes';
import { getBermudaTimeZone } from '../utils/bermudaTimeZone';
import { getLaunchTimingInfo, LaunchTimingInfo } from '../utils/launchTimingUtils';
import { getTrajectoryMapping } from './trajectoryMappingService';

export interface PlumeVisibilityWindow {
  isVisible: boolean;
  quality: 'excellent' | 'good' | 'fair' | 'poor' | 'invisible';
  windowType: 'evening_golden' | 'evening_fading' | 'morning_ideal' | 'morning_possible' | 'daylight' | 'deep_night';
  explanation: string;
  startWatching?: string; // When to start watching (6-8 minutes after liftoff)
  peakVisibility?: string; // When rocket should be most visible
}

export class ExhaustPlumeVisibilityCalculator {
  private static readonly BERMUDA_LAT = 32.3078;
  private static readonly BERMUDA_LNG = -64.7505;

  /**
   * Calculate visibility using exhaust plume illumination physics
   * Now includes timing consistency validation
   */
  static async calculatePlumeVisibility(launch: Launch): Promise<VisibilityData & { plumeWindow: PlumeVisibilityWindow; timingInfo: LaunchTimingInfo }> {
    const launchTime = new Date(launch.net);
    const launchDate = new Date(launchTime.getFullYear(), launchTime.getMonth(), launchTime.getDate());

    // Use government solar service for accurate sun times with fallback and timeout
    let sunTimes;
    try {
      const { GovernmentSolarService } = await import('./governmentSolarService');

      // Add 5 second timeout to prevent hanging
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Solar data fetch timeout')), 5000)
      );

      sunTimes = await Promise.race([
        GovernmentSolarService.getSolarDataForDate(launchDate),
        timeoutPromise
      ]);
    } catch (error) {
      console.warn('[ExhaustPlume] Solar data fetch failed, using fallback:', error);
      // Fallback to simple calculated sun times for Bermuda
      const { getAccurateSunTimes } = await import('../utils/accurateSunTimes');
      const fallbackTimes = getAccurateSunTimes(launchDate);
      
      // Create USNOSolarData compatible object with estimated twilight times
      const sunriseTime = fallbackTimes.sunrise.toTimeString().split(' ')[0];
      const sunsetTime = fallbackTimes.sunset.toTimeString().split(' ')[0];
      
      sunTimes = {
        date: launchDate.toISOString().split('T')[0],
        sunrise: sunriseTime,
        sunset: sunsetTime,
        civil_twilight_begin: new Date(fallbackTimes.sunrise.getTime() - 30 * 60000).toTimeString().split(' ')[0],
        civil_twilight_end: new Date(fallbackTimes.sunset.getTime() + 30 * 60000).toTimeString().split(' ')[0],
        nautical_twilight_begin: new Date(fallbackTimes.sunrise.getTime() - 60 * 60000).toTimeString().split(' ')[0],
        nautical_twilight_end: new Date(fallbackTimes.sunset.getTime() + 60 * 60000).toTimeString().split(' ')[0],
        astronomical_twilight_begin: new Date(fallbackTimes.sunrise.getTime() - 90 * 60000).toTimeString().split(' ')[0],
        astronomical_twilight_end: new Date(fallbackTimes.sunset.getTime() + 90 * 60000).toTimeString().split(' ')[0],
        solar_noon: new Date((fallbackTimes.sunrise.getTime() + fallbackTimes.sunset.getTime()) / 2).toTimeString().split(' ')[0],
        source: 'calculated' as const
      };
    }
    
    const plumeWindow = this.determinePlumeWindow(launchTime, sunTimes);
    const trajectoryMapping = getTrajectoryMapping(launch);
    const trajectory = trajectoryMapping.direction;
    const distance = this.calculateDistance(launch);
    const bearing = this.calculateBearing(launch);
    
    // Get timing info for consistency validation
    const timingInfo = getLaunchTimingInfo(launch.net);

    // Convert plume visibility to standard visibility data
    const likelihood = this.plumeQualityToLikelihood(plumeWindow.quality, distance);
    const reason = this.createPlumeBasedReason(plumeWindow, trajectory, distance);
    const estimatedTimeVisible = this.getPlumeViewingTime(plumeWindow, trajectory);

    return {
      likelihood,
      reason,
      bearing,
      trajectoryDirection: trajectory,
      estimatedTimeVisible,
      plumeWindow,
      timingInfo
    };
  }

  /**
   * Determine visibility window based on exhaust plume illumination physics
   */
  private static determinePlumeWindow(launchTime: Date, sunTimes: USNOSolarData): PlumeVisibilityWindow {
    // Convert UTC launch time to Bermuda local time for comparison
    const bermudaLaunchTime = new Date(launchTime.toLocaleString('en-US', { timeZone: 'Atlantic/Bermuda' }));
    const launchMinutes = bermudaLaunchTime.getHours() * 60 + bermudaLaunchTime.getMinutes();
    
    // Ensure both launch time and sun times are compared in the same timezone context
    // Parse sun times from strings and convert to local time
    const sunsetTime = new Date(`${sunTimes.date} ${sunTimes.sunset}`);
    const sunriseTime = new Date(`${sunTimes.date} ${sunTimes.sunrise}`);
    const sunsetLocalTime = new Date(sunsetTime.toLocaleString('en-US', { timeZone: 'Atlantic/Bermuda' }));
    const sunriseLocalTime = new Date(sunriseTime.toLocaleString('en-US', { timeZone: 'Atlantic/Bermuda' }));
    
    const sunsetMinutes = sunsetLocalTime.getHours() * 60 + sunsetLocalTime.getMinutes();
    const sunriseMinutes = sunriseLocalTime.getHours() * 60 + sunriseLocalTime.getMinutes();
    
    const minutesSinceSunset = launchMinutes - sunsetMinutes;
    const minutesBeforeSunrise = sunriseMinutes - launchMinutes;
    
    // Handle day transition (launch after midnight)
    const adjustedMinutesBeforeSunrise = minutesBeforeSunrise < 0 ? 
      (24 * 60 + sunriseMinutes) - launchMinutes : minutesBeforeSunrise;

    // Sunset Visibility Windows (Evening Launches)
    if (minutesSinceSunset >= 0 && minutesSinceSunset <= 1440) { // Launch after sunset same day
      if (minutesSinceSunset <= 30) {
        // 0-30 minutes after sunset (Best)
        return {
          isVisible: true,
          quality: 'excellent',
          windowType: 'evening_golden',
          explanation: `🌅 Golden Hour Launch! Perfect conditions - ground is in shadow while rocket plume catches sunlight at high altitude. Expect dramatic "jellyfish effect" with bright, colorful exhaust trail.`,
          startWatching: this.addMinutes(launchTime, 6),
          peakVisibility: this.addMinutes(launchTime, 8)
        };
      } else if (minutesSinceSunset <= 60) {
        // 30-60 minutes after sunset (Fading)
        return {
          isVisible: true,
          quality: 'good',
          windowType: 'evening_fading',
          explanation: `🌆 Post-sunset window - upper atmosphere losing sunlight. Plume will be visible if rocket reaches high altitude quickly. Look for dimmer but still visible exhaust trail.`,
          startWatching: this.addMinutes(launchTime, 5),
          peakVisibility: this.addMinutes(launchTime, 7)
        };
      } else {
        // More than 1 hour after sunset (Invisible)
        return {
          isVisible: false,
          quality: 'invisible',
          windowType: 'deep_night',
          explanation: `🌙 Deep night launch - entire atmosphere is in Earth's shadow. Rocket exhaust plume will not be illuminated by sunlight and will be invisible from ground level.`
        };
      }
    }

    // Sunrise Visibility Windows (Morning Launches)  
    if (adjustedMinutesBeforeSunrise >= 0 && adjustedMinutesBeforeSunrise <= 1440) {
      if (adjustedMinutesBeforeSunrise >= 15 && adjustedMinutesBeforeSunrise <= 30) {
        // 30-15 minutes before sunrise (Possible)
        return {
          isVisible: true,
          quality: 'fair',
          windowType: 'morning_possible',
          explanation: `🌄 Pre-dawn window - rocket will climb into sunlight while ground remains dark. Plume becomes visible once rocket reaches illuminated upper atmosphere.`,
          startWatching: this.addMinutes(launchTime, 4),
          peakVisibility: this.addMinutes(launchTime, 6)
        };
      } else if (adjustedMinutesBeforeSunrise >= 0 && adjustedMinutesBeforeSunrise <= 15) {
        // 15-0 minutes before sunrise (Ideal)
        return {
          isVisible: true,
          quality: 'excellent',
          windowType: 'morning_ideal',
          explanation: `🌅 Pre-sunrise golden window! Rocket plume will light up against dark-to-blue background as more upper atmosphere enters sunlight. Excellent contrast conditions.`,
          startWatching: this.addMinutes(launchTime, 5),
          peakVisibility: this.addMinutes(launchTime, 7)
        };
      }
    }

    // Check if it's during daylight hours
    if (launchMinutes > sunriseMinutes + 15 && launchMinutes < sunsetMinutes - 15) {
      return {
        isVisible: false,
        quality: 'invisible',
        windowType: 'daylight',
        explanation: `☀️ Daylight launch - rocket exhaust plume blends into bright sky. Very difficult to see unless directly overhead and producing contrails.`
      };
    }

    // Default case - likely deep night or edge cases
    return {
      isVisible: false,
      quality: 'poor',
      windowType: 'deep_night',
      explanation: `🌙 Launch during deep night hours - rocket plume will not be illuminated by sunlight and will be difficult to see from ground level.`
    };
  }

  /**
   * Convert plume quality to standard visibility likelihood
   */
  private static plumeQualityToLikelihood(
    quality: PlumeVisibilityWindow['quality'], 
    distance: number
  ): 'high' | 'medium' | 'low' | 'none' {
    // Distance factor - beyond 2000km visibility drops significantly
    if (distance > 2000) return 'none';
    if (distance > 1500) {
      // Reduce quality by one level for very distant launches
      switch (quality) {
        case 'excellent': return 'high';
        case 'good': return 'medium';
        case 'fair': return 'low';
        default: return 'none';
      }
    }

    switch (quality) {
      case 'excellent': return 'high';
      case 'good': return 'medium';
      case 'fair': return 'low';
      case 'poor': return 'low';
      case 'invisible': return 'none';
    }
  }

  /**
   * Create human-readable reason based on plume physics
   */
  private static createPlumeBasedReason(
    plumeWindow: PlumeVisibilityWindow,
    trajectory: string,
    distance: number
  ): string {
    let distanceNote = '';
    if (distance > 1500) {
      distanceNote = ` Note: Launch is ${Math.round(distance)}km away - visibility may be reduced.`;
    } else if (distance < 500) {
      distanceNote = ` Great news: Launch is only ${Math.round(distance)}km away - should be very clear!`;
    }

    const directionHint = trajectory !== 'Unknown' ? 
      ` Look ${trajectory.toLowerCase()} from Florida.` : '';

    return plumeWindow.explanation + directionHint + distanceNote;
  }

  /**
   * Get estimated viewing time based on plume window
   */
  private static getPlumeViewingTime(
    plumeWindow: PlumeVisibilityWindow,
    trajectory: string
  ): string {
    if (!plumeWindow.isVisible) {
      return 'Not visible - no plume illumination expected';
    }

    const baseTime = trajectory === 'Southeast' ? 
      'Visible for 3-5 minutes' : 'Visible for 2-4 minutes';

    const startTime = plumeWindow.startWatching ? 
      ` starting ${this.formatTimeOnly(plumeWindow.startWatching)}` : 
      ' starting ~5-6 minutes after liftoff';

    switch (plumeWindow.quality) {
      case 'excellent':
        return `${baseTime}${startTime} - peak visibility expected!`;
      case 'good':
        return `${baseTime}${startTime} - good plume illumination expected`;
      case 'fair':
        return `Possibly visible for 1-2 minutes${startTime} if conditions are clear`;
      default:
        return baseTime + startTime;
    }
  }

  // Helper methods for distance and bearing calculations

  private static calculateDistance(launch: Launch): number {
    const padLat = parseFloat(launch.pad.latitude || launch.pad.location.latitude?.toString() || '28.5');
    const padLng = parseFloat(launch.pad.longitude || launch.pad.location.longitude?.toString() || '-80.5');
    
    const R = 6371; // Earth's radius in km
    const dLat = (this.BERMUDA_LAT - padLat) * Math.PI / 180;
    const dLng = (this.BERMUDA_LNG - padLng) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(padLat * Math.PI / 180) * Math.cos(this.BERMUDA_LAT * Math.PI / 180) *
      Math.sin(dLng / 2) * Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  private static calculateBearing(launch: Launch): number {
    const padLat = parseFloat(launch.pad.latitude || launch.pad.location.latitude?.toString() || '28.5');
    const padLng = parseFloat(launch.pad.longitude || launch.pad.location.longitude?.toString() || '-80.5');
    
    const dLng = (padLng - this.BERMUDA_LNG) * Math.PI / 180;
    const lat1 = this.BERMUDA_LAT * Math.PI / 180;
    const lat2 = padLat * Math.PI / 180;
    
    const y = Math.sin(dLng) * Math.cos(lat2);
    const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);
    
    let bearing = Math.atan2(y, x) * 180 / Math.PI;
    return (bearing + 360) % 360;
  }

  private static addMinutes(date: Date, minutes: number): string {
    const newDate = new Date(date.getTime() + minutes * 60 * 1000);
    return newDate.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
      timeZone: 'Atlantic/Bermuda'
    }) + ' ' + getBermudaTimeZone(newDate);
  }

  private static formatTimeOnly(timeString: string): string {
    return timeString; // Already formatted by addMinutes
  }
}