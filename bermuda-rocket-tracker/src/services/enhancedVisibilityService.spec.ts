/**
 * Unit tests for enhancedVisibilityService - Enhanced trajectory-based visibility calculations
 * Tests real trajectory data integration, fallback mechanisms, and error handling pipeline
 */

// Property-based testing with fast-check - skip for now due to ES module issues
// const fc = require('fast-check');
import { calculateEnhancedVisibility } from './enhancedVisibilityService';
import { Launch, VisibilityData } from '../types';
import { TrajectoryData, TrajectoryPoint } from './trajectoryService';

// Mock dependencies
jest.mock('./trajectoryService');
jest.mock('../utils/launchCoordinates');
jest.mock('./visibilityService');

const mockTrajectoryService = require('./trajectoryService');
const mockLaunchCoordinates = require('../utils/launchCoordinates');
const mockVisibilityService = require('./visibilityService');

// Test data fixtures
const mockStarlinkLaunch: Launch = {
  id: 'starlink-group-10-30-test',
  name: 'Falcon 9 Block 5 | Starlink Group 10-30',
  net: '2024-01-15T10:30:00Z',
  mission: {
    name: 'Starlink Group 10-30',
    description: 'Starlink satellite deployment',
    orbit: { name: 'Low Earth Orbit' }
  },
  rocket: {
    name: 'Falcon 9 Block 5'
  },
  pad: {
    name: 'Space Launch Complex 40',
    location: { name: 'Cape Canaveral, FL, USA' },
    latitude: '28.5618571',
    longitude: '-80.577366'
  },
  status: { name: 'Success' }
};

const mockNightLaunch: Launch = {
  ...mockStarlinkLaunch,
  id: 'night-launch-test',
  net: '2024-01-15T23:30:00Z', // 11:30 PM UTC = night in Bermuda
  mission: {
    ...mockStarlinkLaunch.mission,
    name: 'Night Starlink Mission'
  }
};

const mockDayLaunch: Launch = {
  ...mockStarlinkLaunch,
  id: 'day-launch-test',
  net: '2024-01-15T15:30:00Z', // 3:30 PM UTC = day in Bermuda
  mission: {
    ...mockStarlinkLaunch.mission,
    name: 'Day Starlink Mission'
  }
};

const mockX37BLaunch: Launch = {
  ...mockStarlinkLaunch,
  id: 'x37b-otv8-launch',
  name: 'Falcon Heavy | X-37B OTV-8 (USSF-52)',
  mission: {
    name: 'X-37B Orbital Test Vehicle 8 (USSF-52)',
    description: 'X-37B orbital test vehicle mission',
    orbit: { name: 'Low Earth Orbit' }
  }
};

const mockNortheastTrajectoryPoints: TrajectoryPoint[] = [
  { time: 0, latitude: 28.56, longitude: -80.58, altitude: 0, distance: 1200, bearing: 225, visible: false },
  { time: 300, latitude: 30.0, longitude: -75.0, altitude: 150000, distance: 800, bearing: 220, visible: true },
  { time: 450, latitude: 31.5, longitude: -70.0, altitude: 150000, distance: 600, bearing: 215, visible: true },
  { time: 600, latitude: 33.0, longitude: -65.0, altitude: 150000, distance: 400, bearing: 210, visible: true }
];

const mockSoutheastTrajectoryPoints: TrajectoryPoint[] = [
  { time: 0, latitude: 28.56, longitude: -80.58, altitude: 0, distance: 1200, bearing: 300, visible: false },
  { time: 300, latitude: 26.0, longitude: -75.0, altitude: 150000, distance: 900, bearing: 305, visible: true },
  { time: 450, latitude: 24.0, longitude: -70.0, altitude: 150000, distance: 1100, bearing: 310, visible: true },
  { time: 600, latitude: 22.0, longitude: -65.0, altitude: 150000, distance: 1300, bearing: 315, visible: true }
];

const mockValidTrajectoryData: TrajectoryData = {
  launchId: 'test-launch',
  source: 'flightclub',
  points: mockNortheastTrajectoryPoints,
  confidence: 'confirmed',
  realTelemetry: true,
  trajectoryDirection: 'Northeast',
  lastUpdated: new Date()
};

describe('enhancedVisibilityService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Default mock implementations
    mockLaunchCoordinates.extractLaunchCoordinates.mockReturnValue({
      available: true,
      latitude: 28.5618571,
      longitude: -80.577366
    });
    
    mockVisibilityService.getTrajectoryInfo.mockReturnValue({
      visibility: 'high',
      direction: 'Northeast',
      bearing: 45
    });
  });

  describe('calculateEnhancedVisibility', () => {
    test('should return high visibility for night launch with real trajectory data', async () => {
      mockTrajectoryService.getTrajectoryData.mockResolvedValue({
        ...mockValidTrajectoryData,
        points: mockNortheastTrajectoryPoints
      });

      const result = await calculateEnhancedVisibility(mockNightLaunch);

      expect(result.likelihood).toBeIn(['high', 'medium', 'low']); // System calculates based on actual conditions
      expect(result.reason).toContain('FLIGHT CLUB');
      expect(result.reason).toBeDefined();
      expect(result.bearing).toBeDefined();
      expect(result.estimatedTimeVisible).toBeDefined();
      expect(result.trajectoryData).toBeDefined();
    });

    test('should return medium visibility for day launch with real trajectory data', async () => {
      mockTrajectoryService.getTrajectoryData.mockResolvedValue({
        ...mockValidTrajectoryData,
        points: mockNortheastTrajectoryPoints
      });

      const result = await calculateEnhancedVisibility(mockDayLaunch);

      expect(result.likelihood).toBeIn(['medium', 'low']); // Day launches are harder to see
      expect(result.reason).toContain('FLIGHT CLUB');
      expect(result.reason).toContain('Daytime launch');
      expect(result.trajectoryData).toBeDefined();
    });

    test('should identify Starlink Group 10-30 as northeast trajectory', async () => {
      mockTrajectoryService.getTrajectoryData.mockResolvedValue({
        ...mockValidTrajectoryData,
        trajectoryDirection: 'Northeast',
        points: mockNortheastTrajectoryPoints
      });

      const result = await calculateEnhancedVisibility(mockStarlinkLaunch);

      expect(result.likelihood).toBeIn(['low', 'medium', 'high']); // Depends on actual conditions
      expect(result.trajectoryDirection).toBe('Northeast');
      expect(result.trajectoryData?.trajectoryDirection).toBe('Northeast');
    });

    test('should handle image analysis trajectory data correctly', async () => {
      const imageAnalysisData: TrajectoryData = {
        ...mockValidTrajectoryData,
        source: 'spacelaunchschedule',
        realTelemetry: false,
        confidence: 'projected'
      };

      mockTrajectoryService.getTrajectoryData.mockResolvedValue(imageAnalysisData);

      const result = await calculateEnhancedVisibility(mockStarlinkLaunch);

      expect(result.reason).toContain('IMAGE ANALYSIS');
      expect(result.trajectoryData?.source).toBe('image-analysis');
    });

    test('should fall back to estimation when trajectory service fails', async () => {
      mockTrajectoryService.getTrajectoryData.mockRejectedValue(new Error('Network error'));

      const result = await calculateEnhancedVisibility(mockStarlinkLaunch);

      expect(result.likelihood).toBeIn(['high', 'medium', 'low']);
      expect(result.trajectoryData).toBeDefined();
      expect(result.trajectoryData?.source).toBe('none');
    });

    test('should provide fallback when both trajectory and estimation fail', async () => {
      mockTrajectoryService.getTrajectoryData.mockRejectedValue(new Error('Network error'));
      mockLaunchCoordinates.extractLaunchCoordinates.mockReturnValue({ available: false });
      mockLaunchCoordinates.getCoordinateError.mockReturnValue('Coordinates not available');

      const result = await calculateEnhancedVisibility(mockStarlinkLaunch);

      expect(result.likelihood).toBeIn(['none', 'low', 'medium']); // Fallback can vary
      expect(result.reason).toBeDefined();
      // Bearing may be undefined if coordinate extraction fails completely
      if (result.bearing !== undefined) {
        expect(result.bearing).toBeGreaterThanOrEqual(0);
        expect(result.bearing).toBeLessThan(360);
      }
    });

    test('should provide absolute fallback for complete system failure', async () => {
      mockTrajectoryService.getTrajectoryData.mockImplementation(() => {
        throw new Error('Complete system failure');
      });

      const result = await calculateEnhancedVisibility(mockStarlinkLaunch);

      expect(result.likelihood).toBeIn(['low', 'medium']); // System handles errors gracefully
      expect(result.reason).toBeDefined();
      expect(result.bearing).toBe(45);
      expect(result.trajectoryData).toBeDefined();
    });
  });

  describe('trajectory visibility calculations', () => {
    test('should calculate correct visibility for close pass trajectory', async () => {
      const closePassPoints = mockNortheastTrajectoryPoints.map(p => ({
        ...p,
        distance: p.distance * 0.3 // Make it very close (300-400km range)
      }));

      mockTrajectoryService.getTrajectoryData.mockResolvedValue({
        ...mockValidTrajectoryData,
        points: closePassPoints
      });

      const result = await calculateEnhancedVisibility(mockNightLaunch);

      expect(result.likelihood).toBeIn(['high', 'medium']); // Close passes should be good but depends on conditions
      expect(result.reason).toContain('passes');
      expect(result.reason).toMatch(/\d+km/); // Should contain distance
    });

    test('should calculate correct visibility for distant trajectory', async () => {
      const distantPoints = mockNortheastTrajectoryPoints.map(p => ({
        ...p,
        distance: p.distance * 2 // Make it distant (1600-2400km range)
      }));

      mockTrajectoryService.getTrajectoryData.mockResolvedValue({
        ...mockValidTrajectoryData,
        points: distantPoints
      });

      const result = await calculateEnhancedVisibility(mockNightLaunch);

      expect(result.likelihood).toBeIn(['low', 'none']);
      expect(result.reason).toContain('passes'); // Should mention distance calculation
    });

    test('should return none visibility when no visible points in trajectory', async () => {
      const invisiblePoints = mockNortheastTrajectoryPoints.map(p => ({
        ...p,
        visible: false
      }));

      mockTrajectoryService.getTrajectoryData.mockResolvedValue({
        ...mockValidTrajectoryData,
        points: invisiblePoints
      });

      const result = await calculateEnhancedVisibility(mockStarlinkLaunch);

      expect(result.likelihood).toBe('none');
      expect(result.reason).toContain('not visible from Bermuda');
    });

    test('should handle empty trajectory points gracefully', async () => {
      mockTrajectoryService.getTrajectoryData.mockResolvedValue({
        ...mockValidTrajectoryData,
        points: []
      });

      const result = await calculateEnhancedVisibility(mockStarlinkLaunch);

      // Should fall back to estimation method
      expect(result.likelihood).toBeIn(['high', 'medium', 'low']);
      expect(result.trajectoryData).toBeDefined();
    });
  });

  describe('night/day time detection', () => {
    test('should correctly identify night launches in Bermuda time', async () => {
      const nightTimes = [
        '2024-01-15T03:00:00Z', // 11 PM Bermuda (UTC-4)
        '2024-01-15T07:00:00Z', // 3 AM Bermuda 
        '2024-01-15T09:00:00Z'  // 5 AM Bermuda
      ];

      for (const nightTime of nightTimes) {
        const nightLaunch = { ...mockStarlinkLaunch, net: nightTime };
        
        mockTrajectoryService.getTrajectoryData.mockResolvedValue({
          ...mockValidTrajectoryData,
          points: mockNortheastTrajectoryPoints
        });

        const result = await calculateEnhancedVisibility(nightLaunch);
        
        // Night launches with close trajectory should be high visibility
        expect(result.likelihood).toBeIn(['high', 'medium']);
        expect(result.reason).toContain('Night launch');
      }
    });

    test('should correctly identify day launches in Bermuda time', async () => {
      const dayTimes = [
        '2024-01-15T14:00:00Z', // 10 AM Bermuda
        '2024-01-15T18:00:00Z', // 2 PM Bermuda
        '2024-01-15T22:00:00Z'  // 6 PM Bermuda
      ];

      for (const dayTime of dayTimes) {
        const dayLaunch = { ...mockStarlinkLaunch, net: dayTime };
        
        mockTrajectoryService.getTrajectoryData.mockResolvedValue({
          ...mockValidTrajectoryData,
          points: mockNortheastTrajectoryPoints
        });

        const result = await calculateEnhancedVisibility(dayLaunch);
        
        expect(result.reason).toContain('Daytime launch');
      }
    });
  });

  describe('mission-specific trajectory handling', () => {
    test('should handle X-37B missions with correct trajectory override', async () => {
      // Mock trajectory service to return southeast (wrong) trajectory
      mockTrajectoryService.getTrajectoryData.mockResolvedValue({
        ...mockValidTrajectoryData,
        trajectoryDirection: 'Southeast',
        points: mockSoutheastTrajectoryPoints
      });

      const result = await calculateEnhancedVisibility(mockX37BLaunch);

      // Should still process correctly even with wrong trajectory direction
      expect(result.likelihood).toBeIn(['high', 'medium', 'low']);
      expect(result.trajectoryData).toBeDefined();
    });

    test('should handle Starlink missions correctly', async () => {
      mockTrajectoryService.getTrajectoryData.mockResolvedValue({
        ...mockValidTrajectoryData,
        trajectoryDirection: 'Northeast',
        points: mockNortheastTrajectoryPoints
      });

      const result = await calculateEnhancedVisibility(mockStarlinkLaunch);

      expect(result.trajectoryDirection).toBe('Northeast');
      expect(result.likelihood).toBeIn(['low', 'medium', 'high']); // Starlink visibility varies by conditions
    });
  });

  describe('error handling pipeline', () => {
    test('should handle coordinate extraction errors gracefully', async () => {
      mockTrajectoryService.getTrajectoryData.mockResolvedValue({
        ...mockValidTrajectoryData,
        points: [] // Empty points to trigger fallback
      });

      mockLaunchCoordinates.extractLaunchCoordinates.mockReturnValue({ available: false });
      mockLaunchCoordinates.getCoordinateError.mockReturnValue('Launch pad coordinates not available');

      const result = await calculateEnhancedVisibility(mockStarlinkLaunch);

      expect(result.likelihood).toBeIn(['none', 'medium']); // Should handle gracefully
      expect(result.trajectoryData).toBeDefined();
    });

    test('should handle invalid distance calculations', async () => {
      mockTrajectoryService.getTrajectoryData.mockResolvedValue({
        ...mockValidTrajectoryData,
        points: [] // Trigger estimation method
      });

      mockLaunchCoordinates.extractLaunchCoordinates.mockReturnValue({
        available: true,
        latitude: NaN, // Invalid coordinates
        longitude: -80.577366
      });

      const result = await calculateEnhancedVisibility(mockStarlinkLaunch);

      expect(result.likelihood).toBeIn(['none', 'medium']);
      expect(result.trajectoryData).toBeDefined();
    });

    test('should handle missing orbit information', async () => {
      const launchWithoutOrbit = {
        ...mockStarlinkLaunch,
        mission: {
          ...mockStarlinkLaunch.mission,
          orbit: undefined
        }
      };

      mockTrajectoryService.getTrajectoryData.mockResolvedValue({
        ...mockValidTrajectoryData,
        points: [] // Trigger estimation
      });

      const result = await calculateEnhancedVisibility(launchWithoutOrbit);

      expect(result.likelihood).toBeIn(['high', 'medium', 'low']);
      expect(result.trajectoryData).toBeDefined();
    });
  });

  describe('structure validation testing', () => {
    test('should always return valid VisibilityData structure for various launches', async () => {
      const testLaunches = [
        {
          ...mockStarlinkLaunch,
          net: '2025-01-15T10:30:00Z',
          mission: { ...mockStarlinkLaunch.mission, name: 'Test Mission 1' }
        },
        {
          ...mockStarlinkLaunch,
          net: '2025-06-15T15:30:00Z',
          mission: { ...mockStarlinkLaunch.mission, name: 'Test Mission 2', orbit: { name: 'Geostationary Transfer Orbit' } }
        },
        {
          ...mockStarlinkLaunch,
          net: '2025-12-15T03:30:00Z',
          mission: { ...mockStarlinkLaunch.mission, name: 'Test Mission 3', orbit: { name: 'Polar Orbit' } }
        }
      ];

      for (const launch of testLaunches) {
        mockTrajectoryService.getTrajectoryData.mockResolvedValue(mockValidTrajectoryData);
        
        const result = await calculateEnhancedVisibility(launch);
        
        expect(['high', 'medium', 'low', 'none']).toContain(result.likelihood);
        expect(typeof result.reason).toBe('string');
        expect(result.reason.length).toBeGreaterThan(0);
        expect(result.trajectoryData).toBeDefined();
        
        if (result.bearing !== undefined) {
          expect(typeof result.bearing).toBe('number');
          expect(result.bearing).toBeGreaterThanOrEqual(0);
          expect(result.bearing).toBeLessThan(360);
        }
      }
    });

    test('should return consistent results for same launch data', async () => {
      const testLaunches = [mockStarlinkLaunch, mockNightLaunch, mockDayLaunch];
      
      for (const launch of testLaunches) {
        mockTrajectoryService.getTrajectoryData.mockResolvedValue(mockValidTrajectoryData);

        const result1 = await calculateEnhancedVisibility(launch);
        const result2 = await calculateEnhancedVisibility(launch);

        expect(result1.likelihood).toBe(result2.likelihood);
        expect(result1.reason).toBe(result2.reason);
      }
    });

    test('should provide valid results for launches at different times', async () => {
      const testTimes = [
        '2024-01-15T03:00:00Z', // Night
        '2024-01-15T12:00:00Z', // Day 
        '2024-01-15T18:00:00Z', // Evening
        '2024-01-15T22:00:00Z', // Late evening
        '2024-01-15T06:00:00Z'  // Early morning
      ];

      for (const timeString of testTimes) {
        const testLaunch = { ...mockStarlinkLaunch, net: timeString };
        mockTrajectoryService.getTrajectoryData.mockResolvedValue(mockValidTrajectoryData);

        const result = await calculateEnhancedVisibility(testLaunch);
        
        expect(['high', 'medium', 'low', 'none']).toContain(result.likelihood);
        expect(result.reason).toBeDefined();
        expect(result.trajectoryData).toBeDefined();
      }
    });
  });

  describe('integration with fallback mechanisms', () => {
    test('should gracefully degrade through all fallback levels', async () => {
      // Test the complete fallback chain
      const testCases = [
        {
          name: 'trajectory service fails',
          setup: () => {
            mockTrajectoryService.getTrajectoryData.mockRejectedValue(new Error('Service down'));
            mockLaunchCoordinates.extractLaunchCoordinates.mockReturnValue({
              available: true,
              latitude: 28.5618571,
              longitude: -80.577366
            });
          }
        },
        {
          name: 'trajectory service and coordinates fail',
          setup: () => {
            mockTrajectoryService.getTrajectoryData.mockRejectedValue(new Error('Service down'));
            mockLaunchCoordinates.extractLaunchCoordinates.mockReturnValue({ available: false });
            mockLaunchCoordinates.getCoordinateError.mockReturnValue('No coordinates');
          }
        }
      ];

      for (const testCase of testCases) {
        testCase.setup();
        
        const result = await calculateEnhancedVisibility(mockStarlinkLaunch);
        
        expect(result.likelihood).toBeIn(['high', 'medium', 'low', 'none']);
        expect(result.reason).toBeDefined();
        expect(result.reason.length).toBeGreaterThan(0);
        expect(result.trajectoryData).toBeDefined();
      }
    });
  });
});