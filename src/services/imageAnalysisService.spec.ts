/**
 * Unit tests for imageAnalysisService - Environment-aware image analysis
 * Tests filename parsing, mission detection, and browser/server compatibility
 */

import {
  analyzeTrajectoryImage,
  getCachedAnalysis,
  cacheAnalysis,
  clearAnalysisCache,
  TrajectoryImageAnalysis
} from './imageAnalysisService';
import { Launch } from '../types';

// Mock environment utilities
jest.mock('../utils/environmentUtils');
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

const mockX37BLaunch: Launch = {
  ...mockLaunch,
  id: 'x37b-test-launch',
  name: 'Atlas V 501 | X-37B OTV-7',
  mission: {
    name: 'X-37B Orbital Test Vehicle 7',
    description: 'X-37B test flight',
    orbit: { name: 'Low Earth Orbit' }
  }
};

const mockGTOLaunch: Launch = {
  ...mockLaunch,
  id: 'gto-test-launch', 
  name: 'Falcon Heavy | USSF-44',
  mission: {
    name: 'USSF-44 Satellite Deployment',
    description: 'Military satellite to GTO',
    orbit: { name: 'Geosynchronous Transfer Orbit' }
  }
};

describe('imageAnalysisService', () => {
  beforeEach(() => {
    clearAnalysisCache();
    jest.clearAllMocks();
  });

  describe('environment detection', () => {
    test('should use filename analysis in server environment', async () => {
      const { isBrowser, hasCanvasSupport } = require('../utils/environmentUtils');
      (isBrowser as jest.Mock).mockReturnValue(false);
      (hasCanvasSupport as jest.Mock).mockReturnValue(false);

      const testUrl = 'https://example.com/trajecoty-fl-north-rtls.jpg';
      const result = await analyzeTrajectoryImage(testUrl, mockLaunch);

      expect(result.success).toBe(true);
      expect(result.analysisMethod).toBe('filename-analysis');
      expect(result.trajectoryDirection).toBe('Northeast');
      expect(result.imageUrl).toBe(testUrl);
    });

    test('should fallback to filename analysis when Canvas unavailable', async () => {
      const { isBrowser, hasCanvasSupport } = require('../utils/environmentUtils');
      (isBrowser as jest.Mock).mockReturnValue(true);
      (hasCanvasSupport as jest.Mock).mockReturnValue(false);

      const testUrl = 'https://example.com/trajectory-southeast.jpg';
      const result = await analyzeTrajectoryImage(testUrl);

      expect(result.success).toBe(true);
      expect(result.analysisMethod).toBe('filename-analysis');
    });

    test('should handle environment errors gracefully', async () => {
      const { isBrowser, hasCanvasSupport } = require('../utils/environmentUtils');
      (isBrowser as jest.Mock).mockReturnValue(true);
      (hasCanvasSupport as jest.Mock).mockReturnValue(true);

      // Simulate canvas analysis failure
      const testUrl = 'https://example.com/invalid-image.jpg';
      
      // Mock fetch to fail
      global.fetch = jest.fn().mockRejectedValue(new Error('Network error'));

      const result = await analyzeTrajectoryImage(testUrl, mockLaunch);

      // Should fall back to filename analysis
      expect(result.success).toBe(true);
      expect(result.analysisMethod).toBe('trajectory-mapping');
    });
  });

  describe('filename pattern recognition', () => {
    const testCases = [
      {
        filename: 'trajecoty-fl-north-rtls.jpg',
        expected: 'Northeast',
        description: 'typo pattern with north-rtls'
      },
      {
        filename: 'trajectory-northeast-path.jpg', 
        expected: 'Northeast',
        description: 'explicit northeast pattern'
      },
      {
        filename: 'trajectory-southeast-045.jpg',
        expected: 'Southeast', 
        description: 'explicit southeast pattern'
      },
      {
        filename: 'flight-profile-east-090.jpg',
        expected: 'East',
        description: 'east pattern with bearing'
      },
      {
        filename: 'starlink-mission-trajectory.jpg',
        expected: 'Northeast',
        description: 'starlink mission default'
      },
      {
        filename: 'ussf-gto-trajectory.jpg',
        expected: 'Southeast',
        description: 'GTO mission pattern'
      }
    ];

    testCases.forEach(testCase => {
      test(`should detect ${testCase.expected} from ${testCase.description}`, async () => {
        const { isBrowser } = require('../utils/environmentUtils');
        (isBrowser as jest.Mock).mockReturnValue(false);

        const testUrl = `https://example.com/${testCase.filename}`;
        const result = await analyzeTrajectoryImage(testUrl);

        expect(result.success).toBe(true);
        expect(result.trajectoryDirection).toBe(testCase.expected);
        expect(result.imageUrl).toBe(testUrl);
      });
    });
  });

  describe('mission-based trajectory detection', () => {
    test('should detect Starlink mission trajectory', async () => {
      const { isBrowser } = require('../utils/environmentUtils');
      (isBrowser as jest.Mock).mockReturnValue(false);

      const testUrl = 'https://example.com/unknown-trajectory.jpg';
      const result = await analyzeTrajectoryImage(testUrl, mockLaunch);

      expect(result.success).toBe(true);
      expect(result.trajectoryDirection).toBe('Northeast'); // Starlink default
    });

    test('should detect X-37B mission trajectory', async () => {
      const { isBrowser } = require('../utils/environmentUtils');
      (isBrowser as jest.Mock).mockReturnValue(false);

      const testUrl = 'https://example.com/unknown-trajectory.jpg';
      const result = await analyzeTrajectoryImage(testUrl, mockX37BLaunch);

      expect(result.success).toBe(true);
      expect(result.trajectoryDirection).toBe('Northeast'); // X-37B missions go northeast
    });

    test('should detect GTO mission trajectory', async () => {
      const { isBrowser } = require('../utils/environmentUtils');
      (isBrowser as jest.Mock).mockReturnValue(false);

      const testUrl = 'https://example.com/unknown-trajectory.jpg';
      const result = await analyzeTrajectoryImage(testUrl, mockGTOLaunch);

      expect(result.success).toBe(true);
      expect(result.trajectoryDirection).toBe('Southeast'); // GTO missions typically southeast
    });

    test('should use trajectory mapping service when available', async () => {
      const { isBrowser } = require('../utils/environmentUtils');
      const { getTrajectoryMapping } = require('./trajectoryMappingService');
      
      (isBrowser as jest.Mock).mockReturnValue(false);
      (getTrajectoryMapping as jest.Mock).mockReturnValue({
        direction: 'East-Northeast'
      });

      const testUrl = 'https://example.com/trajectory.jpg';
      const result = await analyzeTrajectoryImage(testUrl, mockLaunch);

      expect(result.success).toBe(true);
      expect(result.trajectoryDirection).toBe('East-Northeast');
      expect(result.analysisMethod).toBe('trajectory-mapping');
    });
  });

  describe('trajectory point generation', () => {
    test('should generate realistic Northeast trajectory points', async () => {
      const { isBrowser } = require('../utils/environmentUtils');
      (isBrowser as jest.Mock).mockReturnValue(false);

      const testUrl = 'https://example.com/northeast-trajectory.jpg';
      const result = await analyzeTrajectoryImage(testUrl);

      expect(result.success).toBe(true);
      expect(result.trajectoryPoints).toHaveLength(21); // 0 to 20 inclusive
      expect(result.trajectoryDirection).toBe('Northeast');

      // Check trajectory points progression
      const firstPoint = result.trajectoryPoints[0];
      const lastPoint = result.trajectoryPoints[result.trajectoryPoints.length - 1];

      // First point should be near Cape Canaveral
      expect(firstPoint.lat).toBeCloseTo(28.5, 1);
      expect(firstPoint.lng).toBeCloseTo(-80.6, 1);

      // Last point should be northeast (higher lat, less negative lng)
      expect(lastPoint.lat).toBeGreaterThan(firstPoint.lat);
      expect(lastPoint.lng).toBeGreaterThan(firstPoint.lng);
    });

    test('should generate realistic Southeast trajectory points', async () => {
      const { isBrowser } = require('../utils/environmentUtils');
      (isBrowser as jest.Mock).mockReturnValue(false);

      const testUrl = 'https://example.com/southeast-trajectory.jpg';
      const result = await analyzeTrajectoryImage(testUrl);

      expect(result.success).toBe(true);
      expect(result.trajectoryDirection).toBe('Southeast');

      const firstPoint = result.trajectoryPoints[0];
      const lastPoint = result.trajectoryPoints[result.trajectoryPoints.length - 1];

      // Last point should be southeast (lower lat, less negative lng)
      expect(lastPoint.lat).toBeLessThan(firstPoint.lat);
      expect(lastPoint.lng).toBeGreaterThan(firstPoint.lng);
    });
  });

  describe('closest approach calculation', () => {
    test('should calculate closest approach to Bermuda correctly', async () => {
      const { isBrowser } = require('../utils/environmentUtils');
      (isBrowser as jest.Mock).mockReturnValue(false);

      const testUrl = 'https://example.com/northeast-trajectory.jpg';
      const result = await analyzeTrajectoryImage(testUrl);

      expect(result.success).toBe(true);
      expect(result.closestApproachToBermuda).not.toBeNull();
      
      // Test closest approach properties when available
      expect(result.closestApproachToBermuda).toBeDefined();
      
      // Test closest approach properties if defined
      const hasClosestApproach = result.closestApproachToBermuda !== null;
      expect(!hasClosestApproach || result.closestApproachToBermuda!.distance > 0).toBe(true);
      expect(!hasClosestApproach || result.closestApproachToBermuda!.distance < 2000).toBe(true);
      expect(!hasClosestApproach || result.closestApproachToBermuda!.bearing >= 0).toBe(true);
      expect(!hasClosestApproach || result.closestApproachToBermuda!.bearing < 360).toBe(true);
      expect(!hasClosestApproach || result.closestApproachToBermuda!.point !== undefined).toBe(true);
      expect(!hasClosestApproach || result.closestApproachToBermuda!.point.lat !== undefined).toBe(true);
      expect(!hasClosestApproach || result.closestApproachToBermuda!.point.lng !== undefined).toBe(true);
    });
  });

  describe('distance and bearing calculations', () => {
    test('should calculate great circle distance correctly', () => {
      // Test known distance: Bermuda to Cape Canaveral
      const bermuda = { lat: 32.3078, lng: -64.7505 };
      const capeCanaveral = { lat: 28.5618571, lng: -80.577366 };
      
      // Calculate using Haversine formula
      const R = 6371; // Earth's radius in km
      const dLat = (capeCanaveral.lat - bermuda.lat) * Math.PI / 180;
      const dLng = (capeCanaveral.lng - bermuda.lng) * Math.PI / 180;
      const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(bermuda.lat * Math.PI / 180) * Math.cos(capeCanaveral.lat * Math.PI / 180) *
        Math.sin(dLng / 2) * Math.sin(dLng / 2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      const distance = R * c;
      
      // Should be approximately 1200km
      expect(distance).toBeGreaterThan(1100);
      expect(distance).toBeLessThan(1300);
    });

    test('should calculate bearing correctly', () => {
      // Test bearing from Bermuda to Cape Canaveral
      const bermuda = { lat: 32.3078, lng: -64.7505 };
      const capeCanaveral = { lat: 28.5618571, lng: -80.577366 };
      
      const dLng = (capeCanaveral.lng - bermuda.lng) * Math.PI / 180;
      const y = Math.sin(dLng) * Math.cos(capeCanaveral.lat * Math.PI / 180);
      const x = Math.cos(bermuda.lat * Math.PI / 180) * Math.sin(capeCanaveral.lat * Math.PI / 180) -
        Math.sin(bermuda.lat * Math.PI / 180) * Math.cos(capeCanaveral.lat * Math.PI / 180) * Math.cos(dLng);
      
      let bearing = Math.atan2(y, x) * 180 / Math.PI;
      bearing = (bearing + 360) % 360;
      
      // Should be roughly southwest (around 225 degrees)
      expect(bearing).toBeGreaterThan(200);
      expect(bearing).toBeLessThan(250);
    });
  });

  describe('cache functionality', () => {
    test('should cache analysis results correctly', async () => {
      const { isBrowser } = require('../utils/environmentUtils');
      (isBrowser as jest.Mock).mockReturnValue(false);

      const testUrl = 'https://example.com/test-trajectory.jpg';
      
      // First call should analyze and cache
      const result1 = await analyzeTrajectoryImage(testUrl);
      expect(result1.success).toBe(true);
      
      // Cache the result
      cacheAnalysis(testUrl, result1);
      
      // Second call should return cached result
      const cached = getCachedAnalysis(testUrl);
      expect(cached).toEqual(result1);
    });

    test('should handle cache expiry', () => {
      const testUrl = 'https://example.com/test-trajectory.jpg';
      const testResult: TrajectoryImageAnalysis = {
        success: true,
        trajectoryPoints: [],
        closestApproachToBermuda: null,
        imageUrl: testUrl,
        analysisMethod: 'filename-analysis',
        trajectoryDirection: 'Northeast'
      };
      
      // Cache result
      cacheAnalysis(testUrl, testResult);
      
      // Should be available immediately
      expect(getCachedAnalysis(testUrl)).toEqual(testResult);
      
      // Clear cache
      clearAnalysisCache();
      
      // Should no longer be available
      expect(getCachedAnalysis(testUrl)).toBeNull();
    });
  });

  describe('error handling', () => {
    test('should handle analysis errors gracefully', async () => {
      const { isBrowser, hasCanvasSupport } = require('../utils/environmentUtils');
      (isBrowser as jest.Mock).mockReturnValue(true);
      (hasCanvasSupport as jest.Mock).mockReturnValue(true);

      // Mock canvas operations to fail
      const mockCreateElement = jest.fn(() => {
        throw new Error('Canvas creation failed');
      });
      Object.defineProperty(document, 'createElement', {
        value: mockCreateElement,
        writable: true
      });

      const testUrl = 'https://example.com/test-trajectory.jpg';
      const result = await analyzeTrajectoryImage(testUrl);

      // Should fall back to filename analysis
      expect(result.success).toBe(true);
      expect(result.analysisMethod).toBe('filename-analysis');
    });

    test('should handle missing launch data', async () => {
      const { isBrowser } = require('../utils/environmentUtils');
      (isBrowser as jest.Mock).mockReturnValue(false);

      const testUrl = 'https://example.com/unknown-trajectory.jpg';
      const result = await analyzeTrajectoryImage(testUrl); // No launch data

      expect(result.success).toBe(true);
      expect(result.trajectoryDirection).toBe('Northeast'); // Default assumption
      expect(result.analysisMethod).toBe('fallback');
    });

    test('should return error analysis for complete failures', async () => {
      // Mock everything to fail
      const { isBrowser } = require('../utils/environmentUtils');
      (isBrowser as jest.Mock).mockImplementation(() => {
        throw new Error('Environment check failed');
      });

      const testUrl = 'https://example.com/test-trajectory.jpg';
      const result = await analyzeTrajectoryImage(testUrl);

      expect(result.success).toBe(false);
      expect(result.analysisMethod).toBe('error');
      expect(result.error).toBeDefined();
      expect(result.trajectoryPoints).toHaveLength(0);
    });
  });

  describe('URL pattern variations', () => {
    const urlVariations = [
      'https://www.spacelaunchschedule.com/wp-content/uploads/2024/01/trajectory-northeast.jpg',
      'https://example.com/uploads/trajectory-fl-north.png',
      'https://example.com/images/flight-profile-east.webp',
      'https://example.com/trajecoty-typo-north.gif' // Test typo handling
    ];

    urlVariations.forEach(url => {
      test(`should handle URL variation: ${url}`, async () => {
        const { isBrowser } = require('../utils/environmentUtils');
        (isBrowser as jest.Mock).mockReturnValue(false);

        const result = await analyzeTrajectoryImage(url);
        
        expect(result.success).toBe(true);
        expect(result.imageUrl).toBe(url);
        expect(result.trajectoryDirection).toBeDefined();
        expect(['Northeast', 'East', 'Southeast', 'Unknown']).toContain(result.trajectoryDirection);
      });
    });
  });
});