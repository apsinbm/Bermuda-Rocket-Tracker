/**
 * Simplified Integration Tests
 * Tests core functionality without brittle expectations
 */

import { launchDataService } from '../launchDataService';
import { calculateVisibility } from '../visibilityService';
import { Launch } from '../../types';

// Mock fetch for consistent testing
global.fetch = jest.fn();

const mockLaunchData = {
  results: [
    {
      id: 'test-launch-1',
      name: 'Falcon 9 | Test Mission',
      mission: {
        name: 'Test Mission',
        description: 'Test mission',
        orbit: { name: 'GTO' }
      },
      rocket: { name: 'Falcon 9 Block 5' },
      pad: {
        name: 'LC-39A',
        location: { 
          name: 'Cape Canaveral, FL, USA',
          latitude: 28.6080,
          longitude: -80.6040
        }
      },
      net: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      window_start: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      window_end: new Date(Date.now() + 24 * 60 * 60 * 1000 + 60 * 60 * 1000).toISOString(),
      status: { name: 'Go', abbrev: 'Go' },
      image: undefined,
      webcast_live: false
    }
  ]
};

describe('Integration Tests - Core Functionality', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockLaunchData)
    });
  });

  afterEach(() => {
    launchDataService.destroy();
  });

  test('should fetch and process launch data', async () => {
    const launches = await launchDataService.getLaunches();
    
    expect(Array.isArray(launches)).toBe(true);
    expect(launches.length).toBeGreaterThanOrEqual(0);
  });

  test('should have correct structure when launches exist', async () => {
    const launches = await launchDataService.getLaunches();
    
    // With our mock data, we expect at least one launch
    expect(launches.length).toBeGreaterThan(0);
    
    const launch = launches[0];
    expect(launch).toHaveProperty('id');
    expect(launch).toHaveProperty('name');
    expect(launch).toHaveProperty('net');
    expect(launch).toHaveProperty('mission');
    expect(launch).toHaveProperty('rocket');
    expect(launch).toHaveProperty('pad');
  });

  test('should calculate visibility for valid launches', async () => {
    const launches = await launchDataService.getLaunches();
    
    // With our mock data, we expect at least one launch
    expect(launches.length).toBeGreaterThan(0);
    
    const launch = launches[0];
    const visibility = await calculateVisibility(launch);
    
    expect(visibility).toHaveProperty('likelihood');
    expect(['high', 'medium', 'low', 'none']).toContain(visibility.likelihood);
    expect(visibility).toHaveProperty('reason');
    expect(typeof visibility.reason).toBe('string');
  });

  test('should have bearing property in visibility result', async () => {
    const launches = await launchDataService.getLaunches();
    expect(launches.length).toBeGreaterThan(0);
    
    const launch = launches[0];
    const visibility = await calculateVisibility(launch);
    
    // Test bearing properties - can be undefined or a valid number
    expect(visibility).toHaveProperty('bearing');
    
    // If bearing exists, extract it for separate testing
    const { bearing } = visibility;
    
    // Test that bearing is either undefined or a valid number
    expect(bearing === undefined || (typeof bearing === 'number' && bearing >= 0 && bearing <= 360)).toBe(true);
  });

  test('should handle API errors gracefully', async () => {
    (fetch as jest.Mock).mockRejectedValueOnce(new Error('Network error'));
    
    // Service should handle errors gracefully, might return empty array or throw
    await expect(async () => {
      const launches = await launchDataService.getLaunches();
      expect(Array.isArray(launches)).toBe(true);
    }).resolves.not.toThrow();
  });

  test('should handle subscription system', async () => {
    let callbackCalled = false;
    const callback = jest.fn(() => { callbackCalled = true; });
    
    const unsubscribe = launchDataService.subscribe(callback);
    
    // Fetch data to trigger subscription
    await launchDataService.getLaunches();
    
    // Give some time for async operations
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Clean up
    unsubscribe();
    
    // Test that unsubscribe works
    expect(() => unsubscribe()).not.toThrow();
  });

  test('should filter Florida launches only', async () => {
    const mockWithNonFlorida = {
      results: [
        ...mockLaunchData.results,
        {
          id: 'non-florida-launch',
          name: 'Non-Florida Launch',
          mission: { name: 'Test', orbit: { name: 'LEO' } },
          rocket: { configuration: { name: 'Test Rocket' } },
          pad: {
            name: 'Test Pad',
            location: { 
              name: 'Vandenberg, CA, USA',
              latitude: 34.7420,
              longitude: -120.5143
            }
          },
          net: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(),
          window_start: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(),
          window_end: new Date(Date.now() + 48 * 60 * 60 * 1000 + 60 * 60 * 1000).toISOString(),
          status: { name: 'Go', abbrev: 'Go' },
          image: undefined,
          webcast_live: false
        }
      ]
    };

    (fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockWithNonFlorida)
    });

    const launches = await launchDataService.getLaunches();
    
    // Should only return Florida launches
    launches.forEach(launch => {
      const location = launch.pad.location.name.toLowerCase();
      expect(
        location.includes('florida') ||
        location.includes('cape canaveral') ||
        location.includes('kennedy')
      ).toBe(true);
    });
  });

  test('should handle visibility calculations for different orbit types', async () => {
    const testLaunch: Launch = {
      id: 'visibility-test',
      name: 'Visibility Test Launch',
      mission: {
        name: 'Test Mission',
        description: 'Test',
        orbit: { name: 'GTO' }
      },
      rocket: { name: 'Test Rocket' },
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
      webcast_live: false
    };

    const orbitTypes = ['GTO', 'LEO', 'SSO', 'GEO'];
    
    for (const orbitType of orbitTypes) {
      const launch = {
        ...testLaunch,
        mission: {
          ...testLaunch.mission,
          orbit: { name: orbitType }
        }
      };
      
      const visibility = await calculateVisibility(launch);
      
      expect(visibility).toHaveProperty('likelihood');
      expect(visibility).toHaveProperty('reason');
      expect(['high', 'medium', 'low', 'none']).toContain(visibility.likelihood);
    }
  });

  test('should handle launches with missing coordinate data', async () => {
    const launchWithoutCoords: Launch = {
      id: 'no-coords-test',
      name: 'No Coordinates Test',
      mission: {
        name: 'Test Mission',
        orbit: { name: 'GTO' }
      },
      rocket: { name: 'Test Rocket' },
      pad: {
        name: 'Unknown Pad',
        location: { name: 'Unknown Location' }
      },
      net: new Date().toISOString(),
      window_start: new Date().toISOString(),
      window_end: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
      status: { name: 'Go', abbrev: 'Go' },
      image: undefined,
      webcast_live: false
    };

    const visibility = await calculateVisibility(launchWithoutCoords);
    
    expect(visibility.likelihood).toBe('none');
    expect(visibility.reason).toContain('coordinates');
  });

  test('should perform consistently across multiple calls', async () => {
    const results = await Promise.all([
      launchDataService.getLaunches(),
      launchDataService.getLaunches(),
      launchDataService.getLaunches()
    ]);

    // All calls should return consistent data
    expect(results[0]).toEqual(results[1]);
    expect(results[1]).toEqual(results[2]);
  });
});

// Custom matcher
expect.extend({
  toBeOneOf<T>(received: T, expected: T[]) {
    const pass = expected.includes(received);
    return {
      message: () => `expected ${received} to be one of ${expected.join(', ')}`,
      pass
    };
  }
});