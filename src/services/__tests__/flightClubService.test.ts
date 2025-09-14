/**
 * Tests for Flight Club telemetry service
 */

import { 
  findFirstVisibleFrame, 
  findAllVisibleFrames, 
  analyzeVisibility,
  TelemetryFrame 
} from '../flightClubService';

// Mock telemetry data for testing
const mockTelemetry: TelemetryFrame[] = [
  { time: 0, lat: 28.5, lon: -80.6, alt: 0 },        // Launch
  { time: 60, lat: 29.0, lon: -79.5, alt: 50000 },   // Ascending
  { time: 120, lat: 29.5, lon: -78.0, alt: 100000 }, // Higher
  { time: 180, lat: 30.0, lon: -76.0, alt: 150000 }, // Potentially visible
  { time: 240, lat: 31.0, lon: -74.0, alt: 150000 }, // Closer to Bermuda
  { time: 300, lat: 32.0, lon: -70.0, alt: 150000 }, // Very close
  { time: 360, lat: 33.0, lon: -66.0, alt: 150000 }, // Moving away
  { time: 420, lat: 34.0, lon: -62.0, alt: 150000 }, // Far
];

describe('Flight Club Service', () => {
  test('findFirstVisibleFrame should find first visible moment', () => {
    const result = findFirstVisibleFrame(mockTelemetry);
    
    expect(result).toBeTruthy();
    expect(result?.time).toBeGreaterThan(0);
    expect(result?.distance_km).toBeLessThan(2000); // Should be within visibility range
    expect(result?.bearing).toBeGreaterThanOrEqual(0);
    expect(result?.bearing).toBeLessThan(360);
  });

  test('findAllVisibleFrames should find multiple visible frames', () => {
    const results = findAllVisibleFrames(mockTelemetry);
    
    expect(results.length).toBeGreaterThan(0);
    results.forEach(frame => {
      expect(frame.distance_km).toBeLessThan(2000);
      expect(frame.time).toBeLessThanOrEqual(600); // Within 10 minutes
    });
  });

  test('analyzeVisibility should provide complete visibility analysis', () => {
    const analysis = analyzeVisibility(mockTelemetry);
    
    expect(typeof analysis.isVisible).toBe('boolean');
    expect(typeof analysis.totalVisibleFrames).toBe('number');
    
    // Properties should exist regardless of visibility
    expect(analysis.firstVisible).toBeDefined();
    expect(analysis.lastVisible).toBeDefined();
    expect(analysis.closestApproach).toBeDefined();
  });

  test('analyzeVisibility should have consistent visible frame count when visible', () => {
    const analysis = analyzeVisibility(mockTelemetry);
    
    // Only test the positive case to avoid conditional expects
    const shouldHaveFrames = analysis.isVisible;
    expect(shouldHaveFrames ? analysis.totalVisibleFrames > 0 : analysis.totalVisibleFrames === 0).toBe(true);
  });

  test('analyzeVisibility should have zero visible frames when not visible', () => {
    // Create telemetry that definitely won't be visible (too far away)
    const farAwayTelemetry: TelemetryFrame[] = [
      { time: 0, lat: 60.0, lon: 60.0, alt: 50000 },
      { time: 60, lat: 61.0, lon: 61.0, alt: 100000 }
    ];
    
    const analysis = analyzeVisibility(farAwayTelemetry);
    
    expect(analysis.isVisible).toBe(false);
    expect(analysis.totalVisibleFrames).toBe(0);
  });

  test('should handle empty telemetry gracefully', () => {
    const emptyTelemetry: TelemetryFrame[] = [];
    
    const firstVisible = findFirstVisibleFrame(emptyTelemetry);
    const allVisible = findAllVisibleFrames(emptyTelemetry);
    const analysis = analyzeVisibility(emptyTelemetry);
    
    expect(firstVisible).toBeNull();
    expect(allVisible).toHaveLength(0);
    expect(analysis.isVisible).toBe(false);
    expect(analysis.totalVisibleFrames).toBe(0);
  });
});