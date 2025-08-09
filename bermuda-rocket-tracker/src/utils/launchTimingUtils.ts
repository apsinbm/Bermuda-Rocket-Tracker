/**
 * Shared Launch Timing Utilities
 * 
 * Provides consistent timezone handling and day/night determination
 * for all launch description systems
 */

import { getBermudaTimeZone } from './bermudaTimeZone';

export type LaunchTimeContext = 
  | 'golden_hour_evening'    // 0-30 min after sunset
  | 'post_sunset_fading'     // 30-60 min after sunset  
  | 'deep_night'             // >60 min after sunset
  | 'pre_dawn_possible'      // 30-15 min before sunrise
  | 'pre_dawn_ideal'         // 15-0 min before sunrise
  | 'daylight'               // Between sunrise+15min and sunset-15min
  | 'unknown';               // Unable to determine

export interface LaunchTimingInfo {
  timeContext: LaunchTimeContext;
  isVisible: boolean;
  bermudaTime: Date;
  timeZone: string;
  description: string;
  icon: string;
  trackingAdvice: string;
}

/**
 * Get comprehensive timing information for a launch
 * Uses same logic as ExhaustPlumeVisibilityCalculator for consistency
 */
export function getLaunchTimingInfo(launchTime: string | Date): LaunchTimingInfo {
  const launchDate = typeof launchTime === 'string' ? new Date(launchTime) : launchTime;
  
  // Convert to Bermuda local time using proper timezone logic
  const bermudaTime = new Date(launchDate.toLocaleString('en-US', { timeZone: 'Atlantic/Bermuda' }));
  const timeZone = getBermudaTimeZone(launchDate);
  
  // Get basic sun times (simplified - in production would use accurate calculation)
  const { timeContext } = determineLaunchContext(bermudaTime);
  
  return {
    timeContext,
    isVisible: isContextVisible(timeContext),
    bermudaTime,
    timeZone,
    description: getContextDescription(timeContext),
    icon: getContextIcon(timeContext),
    trackingAdvice: getContextTrackingAdvice(timeContext)
  };
}

/**
 * Determine launch context based on timing relative to sunset/sunrise
 */
function determineLaunchContext(bermudaTime: Date): { timeContext: LaunchTimeContext } {
  const hour = bermudaTime.getHours();
  const minutes = bermudaTime.getMinutes();
  const totalMinutes = hour * 60 + minutes;
  
  // Approximate sunset/sunrise times for Bermuda (would use accurate calculation in production)
  // August sunset around 8:00 PM (20:00), sunrise around 6:30 AM (06:30)
  const sunsetMinutes = 20 * 60; // 8:00 PM
  const sunriseMinutes = 6.5 * 60; // 6:30 AM
  
  const minutesSinceSunset = totalMinutes - sunsetMinutes;
  const minutesBeforeSunrise = sunriseMinutes - totalMinutes;
  
  // Handle day transition (launch after midnight)
  const adjustedMinutesBeforeSunrise = minutesBeforeSunrise < 0 ? 
    (24 * 60 + sunriseMinutes) - totalMinutes : minutesBeforeSunrise;
  
  // Determine context using same logic as ExhaustPlumeVisibilityCalculator
  let timeContext: LaunchTimeContext;
  
  if (minutesSinceSunset >= 0 && minutesSinceSunset <= 1440) {
    if (minutesSinceSunset <= 30) {
      timeContext = 'golden_hour_evening';
    } else if (minutesSinceSunset <= 60) {
      timeContext = 'post_sunset_fading';
    } else {
      timeContext = 'deep_night';
    }
  } else if (adjustedMinutesBeforeSunrise >= 0 && adjustedMinutesBeforeSunrise <= 60) {
    if (adjustedMinutesBeforeSunrise >= 15 && adjustedMinutesBeforeSunrise <= 30) {
      timeContext = 'pre_dawn_possible';
    } else if (adjustedMinutesBeforeSunrise >= 0 && adjustedMinutesBeforeSunrise <= 15) {
      timeContext = 'pre_dawn_ideal';
    } else {
      timeContext = 'deep_night';
    }
  } else if (totalMinutes > sunriseMinutes + 15 && totalMinutes < sunsetMinutes - 15) {
    timeContext = 'daylight';
  } else {
    timeContext = 'deep_night';
  }
  
  return {
    timeContext
  };
}

/**
 * Check if launch context provides visibility
 */
function isContextVisible(context: LaunchTimeContext): boolean {
  switch (context) {
    case 'golden_hour_evening':
    case 'post_sunset_fading':
    case 'pre_dawn_possible':
    case 'pre_dawn_ideal':
      return true;
    case 'deep_night':
    case 'daylight':
    case 'unknown':
    default:
      return false;
  }
}

/**
 * Get user-friendly description for time context
 */
function getContextDescription(context: LaunchTimeContext): string {
  switch (context) {
    case 'golden_hour_evening':
      return 'Golden Hour Launch - Perfect twilight conditions';
    case 'post_sunset_fading':
      return 'Post-sunset Launch - Good twilight visibility';
    case 'pre_dawn_possible':
      return 'Pre-dawn Launch - Early morning visibility';
    case 'pre_dawn_ideal':
      return 'Pre-sunrise Launch - Ideal morning conditions';
    case 'deep_night':
      return 'Night Launch - Dark sky conditions';
    case 'daylight':
      return 'Daytime Launch - Bright sky conditions';
    case 'unknown':
    default:
      return 'Launch timing assessment';
  }
}

/**
 * Get appropriate icon for time context
 */
function getContextIcon(context: LaunchTimeContext): string {
  switch (context) {
    case 'golden_hour_evening':
      return '🌅';
    case 'post_sunset_fading':
      return '🌆';
    case 'pre_dawn_possible':
      return '🌄';
    case 'pre_dawn_ideal':
      return '🌅';
    case 'deep_night':
      return '🌙';
    case 'daylight':
      return '☀️';
    case 'unknown':
    default:
      return '🚀';
  }
}

/**
 * Get context-appropriate tracking advice
 */
function getContextTrackingAdvice(context: LaunchTimeContext): string {
  switch (context) {
    case 'golden_hour_evening':
      return 'Perfect conditions - look for bright exhaust plume against twilight sky. Expect spectacular "jellyfish effect" with colorful trail.';
    case 'post_sunset_fading':
      return 'Good conditions - exhaust plume will be visible as rocket reaches high altitude. Look for dimmer but visible trail against darkening sky.';
    case 'pre_dawn_possible':
      return 'Fair conditions - rocket becomes visible as it climbs into sunlit upper atmosphere while ground remains dark.';
    case 'pre_dawn_ideal':
      return 'Excellent conditions - rocket plume lights up dramatically against dark-to-blue morning sky transition.';
    case 'deep_night':
      return 'Look for bright moving star climbing slowly across the sky. May appear as glowing dot with exhaust trail.';
    case 'daylight':
      return 'Very difficult to spot against bright blue sky. If visible, may appear as faint contrail or bright speck moving across sky.';
    case 'unknown':
    default:
      return 'Visibility depends on local lighting conditions and rocket altitude.';
  }
}

/**
 * Simplified day/night check for backward compatibility
 * Uses proper timezone handling
 */
export function isNightLaunch(launchTime: string | Date): boolean {
  const timingInfo = getLaunchTimingInfo(launchTime);
  return ['golden_hour_evening', 'post_sunset_fading', 'deep_night', 'pre_dawn_possible', 'pre_dawn_ideal'].includes(timingInfo.timeContext);
}

/**
 * Check if launch is during optimal viewing window (twilight conditions)
 */
export function isOptimalViewingWindow(launchTime: string | Date): boolean {
  const timingInfo = getLaunchTimingInfo(launchTime);
  return ['golden_hour_evening', 'post_sunset_fading', 'pre_dawn_possible', 'pre_dawn_ideal'].includes(timingInfo.timeContext);
}