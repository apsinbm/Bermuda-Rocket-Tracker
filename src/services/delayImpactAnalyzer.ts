/**
 * Delay Impact Analyzer
 * 
 * Analyzes how launch schedule delays affect visibility from Bermuda.
 * Recalculates visibility conditions using enhanced solar position data
 * and provides clear impact assessments for users.
 * 
 * Critical scenarios handled:
 * - Day → Night launches (visibility improves)  
 * - Night → Day launches (visibility degrades)
 * - Optimal → Suboptimal windows
 * - Window timing shifts
 */

import { 
  LaunchWithDelayTracking, 
  DelayImpact, 
  DelayImpactAnalysis, 
  EnhancedVisibilityData,
  ScheduleChangeResult,
  Launch 
} from '../types';
import { calculateVisibility } from './visibilityService';
import { SolarPositionCalculator } from './solarPositionCalculator';
import { VisibilityFormatter } from '../utils/visibilityFormatter';

export class DelayImpactAnalyzer {

  /**
   * Calculate enhanced visibility data using core service + solar conditions
   */
  private static async calculateEnhancedVisibility(launch: Launch): Promise<EnhancedVisibilityData> {
    // Get basic visibility data
    const basicVisibility = await calculateVisibility(launch);
    
    // Calculate solar conditions
    const launchTime = new Date(launch.net);
    const solarData = SolarPositionCalculator.calculateSolarPosition(launchTime, 32.3078, -64.7505);
    
    // Determine twilight phase and illumination conditions
    let twilightPhase: 'day' | 'civil' | 'nautical' | 'astronomical' | 'night';
    let illuminationConditions: 'optimal' | 'good' | 'fair' | 'poor';
    
    if (solarData.elevation > 0) {
      twilightPhase = 'day';
      illuminationConditions = 'poor'; // Day launches are less visible
    } else if (solarData.elevation > -6) {
      twilightPhase = 'civil';
      illuminationConditions = 'good';
    } else if (solarData.elevation > -12) {
      twilightPhase = 'nautical';
      illuminationConditions = 'optimal';
    } else if (solarData.elevation > -18) {
      twilightPhase = 'astronomical';
      illuminationConditions = 'optimal';
    } else {
      twilightPhase = 'night';
      illuminationConditions = 'optimal';
    }
    
    // Determine rocket sunlit status and ground darkness
    const rocketSunlit = solarData.elevation > -6; // Rocket visible if sun not too far below horizon
    const groundDarkness = solarData.elevation < 0; // Ground is dark when sun is below horizon
    
    return {
      ...basicVisibility,
      solarConditions: {
        sunElevation: solarData.elevation,
        sunAzimuth: solarData.azimuth,
        twilightPhase,
        illuminationConditions,
        rocketSunlit,
        groundDarkness
      },
      governmentDataUsed: false, // We're using basic calculations
      lastCalculated: new Date(),
      validationStatus: {
        isValid: true,
        warnings: [],
        dataQuality: 'good'
      }
    };
  }

  /**
   * Analyze how a schedule change affects launch visibility
   */
  static async analyzeDelayImpact(
    launch: LaunchWithDelayTracking,
    scheduleChange: ScheduleChangeResult
  ): Promise<DelayImpactAnalysis> {
    
    
    try {
      // Calculate visibility for both old and new times
      const [oldVisibility, newVisibility] = await Promise.all([
        this.calculateVisibilityForTime(launch, scheduleChange.oldLaunch.net),
        this.calculateEnhancedVisibility(launch)
      ]);

      // Analyze the differences
      const impact = this.determineImpactType(oldVisibility, newVisibility, scheduleChange);
      const severity = this.assessSeverity(impact, oldVisibility, newVisibility, scheduleChange);
      const visibilityChange = this.analyzeVisibilityChanges(oldVisibility, newVisibility);
      
      // Generate user-friendly messages
      const summary = this.generateSummary(impact, severity, oldVisibility, newVisibility);
      const userMessage = this.generateUserMessage(impact, severity, scheduleChange, oldVisibility, newVisibility);
      const shouldNotify = this.shouldNotifyUser(impact, severity, visibilityChange);

      
      return {
        impact,
        severity,
        oldVisibility,
        newVisibility,
        summary,
        userMessage,
        shouldNotify,
        visibilityChange
      };

    } catch (error) {
      console.error(`[DelayImpact] Error analyzing delay impact for ${launch.name}:`, error);
      
      // Return fallback analysis
      return this.createFallbackAnalysis(launch, scheduleChange);
    }
  }

  /**
   * Calculate visibility for a specific time (used for old time comparison)
   */
  private static async calculateVisibilityForTime(
    launch: LaunchWithDelayTracking, 
    launchTimeString: string
  ): Promise<EnhancedVisibilityData> {
    
    // Create a temporary launch object with the old time
    const tempLaunch = {
      ...launch,
      net: launchTimeString
    };
    
    return await this.calculateEnhancedVisibility(tempLaunch);
  }

  /**
   * Determine the type of impact based on visibility changes
   */
  private static determineImpactType(
    oldVisibility: EnhancedVisibilityData,
    newVisibility: EnhancedVisibilityData,
    scheduleChange: ScheduleChangeResult
  ): DelayImpact {
    
    // Handle scrubs first
    if (scheduleChange.changeType === 'scrub') {
      return 'WINDOW_LOST';
    }

    const oldLikelihood = oldVisibility.likelihood;
    const newLikelihood = newVisibility.likelihood;
    
    // Check for window gain/loss
    if (oldLikelihood === 'none' && newLikelihood !== 'none') {
      return 'WINDOW_GAINED';
    }
    
    if (oldLikelihood !== 'none' && newLikelihood === 'none') {
      return 'WINDOW_LOST';
    }
    
    // Check for visibility improvements/degradations
    const likelihoodOrder = { 'none': 0, 'low': 1, 'medium': 2, 'high': 3 };
    const oldScore = likelihoodOrder[oldLikelihood];
    const newScore = likelihoodOrder[newLikelihood];
    
    if (newScore > oldScore) {
      // Check if it's a significant improvement
      const scoreDiff = newScore - oldScore;
      if (scoreDiff >= 2 || (oldLikelihood === 'low' && newLikelihood === 'high')) {
        return 'VISIBILITY_IMPROVED';
      } else {
        return 'MINOR_CHANGE';
      }
    }
    
    if (newScore < oldScore) {
      // Check if it's a significant degradation
      const scoreDiff = oldScore - newScore;
      if (scoreDiff >= 2 || (oldLikelihood === 'high' && newLikelihood === 'low')) {
        return 'VISIBILITY_DEGRADED';
      } else {
        return 'MINOR_CHANGE';
      }
    }
    
    // Check for changes in illumination conditions even if likelihood is same
    if (this.hasSignificantConditionChanges(oldVisibility, newVisibility)) {
      return 'MINOR_CHANGE';
    }
    
    return 'NO_IMPACT';
  }

  /**
   * Check for significant changes in solar/illumination conditions
   */
  private static hasSignificantConditionChanges(
    oldVisibility: EnhancedVisibilityData,
    newVisibility: EnhancedVisibilityData
  ): boolean {
    const oldConditions = oldVisibility.solarConditions;
    const newConditions = newVisibility.solarConditions;
    
    // Check for twilight phase changes
    if (oldConditions.twilightPhase !== newConditions.twilightPhase) {
      return true;
    }
    
    // Check for illumination condition changes
    if (oldConditions.illuminationConditions !== newConditions.illuminationConditions) {
      return true;
    }
    
    // Check for rocket illumination changes
    if (oldConditions.rocketSunlit !== newConditions.rocketSunlit) {
      return true;
    }
    
    // Check for ground darkness changes
    if (oldConditions.groundDarkness !== newConditions.groundDarkness) {
      return true;
    }
    
    return false;
  }

  /**
   * Assess severity of the impact
   */
  private static assessSeverity(
    impact: DelayImpact,
    oldVisibility: EnhancedVisibilityData,
    newVisibility: EnhancedVisibilityData,
    scheduleChange: ScheduleChangeResult
  ): 'critical' | 'significant' | 'minor' | 'none' {
    
    switch (impact) {
      case 'WINDOW_LOST':
        return 'critical';
        
      case 'WINDOW_GAINED':
        return 'significant';
        
      case 'VISIBILITY_DEGRADED':
        // Critical if going from high to none/low
        if (oldVisibility.likelihood === 'high' && 
           (newVisibility.likelihood === 'none' || newVisibility.likelihood === 'low')) {
          return 'critical';
        }
        return 'significant';
        
      case 'VISIBILITY_IMPROVED':
        // Significant if going from none/low to high
        if ((oldVisibility.likelihood === 'none' || oldVisibility.likelihood === 'low') &&
            newVisibility.likelihood === 'high') {
          return 'significant';
        }
        return 'minor';
        
      case 'MINOR_CHANGE':
        return 'minor';
        
      case 'NO_IMPACT':
        return 'none';
        
      default:
        return 'minor';
    }
  }

  /**
   * Analyze specific visibility changes
   */
  private static analyzeVisibilityChanges(
    oldVisibility: EnhancedVisibilityData,
    newVisibility: EnhancedVisibilityData
  ): DelayImpactAnalysis['visibilityChange'] {
    
    return {
      likelihoodChanged: oldVisibility.likelihood !== newVisibility.likelihood,
      conditionsChanged: this.hasSignificantConditionChanges(oldVisibility, newVisibility),
      timingChanged: this.hasTimingChanges(oldVisibility, newVisibility),
      qualityChanged: oldVisibility.validationStatus.dataQuality !== newVisibility.validationStatus.dataQuality
    };
  }

  /**
   * Check for changes in viewing timing
   */
  private static hasTimingChanges(
    oldVisibility: EnhancedVisibilityData,
    newVisibility: EnhancedVisibilityData
  ): boolean {
    const oldWindow = oldVisibility.visibilityWindow;
    const newWindow = newVisibility.visibilityWindow;
    
    if (!oldWindow || !newWindow) {
      return oldWindow !== newWindow; // One has window, other doesn't
    }
    
    // Check for significant timing changes (> 2 minutes)
    const timeDiff = Math.abs(oldWindow.peakVisibilityTime - newWindow.peakVisibilityTime);
    return timeDiff > 120; // 2 minutes
  }

  /**
   * Generate technical summary
   */
  private static generateSummary(
    impact: DelayImpact,
    severity: DelayImpactAnalysis['severity'],
    oldVisibility: EnhancedVisibilityData,
    newVisibility: EnhancedVisibilityData
  ): string {
    
    const summaryParts: string[] = [];
    
    // Impact description
    const impactDescriptions = {
      'VISIBILITY_IMPROVED': 'Launch delay improved visibility conditions',
      'VISIBILITY_DEGRADED': 'Launch delay reduced visibility conditions',
      'WINDOW_GAINED': 'Launch delay moved launch into visible window',
      'WINDOW_LOST': 'Launch delay/scrub removed viewing opportunity',
      'MINOR_CHANGE': 'Launch delay caused minor visibility changes',
      'NO_IMPACT': 'Launch delay had no significant visibility impact',
      'UNKNOWN_IMPACT': 'Unable to determine visibility impact'
    };
    
    summaryParts.push(impactDescriptions[impact] || 'Launch timing changed');
    
    // Likelihood change
    if (oldVisibility.likelihood !== newVisibility.likelihood) {
      summaryParts.push(`Likelihood: ${oldVisibility.likelihood} → ${newVisibility.likelihood}`);
    }
    
    // Solar condition changes
    const oldPhase = oldVisibility.solarConditions.twilightPhase;
    const newPhase = newVisibility.solarConditions.twilightPhase;
    if (oldPhase !== newPhase) {
      summaryParts.push(`Solar conditions: ${oldPhase} → ${newPhase}`);
    }
    
    return summaryParts.join('. ');
  }

  /**
   * Generate user-friendly message
   */
  private static generateUserMessage(
    impact: DelayImpact,
    severity: DelayImpactAnalysis['severity'],
    scheduleChange: ScheduleChangeResult,
    oldVisibility: EnhancedVisibilityData,
    newVisibility: EnhancedVisibilityData
  ): string {
    
    const delayMinutes = Math.abs(scheduleChange.changes.delayMinutes);
    const delayHours = Math.floor(delayMinutes / 60);
    const remainingMinutes = delayMinutes % 60;
    
    let delayText = '';
    if (delayHours > 0) {
      delayText = `${delayHours}h ${remainingMinutes}m`;
    } else {
      delayText = `${delayMinutes} minutes`;
    }
    
    const delayDirection = scheduleChange.changes.delayMinutes > 0 ? 'delayed' : 'moved earlier';
    
    switch (impact) {
      case 'VISIBILITY_IMPROVED':
        return `🎉 Great news! The ${delayText} delay actually improves your viewing opportunity. ` +
               `Visibility upgraded from ${oldVisibility.likelihood.toUpperCase()} to ${newVisibility.likelihood.toUpperCase()}. ` +
               `The new launch time falls in a better viewing window.`;
               
      case 'VISIBILITY_DEGRADED':
        return `⚠️ The ${delayText} delay reduces visibility conditions. ` +
               `Visibility downgraded from ${oldVisibility.likelihood.toUpperCase()} to ${newVisibility.likelihood.toUpperCase()}. ` +
               `The new timing is less favorable for viewing from Bermuda.`;
               
      case 'WINDOW_GAINED':
        return `✅ Excellent! The delay moved this launch into a visible window. ` +
               `What was previously not visible (${oldVisibility.likelihood}) is now ${newVisibility.likelihood.toUpperCase()} visibility. ` +
               `Check the updated viewing instructions.`;
               
      case 'WINDOW_LOST':
        if (scheduleChange.changeType === 'scrub') {
          return `❌ Launch has been scrubbed. This viewing opportunity is no longer available.`;
        }
        return `❌ Unfortunately, the ${delayText} delay moves this launch outside the visible window. ` +
               `Visibility changed from ${oldVisibility.likelihood.toUpperCase()} to not visible.`;
               
      case 'MINOR_CHANGE':
        return `📋 Launch ${delayDirection} by ${delayText}. ` +
               `Visibility remains ${newVisibility.likelihood.toUpperCase()} but viewing conditions have changed slightly. ` +
               `Check updated timing details.`;
               
      case 'NO_IMPACT':
        return `ℹ️ Launch ${delayDirection} by ${delayText}, but visibility conditions remain unchanged. ` +
               `Still ${newVisibility.likelihood.toUpperCase()} visibility from Bermuda.`;
               
      default:
        return `📡 Launch schedule changed. Please check updated visibility conditions.`;
    }
  }

  /**
   * Determine if user should be notified
   */
  private static shouldNotifyUser(
    impact: DelayImpact,
    severity: DelayImpactAnalysis['severity'],
    visibilityChange: DelayImpactAnalysis['visibilityChange']
  ): boolean {
    
    // Always notify for critical impacts
    if (severity === 'critical') {
      return true;
    }
    
    // Always notify for window gained/lost
    if (impact === 'WINDOW_GAINED' || impact === 'WINDOW_LOST') {
      return true;
    }
    
    // Always notify for significant visibility changes
    if (impact === 'VISIBILITY_IMPROVED' || impact === 'VISIBILITY_DEGRADED') {
      return true;
    }
    
    // Notify for significant changes
    if (severity === 'significant') {
      return true;
    }
    
    // Notify for likelihood changes
    if (visibilityChange.likelihoodChanged) {
      return true;
    }
    
    // Don't notify for minor changes or no impact
    return false;
  }

  /**
   * Create fallback analysis when calculation fails
   */
  private static createFallbackAnalysis(
    launch: LaunchWithDelayTracking,
    scheduleChange: ScheduleChangeResult
  ): DelayImpactAnalysis {
    
    console.warn(`[DelayImpact] Creating fallback analysis for ${launch.name}`);
    
    // Create minimal visibility data for fallback
    const createFallbackVisibility = (timeString: string): EnhancedVisibilityData => ({
      likelihood: 'low',
      reason: 'Unable to calculate visibility due to system error',
      bearing: 240, // Rough bearing to Florida from Bermuda
      trajectoryDirection: 'Southeast',
      estimatedTimeVisible: 'Unknown',
      dataSource: 'estimated',
      solarConditions: {
        sunElevation: 0,
        sunAzimuth: 180,
        twilightPhase: 'day',
        illuminationConditions: 'poor',
        rocketSunlit: false,
        groundDarkness: false
      },
      governmentDataUsed: false,
      lastCalculated: new Date(),
      validationStatus: {
        isValid: false,
        warnings: ['System error - unable to calculate accurate visibility'],
        dataQuality: 'poor'
      }
    });
    
    return {
      impact: 'UNKNOWN_IMPACT',
      severity: 'minor',
      oldVisibility: createFallbackVisibility(scheduleChange.oldLaunch.net),
      newVisibility: createFallbackVisibility(launch.net),
      summary: 'Unable to analyze visibility impact due to calculation error',
      userMessage: `Launch schedule changed but we're unable to calculate the visibility impact at this time. Please check conditions manually.`,
      shouldNotify: false,
      visibilityChange: {
        likelihoodChanged: false,
        conditionsChanged: false,
        timingChanged: false,
        qualityChanged: false
      }
    };
  }

  /**
   * Compare two launches for impact testing
   */
  static async compareScenarios(
    baseLaunch: LaunchWithDelayTracking,
    delayedTime: string,
    description: string = 'Scenario comparison'
  ): Promise<DelayImpactAnalysis> {
    
    
    // Create fake schedule change for comparison
    const fakeScheduleChange: ScheduleChangeResult = {
      hasChanged: true,
      changeType: 'delay',
      severity: 'significant',
      oldLaunch: {
        id: baseLaunch.id,
        name: baseLaunch.name || baseLaunch.mission?.name || 'Unknown Launch',
        net: baseLaunch.net,
        status: {
          id: (baseLaunch.status as any).id || 1,
          name: baseLaunch.status.name
        },
        lastChecked: new Date(),
        checkCount: 1
      },
      newLaunch: {
        ...baseLaunch,
        net: delayedTime
      },
      changes: {
        netChanged: true,
        windowChanged: false,
        statusChanged: false,
        delayMinutes: (new Date(delayedTime).getTime() - new Date(baseLaunch.net).getTime()) / (1000 * 60)
      },
      confidence: 'high',
      recommendations: []
    };
    
    // Create delayed launch
    const delayedLaunch: LaunchWithDelayTracking = {
      ...baseLaunch,
      net: delayedTime,
      currentNet: delayedTime
    };
    
    return this.analyzeDelayImpact(delayedLaunch, fakeScheduleChange);
  }

  /**
   * Batch analyze multiple delay scenarios
   */
  static async batchAnalyzeScenarios(
    baseLaunch: LaunchWithDelayTracking,
    scenarios: Array<{ delayedTime: string; description: string }>
  ): Promise<Array<DelayImpactAnalysis & { description: string }>> {
    
    
    const results = await Promise.all(
      scenarios.map(async scenario => {
        const analysis = await this.compareScenarios(baseLaunch, scenario.delayedTime, scenario.description);
        return { ...analysis, description: scenario.description };
      })
    );
    
    return results;
  }
}