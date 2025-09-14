/**
 * Integration Tests for Launch Data Service
 * Tests the full integration between API, data processing, and visibility calculations
 */

import { launchDataService } from '../launchDataService';
import { calculateVisibility } from '../visibilityService';

// Mock the API to return consistent test data
global.fetch = jest.fn();

const mockLaunchData = {
  results: [
    {
      id: 'test-launch-1',
      name: 'Falcon 9 | Test Mission',
      mission: {
        name: 'Test Mission',
        description: 'A test mission for integration testing',
        orbit: { name: 'GTO' }
      },
      rocket: {
        name: 'Falcon 9 Block 5'
      },
      pad: {
        name: 'LC-39A',
        location: { 
          name: 'Cape Canaveral, FL, USA',
          latitude: 28.6080,
          longitude: -80.6040
        }
      },
      net: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 24 hours from now
      window_start: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      window_end: new Date(Date.now() + 24 * 60 * 60 * 1000 + 60 * 60 * 1000).toISOString(),
      status: { name: 'Go', abbrev: 'Go' },
      image: 'https://example.com/image.jpg',
      webcast_live: true
    },
    {
      id: 'test-launch-2',
      name: 'Atlas V | Test Mission 2',
      mission: {
        name: 'Test Mission 2',
        description: 'Another test mission',
        orbit: { name: 'LEO' }
      },
      rocket: {
        configuration: { name: 'Atlas V' }
      },
      pad: {
        name: 'SLC-41',
        location: { 
          name: 'Cape Canaveral, FL, USA',
          latitude: 28.5830,
          longitude: -80.5832
        }
      },
      net: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(), // 48 hours from now
      window_start: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(),
      window_end: new Date(Date.now() + 48 * 60 * 60 * 1000 + 30 * 60 * 1000).toISOString(),
      status: { name: 'TBD', abbrev: 'TBD' },
      image: undefined,
      webcast_live: false
    }
  ]
};

describe('Launch Data Service Integration Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockLaunchData)
    });
  });

  afterEach(() => {
    // Clean up services
    launchDataService.destroy();
  });

  describe('Data Fetching Integration', () => {
    test('should fetch and process launch data correctly', async () => {
      const launches = await launchDataService.getLaunches();
      
      expect(launches).toHaveLength(2);
      expect(launches[0]).toMatchObject({
        id: 'test-launch-1',
        name: 'Falcon 9 | Test Mission',
        mission: {
          name: 'Test Mission',
          orbit: { name: 'GTO' }
        },
        rocket: { name: 'Falcon 9' },
        pad: {
          name: 'LC-39A',
          location: { name: 'Cape Canaveral, FL, USA' }
        }
      });
      
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('thespacedevs.com'),
        expect.any(Object)
      );
    });

    test('should filter Florida launches only', async () => {
      // Add a non-Florida launch to the mock data
      const mockDataWithNonFlorida = {
        results: [
          ...mockLaunchData.results,
          {
            id: 'test-launch-3',
            name: 'Non-Florida Launch',
            mission: { name: 'Test', orbit: { name: 'LEO' } },
            rocket: { configuration: { name: 'Test Rocket' } },
            pad: {
              name: 'Test Pad',
              location: { name: 'Vandenberg, CA, USA' }
            },
            net: new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString(),
            window_start: new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString(),
            window_end: new Date(Date.now() + 72 * 60 * 60 * 1000 + 60 * 60 * 1000).toISOString(),
            status: { name: 'Go', abbrev: 'Go' },
            image: undefined,
            webcast_live: false
          }
        ]
      };

      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockDataWithNonFlorida)
      });

      const launches = await launchDataService.getLaunches();
      
      // Should only return Florida launches
      expect(launches).toHaveLength(2);
      expect(launches.every(launch => 
        launch.pad.location.name.toLowerCase().includes('florida') ||
        launch.pad.location.name.toLowerCase().includes('cape canaveral')
      )).toBe(true);
    });

    test('should handle API errors gracefully', async () => {
      (fetch as jest.Mock).mockRejectedValueOnce(new Error('Network error'));

      await expect(launchDataService.getLaunches()).rejects.toThrow('Network error');
    });

    test('should handle HTTP error responses', async () => {
      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error'
      });

      await expect(launchDataService.getLaunches()).rejects.toThrow('Launch Library API error: 500');
    });
  });

  describe('Visibility Calculation Integration', () => {
    test('should calculate visibility for GTO launches correctly', async () => {
      const launches = await launchDataService.getLaunches();
      const gtoLaunch = launches.find(l => l.mission.orbit?.name === 'GTO');
      
      expect(gtoLaunch).toBeDefined();
      
      if (gtoLaunch) {
        const visibility = await calculateVisibility(gtoLaunch);
        
        expect(visibility).toHaveProperty('likelihood');
        expect(['high', 'medium', 'low', 'none']).toContain(visibility.likelihood);
      }
    });

    test('should calculate enhanced visibility with trajectory data', async () => {
      const launches = await launchDataService.getLaunches();
      const testLaunch = launches[0];
      
      const enhancedVisibility = await calculateVisibility(testLaunch);
      
      expect(enhancedVisibility).toHaveProperty('likelihood');
      expect(enhancedVisibility).toHaveProperty('score');
      expect(enhancedVisibility).toHaveProperty('factors');
      expect(enhancedVisibility.factors).toBeInstanceOf(Array);
      
      // Enhanced visibility should have more detailed factors
      if (enhancedVisibility.factors) {
        expect(enhancedVisibility.factors.length).toBeGreaterThanOrEqual(3);
      }
    });

    test('should provide consistent visibility calculations', async () => {
      const launches = await launchDataService.getLaunches();
      const testLaunch = launches[0];
      
      // Calculate visibility multiple times
      const visibility1 = await calculateVisibility(testLaunch);
      const visibility2 = await calculateVisibility(testLaunch);
      
      expect(visibility1.likelihood).toBe(visibility2.likelihood);
      expect(visibility1.score).toBe(visibility2.score);
      expect(visibility1.factors).toEqual(visibility2.factors);
    });
  });

  describe('Service Subscription Integration', () => {
    test('should notify subscribers when data updates', async () => {
      const callback = jest.fn();
      const unsubscribe = launchDataService.subscribe(callback);
      
      // Initial data fetch should trigger callback
      await launchDataService.getLaunches();
      
      expect(callback).toHaveBeenCalledWith(expect.any(Array));
      expect(callback.mock.calls[0][0]).toHaveLength(2);
      
      unsubscribe();
    });

    test('should handle multiple subscribers correctly', async () => {
      const callback1 = jest.fn();
      const callback2 = jest.fn();
      
      const unsubscribe1 = launchDataService.subscribe(callback1);
      const unsubscribe2 = launchDataService.subscribe(callback2);
      
      await launchDataService.getLaunches();
      
      expect(callback1).toHaveBeenCalled();
      expect(callback2).toHaveBeenCalled();
      
      unsubscribe1();
      unsubscribe2();
    });

    test('should stop notifying after unsubscribe', async () => {
      const callback = jest.fn();
      const unsubscribe = launchDataService.subscribe(callback);
      
      await launchDataService.getLaunches();
      expect(callback).toHaveBeenCalledTimes(1);
      
      unsubscribe();
      callback.mockClear();
      
      // Force another update
      await launchDataService.forceRefresh();
      expect(callback).not.toHaveBeenCalled();
    });
  });


  describe('Error Recovery Integration', () => {
    test('should retry failed requests with backoff', async () => {
      let callCount = 0;
      (fetch as jest.Mock).mockImplementation(() => {
        callCount++;
        if (callCount <= 2) {
          return Promise.reject(new Error('Temporary network error'));
        }
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockLaunchData)
        });
      });

      // This should eventually succeed after retries
      const launches = await launchDataService.getLaunches();
      
      expect(launches).toHaveLength(2);
      expect(callCount).toBeGreaterThan(1); // Should have retried
    });

    test('should handle malformed API responses', async () => {
      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ results: null })
      });

      await expect(launchDataService.getLaunches()).rejects.toThrow();
    });
  });

  describe('Memory Management Integration', () => {
    test('should clean up resources properly', async () => {
      const callback = jest.fn();
      const unsubscribe = launchDataService.subscribe(callback);
      
      await launchDataService.getLaunches();
      
      // Destroy service
      launchDataService.destroy();
      
      // Callback should not be called after destroy
      callback.mockClear();
      
      // This won't work because service is destroyed, but it shouldn't crash
      expect(() => launchDataService.destroy()).not.toThrow();
      
      unsubscribe(); // Should not throw even after destroy
    });
  });
});

describe('End-to-End Integration Tests', () => {
  test('complete launch tracking workflow', async () => {
    const mockCallback = jest.fn();
    
    // 1. Subscribe to updates
    const unsubscribe = launchDataService.subscribe(mockCallback);
    
    // 2. Fetch initial data
    const launches = await launchDataService.getLaunches();
    expect(launches.length).toBeGreaterThan(0);
    
    // 3. Calculate visibility for each launch
    const launchesWithVisibility = await Promise.all(
      launches.map(async (launch) => {
        const visibility = await calculateVisibility(launch);
        return { ...launch, visibility };
      })
    );
    
    // 4. Verify complete data structure
    launchesWithVisibility.forEach(launch => {
      expect(launch).toHaveProperty('id');
      expect(launch).toHaveProperty('name');
      expect(launch).toHaveProperty('net');
      expect(launch).toHaveProperty('visibility');
      expect(launch.visibility).toHaveProperty('likelihood');
      expect(launch.visibility).toHaveProperty('score');
      expect(launch.visibility).toHaveProperty('factors');
    });
    
    // 5. Test force refresh
    await launchDataService.forceRefresh();
    expect(mockCallback).toHaveBeenCalled();
    
    // 6. Clean up
    unsubscribe();
  });
});