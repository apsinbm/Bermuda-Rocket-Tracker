/**
 * Plume Illumination Service
 * 
 * Predicts when rocket exhaust plumes will be illuminated by sunlight during
 * twilight launches, creating the spectacular "jellyfish" effect visible from Bermuda.
 * 
 * Key Physics:
 * - Rocket enters sunlight when altitude > Earth's shadow height
 * - Earth's shadow height = tan(sun_depression_angle) * Earth_radius
 * - Plume expansion follows atmospheric density/pressure curves
 * - Visibility depends on viewing angle, plume size, and scattering
 */

import { LaunchWithVisibility } from '../types';
import { GovernmentSolarService } from './governmentSolarService';

export interface PlumeIlluminationPrediction {
  launchTime: Date;
  hasPlumeIllumination: boolean;
  illuminationPeriods: IlluminationPeriod[];
  bestViewingMoments: ViewingMoment[];
  overallQuality: 'none' | 'poor' | 'fair' | 'good' | 'excellent' | 'spectacular';
  photographyRecommendations: PhotographyTips;
}

export interface IlluminationPeriod {
  startTime: Date;
  endTime: Date;
  rocketAltitude: {
    start: number; // km
    end: number;   // km
  };
  sunAngle: {
    start: number; // degrees below horizon
    end: number;   // degrees below horizon
  };
  plumeVisibility: {
    intensity: 'faint' | 'moderate' | 'bright' | 'brilliant';
    sizeKm: number; // plume diameter at max expansion
    viewingAngleDegrees: number; // angle from Bermuda
  };
  duration: number; // seconds
}

export interface ViewingMoment {
  time: Date;
  description: string;
  rocketAltitude: number; // km
  plumeSize: number; // km diameter
  sunAngle: number; // degrees below horizon
  intensity: 'faint' | 'moderate' | 'bright' | 'brilliant';
  viewingTips: string;
}

export interface PhotographyTips {
  cameraSettings: {
    iso: number;
    aperture: number;
    shutterSpeed: string;
    focusDistance: string;
  };
  timing: {
    startRecording: string; // relative to launch
    keyMoments: string[];
  };
  composition: {
    framingAdvice: string;
    foregroundElements: string[];
  };
  equipment: string[];
}

// Bermuda coordinates for calculations
const BERMUDA_LAT = 32.3078;
const BERMUDA_LNG = -64.7505;

// Physical constants
const EARTH_RADIUS_KM = 6371;
const ATMOSPHERE_SCALE_HEIGHT = 8.5; // km, atmospheric density scale height

export class PlumeIlluminationService {

  /**
   * Main prediction function - analyzes launch for plume illumination potential
   */
  static async predictPlumeIllumination(launch: LaunchWithVisibility): Promise<PlumeIlluminationPrediction> {
    const launchTime = new Date(launch.net);
    
    try {
      // Get solar data for launch date
      const solarData = await GovernmentSolarService.getSolarDataForDate(launchTime);
      
      // Check if launch occurs during twilight (when plume illumination is possible)
      const twilightStatus = this.analyzeTwilightConditions(launchTime, solarData);
      
      return this.generatePredictionWithSolarData(launch, launchTime, solarData, twilightStatus);
    } catch (error) {
      console.warn('[PlumeIllumination] Solar data fetch failed, using fallback calculations:', error);
      
      // Fallback: use simplified twilight calculations
      const fallbackTwilightStatus = this.calculateSimpleTwilight(launchTime);
      return this.generateFallbackPrediction(launch, launchTime, fallbackTwilightStatus);
    }
  }

  /**
   * Generate prediction with full solar data
   */
  private static generatePredictionWithSolarData(
    launch: LaunchWithVisibility,
    launchTime: Date,
    solarData: any,
    twilightStatus: any
  ): PlumeIlluminationPrediction {
    
    if (!twilightStatus.isDuringTwilight) {
      return {
        launchTime,
        hasPlumeIllumination: false,
        illuminationPeriods: [],
        bestViewingMoments: [],
        overallQuality: 'none',
        photographyRecommendations: this.getBasicPhotographyTips()
      };
    }

    // Calculate illumination periods based on rocket trajectory
    const illuminationPeriods = this.calculateIlluminationPeriods(
      launch, 
      launchTime, 
      solarData
    );

    // Identify best viewing moments
    const bestViewingMoments = this.findBestViewingMoments(illuminationPeriods);

    // Assess overall quality
    const overallQuality = this.assessOverallQuality(illuminationPeriods, twilightStatus);

    // Generate photography recommendations
    const photographyRecommendations = this.generatePhotographyTips(
      twilightStatus,
      illuminationPeriods,
      overallQuality
    );

    return {
      launchTime,
      hasPlumeIllumination: illuminationPeriods.length > 0,
      illuminationPeriods,
      bestViewingMoments,
      overallQuality,
      photographyRecommendations
    };
  }

  /**
   * Analyze twilight conditions at launch time
   */
  private static analyzeTwilightConditions(launchTime: Date, solarData: any) {
    const hour = launchTime.getHours();
    const minute = launchTime.getMinutes();
    const timeMinutes = hour * 60 + minute;

    // Convert solar data times to minutes
    const sunriseMinutes = this.timeStringToMinutes(solarData.sunrise);
    const sunsetMinutes = this.timeStringToMinutes(solarData.sunset);
    const civilTwilightStartMinutes = this.timeStringToMinutes(solarData.civilTwilightStart);
    const civilTwilightEndMinutes = this.timeStringToMinutes(solarData.civilTwilightEnd);
    const nauticalTwilightStartMinutes = this.timeStringToMinutes(solarData.nauticalTwilightStart);
    const nauticalTwilightEndMinutes = this.timeStringToMinutes(solarData.nauticalTwilightEnd);

    let isDuringTwilight = false;
    let twilightType = 'none';
    let sunAngleDegrees = 0;

    // Morning twilight
    if (timeMinutes >= nauticalTwilightStartMinutes && timeMinutes <= sunriseMinutes) {
      isDuringTwilight = true;
      if (timeMinutes >= civilTwilightStartMinutes) {
        twilightType = 'civil';
        sunAngleDegrees = -6 + ((timeMinutes - civilTwilightStartMinutes) / (sunriseMinutes - civilTwilightStartMinutes)) * 6;
      } else {
        twilightType = 'nautical';
        sunAngleDegrees = -12 + ((timeMinutes - nauticalTwilightStartMinutes) / (civilTwilightStartMinutes - nauticalTwilightStartMinutes)) * 6;
      }
    }
    
    // Evening twilight
    else if (timeMinutes >= sunsetMinutes && timeMinutes <= nauticalTwilightEndMinutes) {
      isDuringTwilight = true;
      if (timeMinutes <= civilTwilightEndMinutes) {
        twilightType = 'civil';
        sunAngleDegrees = -6 * ((timeMinutes - sunsetMinutes) / (civilTwilightEndMinutes - sunsetMinutes));
      } else {
        twilightType = 'nautical';
        sunAngleDegrees = -6 - 6 * ((timeMinutes - civilTwilightEndMinutes) / (nauticalTwilightEndMinutes - civilTwilightEndMinutes));
      }
    }

    return {
      isDuringTwilight,
      twilightType,
      sunAngleDegrees, // negative value (degrees below horizon)
      quality: this.rateTwilightQuality(twilightType, Math.abs(sunAngleDegrees))
    };
  }

  /**
   * Calculate when the rocket will be illuminated during its flight
   */
  private static calculateIlluminationPeriods(
    launch: LaunchWithVisibility, 
    launchTime: Date, 
    solarData: any
  ): IlluminationPeriod[] {
    const periods: IlluminationPeriod[] = [];
    
    // Estimate rocket altitude profile (simplified model)
    const altitudeProfile = this.generateAltitudeProfile(launchTime);
    
    // Calculate Earth's shadow height at launch time
    const sunAngle = this.calculateSunAngle(launchTime, solarData);
    const shadowHeightKm = this.calculateEarthShadowHeight(sunAngle);

    let illuminationStart: Date | null = null;
    let startAltitude = 0;
    let startSunAngle = 0;

    // Check each point in altitude profile
    for (const point of altitudeProfile) {
      const isIlluminated = point.altitude > shadowHeightKm;
      const currentSunAngle = this.calculateSunAngle(point.time, solarData);
      
      if (isIlluminated && !illuminationStart) {
        // Start of illumination period
        illuminationStart = point.time;
        startAltitude = point.altitude;
        startSunAngle = currentSunAngle;
      } else if (!isIlluminated && illuminationStart) {
        // End of illumination period
        const period = this.createIlluminationPeriod(
          illuminationStart,
          point.time,
          startAltitude,
          point.altitude,
          startSunAngle,
          currentSunAngle,
          launch
        );
        periods.push(period);
        illuminationStart = null;
      }
    }

    // If illumination continues to end of flight
    if (illuminationStart) {
      const lastPoint = altitudeProfile[altitudeProfile.length - 1];
      const period = this.createIlluminationPeriod(
        illuminationStart,
        lastPoint.time,
        startAltitude,
        lastPoint.altitude,
        startSunAngle,
        this.calculateSunAngle(lastPoint.time, solarData),
        launch
      );
      periods.push(period);
    }

    return periods;
  }

  /**
   * Generate simplified rocket altitude profile
   */
  private static generateAltitudeProfile(launchTime: Date) {
    const profile = [];
    const timeStep = 10; // seconds
    const maxTime = 600; // 10 minutes

    for (let t = 0; t <= maxTime; t += timeStep) {
      const time = new Date(launchTime.getTime() + t * 1000);
      
      // Simplified altitude model: rapid initial climb, then more gradual
      let altitude = 0;
      if (t <= 120) {
        // First 2 minutes: rapid climb to ~100km
        altitude = (t / 120) * (t / 120) * 100; // km
      } else {
        // After 2 minutes: continued climb but slower
        altitude = 100 + Math.sqrt(t - 120) * 10; // km
      }

      profile.push({ time, altitude });
    }

    return profile;
  }

  /**
   * Calculate Earth's shadow height for given sun angle
   */
  private static calculateEarthShadowHeight(sunAngleDegrees: number): number {
    const sunAngleRadians = Math.abs(sunAngleDegrees) * Math.PI / 180;
    return Math.tan(sunAngleRadians) * EARTH_RADIUS_KM;
  }

  /**
   * Calculate sun angle below horizon for given time
   */
  private static calculateSunAngle(time: Date, solarData: any): number {
    // Simplified calculation - in reality would use proper solar position algorithms
    const hour = time.getHours() + time.getMinutes() / 60;
    const sunriseHour = this.timeStringToHour(solarData.sunrise);
    const sunsetHour = this.timeStringToHour(solarData.sunset);
    
    if (hour < sunriseHour) {
      // Morning - sun angle decreases toward sunrise
      const hoursTillSunrise = sunriseHour - hour;
      return -Math.min(18, hoursTillSunrise * 3); // Simplified: 3 degrees per hour
    } else if (hour > sunsetHour) {
      // Evening - sun angle increases after sunset
      const hoursSinceSunset = hour - sunsetHour;
      return -Math.min(18, hoursSinceSunset * 3); // Simplified: 3 degrees per hour
    } else {
      return 10; // Daytime - sun is above horizon
    }
  }

  /**
   * Create an illumination period object
   */
  private static createIlluminationPeriod(
    startTime: Date,
    endTime: Date,
    startAltitude: number,
    endAltitude: number,
    startSunAngle: number,
    endSunAngle: number,
    launch: LaunchWithVisibility
  ): IlluminationPeriod {
    const duration = (endTime.getTime() - startTime.getTime()) / 1000;
    const avgAltitude = (startAltitude + endAltitude) / 2;
    
    // Calculate plume size based on altitude and atmospheric density
    const plumeSize = this.calculatePlumeSize(avgAltitude);
    
    // Determine intensity based on sun angle and altitude
    const intensity = this.calculatePlumeIntensity(avgAltitude, Math.abs((startSunAngle + endSunAngle) / 2));
    
    // Calculate viewing angle from Bermuda
    const viewingAngle = this.calculateViewingAngle(launch, avgAltitude);

    return {
      startTime,
      endTime,
      rocketAltitude: {
        start: startAltitude,
        end: endAltitude
      },
      sunAngle: {
        start: startSunAngle,
        end: endSunAngle
      },
      plumeVisibility: {
        intensity,
        sizeKm: plumeSize,
        viewingAngleDegrees: viewingAngle
      },
      duration
    };
  }

  /**
   * Calculate plume expansion size based on altitude
   */
  private static calculatePlumeSize(altitudeKm: number): number {
    // Plume expands more at higher altitudes due to lower atmospheric pressure
    // Simplified model based on exponential atmosphere
    const pressureRatio = Math.exp(-altitudeKm / ATMOSPHERE_SCALE_HEIGHT);
    const basePlumeSize = 1; // km diameter at sea level
    return basePlumeSize / Math.sqrt(pressureRatio + 0.1); // Prevent division by zero
  }

  /**
   * Calculate plume brightness intensity
   */
  private static calculatePlumeIntensity(altitudeKm: number, sunAngleDegrees: number): 'faint' | 'moderate' | 'bright' | 'brilliant' {
    // Higher altitude and optimal sun angles give brighter plumes
    const altitudeScore = Math.min(altitudeKm / 200, 1); // Normalize to 200km max
    const sunAngleScore = 1 - Math.min(sunAngleDegrees / 18, 1); // Best at small angles
    
    const combinedScore = (altitudeScore + sunAngleScore) / 2;
    
    if (combinedScore > 0.8) return 'brilliant';
    if (combinedScore > 0.6) return 'bright';
    if (combinedScore > 0.4) return 'moderate';
    return 'faint';
  }

  /**
   * Calculate viewing angle from Bermuda to rocket
   */
  private static calculateViewingAngle(launch: LaunchWithVisibility, altitudeKm: number): number {
    // Simplified calculation using bearing and altitude
    const bearing = launch.visibility.bearing || 225; // Default southwest
    const distance = 500; // km - typical distance to launch site from Bermuda
    
    return Math.atan(altitudeKm / distance) * 180 / Math.PI;
  }

  /**
   * Find the best viewing moments from illumination periods
   */
  private static findBestViewingMoments(periods: IlluminationPeriod[]): ViewingMoment[] {
    const moments: ViewingMoment[] = [];

    for (const period of periods) {
      // Peak illumination moment (middle of period)
      const midTime = new Date((period.startTime.getTime() + period.endTime.getTime()) / 2);
      const midAltitude = (period.rocketAltitude.start + period.rocketAltitude.end) / 2;
      
      moments.push({
        time: midTime,
        description: `Peak plume illumination - ${period.plumeVisibility.intensity} glow`,
        rocketAltitude: midAltitude,
        plumeSize: period.plumeVisibility.sizeKm,
        sunAngle: (period.sunAngle.start + period.sunAngle.end) / 2,
        intensity: period.plumeVisibility.intensity,
        viewingTips: this.getViewingTips(period.plumeVisibility.intensity, midAltitude)
      });
    }

    // Sort by intensity (best first)
    return moments.sort((a, b) => {
      const intensityOrder = { brilliant: 4, bright: 3, moderate: 2, faint: 1 };
      return intensityOrder[b.intensity] - intensityOrder[a.intensity];
    });
  }

  /**
   * Assess overall quality of plume illumination event
   */
  private static assessOverallQuality(
    periods: IlluminationPeriod[],
    twilightStatus: any
  ): 'none' | 'poor' | 'fair' | 'good' | 'excellent' | 'spectacular' {
    if (periods.length === 0) return 'none';

    const bestPeriod = periods.reduce((best, current) => {
      const intensityOrder = { brilliant: 4, bright: 3, moderate: 2, faint: 1 };
      return intensityOrder[current.plumeVisibility.intensity] > intensityOrder[best.plumeVisibility.intensity] 
        ? current : best;
    });

    const totalDuration = periods.reduce((sum, p) => sum + p.duration, 0);
    const avgPlumeSize = periods.reduce((sum, p) => sum + p.plumeVisibility.sizeKm, 0) / periods.length;

    // Quality factors
    const intensityScore = { brilliant: 1, bright: 0.8, moderate: 0.6, faint: 0.4 }[bestPeriod.plumeVisibility.intensity];
    const durationScore = Math.min(totalDuration / 300, 1); // Up to 5 minutes
    const twilightScore = { civil: 1, nautical: 0.8, astronomical: 0.6 }[twilightStatus.twilightType as 'civil' | 'nautical' | 'astronomical'] || 0.4;
    const sizeScore = Math.min(avgPlumeSize / 20, 1); // Up to 20km diameter

    const overallScore = (intensityScore + durationScore + twilightScore + sizeScore) / 4;

    if (overallScore > 0.9) return 'spectacular';
    if (overallScore > 0.75) return 'excellent';
    if (overallScore > 0.6) return 'good';
    if (overallScore > 0.45) return 'fair';
    return 'poor';
  }

  /**
   * Generate photography recommendations for plume illumination
   */
  private static generatePhotographyTips(
    twilightStatus: any,
    periods: IlluminationPeriod[],
    quality: string
  ): PhotographyTips {
    const isDark = twilightStatus.twilightType === 'nautical' || Math.abs(twilightStatus.sunAngleDegrees) > 10;
    const hasLongPeriods = periods.some(p => p.duration > 120);

    return {
      cameraSettings: {
        iso: isDark ? 800 : 400,
        aperture: isDark ? 4 : 8,
        shutterSpeed: hasLongPeriods ? '30s-60s' : '5s-15s',
        focusDistance: 'infinity'
      },
      timing: {
        startRecording: 'T+60 seconds (when rocket reaches ~20km altitude)',
        keyMoments: periods.map(p => 
          `T+${Math.round((p.startTime.getTime() - periods[0].startTime.getTime()) / 1000 + 60)}s: ${p.plumeVisibility.intensity} plume illumination`
        )
      },
      composition: {
        framingAdvice: `Frame ${twilightStatus.twilightType === 'civil' ? 'wide' : 'medium'} to capture full plume expansion`,
        foregroundElements: ['Bermuda coastline for scale', 'Distinctive landmarks', 'Palm trees for context']
      },
      equipment: [
        'Wide-angle lens (14-24mm) for full plume capture',
        'Sturdy tripod - critical for long exposures',
        'Remote shutter or intervalometer',
        isDark ? 'Extra batteries (cold drains faster)' : 'Neutral density filter for balance',
        'Backup memory cards for continuous shooting'
      ]
    };
  }

  // Utility functions
  private static timeStringToMinutes(timeString: string): number {
    const [hours, minutes] = timeString.split(':').map(Number);
    return hours * 60 + minutes;
  }

  private static timeStringToHour(timeString: string): number {
    const [hours, minutes] = timeString.split(':').map(Number);
    return hours + minutes / 60;
  }

  private static rateTwilightQuality(twilightType: string, sunAngleDegrees: number): 'poor' | 'fair' | 'good' | 'excellent' {
    if (twilightType === 'civil' && sunAngleDegrees <= 4) return 'excellent';
    if (twilightType === 'civil') return 'good';
    if (twilightType === 'nautical' && sunAngleDegrees <= 10) return 'good';
    if (twilightType === 'nautical') return 'fair';
    return 'poor';
  }

  private static getViewingTips(intensity: string, altitude: number): string {
    const tips = {
      brilliant: `Look for spectacular jellyfish-like plume at ${Math.round(altitude)}km altitude. Use binoculars for incredible detail!`,
      bright: `Bright illuminated plume visible to naked eye. Great photo opportunity at ${Math.round(altitude)}km.`,
      moderate: `Visible as glowing trail. Binoculars recommended to see full plume structure at ${Math.round(altitude)}km.`,
      faint: `Subtle glow - may need binoculars or camera to capture fully. Look carefully at ${Math.round(altitude)}km altitude.`
    };
    return tips[intensity as keyof typeof tips] || 'Watch for illuminated exhaust plume.';
  }

  private static getBasicPhotographyTips(): PhotographyTips {
    return {
      cameraSettings: {
        iso: 400,
        aperture: 8,
        shutterSpeed: '1/250s',
        focusDistance: 'infinity'
      },
      timing: {
        startRecording: 'At liftoff',
        keyMoments: ['Liftoff', 'Max Q', 'MECO', 'Stage separation']
      },
      composition: {
        framingAdvice: 'Standard launch photography',
        foregroundElements: ['Coastline', 'Landmarks']
      },
      equipment: ['Standard telephoto lens', 'Tripod', 'Remote shutter']
    };
  }

  /**
   * Simple twilight calculation fallback when solar APIs fail
   */
  private static calculateSimpleTwilight(launchTime: Date) {
    const hour = launchTime.getHours();
    const minute = launchTime.getMinutes();
    const timeMinutes = hour * 60 + minute;

    // Simple twilight times for Bermuda latitude
    const morningTwilightStart = 5 * 60; // 5:00 AM
    const morningTwilightEnd = 7 * 60;   // 7:00 AM  
    const eveningTwilightStart = 18 * 60; // 6:00 PM
    const eveningTwilightEnd = 20 * 60;   // 8:00 PM

    const isDuringTwilight = (timeMinutes >= morningTwilightStart && timeMinutes <= morningTwilightEnd) ||
                           (timeMinutes >= eveningTwilightStart && timeMinutes <= eveningTwilightEnd);

    return {
      isDuringTwilight,
      twilightType: timeMinutes < 12 * 60 ? 'morning' : 'evening',
      sunAngle: isDuringTwilight ? -10 : (timeMinutes < 12 * 60 ? -30 : -30) // Rough sun depression angle
    };
  }

  /**
   * Generate fallback prediction when solar data unavailable
   */
  private static generateFallbackPrediction(
    launch: LaunchWithVisibility,
    launchTime: Date,
    twilightStatus: any
  ): PlumeIlluminationPrediction {
    if (!twilightStatus.isDuringTwilight) {
      return {
        launchTime,
        hasPlumeIllumination: false,
        illuminationPeriods: [],
        bestViewingMoments: [],
        overallQuality: 'none',
        photographyRecommendations: this.getBasicPhotographyTips()
      };
    }

    // Generate basic illumination prediction
    const illuminationStart = new Date(launchTime.getTime() + 60000); // T+1 minute
    const illuminationEnd = new Date(launchTime.getTime() + 300000);  // T+5 minutes

    const basicIlluminationPeriod: IlluminationPeriod = {
      startTime: illuminationStart,
      endTime: illuminationEnd,
      rocketAltitude: {
        start: 20,  // km
        end: 100    // km
      },
      sunAngle: {
        start: twilightStatus.sunAngle,
        end: twilightStatus.sunAngle + 2
      },
      plumeVisibility: {
        intensity: 'moderate',
        sizeKm: 5,
        viewingAngleDegrees: 45
      },
      duration: 240
    };

    const bestMoment: ViewingMoment = {
      time: new Date(launchTime.getTime() + 180000), // T+3 minutes
      description: 'Peak plume illumination expected',
      rocketAltitude: 60,
      plumeSize: 8,
      sunAngle: twilightStatus.sunAngle + 1,
      intensity: 'moderate',
      viewingTips: 'Look for illuminated exhaust plume against dark sky'
    };

    return {
      launchTime,
      hasPlumeIllumination: true,
      illuminationPeriods: [basicIlluminationPeriod],
      bestViewingMoments: [bestMoment],
      overallQuality: 'fair',
      photographyRecommendations: {
        cameraSettings: {
          iso: 800,
          aperture: 4,
          shutterSpeed: '1/60s',
          focusDistance: 'infinity'
        },
        timing: {
          startRecording: 'T+1 minute',
          keyMoments: ['T+1 min (plume start)', 'T+3 min (peak)', 'T+5 min (fade)']
        },
        composition: {
          framingAdvice: 'Frame wide to capture full plume expansion',
          foregroundElements: ['Ocean horizon', 'Local landmarks']
        },
        equipment: ['Wide angle lens', 'Sturdy tripod', 'Remote trigger']
      }
    };
  }
}