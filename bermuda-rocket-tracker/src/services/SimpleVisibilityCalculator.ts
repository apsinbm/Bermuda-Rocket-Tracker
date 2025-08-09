/**
 * Simple Visibility Calculator - Pure Functions Only
 * Based on REBUILD_INSTRUCTIONS.md requirements
 * NO external API calls, NO complex async operations, NO fallback chains
 */

import { Launch, VisibilityData } from '../types';
import { getBermudaUTCOffset } from '../utils/bermudaTimeZone';

export class SimpleVisibilityCalculator {
  private static readonly BERMUDA_LAT = 32.3078;
  private static readonly BERMUDA_LNG = -64.7505;
  
  // Twilight definitions (sun elevation angles)
  private static readonly CIVIL_TWILIGHT = -6;      // 0° to -6°: still bright
  private static readonly NAUTICAL_TWILIGHT = -12;  // -6° to -12°: getting dark
  private static readonly ASTRONOMICAL_TWILIGHT = -18; // -12° to -18°: quite dark
  // Below -18°: true night (best for rockets)
  
  /**
   * Calculate visibility using pure functions only
   * This replaces the complex enhancedVisibilityService
   */
  static calculateVisibility(launch: Launch): VisibilityData {
    const solarElevation = this.calculateSolarElevation(launch.net);
    const twilightLevel = this.getTwilightLevel(solarElevation);
    const trajectory = this.getTrajectoryDirection(launch);
    const distance = this.calculateDistance(launch);
    const bearing = this.calculateBearing(launch);
    
    return {
      likelihood: this.getLikelihoodWithTwilight(twilightLevel, trajectory, distance),
      reason: this.createReasonWithTwilight(launch, twilightLevel, trajectory, solarElevation),
      bearing: bearing,
      trajectoryDirection: trajectory,
      estimatedTimeVisible: this.getViewingTimeWithTwilight(launch, twilightLevel)
    };
  }
  
  /**
   * Calculate solar elevation angle for twilight determination
   */
  private static calculateSolarElevation(launchTime: string): number {
    const date = new Date(launchTime);
    
    // Calculate Julian day number
    const jd = this.toJulianDay(date);
    
    // Calculate solar position
    const n = jd - 2451545.0; // days since J2000
    const L = (280.460 + 0.9856474 * n) % 360; // mean longitude of sun
    const g = ((357.528 + 0.9856003 * n) % 360) * Math.PI / 180; // mean anomaly
    const lambda = (L + 1.915 * Math.sin(g) + 0.020 * Math.sin(2 * g)) * Math.PI / 180; // ecliptic longitude
    
    // Calculate sun's declination
    const delta = Math.asin(Math.sin(23.439 * Math.PI / 180) * Math.sin(lambda));
    
    // Calculate local hour angle (accounting for Bermuda timezone with accurate DST)
    const offsetHours = getBermudaUTCOffset(date);
    
    const localTime = new Date(date.getTime() - (offsetHours * 60 * 60 * 1000));
    const hours = localTime.getUTCHours() + localTime.getUTCMinutes() / 60;
    const hourAngle = (15 * (hours - 12)) * Math.PI / 180;
    
    // Calculate solar elevation angle
    const phi = this.BERMUDA_LAT * Math.PI / 180; // Bermuda latitude in radians
    const elevation = Math.asin(
      Math.sin(phi) * Math.sin(delta) + 
      Math.cos(phi) * Math.cos(delta) * Math.cos(hourAngle)
    );
    
    return elevation * 180 / Math.PI; // convert to degrees
  }
  
  /**
   * Convert Date to Julian Day Number
   */
  private static toJulianDay(date: Date): number {
    const a = Math.floor((14 - date.getUTCMonth() - 1) / 12);
    const y = date.getUTCFullYear() + 4800 - a;
    const m = date.getUTCMonth() + 1 + 12 * a - 3;
    
    return date.getUTCDate() + Math.floor((153 * m + 2) / 5) + 365 * y + 
           Math.floor(y / 4) - Math.floor(y / 100) + Math.floor(y / 400) - 32045 +
           (date.getUTCHours() - 12) / 24 + date.getUTCMinutes() / 1440 + date.getUTCSeconds() / 86400;
  }
  
  /**
   * Determine twilight level based on solar elevation
   */
  private static getTwilightLevel(solarElevation: number): 'day' | 'civil' | 'nautical' | 'astronomical' | 'night' {
    if (solarElevation > 0) return 'day';
    if (solarElevation > this.CIVIL_TWILIGHT) return 'civil';
    if (solarElevation > this.NAUTICAL_TWILIGHT) return 'nautical';
    if (solarElevation > this.ASTRONOMICAL_TWILIGHT) return 'astronomical';
    return 'night';
  }
  
  /**
   * Determine trajectory direction based on mission characteristics
   */
  private static getTrajectoryDirection(launch: Launch): 'Northeast' | 'East-Northeast' | 'East' | 'East-Southeast' | 'Southeast' {
    const orbit = launch.mission.orbit?.name?.toLowerCase() || '';
    const mission = launch.mission.name?.toLowerCase() || '';
    
    if (orbit.includes('gto') || orbit.includes('geostationary') || orbit.includes('geosynchronous')) {
      return 'Southeast';
    } else if (orbit.includes('starlink') || mission.includes('starlink')) {
      return 'Northeast';
    } else if (orbit.includes('iss') || orbit.includes('station') || mission.includes('dragon') || mission.includes('crew')) {
      return 'Northeast';
    }
    return 'Northeast'; // Default for most missions
  }
  
  /**
   * Calculate distance from launch pad to Bermuda
   */
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
  
  /**
   * Calculate bearing from Bermuda to launch pad
   */
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
  
  /**
   * Determine likelihood based on twilight level and trajectory
   */
  private static getLikelihoodWithTwilight(twilightLevel: string, trajectory: string, distance: number): 'high' | 'medium' | 'low' | 'none' {
    if (distance > 2000) {
      return 'none'; // Too far away
    }
    
    // Visibility based on lighting conditions and trajectory
    switch (twilightLevel) {
      case 'day':
      case 'civil':
        return 'none'; // Too bright to see rockets
        
      case 'nautical':
        // Getting dark enough to potentially see bright rockets
        return trajectory === 'Southeast' ? 'low' : 'none';
        
      case 'astronomical':
        // Good conditions for rocket visibility
        if (trajectory === 'Southeast') return 'medium'; // GTO missions
        if (trajectory === 'Northeast') return 'low';    // LEO missions
        return 'low';
        
      case 'night':
        // Optimal conditions for rocket visibility
        if (trajectory === 'Southeast') return 'high';   // GTO missions very visible
        if (trajectory === 'Northeast') return 'medium'; // LEO missions moderately visible
        return 'medium';
        
      default:
        return 'low';
    }
  }
  
  /**
   * Create human-readable reason with twilight information
   */
  private static createReasonWithTwilight(launch: Launch, twilightLevel: string, trajectory: string, solarElevation: number): string {
    const elevationText = `${Math.abs(solarElevation).toFixed(1)}°`;
    
    switch (twilightLevel) {
      case 'day':
        return `☀️ Daytime launch (sun ${elevationText} above horizon) - rockets are invisible against the bright blue sky.`;
        
      case 'civil':
        return `🌅 Civil twilight launch (sun ${elevationText} below horizon) - still too bright to see rockets clearly. Wait for darker skies.`;
        
      case 'nautical':
        return `🌆 Nautical twilight launch (sun ${elevationText} below horizon) - sky is getting dark enough that very bright rockets may become visible, especially GTO missions going ${trajectory.toLowerCase()}.`;
        
      case 'astronomical':
        return `🌌 Astronomical twilight launch (sun ${elevationText} below horizon) - good viewing conditions! Look for a bright moving star going ${trajectory.toLowerCase()} from Florida. Start watching 6-8 minutes after liftoff.`;
        
      case 'night':
        if (trajectory === 'Southeast') {
          return `🌙 True night launch (sun ${elevationText} below horizon) - optimal viewing conditions! This GTO mission will travel southeast and should be very visible as a bright moving star. Start watching 6 minutes after liftoff.`;
        } else {
          return `🌙 True night launch (sun ${elevationText} below horizon) - excellent viewing conditions! Look for a bright moving star traveling ${trajectory.toLowerCase()} from Florida. Start watching 4-6 minutes after liftoff.`;
        }
        
      default:
        return `Launch visibility depends on lighting conditions and trajectory direction (${trajectory}).`;
    }
  }
  
  /**
   * Estimate viewing time window with twilight considerations
   */
  private static getViewingTimeWithTwilight(launch: Launch, twilightLevel: string): string {
    const trajectory = this.getTrajectoryDirection(launch);
    
    switch (twilightLevel) {
      case 'day':
        return 'Not visible during daylight hours';
        
      case 'civil':
        return 'Not visible during civil twilight - too bright';
        
      case 'nautical':
        if (trajectory === 'Southeast') {
          return 'Possibly visible for 1-2 minutes starting ~7-8 minutes after liftoff if very bright';
        }
        return 'Unlikely to be visible during nautical twilight';
        
      case 'astronomical':
        if (trajectory === 'Southeast') {
          return 'Visible for 2-3 minutes starting ~6-7 minutes after liftoff';
        }
        return 'Visible for 1-2 minutes starting ~5-6 minutes after liftoff';
        
      case 'night':
        if (trajectory === 'Southeast') {
          return 'Visible for 3-5 minutes starting ~6 minutes after liftoff';
        }
        return 'Visible for 2-4 minutes starting ~4-6 minutes after liftoff';
        
      default:
        return 'Viewing window depends on lighting conditions';
    }
  }
}