/**
 * Visibility Output Formatter
 * 
 * Formats enhanced visibility data for user-friendly display
 * Provides clear, actionable information about rocket launch visibility
 */

import { EnhancedVisibilityData } from '../types';
import { getBermudaTimeZone } from './bermudaTimeZone';

export interface FormattedVisibilityOutput {
  visible: boolean;
  visibilityText: string;
  confidence: 'high' | 'medium' | 'low' | 'unknown';
  viewingInstructions: {
    bestTime: string;
    direction: string;
    elevation: string;
    duration: string;
  };
  lightingConditions: string;
  sunPosition: string;
  launchTiming: string;
  dataSource: string;
  warnings: string[];
}

export class VisibilityFormatter {

  /**
   * Format enhanced visibility data into user-friendly output
   */
  static formatVisibility(
    enhancedData: EnhancedVisibilityData,
    launchTime: Date
  ): FormattedVisibilityOutput {
    
    const visible = enhancedData.likelihood !== 'none';
    const confidence = this.mapLikelihoodToConfidence(enhancedData.likelihood);
    const viewingInstructions = this.formatViewingInstructions(enhancedData, launchTime);
    const lightingConditions = this.formatLightingConditions(enhancedData.solarConditions);
    const sunPosition = this.formatSunPosition(enhancedData.solarConditions);
    const launchTiming = this.formatLaunchTiming(enhancedData.solarConditions, launchTime);
    const dataSource = this.formatDataSource(enhancedData);
    
    // Generate main visibility text
    const visibilityText = this.generateVisibilityText(
      visible,
      enhancedData.likelihood,
      confidence,
      enhancedData.validationStatus.dataQuality
    );

    return {
      visible,
      visibilityText,
      confidence,
      viewingInstructions,
      lightingConditions,
      sunPosition,
      launchTiming,
      dataSource,
      warnings: enhancedData.validationStatus.warnings
    };
  }

  /**
   * Generate main visibility text
   */
  private static generateVisibilityText(
    visible: boolean,
    likelihood: string,
    confidence: string,
    dataQuality: string
  ): string {
    if (!visible) {
      return `Visible: No - Launch not expected to be visible from Bermuda`;
    }

    const likelihoodMap: Record<string, string> = {
      'high': 'Yes - Excellent visibility expected',
      'medium': 'Likely - Good chance of visibility',
      'low': 'Possibly - Limited visibility expected',
      'none': 'No - Not visible from Bermuda'
    };
    const likelihoodText = likelihoodMap[likelihood] || 'Unknown visibility';

    const confidenceNote = confidence === 'high' ? ' (High confidence)' :
                           confidence === 'medium' ? ' (Moderate confidence)' :
                           confidence === 'low' ? ' (Low confidence - check closer to launch)' :
                           '';

    return `Visible: ${likelihoodText}${confidenceNote}`;
  }

  /**
   * Format viewing instructions
   */
  private static formatViewingInstructions(
    enhancedData: EnhancedVisibilityData,
    launchTime: Date
  ): FormattedVisibilityOutput['viewingInstructions'] {
    
    const window = enhancedData.visibilityWindow;
    
    if (!window) {
      return {
        bestTime: 'Unknown',
        direction: enhancedData.bearing ? `${Math.round(enhancedData.bearing)}° (${this.bearingToCompass(enhancedData.bearing)})` : 'Unknown',
        elevation: 'Look low on horizon',
        duration: 'Unknown'
      };
    }

    // Calculate best viewing time
    const bestTimeMinutes = Math.round(window.peakVisibilityTime / 60);
    const bestTimeDate = new Date(launchTime.getTime() + window.peakVisibilityTime * 1000);
    const bestTimeString = `${bestTimeMinutes} minutes after liftoff (${this.formatTime(bestTimeDate)})`;

    // Format direction
    const startBearing = Math.round(window.startBearing);
    const endBearing = Math.round(window.endBearing);
    const direction = startBearing === endBearing ? 
      `${startBearing}° (${this.bearingToCompass(startBearing)})` :
      `${startBearing}° to ${endBearing}° (${this.bearingToCompass(startBearing)} to ${this.bearingToCompass(endBearing)})`;

    // Estimate elevation based on distance and time
    const elevationAngle = this.estimateElevationAngle(window.closestApproach, window.peakVisibilityTime);
    const elevation = `${Math.round(elevationAngle)}° above horizon`;

    // Format duration
    const durationMinutes = Math.round(window.totalVisibleTime / 60);
    const duration = `${durationMinutes} minutes`;

    return {
      bestTime: bestTimeString,
      direction,
      elevation,
      duration
    };
  }

  /**
   * Format lighting conditions
   */
  private static formatLightingConditions(solarConditions: EnhancedVisibilityData['solarConditions']): string {
    const conditions = {
      'optimal': '🌟 Optimal - Perfect contrast between dark ground and sunlit rocket',
      'good': '👍 Good - Favorable lighting for rocket visibility',
      'fair': '⚠️ Fair - Marginal lighting conditions',
      'poor': '❌ Poor - Difficult viewing conditions'
    };

    const base = conditions[solarConditions.illuminationConditions] || 'Unknown conditions';
    
    // Add specific details
    const details: string[] = [];
    
    if (solarConditions.rocketSunlit && solarConditions.groundDarkness) {
      details.push('rocket illuminated while ground is dark');
    } else if (solarConditions.rocketSunlit && !solarConditions.groundDarkness) {
      details.push('rocket illuminated but sky may be bright');
    } else if (!solarConditions.rocketSunlit) {
      details.push('rocket may not be sunlit');
    }

    return details.length > 0 ? `${base} (${details.join(', ')})` : base;
  }

  /**
   * Format sun position information
   */
  private static formatSunPosition(solarConditions: EnhancedVisibilityData['solarConditions']): string {
    const elevation = solarConditions.sunElevation;
    const azimuth = solarConditions.sunAzimuth;

    // Describe sun position relative to horizon
    let positionDesc = '';
    if (elevation > 0) {
      positionDesc = `${Math.abs(Math.round(elevation))}° above horizon`;
    } else if (elevation > -6) {
      positionDesc = `${Math.abs(Math.round(elevation))}° below horizon (civil twilight)`;
    } else if (elevation > -12) {
      positionDesc = `${Math.abs(Math.round(elevation))}° below horizon (nautical twilight)`;
    } else if (elevation > -18) {
      positionDesc = `${Math.abs(Math.round(elevation))}° below horizon (astronomical twilight)`;
    } else {
      positionDesc = `${Math.abs(Math.round(elevation))}° below horizon (full night)`;
    }

    const direction = this.bearingToCompass(azimuth);
    
    return `Sun position: ${positionDesc} at ${Math.round(azimuth)}° (${direction})`;
  }

  /**
   * Format launch timing relative to sunset/sunrise
   */
  private static formatLaunchTiming(
    solarConditions: EnhancedVisibilityData['solarConditions'],
    launchTime: Date
  ): string {
    const phase = solarConditions.twilightPhase;
    const elevation = solarConditions.sunElevation;

    // Estimate minutes from sunset/sunrise based on sun elevation
    // Rough approximation: sun moves ~0.25° per minute near horizon
    const minutesFromHorizon = Math.abs(elevation) / 0.25;

    if (phase === 'day') {
      return 'Launch during daylight hours';
    } else if (phase === 'civil' || phase === 'nautical') {
      if (elevation < 0) {
        return `Launch ~${Math.round(minutesFromHorizon)} minutes after sunset`;
      } else {
        return `Launch ~${Math.round(minutesFromHorizon)} minutes before sunrise`;
      }
    } else if (phase === 'astronomical') {
      return 'Launch during astronomical twilight';
    } else {
      return 'Launch during full darkness';
    }
  }

  /**
   * Format data source information
   */
  private static formatDataSource(enhancedData: EnhancedVisibilityData): string {
    const sources: string[] = [];

    if (enhancedData.governmentDataUsed) {
      sources.push('USNO/Government solar data');
    }

    if (enhancedData.dataSource === 'flightclub') {
      sources.push('FlightClub trajectory data');
    } else if (enhancedData.dataSource === 'calculated') {
      sources.push('Calculated trajectory');
    } else {
      sources.push('Estimated trajectory');
    }

    const quality = enhancedData.validationStatus.dataQuality;
    const qualityMap: Record<string, string> = {
      'excellent': '(Excellent accuracy)',
      'good': '(Good accuracy)',
      'fair': '(Fair accuracy)',
      'poor': '(Limited accuracy)'
    };
    const qualityText = qualityMap[quality] || '';

    return `Data sources: ${sources.join(', ')} ${qualityText}`.trim();
  }

  /**
   * Map likelihood to confidence level
   */
  private static mapLikelihoodToConfidence(
    likelihood: string
  ): 'high' | 'medium' | 'low' | 'unknown' {
    switch (likelihood) {
      case 'high':
        return 'high';
      case 'medium':
        return 'medium';
      case 'low':
        return 'low';
      case 'none':
        return 'low';
      default:
        return 'unknown';
    }
  }

  /**
   * Convert bearing to compass direction
   */
  private static bearingToCompass(bearing: number): string {
    const directions = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE',
                       'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
    const index = Math.round(bearing / 22.5) % 16;
    return directions[index] || 'N';
  }

  /**
   * Estimate elevation angle based on distance and time
   */
  private static estimateElevationAngle(distance: number, timeSeconds: number): number {
    // Rough estimation based on typical rocket trajectories
    // Assumes rocket reaches ~100km altitude at 6 minutes
    const altitudeKm = Math.min(100, timeSeconds / 6 * 100);
    const elevationRad = Math.atan(altitudeKm / distance);
    return elevationRad * 180 / Math.PI;
  }

  /**
   * Format time for display
   */
  private static formatTime(date: Date): string {
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
      timeZone: 'Atlantic/Bermuda'
    }) + ' ' + getBermudaTimeZone(date);
  }

  /**
   * Generate summary text for display
   */
  static generateSummary(formatted: FormattedVisibilityOutput): string {
    const parts: string[] = [];

    // Main visibility
    parts.push(formatted.visibilityText);

    // Best viewing time
    if (formatted.visible && formatted.viewingInstructions.bestTime !== 'Unknown') {
      parts.push(`Best viewing: ${formatted.viewingInstructions.bestTime}`);
    }

    // Direction
    if (formatted.visible && formatted.viewingInstructions.direction !== 'Unknown') {
      parts.push(`Look ${formatted.viewingInstructions.direction}`);
    }

    // Duration
    if (formatted.visible && formatted.viewingInstructions.duration !== 'Unknown') {
      parts.push(`Duration: ${formatted.viewingInstructions.duration}`);
    }

    // Lighting
    parts.push(formatted.lightingConditions);

    // Sun position
    parts.push(formatted.sunPosition);

    // Launch timing
    parts.push(formatted.launchTiming);

    return parts.join('\n');
  }
}