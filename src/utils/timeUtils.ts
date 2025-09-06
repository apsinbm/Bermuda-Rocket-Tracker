import { BermudaTimeService } from '../services/bermudaTimeService';

export function convertToBermudaTime(utcTime: string): string {
  return BermudaTimeService.formatBermudaTime(utcTime, 'full');
}

export function formatLaunchTime(utcTime: string): {
  date: string;
  time: string;
  timeZone: string;
  bermudaTime: string;
} {
  const bermudaInfo = BermudaTimeService.toBermudaTime(utcTime);
  
  const dateString = BermudaTimeService.formatBermudaTime(utcTime, 'date');
  const timeString = bermudaInfo.bermudaTime.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  });
  
  return {
    date: dateString,
    time: timeString,
    timeZone: bermudaInfo.timeZoneName,
    bermudaTime: `${dateString} ${timeString} ${bermudaInfo.timeZoneName}`
  };
}

export function formatLaunchWindow(windowStart?: string, windowEnd?: string, net?: string, missionName?: string): {
  hasWindow: boolean;
  windowText: string;
  timeZone: string;
} {
  // If no window data, fall back to NET time with better handling
  if (!windowStart || !windowEnd) {
    if (net) {
      const netFormatted = formatLaunchTime(net);
      
      // For certain mission types, create a reasonable window estimate
      const mission = (missionName || '').toLowerCase();
      if (mission.includes('starlink')) {
        // Starlink missions usually have very short windows, show as instantaneous
        return {
          hasWindow: false,
          windowText: netFormatted.time,
          timeZone: netFormatted.timeZone
        };
      }
      
      // For other missions without window data, show NET time
      return {
        hasWindow: false,
        windowText: netFormatted.time,
        timeZone: netFormatted.timeZone
      };
    }
    return {
      hasWindow: false,
      windowText: 'TBD',
      timeZone: 'ADT'
    };
  }
  
  const startDate = new Date(windowStart);
  const endDate = new Date(windowEnd);
  
  // Check if window is instantaneous (start = end) or very short (< 2 minutes)
  const windowDuration = (endDate.getTime() - startDate.getTime()) / (1000 * 60); // minutes
  
  if (windowDuration <= 1) {
    // Instantaneous launch - just show the time
    const formatted = formatLaunchTime(windowStart);
    return {
      hasWindow: false,
      windowText: formatted.time,
      timeZone: formatted.timeZone
    };
  }
  
  // Format both times in Bermuda timezone
  const startTime = startDate.toLocaleTimeString('en-US', {
    timeZone: 'Atlantic/Bermuda',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  });
  
  const endTime = endDate.toLocaleTimeString('en-US', {
    timeZone: 'Atlantic/Bermuda',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  });
  
  const timeZone = BermudaTimeService.toBermudaTime(startDate).timeZoneName;
  
  return {
    hasWindow: true,
    windowText: `${startTime} - ${endTime}`,
    timeZone: timeZone
  };
}

export function getCountdownTime(launchTime: string): {
  days: number;
  hours: number;
  minutes: number;
  isLive: boolean;
} {
  const now = new Date();
  const launch = new Date(launchTime);
  const diff = launch.getTime() - now.getTime();
  
  if (diff <= 0) {
    return { days: 0, hours: 0, minutes: 0, isLive: true };
  }
  
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  
  return { days, hours, minutes, isLive: false };
}