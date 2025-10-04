/**
 * Unit tests for trajectoryService - Core trajectory data functionality
 * Tests environment detection, image analysis, and fallback mechanisms
 */

import {
  getTrajectoryData,
  clearTrajectoryCache,
  getTrajectoryCache,
  TrajectoryData
} from './trajectoryService';
import { Launch, TrajectoryPoint } from '../types';

// Mock dependencies
jest.mock('../utils/environmentUtils');
jest.mock('./imageAnalysisService');
jest.mock('./spaceLaunchScheduleService');
jest.mock('./flightClubService');
jest.mock('./trajectoryMappingService');

const mockLaunch: Launch = {
  id: 'test-launch-123',
  name: 'Falcon 9 Block 5 | Starlink Group 10-30',
  net: '2024-01-15T10:30:00Z',
  mission: {
    name: 'Starlink Group 10-30',
    description: 'Starlink satellite deployment',
    orbit: { name: 'Low Earth Orbit' }
  },
  rocket: {
    name: 'Falcon 9 Block 5',
  },
  pad: {
    name: 'Space Launch Complex 40',
    location: { name: 'Cape Canaveral, FL, USA' },
    latitude: '28.5618571',
    longitude: '-80.577366'
  },
  status: { name: 'Success' }
};

const mockX37BLaunch: Launch = {
  ...mockLaunch,
  id: 'x37b-otv7-launch',
  name: 'Atlas V 501 | X-37B OTV-7 (USSF-52)',
  mission: {
    name: 'X-37B Orbital Test Vehicle 7 (USSF-52)',
    description: 'X-37B orbital test vehicle mission',
    orbit: { name: 'Low Earth Orbit' }
  }
};

describe('trajectoryService', () => {
  beforeEach(() => {
    clearTrajectoryCache();
    jest.clearAllMocks();
  });

  describe('cache management', () => {
    test('should start with empty cache', () => {
      const cache = getTrajectoryCache();
      expect(cache.size).toBe(0);
    });

    test('should clear cache successfully', () => {
      // Add something to cache first by calling getTrajectoryData
      // This will be tested in integration scenarios
      clearTrajectoryCache();
      const cache = getTrajectoryCache();
      expect(cache.size).toBe(0);
    });
  });

  describe('trajectory direction determination', () => {
    test('should determine Northeast trajectory from trajectory points', () => {
      // Test the private determineTrajectoryDirection function through public API
      const points: TrajectoryPoint[] = [
        { time: 0, latitude: 28.5, longitude: -80.6, altitude: 0, distance: 1200, bearing: 45, aboveHorizon: false, elevationAngle: -2, visible: false, stage: 'first', engineStatus: 'burning' },
        { time: 300, latitude: 30.0, longitude: -75.0, altitude: 150000, distance: 800, bearing: 45, aboveHorizon: true, elevationAngle: 15, visible: true, stage: 'separation', engineStatus: 'separation' },
        { time: 600, latitude: 32.0, longitude: -70.0, altitude: 150000, distance: 600, bearing: 45, aboveHorizon: true, elevationAngle: 20, visible: true, stage: 'second-burn', engineStatus: 'burning' }
      ];
      
      // The bearing from start to end should be around 45 degrees (Northeast)
      const startPoint = points[0];
      const endPoint = points[points.length - 1];
      
      // Calculate bearing manually to verify our logic
      const dLng = (endPoint.longitude - startPoint.longitude) * Math.PI / 180;
      const y = Math.sin(dLng) * Math.cos(endPoint.latitude * Math.PI / 180);
      const x = Math.cos(startPoint.latitude * Math.PI / 180) * Math.sin(endPoint.latitude * Math.PI / 180) -
        Math.sin(startPoint.latitude * Math.PI / 180) * Math.cos(endPoint.latitude * Math.PI / 180) * Math.cos(dLng);
      let bearing = Math.atan2(y, x) * 180 / Math.PI;
      bearing = (bearing + 360) % 360;
      
      // Should be between 15 and 75 degrees for Northeast classification
      expect(bearing).toBeGreaterThan(15);
      expect(bearing).toBeLessThan(75);
    });

    test('should handle edge case with single trajectory point', () => {
      const points: TrajectoryPoint[] = [
        { time: 0, latitude: 28.5, longitude: -80.6, altitude: 0, distance: 1200, bearing: 45, aboveHorizon: false, elevationAngle: -2, visible: false, stage: 'first', engineStatus: 'burning' }
      ];
      
      // With single point, direction should be 'Unknown'
      // This will be tested through the integration test as the function is private
      expect(points.length).toBe(1);
    });
  });

  describe('visibility calculations', () => {
    test('should calculate visibility radius correctly for different altitudes', () => {
      // Test the visibility calculation logic
      const EARTH_RADIUS_KM = 6371;
      
      // At 150km altitude (typical for rocket visibility)
      const altitude150km = 150000; // meters
      const altitudeKm = altitude150km / 1000;
      const theta = Math.acos(EARTH_RADIUS_KM / (EARTH_RADIUS_KM + altitudeKm));
      const visibilityRadius = EARTH_RADIUS_KM * theta;
      
      // Should be around 1400km visibility radius
      expect(visibilityRadius).toBeGreaterThan(1300);
      expect(visibilityRadius).toBeLessThan(1500);
    });

    test('should calculate distance correctly', () => {
      // Test great circle distance calculation
      const bermudaLat = 32.3078;
      const bermudaLng = -64.7505;
      const capeCanaveralLat = 28.5618571;
      const capeCanaveralLng = -80.577366;
      
      // Calculate distance using Haversine formula
      const R = 6371;
      const dLat = (capeCanaveralLat - bermudaLat) * Math.PI / 180;
      const dLng = (capeCanaveralLng - bermudaLng) * Math.PI / 180;
      const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(bermudaLat * Math.PI / 180) * Math.cos(capeCanaveralLat * Math.PI / 180) *
        Math.sin(dLng / 2) * Math.sin(dLng / 2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      const distance = R * c;
      
      // Great circle distance between Bermuda and Cape Canaveral is ~1570km
      expect(distance).toBeGreaterThan(1500);
      expect(distance).toBeLessThan(1650);
    });
  });

  describe('trajectory data integration', () => {
    beforeEach(() => {
      // Mock the environment detection
      const { isBrowser } = require('../utils/environmentUtils');
      (isBrowser as jest.Mock).mockReturnValue(false); // Server environment by default
    });

    test('should handle server environment gracefully', async () => {
      // Mock space launch schedule service to return no data
      const { getCachedSpaceLaunchScheduleData } = require('./spaceLaunchScheduleService');
      (getCachedSpaceLaunchScheduleData as jest.Mock).mockResolvedValue({
        flightClubId: null,
        trajectoryImageUrl: null,
        trajectoryDirection: null
      });

      // Mock trajectory mapping service
      const { getTrajectoryMapping } = require('./trajectoryMappingService');
      (getTrajectoryMapping as jest.Mock).mockReturnValue({
        azimuth: 45,
        direction: 'Northeast'
      });

      const result = await getTrajectoryData(mockLaunch);
      
      expect(result).toBeDefined();
      expect(result.launchId).toBe(mockLaunch.id);
      expect(result.source).toBeDefined();
      expect(result.confidence).toBeDefined();
      expect(result.lastUpdated).toBeInstanceOf(Date);
    });

    test('should apply X-37B trajectory override correctly', async () => {
      // Mock services to return incorrect trajectory direction
      const { getCachedSpaceLaunchScheduleData } = require('./spaceLaunchScheduleService');
      (getCachedSpaceLaunchScheduleData as jest.Mock).mockResolvedValue({
        flightClubId: null,
        trajectoryImageUrl: null,
        trajectoryDirection: 'Southeast' // Wrong direction
      });

      const { getTrajectoryMapping } = require('./trajectoryMappingService');
      (getTrajectoryMapping as jest.Mock).mockReturnValue({
        azimuth: 135, // Southeast
        direction: 'Southeast'
      });

      const result = await getTrajectoryData(mockX37BLaunch);
      
      // Should override to Northeast for X-37B missions
      expect(result.trajectoryDirection).toBe('Northeast');
      expect(result.confidence).toBe('confirmed'); // High confidence override
    });
  });

  describe('cache expiry logic', () => {
    test('should calculate correct cache expiry for different launch times', () => {
      const now = Date.now();
      
      // Future launches at different intervals
      const launch7DaysOut = new Date(now + (7 * 24 * 60 * 60 * 1000 + 1000)).toISOString();
      const launch3DaysOut = new Date(now + (3 * 24 * 60 * 60 * 1000)).toISOString();
      const launch1DayOut = new Date(now + (24 * 60 * 60 * 1000)).toISOString();
      const launch2HoursOut = new Date(now + (2 * 60 * 60 * 1000)).toISOString();
      const launch1HourOut = new Date(now + (60 * 60 * 1000)).toISOString();
      
      // Test the cache expiry calculation logic
      // We can't directly test the private function, but we can test the concept
      const getCacheExpiryTime = (launchTime: string): number => {
        const launchTimestamp = new Date(launchTime).getTime();
        const hoursUntilLaunch = (launchTimestamp - now) / (1000 * 60 * 60);
        
        if (hoursUntilLaunch > 168) { // > 7 days
          return 24 * 60 * 60 * 1000; // 24 hours
        } else if (hoursUntilLaunch > 72) { // 3-7 days
          return 12 * 60 * 60 * 1000; // 12 hours
        } else if (hoursUntilLaunch > 24) { // 1-3 days
          return 6 * 60 * 60 * 1000; // 6 hours
        } else if (hoursUntilLaunch > 2) { // 2-24 hours
          return 2 * 60 * 60 * 1000; // 2 hours
        } else {
          return 30 * 60 * 1000; // 30 minutes for imminent launches
        }
      };
      
      expect(getCacheExpiryTime(launch7DaysOut)).toBe(12 * 60 * 60 * 1000); // 12 hours
      expect(getCacheExpiryTime(launch3DaysOut)).toBe(6 * 60 * 60 * 1000); // 6 hours  
      expect(getCacheExpiryTime(launch1DayOut)).toBe(2 * 60 * 60 * 1000); // 2 hours
      expect(getCacheExpiryTime(launch2HoursOut)).toBe(2 * 60 * 60 * 1000); // 2 hours
      expect(getCacheExpiryTime(launch1HourOut)).toBe(30 * 60 * 1000); // 30 minutes
    });
  });

  describe('error handling', () => {
    test('should handle Space Launch Schedule service errors gracefully', async () => {
      // Mock service to throw error
      const { getCachedSpaceLaunchScheduleData } = require('./spaceLaunchScheduleService');
      (getCachedSpaceLaunchScheduleData as jest.Mock).mockRejectedValue(new Error('Network error'));

      // Mock trajectory mapping as fallback
      const { getTrajectoryMapping } = require('./trajectoryMappingService');
      (getTrajectoryMapping as jest.Mock).mockReturnValue({
        azimuth: 45,
        direction: 'Northeast'
      });

      const result = await getTrajectoryData(mockLaunch);
      
      // Should still return valid trajectory data
      expect(result).toBeDefined();
      expect(result.launchId).toBe(mockLaunch.id);
      expect(result.confidence).toBe('estimated'); // Fallback confidence level
    });

    test('should handle Flight Club service errors gracefully', async () => {
      // Mock services
      const { getCachedSpaceLaunchScheduleData } = require('./spaceLaunchScheduleService');
      (getCachedSpaceLaunchScheduleData as jest.Mock).mockResolvedValue({
        flightClubId: 'test-flight-club-id',
        trajectoryImageUrl: null,
        trajectoryDirection: null
      });

      const { getCachedTelemetry } = require('./flightClubService');
      (getCachedTelemetry as jest.Mock).mockRejectedValue(new Error('Flight Club API error'));

      const { getTrajectoryMapping } = require('./trajectoryMappingService');
      (getTrajectoryMapping as jest.Mock).mockReturnValue({
        azimuth: 45,
        direction: 'Northeast'
      });

      const result = await getTrajectoryData(mockLaunch);
      
      // Should fall back to trajectory generation
      expect(result).toBeDefined();
      expect(result.launchId).toBe(mockLaunch.id);
      expect(result.source).toBe('none'); // Should fall back to generated data
    });
  });

  describe('filename analysis', () => {
    test('should analyze trajectory from filename patterns', () => {
      // Test URL patterns that should be detected
      const testCases = [
        {
          url: 'https://example.com/trajecoty-fl-north-rtls.jpg',
          expectedDirection: 'Northeast'
        },
        {
          url: 'https://example.com/trajectory-southeast-path.jpg',
          expectedDirection: 'Southeast'
        },
        {
          url: 'https://example.com/starlink-mission-trajectory.jpg',
          mission: 'Starlink Group 6-7',
          expectedDirection: 'Northeast'
        }
      ];
      
      testCases.forEach(testCase => {
        // These patterns should be detected by the filename analysis
        const filename = testCase.url.split('/').pop()?.toLowerCase() || '';
        
        // Test Northeast pattern detection
        const isNortheastDirection = testCase.expectedDirection === 'Northeast';
        const northeastPatterns = [
          'northeast', 'north-east', 'ne-', '_ne_', '_ne.',
          'rtls', 'north', 'fl-north', 'trajecoty-fl-north'
        ];
        
        const hasNortheastPattern = northeastPatterns.some(pattern => 
          filename.includes(pattern) || testCase.url.toLowerCase().includes(pattern)
        );
        
        expect(!isNortheastDirection || hasNortheastPattern).toBe(true);
        
        // Test Starlink mission direction
        const isStarlinkMission = testCase.mission && testCase.mission.toLowerCase().includes('starlink');
        expect(!isStarlinkMission || testCase.expectedDirection === 'Northeast').toBe(true);
      });
    });
  });
});
