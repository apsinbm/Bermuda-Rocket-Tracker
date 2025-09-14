/**
 * Delay Scenario Testing Utilities
 * 
 * Comprehensive testing framework for delay impact scenarios.
 * Validates visibility calculations across different time conditions.
 * Ensures accurate impact assessments for all delay types.
 */

import { LaunchWithDelayTracking, DelayImpactAnalysis, Launch } from '../types';
import { DelayImpactAnalyzer } from '../services/delayImpactAnalyzer';

// Test scenarios covering all critical delay patterns
export interface DelayTestScenario {
  name: string;
  description: string;
  originalTime: string;
  delayedTime: string;
  expectedImpact: 'VISIBILITY_IMPROVED' | 'VISIBILITY_DEGRADED' | 'WINDOW_GAINED' | 'WINDOW_LOST' | 'MINOR_CHANGE' | 'NO_IMPACT';
  expectedSeverity: 'critical' | 'significant' | 'minor' | 'none';
  category: 'day_to_night' | 'night_to_day' | 'optimal_shift' | 'window_loss' | 'minor_adjustment' | 'advance';
}

// Comprehensive test scenarios for Bermuda visibility
export const DELAY_TEST_SCENARIOS: DelayTestScenario[] = [
  // Day → Night launches (VISIBILITY IMPROVES)
  {
    name: 'Afternoon Day to Evening Twilight',
    description: 'Launch delayed from bright afternoon to optimal evening twilight',
    originalTime: '2025-09-15T19:00:00.000Z', // 3 PM local (daylight)
    delayedTime: '2025-09-15T23:00:00.000Z',   // 7 PM local (twilight)
    expectedImpact: 'VISIBILITY_IMPROVED',
    expectedSeverity: 'significant',
    category: 'day_to_night'
  },
  {
    name: 'Late Morning to Dawn',
    description: 'Launch delayed from late morning to optimal dawn conditions',
    originalTime: '2025-09-15T14:00:00.000Z', // 10 AM local (daylight)
    delayedTime: '2025-09-16T09:00:00.000Z',   // 5 AM next day (dawn)
    expectedImpact: 'VISIBILITY_IMPROVED',
    expectedSeverity: 'significant',
    category: 'day_to_night'
  },
  
  // Night → Day launches (VISIBILITY DEGRADES)
  {
    name: 'Dawn to Morning Daylight',
    description: 'Launch delayed from optimal dawn to bright morning',
    originalTime: '2025-09-15T09:00:00.000Z', // 5 AM local (dawn)
    delayedTime: '2025-09-15T13:00:00.000Z',  // 9 AM local (daylight)
    expectedImpact: 'VISIBILITY_DEGRADED',
    expectedSeverity: 'significant',
    category: 'night_to_day'
  },
  {
    name: 'Evening Twilight to Next Day',
    description: 'Launch delayed from evening twilight to next afternoon',
    originalTime: '2025-09-15T23:30:00.000Z', // 7:30 PM local (twilight)
    delayedTime: '2025-09-16T18:00:00.000Z',  // 2 PM next day (daylight)
    expectedImpact: 'VISIBILITY_DEGRADED',
    expectedSeverity: 'critical',
    category: 'night_to_day'
  },
  
  // Window Gained scenarios
  {
    name: 'Late Night to Early Morning',
    description: 'Launch moved from deep night (invisible) to dawn (visible)',
    originalTime: '2025-09-15T06:00:00.000Z', // 2 AM local (deep night)
    delayedTime: '2025-09-15T10:00:00.000Z',  // 6 AM local (dawn)
    expectedImpact: 'WINDOW_GAINED',
    expectedSeverity: 'significant',
    category: 'window_loss'
  },
  
  // Window Lost scenarios
  {
    name: 'Dawn to Deep Night',
    description: 'Launch delayed from dawn (visible) to deep night (invisible)',
    originalTime: '2025-09-15T09:00:00.000Z', // 5 AM local (dawn)
    delayedTime: '2025-09-15T04:00:00.000Z',  // 12 AM local (deep night)
    expectedImpact: 'WINDOW_LOST',
    expectedSeverity: 'critical',
    category: 'window_loss'
  },
  
  // Optimal window shifts
  {
    name: 'Optimal to Sub-optimal Twilight',
    description: 'Launch delayed within twilight period but to less optimal time',
    originalTime: '2025-09-15T23:00:00.000Z', // 7 PM local (optimal twilight)
    delayedTime: '2025-09-16T02:00:00.000Z',  // 10 PM local (late twilight)
    expectedImpact: 'MINOR_CHANGE',
    expectedSeverity: 'minor',
    category: 'optimal_shift'
  },
  
  // Minor adjustments
  {
    name: 'Small Dawn Window Shift',
    description: 'Minor delay within same dawn window',
    originalTime: '2025-09-15T09:00:00.000Z', // 5:00 AM local
    delayedTime: '2025-09-15T09:15:00.000Z',  // 5:15 AM local
    expectedImpact: 'NO_IMPACT',
    expectedSeverity: 'none',
    category: 'minor_adjustment'
  },
  {
    name: 'Small Twilight Adjustment',
    description: 'Minor delay within same twilight window',
    originalTime: '2025-09-15T23:00:00.000Z', // 7:00 PM local
    delayedTime: '2025-09-15T23:20:00.000Z',  // 7:20 PM local  
    expectedImpact: 'NO_IMPACT',
    expectedSeverity: 'none',
    category: 'minor_adjustment'
  },
  
  // Launch advances (moved earlier)
  {
    name: 'Daylight Moved to Dawn',
    description: 'Launch moved earlier from daylight to dawn',
    originalTime: '2025-09-15T15:00:00.000Z', // 11 AM local (daylight)
    delayedTime: '2025-09-15T10:00:00.000Z',  // 6 AM local (dawn)
    expectedImpact: 'VISIBILITY_IMPROVED',
    expectedSeverity: 'significant',
    category: 'advance'
  },
  
  // Seasonal variations
  {
    name: 'Winter Daylight Hours',
    description: 'Test during winter with shorter daylight (December)',
    originalTime: '2025-12-15T18:00:00.000Z', // 2 PM local winter
    delayedTime: '2025-12-15T22:00:00.000Z',  // 6 PM local winter  
    expectedImpact: 'VISIBILITY_IMPROVED',
    expectedSeverity: 'significant',
    category: 'day_to_night'
  },
  {
    name: 'Summer Daylight Hours',
    description: 'Test during summer with longer daylight (June)',
    originalTime: '2025-06-15T20:00:00.000Z', // 4 PM local summer
    delayedTime: '2025-06-16T00:00:00.000Z',  // 8 PM local summer
    expectedImpact: 'VISIBILITY_IMPROVED',
    expectedSeverity: 'minor',
    category: 'day_to_night'
  }
];

// Results from scenario testing
export interface DelayTestResult {
  scenario: DelayTestScenario;
  analysis: DelayImpactAnalysis;
  passed: boolean;
  issues: string[];
  executionTime: number;
  details: {
    impactMatched: boolean;
    severityMatched: boolean;
    reasonableVisibilityChange: boolean;
    messageQuality: string;
  };
}

export class DelayScenarioTester {
  
  /**
   * Run all delay scenarios and validate results
   */
  static async runAllScenarios(): Promise<DelayTestResult[]> {
    
    const results: DelayTestResult[] = [];
    
    for (const scenario of DELAY_TEST_SCENARIOS) {
      const result = await this.runSingleScenario(scenario);
      results.push(result);
    }
    
    // Generate summary
    this.logTestSummary(results);
    
    return results;
  }
  
  /**
   * Run a single delay scenario
   */
  static async runSingleScenario(scenario: DelayTestScenario): Promise<DelayTestResult> {
    const startTime = Date.now();
    const issues: string[] = [];
    
    try {
      // Create mock launch for testing
      const mockLaunch = this.createMockLaunch(scenario.originalTime);
      
      // Run delay impact analysis
      const analysis = await DelayImpactAnalyzer.compareScenarios(
        mockLaunch,
        scenario.delayedTime,
        scenario.description
      );
      
      // Validate results
      const impactMatched = analysis.impact === scenario.expectedImpact;
      const severityMatched = analysis.severity === scenario.expectedSeverity;
      
      if (!impactMatched) {
        issues.push(`Impact mismatch: expected ${scenario.expectedImpact}, got ${analysis.impact}`);
      }
      
      if (!severityMatched) {
        issues.push(`Severity mismatch: expected ${scenario.expectedSeverity}, got ${analysis.severity}`);
      }
      
      // Validate visibility change is reasonable
      const reasonableVisibilityChange = this.validateVisibilityChange(analysis, scenario);
      if (!reasonableVisibilityChange) {
        issues.push('Visibility change seems unreasonable for this scenario');
      }
      
      // Assess message quality
      const messageQuality = this.assessMessageQuality(analysis.userMessage);
      
      const executionTime = Date.now() - startTime;
      
      return {
        scenario,
        analysis,
        passed: issues.length === 0,
        issues,
        executionTime,
        details: {
          impactMatched,
          severityMatched,
          reasonableVisibilityChange,
          messageQuality
        }
      };
      
    } catch (error) {
      const executionTime = Date.now() - startTime;
      console.error(`[DelayTesting] Error in scenario ${scenario.name}:`, error);
      
      return {
        scenario,
        analysis: this.createErrorAnalysis(),
        passed: false,
        issues: [`Execution error: ${error}`],
        executionTime,
        details: {
          impactMatched: false,
          severityMatched: false,
          reasonableVisibilityChange: false,
          messageQuality: 'error'
        }
      };
    }
  }
  
  /**
   * Create mock launch for testing
   */
  private static createMockLaunch(launchTime: string): LaunchWithDelayTracking {
    const baseLaunch: Launch = {
      id: `test-launch-${Date.now()}`,
      name: 'Test Launch',
      rocket: {
        name: 'Falcon 9'
      },
      launch_service_provider: {
        name: 'SpaceX'
      },
      pad: {
        name: 'LC-39A',
        latitude: '28.6080',
        longitude: '-80.6040',
        location: {
          name: 'Kennedy Space Center',
          latitude: 28.6080,
          longitude: -80.6040
        }
      },
      net: launchTime,
      mission: {
        name: 'Test Mission',
        orbit: {
          name: 'LEO'
        }
      },
      status: {
        name: 'Go',
        abbrev: 'Go'
      }
    };
    
    return {
      ...baseLaunch,
      // Mock visibility data for testing
      visibility: {
        likelihood: 'medium',
        reason: 'Test scenario - calculated visibility',
        bearing: 225,
        trajectoryDirection: 'Southeast',
        estimatedTimeVisible: '3-4 minutes',
        trajectoryImageUrl: undefined
      },
      bermudaTime: `Test Launch Time - ${launchTime}`,
      originalNet: launchTime,
      currentNet: launchTime,
      lastUpdated: new Date(),
      delayHistory: [],
      scheduleStatus: 'on-time',
      pollingFrequency: 300000,
      lastPolled: new Date(),
      priorityLevel: 'medium'
    };
  }
  
  /**
   * Validate that visibility change is reasonable for the scenario
   */
  private static validateVisibilityChange(
    analysis: DelayImpactAnalysis,
    scenario: DelayTestScenario
  ): boolean {
    
    const oldLikelihood = analysis.oldVisibility.likelihood;
    const newLikelihood = analysis.newVisibility.likelihood;
    const oldPhase = analysis.oldVisibility.solarConditions.twilightPhase;
    const newPhase = analysis.newVisibility.solarConditions.twilightPhase;
    
    switch (scenario.category) {
      case 'day_to_night':
        // Should improve visibility when moving from day to night
        return (oldPhase === 'day' || oldPhase === 'civil') && 
               (newPhase === 'nautical' || newPhase === 'astronomical' || newPhase === 'night') &&
               this.isVisibilityImprovement(oldLikelihood, newLikelihood);
               
      case 'night_to_day':
        // Should degrade visibility when moving from night to day
        return (oldPhase === 'night' || oldPhase === 'astronomical' || oldPhase === 'nautical') &&
               (newPhase === 'day' || newPhase === 'civil') &&
               this.isVisibilityDegradation(oldLikelihood, newLikelihood);
               
      case 'minor_adjustment':
        // Should have minimal impact
        return oldPhase === newPhase && oldLikelihood === newLikelihood;
        
      default:
        return true; // Don't validate complex scenarios automatically
    }
  }
  
  /**
   * Check if visibility improved
   */
  private static isVisibilityImprovement(
    oldLikelihood: string,
    newLikelihood: string
  ): boolean {
    const order = { 'none': 0, 'low': 1, 'medium': 2, 'high': 3 };
    return order[newLikelihood as keyof typeof order] > order[oldLikelihood as keyof typeof order];
  }
  
  /**
   * Check if visibility degraded
   */
  private static isVisibilityDegradation(
    oldLikelihood: string,
    newLikelihood: string
  ): boolean {
    const order = { 'none': 0, 'low': 1, 'medium': 2, 'high': 3 };
    return order[newLikelihood as keyof typeof order] < order[oldLikelihood as keyof typeof order];
  }
  
  /**
   * Assess quality of user message
   */
  private static assessMessageQuality(message: string): string {
    if (!message || message.length < 10) {
      return 'poor';
    }
    
    // Check for key elements - simplified regex patterns for safety
    const hasEmoji = /🚀|📡|🛰️|🌟|⭐/.test(message);
    const hasTimeInfo = /\d+.*minutes?|hour/i.test(message);
    const hasVisibilityInfo = /visibility|viewing|window/i.test(message);
    const hasActionable = /check|look|watch|updated/i.test(message);
    
    let score = 0;
    if (hasEmoji) score++;
    if (hasTimeInfo) score++;
    if (hasVisibilityInfo) score++;
    if (hasActionable) score++;
    
    if (score >= 3) return 'excellent';
    if (score >= 2) return 'good';
    if (score >= 1) return 'fair';
    return 'poor';
  }
  
  /**
   * Create error analysis for failed scenarios
   */
  private static createErrorAnalysis(): DelayImpactAnalysis {
    const errorVisibility = {
      likelihood: 'low' as const,
      reason: 'Error during calculation',
      bearing: 0,
      trajectoryDirection: 'Unknown' as const,
      estimatedTimeVisible: 'Unknown',
      dataSource: 'estimated' as const,
      solarConditions: {
        sunElevation: 0,
        sunAzimuth: 0,
        twilightPhase: 'day' as const,
        illuminationConditions: 'poor' as const,
        rocketSunlit: false,
        groundDarkness: false
      },
      governmentDataUsed: false,
      lastCalculated: new Date(),
      validationStatus: {
        isValid: false,
        warnings: ['Calculation error'],
        dataQuality: 'poor' as const
      }
    };
    
    return {
      impact: 'UNKNOWN_IMPACT',
      severity: 'minor',
      oldVisibility: errorVisibility,
      newVisibility: errorVisibility,
      summary: 'Error during analysis',
      userMessage: 'Unable to analyze delay impact',
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
   * Log test summary
   */
  private static logTestSummary(results: DelayTestResult[]): void {
    const totalTests = results.length;
    const passedTests = results.filter(r => r.passed).length;
    const failedTests = totalTests - passedTests;
    
    const avgExecutionTime = results.reduce((sum, r) => sum + r.executionTime, 0) / totalTests;
    
    
    // Log failed tests
    const failedResults = results.filter(r => !r.passed);
    if (failedResults.length > 0) {
      failedResults.forEach(result => {
      });
    }
    
    // Log performance insights
    const slowTests = results.filter(r => r.executionTime > 1000);
    if (slowTests.length > 0) {
      slowTests.forEach(result => {
      });
    }
    
  }
  
  /**
   * Run scenarios by category
   */
  static async runScenariosByCategory(category: DelayTestScenario['category']): Promise<DelayTestResult[]> {
    const scenarios = DELAY_TEST_SCENARIOS.filter(s => s.category === category);
    
    const results: DelayTestResult[] = [];
    for (const scenario of scenarios) {
      const result = await this.runSingleScenario(scenario);
      results.push(result);
    }
    
    return results;
  }
  
  /**
   * Create custom scenario for testing
   */
  static async testCustomScenario(
    name: string,
    originalTime: string,
    delayedTime: string,
    expectedImpact?: DelayTestScenario['expectedImpact']
  ): Promise<DelayTestResult> {
    
    const customScenario: DelayTestScenario = {
      name,
      description: `Custom scenario: ${name}`,
      originalTime,
      delayedTime,
      expectedImpact: expectedImpact || 'MINOR_CHANGE',
      expectedSeverity: 'minor',
      category: 'minor_adjustment'
    };
    
    return this.runSingleScenario(customScenario);
  }
}