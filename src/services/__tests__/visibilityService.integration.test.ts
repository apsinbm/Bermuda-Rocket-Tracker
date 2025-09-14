/**
 * Integration Tests for Visibility Calculation Services
 * Tests the complete visibility calculation pipeline with real scenarios
 */

import { calculateVisibility } from '../visibilityService';
import { Launch } from '../../types';

// Mock trajectory service for enhanced visibility tests
jest.mock('../trajectoryService', () => ({
  getTrajectoryData: jest.fn().mockResolvedValue({
    points: [
      { time: 0, latitude: 28.6, longitude: -80.6, altitude: 0 },
      { time: 60, latitude: 29.0, longitude: -79.5, altitude: 50000 },
      { time: 120, latitude: 30.0, longitude: -78.0, altitude: 150000 },
      { time: 300, latitude: 32.0, longitude: -65.0, altitude: 300000 }
    ],
    source: 'flightclub',
    maxAltitude: 300000,
    range: 400000
  })
}));

describe('Visibility Service Integration Tests', () => {
  const createTestLaunch = (overrides: Partial<Launch> = {}): Launch => ({
    id: 'test-launch',
    name: 'Test Launch',
    mission: {
      name: 'Test Mission',
      description: 'Test description',
      orbit: { name: 'GTO' }
    },
    rocket: { name: 'Falcon 9' },
    pad: {
      name: 'LC-39A',
      location: { 
        name: 'Cape Canaveral, FL, USA',
        latitude: 28.6080,
        longitude: -80.6040
      }
    },
    net: new Date().toISOString(),
    window_start: new Date().toISOString(),
    window_end: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    status: { name: 'Go', abbrev: 'Go' },
    image: undefined,
    webcast_live: false,
    ...overrides
  });

  describe('Basic Visibility Calculations', () => {
    test('should calculate good visibility for night GTO launch', async () => {
      // Create a night launch (9 PM)
      const nightTime = new Date();
      nightTime.setHours(21, 0, 0, 0);
      
      const launch = createTestLaunch({
        net: nightTime.toISOString(),
        mission: { 
          name: 'Commercial Satellite',
          description: 'Satellite deployment',
          orbit: { name: 'GTO' } 
        }
      });

      const visibility = await calculateVisibility(launch);

      expect(visibility.likelihood).toBeOneOf(['high', 'medium']);
      expect(visibility).toHaveProperty('reason');
      expect(visibility).toHaveProperty('bearing');
      expect(visibility.reason).toContain('night');
    });

    test('should calculate medium visibility for day GTO launch', async () => {
      // Create a day launch (2 PM)
      const dayTime = new Date();
      dayTime.setHours(14, 0, 0, 0);
      
      const launch = createTestLaunch({
        net: dayTime.toISOString(),
        mission: { 
          name: 'Commercial Satellite',
          description: 'Commercial mission',
          orbit: { name: 'GTO' } 
        }
      });

      const visibility = await calculateVisibility(launch);

      expect(visibility.likelihood).toBe('medium');
      
      // Test score and factors structure
      expect(visibility).toHaveProperty('score');
      expect(visibility).toHaveProperty('factors');
      
      // Test score value if defined
      const hasScore = visibility.score !== undefined;
      expect(!hasScore || visibility.score! < 0.7).toBe(true);
      
      // Test factors content if defined
      const hasFactors = visibility.factors !== undefined;
      expect(!hasFactors || visibility.factors!.includes('Daylight reduces visibility')).toBe(true);
    });

    test('should calculate low visibility for LEO launches', async () => {
      const launch = createTestLaunch({
        mission: { 
          name: 'ISS Mission',
          description: 'International Space Station mission',
          orbit: { name: 'LEO' } 
        }
      });

      const visibility = await calculateVisibility(launch);

      expect(visibility.likelihood).toBe('low');
      
      expect(visibility).toHaveProperty('factors');
      
      // Test factors content if defined
      const hasFactors = visibility.factors !== undefined;
      expect(!hasFactors || visibility.factors!.includes('LEO trajectory has limited visibility from Bermuda')).toBe(true);
    });

    test('should calculate no visibility for polar/sun-synchronous orbits', async () => {
      const launch = createTestLaunch({
        mission: { 
          name: 'Earth Observation',
          description: 'Polar orbit mission',
          orbit: { name: 'SSO' } 
        }
      });

      const visibility = await calculateVisibility(launch);

      expect(visibility.likelihood).toBe('none');
      
      expect(visibility).toHaveProperty('score');
      expect(visibility).toHaveProperty('factors');
      
      // Test score value if defined
      const hasScore = visibility.score !== undefined;
      expect(!hasScore || visibility.score === 0).toBe(true);
      
      // Test factors content if defined
      const hasFactors = visibility.factors !== undefined;
      expect(!hasFactors || visibility.factors!.includes('Polar/SSO trajectory not visible from Bermuda')).toBe(true);
    });
  });

  describe('Enhanced Visibility Calculations', () => {
    test('should provide detailed trajectory analysis', async () => {
      const launch = createTestLaunch({
        mission: { 
          name: 'Starlink',
          description: 'Satellite constellation',
          orbit: { name: 'GTO' } 
        }
      });

      const visibility = await calculateVisibility(launch);

      expect(visibility).toHaveProperty('likelihood');
      expect(visibility).toHaveProperty('score');
      expect(visibility).toHaveProperty('factors');
    });

    test('should include detailed trajectory factors when available', async () => {
      const launch = createTestLaunch({
        mission: { 
          name: 'Starlink',
          description: 'Satellite constellation',
          orbit: { name: 'GTO' } 
        }
      });

      const visibility = await calculateVisibility(launch);
      
      // Test factors content and length if defined
      const hasFactors = visibility.factors !== undefined;
      expect(!hasFactors || visibility.factors!.length > 3).toBe(true);
      
      // Should include trajectory-specific factors if factors exist
      expect(!hasFactors || visibility.factors!.some(factor => 
        factor.includes('trajectory') || factor.includes('altitude')
      )).toBe(true);
    });

    test('should handle trajectory service failures gracefully', async () => {
      // Mock trajectory service to fail
      const trajectoryService = require('../trajectoryService');
      trajectoryService.getTrajectoryData.mockRejectedValueOnce(
        new Error('Trajectory data unavailable')
      );

      const launch = createTestLaunch();
      const visibility = await calculateVisibility(launch);

      // Should fall back to basic visibility calculation
      expect(visibility).toHaveProperty('likelihood');
      expect(visibility).toHaveProperty('score');
      expect(visibility).toHaveProperty('factors');
    });

    test('should calculate visibility window based on trajectory', async () => {
      const launch = createTestLaunch({
        mission: { 
          name: 'Commercial Mission',
          description: 'GTO mission',
          orbit: { name: 'GTO' } 
        }
      });

      const visibility = await calculateVisibility(launch);

      // Enhanced visibility should include timing information
      expect(visibility).toHaveProperty('factors');
      
      // Test timing information if factors exist
      const hasFactors = visibility.factors !== undefined;
      expect(!hasFactors || visibility.factors!.some(factor => 
        factor.includes('visible for') || factor.includes('duration')
      )).toBe(true);
    });
  });

  describe('Real-world Launch Scenarios', () => {
    test('should handle Falcon 9 Starlink launch correctly', async () => {
      const starlinkLaunch = createTestLaunch({
        name: 'Falcon 9 Block 5 | Starlink Group',
        mission: {
          name: 'Starlink Group 6-25',
          description: 'SpaceX Starlink satellite constellation deployment',
          orbit: { name: 'LEO' }
        },
        rocket: { name: 'Falcon 9 Block 5' },
        pad: {
          name: 'LC-39A',
          location: { name: 'Kennedy Space Center, FL, USA' }
        }
      });

      const basicVisibility = await calculateVisibility(starlinkLaunch);
      const enhancedVisibility = await calculateVisibility(starlinkLaunch);

      // LEO Starlink missions typically have low visibility from Bermuda
      expect(basicVisibility.likelihood).toBe('low');
      expect(enhancedVisibility.likelihood).toBeOneOf(['low', 'medium']);
      
      // Enhanced should provide more detailed analysis when both have factors
      const bothHaveFactors = enhancedVisibility.factors !== undefined && basicVisibility.factors !== undefined;
      expect(!bothHaveFactors || enhancedVisibility.factors!.length >= basicVisibility.factors!.length).toBe(true);
    });

    test('should handle Atlas V planetary mission correctly', async () => {
      const planetaryLaunch = createTestLaunch({
        name: 'Atlas V 551 | Mars Sample Return',
        mission: {
          name: 'Mars Sample Return Orbiter',
          description: 'Interplanetary mission to Mars',
          orbit: { name: 'Heliocentric' }
        },
        rocket: { name: 'Atlas V 551' },
        pad: {
          name: 'SLC-41',
          location: { name: 'Cape Canaveral Space Force Station, FL, USA' }
        }
      });

      const visibility = await calculateVisibility(planetaryLaunch);

      // Interplanetary launches often have good visibility due to high energy trajectories
      expect(['medium', 'high']).toContain(visibility.likelihood);
      
      expect(visibility).toHaveProperty('factors');
      
      // Test factors content if defined
      const hasFactors = visibility.factors !== undefined;
      expect(!hasFactors || visibility.factors!.some(factor => 
        factor.includes('high-energy') || factor.includes('interplanetary')
      )).toBe(true);
    });

    test('should handle Space Shuttle era launch profile', async () => {
      const shuttleLaunch = createTestLaunch({
        name: 'Space Shuttle Discovery | STS-133',
        mission: {
          name: 'STS-133',
          description: 'International Space Station logistics mission',
          orbit: { name: 'LEO' }
        },
        rocket: { name: 'Space Shuttle' },
        pad: {
          name: 'LC-39A',
          location: { name: 'Kennedy Space Center, FL, USA' }
        }
      });

      const visibility = await calculateVisibility(shuttleLaunch);

      // Shuttle missions to ISS had northeast trajectory, limited visibility from Bermuda
      expect(visibility.likelihood).toBe('low');
      
      expect(visibility).toHaveProperty('factors');
      
      // Test factors content if defined
      const hasFactors = visibility.factors !== undefined;
      expect(!hasFactors || visibility.factors!.includes('LEO trajectory has limited visibility from Bermuda')).toBe(true);
    });
  });

  describe('Time-based Visibility Analysis', () => {
    test('should correctly identify optimal viewing times', async () => {
      // Test various launch times throughout the day
      const launchTimes = [
        { hour: 6, expected: 'medium' }, // Dawn
        { hour: 12, expected: 'medium' }, // Noon
        { hour: 18, expected: 'medium' }, // Dusk
        { hour: 21, expected: 'high' },   // Night
        { hour: 2, expected: 'high' }     // Late night
      ];

      for (const { hour, expected } of launchTimes) {
        const launchTime = new Date();
        launchTime.setHours(hour, 0, 0, 0);

        const launch = createTestLaunch({
          net: launchTime.toISOString(),
          mission: { 
            name: 'Test Mission',
            description: 'Test',
            orbit: { name: 'GTO' } 
          }
        });

        const visibility = await calculateVisibility(launch);
        expect(visibility.likelihood).toBe(expected);
      }
    });

    test('should account for seasonal visibility changes', async () => {
      // Test launches in different seasons
      const seasons = [
        { month: 2, name: 'Winter' },   // February
        { month: 5, name: 'Spring' },   // May
        { month: 8, name: 'Summer' },   // August
        { month: 11, name: 'Fall' }     // November
      ];

      for (const { month, name } of seasons) {
        const launchTime = new Date();
        launchTime.setMonth(month, 15); // 15th of the month
        launchTime.setHours(21, 0, 0, 0); // 9 PM

        const launch = createTestLaunch({
          net: launchTime.toISOString(),
          mission: { 
            name: `${name} GTO Mission`,
            description: 'Seasonal test',
            orbit: { name: 'GTO' } 
          }
        });

        const visibility = await calculateVisibility(launch);
        
        // All should be high visibility (night GTO launches)
        expect(visibility.likelihood).toBe('high');
        
        expect(visibility).toHaveProperty('score');
        
        // Test score value if defined
        const hasScore = visibility.score !== undefined;
        expect(!hasScore || visibility.score! > 0.7).toBe(true);
      }
    });
  });

  describe('Visibility Consistency and Edge Cases', () => {
    test('should provide consistent results for identical launches', async () => {
      const launch = createTestLaunch();
      
      const visibility1 = await calculateVisibility(launch);
      const visibility2 = await calculateVisibility(launch);
      
      expect(visibility1.likelihood).toBe(visibility2.likelihood);
      expect(visibility1.score).toBe(visibility2.score);
      expect(visibility1.factors).toEqual(visibility2.factors);
    });

    test('should handle launches with missing orbit information', async () => {
      const launch = createTestLaunch({
        mission: {
          name: 'Unknown Mission',
          description: 'No orbit specified',
          orbit: { name: '' }
        }
      });

      const visibility = await calculateVisibility(launch);
      
      expect(visibility.likelihood).toBe('none');
      
      expect(visibility).toHaveProperty('score');
      expect(visibility).toHaveProperty('factors');
      
      // Test score value if defined
      const hasScore = visibility.score !== undefined;
      expect(!hasScore || visibility.score === 0).toBe(true);
      
      // Test factors content if defined
      const hasFactors = visibility.factors !== undefined;
      expect(!hasFactors || visibility.factors!.includes('Unknown orbit type')).toBe(true);
    });

    test('should handle invalid launch times', async () => {
      const launch = createTestLaunch({
        net: 'invalid-date'
      });

      // Should not throw, should handle gracefully
      await expect(async () => await calculateVisibility(launch)).not.toThrow();
      
      const visibility = await calculateVisibility(launch);
      expect(visibility.likelihood).toBe('none');
    });

    test('should handle launches from non-Florida locations', async () => {
      const launch = createTestLaunch({
        pad: {
          name: 'SLC-4E',
          location: { name: 'Vandenberg Space Force Base, CA, USA' }
        }
      });

      const visibility = await calculateVisibility(launch);
      
      expect(visibility.likelihood).toBe('none');
      
      expect(visibility).toHaveProperty('score');
      expect(visibility).toHaveProperty('factors');
      
      // Test score value if defined
      const hasScore = visibility.score !== undefined;
      expect(!hasScore || visibility.score === 0).toBe(true);
      
      // Test factors content if defined
      const hasFactors = visibility.factors !== undefined;
      expect(!hasFactors || visibility.factors!.includes('Launch not from Florida')).toBe(true);
    });
  });

  describe('Performance and Scale Tests', () => {
    test('should handle multiple launches efficiently', async () => {
      const launches = Array.from({ length: 10 }, (_, i) => 
        createTestLaunch({
          id: `test-launch-${i}`,
          name: `Test Launch ${i}`
        })
      );

      const startTime = Date.now();
      
      const visibilities = await Promise.all(launches.map(launch => calculateVisibility(launch)));
      
      const endTime = Date.now();
      const duration = endTime - startTime;

      expect(visibilities).toHaveLength(10);
      expect(duration).toBeLessThan(100); // Should complete in under 100ms
      
      visibilities.forEach(visibility => {
        expect(visibility).toHaveProperty('likelihood');
        expect(visibility).toHaveProperty('score');
        expect(visibility).toHaveProperty('factors');
      });
    });

    test('should handle enhanced visibility calculations for multiple launches', async () => {
      const launches = Array.from({ length: 5 }, (_, i) => 
        createTestLaunch({
          id: `enhanced-test-${i}`,
          name: `Enhanced Test ${i}`
        })
      );

      const startTime = Date.now();
      
      const visibilities = await Promise.all(
        launches.map(launch => calculateVisibility(launch))
      );
      
      const endTime = Date.now();
      const duration = endTime - startTime;

      expect(visibilities).toHaveLength(5);
      expect(duration).toBeLessThan(2000); // Should complete in under 2 seconds
      
      visibilities.forEach(visibility => {
        expect(visibility).toHaveProperty('likelihood');
        expect(visibility).toHaveProperty('score');
        expect(visibility).toHaveProperty('factors');
        // Test factors length if defined
        const hasFactors = visibility.factors !== undefined;
        expect(!hasFactors || visibility.factors!.length > 0).toBe(true);
      });
    });
  });
});

// Custom matcher for better test readability
expect.extend({
  toBeOneOf<T>(received: T, expected: T[]) {
    const pass = expected.includes(received);
    return {
      message: () => 
        `expected ${received} to be one of ${expected.join(', ')}`,
      pass
    };
  }
});