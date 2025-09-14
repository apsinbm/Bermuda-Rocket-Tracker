/**
 * Geometric Visibility Service
 * 
 * Physics-based rocket visibility calculations considering:
 * - Line-of-sight geometry from Bermuda
 * - Earth's curvature and horizon effects
 * - Trajectory path analysis with distance/altitude
 * - Time-of-day illumination factors
 */

import { Launch, GeometricVisibilityResult, VisibilityFactors, TrajectoryPoint } from '../types';

// Bermuda coordinates
const BERMUDA_LAT = 32.3078;
const BERMUDA_LNG = -64.7505;
const EARTH_RADIUS_KM = 6371;

// East Coast Launch Facility Coordinates
const LAUNCH_SITES = {
  // Florida facilities
  CAPE_CANAVERAL: { lat: 28.5618, lng: -80.5772 },
  KENNEDY: { lat: 28.6080, lng: -80.6040 },
  // Virginia facilities  
  WALLOPS: { lat: 37.8337, lng: -75.4881 }
};

// Default launch site (Cape Canaveral for backward compatibility)
const DEFAULT_LAUNCH_SITE = LAUNCH_SITES.CAPE_CANAVERAL;

export class GeometricVisibilityService {
  
  /**
   * Get launch site coordinates based on launch pad location
   */
  private static getLaunchSiteCoords(launch: Launch): { lat: number; lng: number } {
    const locationName = launch.pad.location.name.toLowerCase();
    const padName = launch.pad.name.toLowerCase();
    
    // Check for specific facilities
    if (locationName.includes('wallops') || locationName.includes('virginia')) {
      return LAUNCH_SITES.WALLOPS;
    } else if (locationName.includes('kennedy') || padName.includes('lc-39') || padName.includes('lc39')) {
      return LAUNCH_SITES.KENNEDY;  
    } else if (locationName.includes('cape canaveral') || locationName.includes('ccafs') || locationName.includes('cafs')) {
      return LAUNCH_SITES.CAPE_CANAVERAL;
    }
    
    // Default to Cape Canaveral for Florida launches or unknown locations
    return DEFAULT_LAUNCH_SITE;
  }
  
  /**
   * Calculate comprehensive visibility based on physics and geometry
   */
  static calculateVisibility(launch: Launch): GeometricVisibilityResult {
    
    // Get trajectory information
    const trajectoryInfo = this.getTrajectoryInfo(launch);
    
    // Generate trajectory points along the flight path
    const trajectoryPoints = this.generateTrajectoryPoints(launch, trajectoryInfo);
    
    // Calculate enhanced 2nd stage visibility window
    const secondStageWindow = this.calculate2ndStageVisibilityWindow(launch, trajectoryInfo);
    
    // Validate trajectory makes geographic sense
    const validation = this.validateTrajectory(trajectoryPoints, trajectoryInfo, launch);
    
    // Analyze visibility factors including 2nd stage window  
    const factors = this.analyzeVisibilityFactors(trajectoryPoints, launch);
    
    // Determine final visibility result
    const result = this.determineVisibilityResult(factors);
    
    // Add validation warnings to result if needed
    let finalReason = result.reason;
    if (validation.warnings.length > 0) {
      console.warn(`[GeometricVisibility] ${launch.mission.name} trajectory warnings:`, validation.warnings);
    }
    
    return {
      isVisible: result.isVisible,
      likelihood: result.likelihood,
      reason: finalReason,
      factors,
      trajectoryPoints
    };
  }
  
  /**
   * Validate that trajectory calculations make geographic sense
   */
  private static validateTrajectory(trajectoryPoints: TrajectoryPoint[], trajectoryInfo: any, launch: Launch) {
    const warnings: string[] = [];
    const missionName = launch.mission.name;
    
    if (trajectoryPoints.length === 0) {
      warnings.push('No trajectory points generated');
      return { warnings };
    }
    
    // Find trajectory endpoints to validate direction
    const startPoint = trajectoryPoints[0];
    // const midPoint = trajectoryPoints[Math.floor(trajectoryPoints.length / 2)]; // Unused for now
    const endPoint = trajectoryPoints[trajectoryPoints.length - 1];
    
    // Calculate actual direction traveled
    const latChange = endPoint.latitude - startPoint.latitude;
    const lngChange = endPoint.longitude - startPoint.longitude;
    
    // Validate direction matches expected trajectory
    const expectedDirection = trajectoryInfo.direction.toLowerCase();
    if (expectedDirection.includes('north') && latChange < 0) {
      warnings.push(`Expected northward trajectory but rocket moves south (${latChange.toFixed(2)}° lat change)`);
    }
    if (expectedDirection.includes('south') && latChange > 0) {
      warnings.push(`Expected southward trajectory but rocket moves north (${latChange.toFixed(2)}° lat change)`);
    }
    if (expectedDirection.includes('east') && lngChange < 0) {
      warnings.push(`Expected eastward trajectory but rocket moves west (${lngChange.toFixed(2)}° lng change)`);
    }
    if (expectedDirection.includes('west') && lngChange > 0) {
      warnings.push(`Expected westward trajectory but rocket moves east (${lngChange.toFixed(2)}° lng change)`);
    }
    
    // Find closest approach point and validate distance makes sense
    const closestPoint = trajectoryPoints.reduce((closest, point) => 
      point.distance < closest.distance ? point : closest
    );
    
    // Geographic sanity checks
    if (closestPoint.distance < 200) {
      warnings.push(`Closest approach ${closestPoint.distance.toFixed(0)}km seems too close - may indicate calculation error`);
    }
    
    // Check if trajectory actually passes near known geographic features
    const bermudaDistance = 1100; // Approximate distance from Florida to Bermuda
    if (closestPoint.distance < bermudaDistance * 0.5 && !expectedDirection.includes('north')) {
      warnings.push(`Non-northern trajectory claims ${closestPoint.distance.toFixed(0)}km closest approach, but geographic distance Cape Canaveral-Bermuda is ~${bermudaDistance}km`);
    }
    
    // Log trajectory info for debugging
    console.log(`[GeometricVisibility] ${missionName}: ${expectedDirection} trajectory, closest approach ${closestPoint.distance.toFixed(0)}km at T+${closestPoint.time}s (${closestPoint.latitude.toFixed(2)}, ${closestPoint.longitude.toFixed(2)})`);
    
    return { warnings };
  }
  
  /**
   * Get trajectory information for the launch
   */
  private static getTrajectoryInfo(launch: Launch) {
    const missionName = launch.mission?.name?.toLowerCase() || '';
    const orbitType = launch.mission?.orbit?.name?.toLowerCase() || '';
    
    // Determine trajectory based on mission type
    // ISS, Dragon, Cygnus, and most crewed missions - Northeast trajectory toward ISS
    if (missionName.includes('starlink') || missionName.includes('dragon') || 
        missionName.includes('iss') || orbitType.includes('iss') || 
        missionName.includes('crew') || missionName.includes('cygnus') || 
        missionName.includes('crs')) {
      return { azimuth: 50, direction: 'Northeast', confidence: 'high' };
    }
    
    // GTO/GEO missions - Initially east, then dogleg southeast
    if (orbitType.includes('gto') || orbitType.includes('geo')) {
      return { azimuth: 90, direction: 'East', confidence: 'medium' };
    }
    
    // Sun-Synchronous Orbit missions - Southeast trajectory
    if (orbitType.includes('sso') || orbitType.includes('sun-synchronous') ||
        missionName.includes('kompsat') || orbitType.includes('polar') ||
        missionName.includes('landsat')) {
      return { azimuth: 140, direction: 'Southeast', confidence: 'high' };
    }
    
    // True polar missions - Due south
    if (orbitType.includes('polar') && !orbitType.includes('sun-synchronous')) {
      return { azimuth: 180, direction: 'South', confidence: 'high' };
    }
    
    // Military/defense missions - Can vary widely
    if (missionName.includes('ussf') || missionName.includes('nro') || 
        missionName.includes('x-37b') || missionName.includes('otv')) {
      // X-37B and OTV missions typically go northeast
      if (missionName.includes('x-37b') || missionName.includes('otv')) {
        return { azimuth: 50, direction: 'Northeast', confidence: 'high' };
      }
      // Other USSF missions vary - default to east
      return { azimuth: 90, direction: 'East', confidence: 'low' };
    }
    
    // Westward launches (rare from Florida, would be very specific missions)
    // These would be retrograde and extremely unusual from Cape Canaveral
    // Most westward launches happen from Vandenberg, not Florida
    if (orbitType.includes('retrograde')) {
      return { azimuth: 270, direction: 'West', confidence: 'low' };
    }
    
    // Default LEO missions typically go northeast
    return { azimuth: 60, direction: 'Northeast', confidence: 'medium' };
  }
  
  /**
   * Generate trajectory points for the flight path
   */
  private static generateTrajectoryPoints(launch: Launch, trajectoryInfo: any): TrajectoryPoint[] {
    const points: TrajectoryPoint[] = [];
    // const launchTime = new Date(launch.net); // Unused for now
    const launchSite = this.getLaunchSiteCoords(launch);
    
    // Simulate trajectory points every 30 seconds for 15 minutes
    for (let t = 0; t <= 900; t += 30) {
      const point = this.calculateTrajectoryPoint(t, trajectoryInfo, launchSite);
      points.push(point);
    }
    
    return points;
  }
  
  /**
   * Enhanced 2nd stage visibility calculation
   * Focus on when 2nd stage becomes visible until SECO
   */
  private static calculate2ndStageVisibilityWindow(launch: Launch, trajectoryInfo: any): { 
    visibilityStart: number | null;
    visibilityEnd: number | null; 
    stageSeparationTime: number;
    estimatedSecoTime: number;
    reason: string;
  } {
    const launchSite = this.getLaunchSiteCoords(launch);
    const missionName = launch.mission?.name?.toLowerCase() || '';
    const orbitType = launch.mission?.orbit?.name?.toLowerCase() || '';
    
    // Estimate stage separation timing based on launch type
    let stageSeparationTime = 150; // Default ~2.5 minutes for Falcon 9
    let estimatedSecoTime = 480; // Default ~8 minutes
    
    // Adjust timings based on mission profile
    if (missionName.includes('starlink') || missionName.includes('dragon') || 
        missionName.includes('crew') || orbitType.includes('iss')) {
      // ISS missions: shorter second stage burn
      stageSeparationTime = 160; // Slightly longer first stage for ISS trajectory
      estimatedSecoTime = 540; // ~9 minutes total
    } else if (orbitType.includes('gto') || orbitType.includes('geo')) {
      // GTO missions: much longer second stage coast and relight
      stageSeparationTime = 140; // Shorter first stage for GTO trajectory  
      estimatedSecoTime = 1680; // ~28 minutes (SECO-1 at ~8min, SECO-2 at ~28min)
    } else if (orbitType.includes('sso') || orbitType.includes('polar')) {
      // SSO missions: standard profile
      stageSeparationTime = 150;
      estimatedSecoTime = 450; // ~7.5 minutes
    }
    
    // Calculate detailed trajectory points during 2nd stage window
    let visibilityStart = null;
    let visibilityEnd = null;
    let reason = '';
    
    // Check trajectory points every 15 seconds during 2nd stage window
    for (let t = stageSeparationTime; t <= estimatedSecoTime; t += 15) {
      const point = this.calculateTrajectoryPoint(t, trajectoryInfo, launchSite);
      
      // 2nd stage is visible if above horizon
      if (point.aboveHorizon && point.distance < 1500) { // 1500km visibility limit
        if (visibilityStart === null) {
          visibilityStart = t;
        }
        visibilityEnd = t;
      }
    }
    
    // Generate reason based on results
    if (visibilityStart !== null && visibilityEnd !== null) {
      const durationMinutes = Math.round((visibilityEnd - visibilityStart) / 60);
      const startMinutes = Math.floor(visibilityStart / 60);
      const startSeconds = Math.round(visibilityStart % 60);
      const endMinutes = Math.floor(visibilityEnd / 60);
      const endSeconds = Math.round(visibilityEnd % 60);
      
      reason = `2nd stage visible from T+${startMinutes}:${String(startSeconds).padStart(2,'0')} to T+${endMinutes}:${String(endSeconds).padStart(2,'0')} (${durationMinutes} minutes)`;
    } else if (visibilityStart === null) {
      reason = '2nd stage remains below horizon from Bermuda';
    } else {
      reason = '2nd stage visibility window too brief to observe';
    }
    
    return {
      visibilityStart,
      visibilityEnd,
      stageSeparationTime,
      estimatedSecoTime,
      reason
    };
  }
  
  /**
   * Calculate a single trajectory point using realistic orbital mechanics
   */
  private static calculateTrajectoryPoint(timeSeconds: number, trajectoryInfo: any, launchSite: { lat: number; lng: number }): TrajectoryPoint {
    const azimuthRad = (trajectoryInfo.azimuth * Math.PI) / 180;
    const altitude = this.calculateAltitude(timeSeconds);
    
    // Realistic ground track velocity calculation
    // Rocket ground speed varies with altitude and trajectory phase
    let groundSpeed; // km/s
    
    if (timeSeconds < 60) {
      // First stage: Low speed, mostly vertical
      groundSpeed = timeSeconds * 0.05; // 0 to 3 km/s over 60s
    } else if (timeSeconds < 180) {
      // Second stage acceleration phase
      const phaseProgress = (timeSeconds - 60) / 120; // 0 to 1 over 2 minutes
      groundSpeed = 3 + phaseProgress * 4; // 3 to 7 km/s
    } else {
      // Orbital velocity phase - account for Earth's rotation
      groundSpeed = 7.5; // ~7.5 km/s ground track speed
    }
    
    // Calculate ground distance traveled
    const groundDistance = this.calculateGroundDistance(timeSeconds, groundSpeed);
    
    // Account for Earth's curvature in trajectory calculation
    const earthRotation = timeSeconds * 0.004167; // Earth rotates 0.25°/min = 0.004167°/s
    const effectiveAzimuth = azimuthRad - (earthRotation * Math.PI / 180);
    
    // Calculate position relative to launch site using spherical geometry
    const angularDistance = groundDistance / EARTH_RADIUS_KM; // radians
    
    const lat1Rad = launchSite.lat * Math.PI / 180;
    const lng1Rad = launchSite.lng * Math.PI / 180;
    
    // Great circle navigation formulas
    const lat2Rad = Math.asin(
      Math.sin(lat1Rad) * Math.cos(angularDistance) +
      Math.cos(lat1Rad) * Math.sin(angularDistance) * Math.cos(effectiveAzimuth)
    );
    
    const lng2Rad = lng1Rad + Math.atan2(
      Math.sin(effectiveAzimuth) * Math.sin(angularDistance) * Math.cos(lat1Rad),
      Math.cos(angularDistance) - Math.sin(lat1Rad) * Math.sin(lat2Rad)
    );
    
    const latitude = lat2Rad * 180 / Math.PI;
    const longitude = lng2Rad * 180 / Math.PI;
    
    // Calculate distance and bearing from Bermuda
    const distance = this.calculateDistance(BERMUDA_LAT, BERMUDA_LNG, latitude, longitude);
    const bearing = this.calculateBearing(BERMUDA_LAT, BERMUDA_LNG, latitude, longitude);
    
    // Calculate if above horizon from Bermuda
    const { aboveHorizon, elevationAngle } = this.calculateHorizonVisibility(distance, altitude);
    
    // Determine stage and engine status based on time
    const stageInfo = this.determineStageInfo(timeSeconds);
    
    return {
      time: timeSeconds,
      latitude,
      longitude,
      altitude,
      distance,
      bearing,
      aboveHorizon,
      elevationAngle,
      visible: aboveHorizon, // alias for aboveHorizon
      stage: stageInfo.stage,
      engineStatus: stageInfo.engineStatus
    };
  }
  
  /**
   * Determine rocket stage and engine status from time
   */
  private static determineStageInfo(timeSeconds: number): { stage: TrajectoryPoint['stage'], engineStatus: TrajectoryPoint['engineStatus'] } {
    // Fallback to typical Falcon 9 flight profile timings
    const FIRST_STAGE_BURN_END = 162; // ~2:42 - First stage MECO
    const STAGE_SEPARATION = 165; // ~2:45 - Stage separation
    const SECOND_STAGE_IGNITION = 168; // ~2:48 - Second stage MVac ignition  
    const SECOND_STAGE_BURN_END = 540; // ~9:00 - Second stage SECO-1
    
    if (timeSeconds <= FIRST_STAGE_BURN_END) {
      return { stage: 'first', engineStatus: 'burning' };
    } else if (timeSeconds <= STAGE_SEPARATION) {
      return { stage: 'first', engineStatus: 'shutdown' };
    } else if (timeSeconds <= SECOND_STAGE_IGNITION) {
      return { stage: 'separation', engineStatus: 'separation' };
    } else if (timeSeconds <= SECOND_STAGE_BURN_END) {
      return { stage: 'second-burn', engineStatus: 'burning' };
    } else {
      return { stage: 'second-coast', engineStatus: 'shutdown' };
    }
  }

  /**
   * Calculate cumulative ground distance with realistic acceleration
   */
  private static calculateGroundDistance(timeSeconds: number, currentSpeed: number): number {
    // Integration of speed over time for more accurate distance
    let totalDistance = 0;
    
    // Calculate distance in 10-second intervals for better accuracy
    for (let t = 0; t < timeSeconds; t += 10) {
      let speed;
      if (t < 60) {
        speed = t * 0.05;
      } else if (t < 180) {
        const phaseProgress = (t - 60) / 120;
        speed = 3 + phaseProgress * 4;
      } else {
        speed = 7.5;
      }
      totalDistance += speed * 10; // speed * time_interval
    }
    
    // Handle remainder
    const remainder = timeSeconds % 10;
    if (remainder > 0) {
      totalDistance += currentSpeed * remainder;
    }
    
    return Math.min(totalDistance, 3000); // Cap at 3000km for safety
  }
  
  /**
   * Calculate realistic altitude profile
   */
  private static calculateAltitude(timeSeconds: number): number {
    if (timeSeconds < 60) {
      // First stage: 0-60s, 0-100km
      return (timeSeconds / 60) * 100;
    } else if (timeSeconds < 300) {
      // Second stage: 60-300s, 100-400km
      return 100 + ((timeSeconds - 60) / 240) * 300;
    } else {
      // Coasting/deployment: 300+s, maintain ~400km
      return 400;
    }
  }
  
  /**
   * Calculate if rocket is visible above horizon from Bermuda
   */
  private static calculateHorizonVisibility(distanceKm: number, altitudeKm: number) {
    // Calculate theoretical horizon distance for given altitude
    const horizonDistance = Math.sqrt(2 * EARTH_RADIUS_KM * altitudeKm + altitudeKm * altitudeKm);
    
    const aboveHorizon = distanceKm <= horizonDistance;
    
    // Calculate elevation angle
    let elevationAngle = 0;
    if (aboveHorizon && distanceKm > 0) {
      // Use spherical geometry to calculate elevation angle
      const earthCenterAngle = Math.acos(EARTH_RADIUS_KM / (EARTH_RADIUS_KM + altitudeKm));
      const observerAngle = Math.asin(distanceKm / (EARTH_RADIUS_KM + altitudeKm));
      elevationAngle = Math.max(0, (earthCenterAngle - observerAngle) * (180 / Math.PI));
    }
    
    return { aboveHorizon, elevationAngle };
  }
  
  /**
   * Analyze all visibility factors
   */
  private static analyzeVisibilityFactors(trajectoryPoints: TrajectoryPoint[], launch: Launch, secondStageWindow?: any): VisibilityFactors {
    const visiblePoints = trajectoryPoints.filter(p => p.aboveHorizon);
    const hasVisibility = visiblePoints.length > 0;
    
    // Get trajectory information for actual rocket direction
    const trajectoryInfo = this.getTrajectoryInfo(launch);
    
    // Find closest approach
    const closestPoint = trajectoryPoints.reduce((closest, point) => 
      point.distance < closest.distance ? point : closest
    );
    
    // Find visibility window - prefer 2nd stage calculation when available
    let visibilityStart = -1;
    let visibilityEnd = -1;
    let visibilityReason = '';
    
    if (secondStageWindow && secondStageWindow.visibilityStart !== null && secondStageWindow.visibilityEnd !== null) {
      // Use enhanced 2nd stage visibility window
      visibilityStart = secondStageWindow.visibilityStart / 60; // Convert to minutes
      visibilityEnd = secondStageWindow.visibilityEnd / 60;
      visibilityReason = secondStageWindow.reason;
    } else if (hasVisibility) {
      // Fallback to general visibility window
      visibilityStart = visiblePoints[0].time / 60; // Convert to minutes
      visibilityEnd = visiblePoints[visiblePoints.length - 1].time / 60;
      visibilityReason = `General visibility from T+${Math.round(visibilityStart)} to T+${Math.round(visibilityEnd)} minutes`;
    } else {
      visibilityReason = secondStageWindow?.reason || 'Not visible from Bermuda';
    }
    
    // Determine time of day
    const launchTime = new Date(launch.net);
    const timeOfDay = this.determineTimeOfDay(launchTime);
    
    // Calculate maximum values
    const maxAltitude = Math.max(...trajectoryPoints.map(p => p.altitude));
    const maxViewingAngle = hasVisibility ? Math.max(...visiblePoints.map(p => p.elevationAngle)) : 0;
    
    // Generate viewing instructions
    const viewingInstructions = this.generateViewingInstructions(trajectoryPoints, trajectoryInfo, visiblePoints);
    
    return {
      geometricVisibility: hasVisibility,
      maxAltitude,
      closestApproach: closestPoint.distance,
      visibilityWindow: {
        start: visibilityStart,
        end: visibilityEnd,
        duration: visibilityEnd > visibilityStart ? visibilityEnd - visibilityStart : 0
      },
      timeOfDay,
      exhaustPlumeIlluminated: timeOfDay !== 'day',
      trajectoryDirection: trajectoryInfo.direction, // Actual rocket direction
      initialViewingDirection: viewingInstructions.initialDirection,
      trackingPath: viewingInstructions.trackingPath,
      maxViewingAngle,
      visibilityReason
    };
  }
  
  /**
   * Generate comprehensive viewing instructions for observers in Bermuda
   */
  private static generateViewingInstructions(trajectoryPoints: TrajectoryPoint[], trajectoryInfo: any, visiblePoints: TrajectoryPoint[]) {
    if (visiblePoints.length === 0) {
      return {
        initialDirection: 'Not visible',
        trackingPath: 'Not visible from Bermuda'
      };
    }
    
    // Get key points for tracking
    const firstVisible = visiblePoints[0];
    const lastVisible = visiblePoints[visiblePoints.length - 1];
    const midVisible = visiblePoints[Math.floor(visiblePoints.length / 2)];
    
    // Convert bearings to directions
    const startDirection = this.getDirectionFromBearing(firstVisible.bearing);
    const midDirection = this.getDirectionFromBearing(midVisible.bearing);
    const endDirection = this.getDirectionFromBearing(lastVisible.bearing);
    
    // Generate tracking path based on rocket trajectory
    const rocketDirection = trajectoryInfo.direction.toLowerCase();
    let trackingPath = '';
    
    if (rocketDirection.includes('northeast')) {
      // ISS/Crew missions: rocket travels NE, appears SW, moves to W/NW
      trackingPath = this.generateTrackingPath([startDirection, midDirection, endDirection]);
    } else if (rocketDirection.includes('east')) {
      // GTO missions: rocket travels E, appears S, moves to SW/W
      trackingPath = this.generateTrackingPath([startDirection, midDirection, endDirection]);
    } else if (rocketDirection.includes('southeast')) {
      // SSO missions: rocket travels SE, appears SW, moves away
      trackingPath = this.generateTrackingPath([startDirection, midDirection, endDirection]);
    } else {
      // Generic path
      trackingPath = this.generateTrackingPath([startDirection, midDirection, endDirection]);
    }
    
    return {
      initialDirection: startDirection,
      trackingPath: trackingPath
    };
  }
  
  /**
   * Generate smooth tracking path description
   */
  private static generateTrackingPath(directions: string[]): string {
    // Remove duplicates while preserving order
    const uniqueDirections = directions.filter((dir, index) => 
      index === 0 || dir !== directions[index - 1]
    );
    
    if (uniqueDirections.length === 1) {
      return `Remains in ${uniqueDirections[0]}`;
    } else if (uniqueDirections.length === 2) {
      return `${uniqueDirections[0]} → ${uniqueDirections[1]}`;
    } else {
      return uniqueDirections.join(' → ');
    }
  }
  
  /**
   * Determine final visibility result based on factors
   */
  private static determineVisibilityResult(factors: VisibilityFactors) {
    if (!factors.geometricVisibility) {
      return {
        isVisible: false,
        likelihood: 'none' as const,
        reason: `Not visible from Bermuda - ${factors.trajectoryDirection.toLowerCase()} trajectory travels away from Bermuda. Closest approach: ${Math.round(factors.closestApproach)}km.`
      };
    }
    
    // Enhanced directional analysis - reject trajectories going away from Bermuda
    const unfavorableDirections = ['South', 'Southwest', 'West', 'Southeast'];
    const isUnfavorableDirection = unfavorableDirections.some(dir => 
      factors.trajectoryDirection.toLowerCase().includes(dir.toLowerCase())
    );
    
    // Reject launches that travel away from Bermuda with poor viewing conditions
    if (isUnfavorableDirection && factors.closestApproach > 1200 && factors.maxViewingAngle < 10) {
      return {
        isVisible: false,
        likelihood: 'none' as const,
        reason: `Not visible from Bermuda - ${factors.trajectoryDirection.toLowerCase()} trajectory travels away from Bermuda toward ${factors.trajectoryDirection.toLowerCase()}. Closest approach: ${Math.round(factors.closestApproach)}km with maximum elevation of only ${Math.round(factors.maxViewingAngle)}°.`
      };
    }
    
    // Visible, determine likelihood based on new three-tier system
    let likelihood: 'high' | 'medium' | 'low' = 'low';
    let reason = '';
    
    // Apply new visibility scoring based on real-world observations
    if (factors.timeOfDay === 'twilight') {
      // Twilight = Optimal conditions
      if (factors.closestApproach < 800 && factors.maxViewingAngle > 5) {
        likelihood = 'high';
        reason = `Optimal viewing conditions - twilight launch with ${factors.trajectoryDirection.toLowerCase()} trajectory. Exhaust plume illuminated by sun against dark sky. Passes within ${Math.round(factors.closestApproach)}km at ${Math.round(factors.maxViewingAngle)}° elevation.`;
      } else if (factors.maxViewingAngle > 0) {
        likelihood = 'medium';
        reason = `Good viewing conditions - twilight launch with ${factors.trajectoryDirection.toLowerCase()} trajectory. Passes ${Math.round(factors.closestApproach)}km away at ${Math.round(factors.maxViewingAngle)}° elevation.`;
      }
    } else if (factors.timeOfDay === 'night') {
      // Night = Good conditions (exhaust plume glow visible)
      if (factors.closestApproach < 800 && factors.maxViewingAngle > 5) {
        likelihood = 'high';
        reason = `Good viewing conditions - night launch with ${factors.trajectoryDirection.toLowerCase()} trajectory. Exhaust plume glow clearly visible against dark sky. Passes within ${Math.round(factors.closestApproach)}km at ${Math.round(factors.maxViewingAngle)}° elevation.`;
      } else if (factors.closestApproach < 1200 && factors.maxViewingAngle > 0) {
        likelihood = 'medium';
        reason = `Good viewing conditions - night launch with ${factors.trajectoryDirection.toLowerCase()} trajectory. Exhaust plume visible against dark sky. Passes ${Math.round(factors.closestApproach)}km away at ${Math.round(factors.maxViewingAngle)}° elevation.`;
      } else if (factors.maxViewingAngle > 0) {
        likelihood = 'low';
        reason = `Fair viewing conditions - night launch but distant ${factors.trajectoryDirection.toLowerCase()} trajectory. Passes ${Math.round(factors.closestApproach)}km away at ${Math.round(factors.maxViewingAngle)}° elevation.`;
      }
    } else {
      // Day = Challenging conditions
      if (factors.closestApproach < 400 && factors.maxViewingAngle > 20) {
        likelihood = 'low';
        reason = `Challenging viewing conditions - daytime launch with ${factors.trajectoryDirection.toLowerCase()} trajectory. Look for bright dot or contrail. Passes ${Math.round(factors.closestApproach)}km away at ${Math.round(factors.maxViewingAngle)}° elevation.`;
      } else if (factors.maxViewingAngle > 0) {
        likelihood = 'low';
        reason = `Very challenging viewing - daytime launch with ${factors.trajectoryDirection.toLowerCase()} trajectory. Daylight washes out exhaust glow. Passes ${Math.round(factors.closestApproach)}km away at ${Math.round(factors.maxViewingAngle)}° elevation.`;
      }
    }
    
    // Apply unfavorable direction penalty only for day launches
    if (isUnfavorableDirection && factors.timeOfDay === 'day') {
      likelihood = 'low';
      reason = `Very challenging viewing - daytime ${factors.trajectoryDirection.toLowerCase()} trajectory travels away from Bermuda. Distance ${Math.round(factors.closestApproach)}km with ${Math.round(factors.maxViewingAngle)}° elevation. Very difficult to spot.`;
    } else if (isUnfavorableDirection && factors.closestApproach > 1200) {
      // Still penalize very distant unfavorable trajectories even at night/twilight
      likelihood = 'low';
      reason = `Limited visibility - ${factors.trajectoryDirection.toLowerCase()} trajectory travels away from Bermuda. Distance ${Math.round(factors.closestApproach)}km with low elevation angle (${Math.round(factors.maxViewingAngle)}°). ${factors.timeOfDay === 'day' ? 'Very difficult to spot in daylight' : 'Difficult to spot even with exhaust glow'}.`;
    }
    
    // Ensure we always have a reason
    if (!reason) {
      reason = `Limited visibility - rocket passes at distance of ${Math.round(factors.closestApproach)}km with low elevation angle (${Math.round(factors.maxViewingAngle)}°). ${factors.timeOfDay === 'day' ? 'Daylight makes viewing very challenging' : 'May be difficult to spot'}.`;
    }
    
    if (factors.visibilityWindow.duration > 0) {
      reason += ` Visible from T+${Math.round(factors.visibilityWindow.start)} to T+${Math.round(factors.visibilityWindow.end)} minutes.`;
    }
    
    return {
      isVisible: true,
      likelihood,
      reason
    };
  }
  
  /**
   * Utility functions
   */
  private static calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const R = EARTH_RADIUS_KM;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLng/2) * Math.sin(dLng/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  }
  
  private static calculateBearing(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const lat1Rad = lat1 * Math.PI / 180;
    const lat2Rad = lat2 * Math.PI / 180;
    const y = Math.sin(dLng) * Math.cos(lat2Rad);
    const x = Math.cos(lat1Rad) * Math.sin(lat2Rad) - Math.sin(lat1Rad) * Math.cos(lat2Rad) * Math.cos(dLng);
    const bearing = Math.atan2(y, x) * 180 / Math.PI;
    return (bearing + 360) % 360;
  }
  
  private static determineTimeOfDay(launchTime: Date): 'day' | 'twilight' | 'night' {
    const hour = launchTime.getUTCHours();
    if (hour >= 6 && hour < 18) return 'day';
    if ((hour >= 5 && hour < 6) || (hour >= 18 && hour < 20)) return 'twilight';
    return 'night';
  }
  
  private static getDirectionFromBearing(bearing: number): string {
    if (bearing >= 337.5 || bearing < 22.5) return 'North';
    if (bearing >= 22.5 && bearing < 67.5) return 'Northeast';
    if (bearing >= 67.5 && bearing < 112.5) return 'East';
    if (bearing >= 112.5 && bearing < 157.5) return 'Southeast';
    if (bearing >= 157.5 && bearing < 202.5) return 'South';
    if (bearing >= 202.5 && bearing < 247.5) return 'Southwest';
    if (bearing >= 247.5 && bearing < 292.5) return 'West';
    return 'Northwest';
  }
}