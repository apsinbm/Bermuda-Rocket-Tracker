/**
 * FlightClub Data Processor
 * 
 * Processes raw FlightClub telemetry data into visualization-ready formats
 * that match FlightClub's professional visualization features.
 */

export interface RawTelemetryPoint {
  time: number; // seconds from T-0
  latitude: number;
  longitude: number;
  altitude: number; // meters
  speed: number; // m/s
}

export interface ProcessedTelemetryPoint {
  time: number;
  latitude: number;
  longitude: number;
  altitude: number; // meters
  speed: number; // m/s
  
  // Calculated Bermuda-specific data
  distanceFromBermuda: number; // km
  bearingFromBermuda: number; // degrees from north
  elevationAngle: number; // degrees above horizon from Bermuda
  azimuthAngle: number; // compass bearing from Bermuda
  isVisibleFromBermuda: boolean;
  
  // Flight dynamics
  groundSpeed: number; // horizontal velocity component
  verticalVelocity: number; // vertical velocity component
  downrangeDistance: number; // distance from launch site
  
  // Stage information
  stageNumber: number;
  throttle: number; // 0-1, estimated from acceleration
}

export interface StageData {
  stageNumber: number;
  telemetry: ProcessedTelemetryPoint[];
  duration: number; // seconds
  maxAltitude: number; // meters
  maxSpeed: number; // m/s
  finalEvent?: StageEvent;
}

export interface StageEvent {
  time: number; // T+ seconds
  event: string; // 'MECO', 'Stage Separation', 'SECO-1', etc.
  stageNumber: number;
  description: string;
  telemetryIndex: number; // index in telemetry array
  engineType?: 'Merlin' | 'MVac' | 'Unknown'; // Engine type for specific event tracking
}

export interface FlightProfile {
  missionId: string;
  missionName: string;
  vehicle: string;
  company: string;
  launchSite: {
    latitude: number;
    longitude: number;
    name: string;
  };
  
  stages: StageData[];
  events: StageEvent[];
  
  // Mission metrics
  totalDuration: number; // seconds
  maxAltitude: number; // meters
  maxSpeed: number; // m/s
  maxDownrange: number; // km
  
  // Bermuda visibility summary
  visibilityWindows: VisibilityWindow[];
  totalVisibleDuration: number; // seconds
  peakVisibilityTime: number; // T+ seconds
  closestApproach: {
    time: number;
    distance: number;
    altitude: number;
    bearing: number;
  };
}

export interface VisibilityWindow {
  startTime: number; // T+ seconds
  endTime: number; // T+ seconds
  duration: number; // seconds
  maxElevation: number; // degrees
  maxElevationTime: number; // T+ seconds
  averageAzimuth: number; // degrees
  stage: number;
}

// Bermuda coordinates
const BERMUDA_LAT = 32.3078;
const BERMUDA_LNG = -64.7505;
const BERMUDA_ELEVATION = 0; // meters above sea level

// Earth constants
const EARTH_RADIUS = 6371000; // meters

export class FlightClubDataProcessor {
  
  /**
   * Process raw FlightClub API response into visualization-ready data
   */
  static processFlightClubData(rawData: any): FlightProfile {
    const stages: StageData[] = [];
    const allEvents: StageEvent[] = [];
    
    // Process each stage
    for (const rawStage of rawData.stages || []) {
      const stageData = this.processStageData(rawStage);
      stages.push(stageData);
    }
    
    // Process events
    if (rawData.events) {
      for (const event of rawData.events) {
        const processedEvent = this.processStageEvent(event, stages);
        if (processedEvent) {
          allEvents.push(processedEvent);
        }
      }
    }
    
    // Calculate mission metrics
    const allTelemetry = stages.flatMap(stage => stage.telemetry);
    const metrics = this.calculateMissionMetrics(allTelemetry);
    
    // Calculate Bermuda visibility windows
    const visibilityWindows = this.calculateVisibilityWindows(allTelemetry);
    
    return {
      missionId: rawData.missionId || 'unknown',
      missionName: rawData.description || 'Unknown Mission',
      vehicle: rawData.vehicle || 'Unknown Vehicle',
      company: rawData.company || 'Unknown Company',
      launchSite: {
        latitude: rawData.launchSite?.latitude || 28.56184, // Default to Canaveral
        longitude: rawData.launchSite?.longitude || -80.5773,
        name: rawData.launchSite?.name || 'Cape Canaveral'
      },
      stages,
      events: allEvents,
      ...metrics,
      visibilityWindows,
      totalVisibleDuration: visibilityWindows.reduce((sum, window) => sum + window.duration, 0),
      peakVisibilityTime: this.findPeakVisibilityTime(allTelemetry),
      closestApproach: this.findClosestApproach(allTelemetry)
    };
  }
  
  /**
   * Process individual stage telemetry data
   */
  private static processStageData(rawStage: any): StageData {
    const telemetry: ProcessedTelemetryPoint[] = [];
    const rawTelemetry = rawStage.telemetry || [];
    
    for (let i = 0; i < rawTelemetry.length; i++) {
      const point = rawTelemetry[i];
      const processedPoint = this.processTelemetryPoint(point, rawStage.stageNumber, i, rawTelemetry);
      telemetry.push(processedPoint);
    }
    
    const duration = telemetry.length > 0 ? 
      telemetry[telemetry.length - 1].time - telemetry[0].time : 0;
    
    return {
      stageNumber: rawStage.stageNumber,
      telemetry,
      duration,
      maxAltitude: Math.max(...telemetry.map(p => p.altitude)),
      maxSpeed: Math.max(...telemetry.map(p => p.speed)),
      finalEvent: undefined // Will be set when processing events
    };
  }
  
  /**
   * Process individual telemetry point with Bermuda calculations
   */
  private static processTelemetryPoint(
    point: RawTelemetryPoint, 
    stageNumber: number,
    index: number,
    allPoints: RawTelemetryPoint[]
  ): ProcessedTelemetryPoint {
    
    // Calculate distance and bearing from Bermuda
    const bermudaData = this.calculateBermudaMetrics(
      point.latitude, 
      point.longitude, 
      point.altitude
    );
    
    // Calculate flight dynamics
    const dynamics = this.calculateFlightDynamics(point, index, allPoints);
    
    // Estimate throttle from acceleration
    const throttle = this.estimateThrottle(point, index, allPoints);
    
    return {
      time: point.time,
      latitude: point.latitude,
      longitude: point.longitude,
      altitude: point.altitude,
      speed: point.speed,
      
      distanceFromBermuda: bermudaData.distance,
      bearingFromBermuda: bermudaData.bearing,
      elevationAngle: bermudaData.elevation,
      azimuthAngle: bermudaData.azimuth,
      isVisibleFromBermuda: bermudaData.isVisible,
      
      groundSpeed: dynamics.groundSpeed,
      verticalVelocity: dynamics.verticalVelocity,
      downrangeDistance: dynamics.downrangeDistance,
      
      stageNumber,
      throttle
    };
  }
  
  /**
   * Calculate Bermuda-specific metrics for a telemetry point
   */
  private static calculateBermudaMetrics(lat: number, lng: number, alt: number) {
    // Calculate distance using great circle formula
    const distance = this.calculateGreatCircleDistance(
      BERMUDA_LAT, BERMUDA_LNG, lat, lng
    );
    
    // Calculate bearing from Bermuda to rocket
    const bearing = this.calculateBearing(BERMUDA_LAT, BERMUDA_LNG, lat, lng);
    
    // Calculate elevation angle (accounting for Earth curvature)
    const elevation = this.calculateElevationAngle(distance * 1000, alt, BERMUDA_ELEVATION);
    
    // Azimuth is the same as bearing for distant objects
    const azimuth = bearing;
    
    // Visibility check (above horizon and within reasonable distance)
    const isVisible = elevation > 0 && distance < 2000; // 2000km max viewing distance
    
    return {
      distance,
      bearing,
      elevation,
      azimuth,
      isVisible
    };
  }
  
  /**
   * Calculate flight dynamics
   */
  private static calculateFlightDynamics(
    point: RawTelemetryPoint, 
    index: number, 
    allPoints: RawTelemetryPoint[]
  ) {
    let groundSpeed = 0;
    let verticalVelocity = 0;
    let downrangeDistance = 0;
    
    if (index > 0 && index < allPoints.length) {
      const prevPoint = allPoints[index - 1];
      const deltaTime = point.time - prevPoint.time;
      
      if (deltaTime > 0) {
        // Calculate horizontal distance traveled
        const horizontalDistance = this.calculateGreatCircleDistance(
          prevPoint.latitude, prevPoint.longitude,
          point.latitude, point.longitude
        );
        groundSpeed = (horizontalDistance * 1000) / deltaTime; // m/s
        
        // Calculate vertical velocity
        verticalVelocity = (point.altitude - prevPoint.altitude) / deltaTime;
      }
    }
    
    // Calculate downrange distance from launch site (assuming first point is launch)
    if (allPoints.length > 0) {
      const launchPoint = allPoints[0];
      downrangeDistance = this.calculateGreatCircleDistance(
        launchPoint.latitude, launchPoint.longitude,
        point.latitude, point.longitude
      );
    }
    
    return {
      groundSpeed,
      verticalVelocity,
      downrangeDistance
    };
  }
  
  /**
   * Estimate throttle level from acceleration patterns
   */
  private static estimateThrottle(
    point: RawTelemetryPoint, 
    index: number, 
    allPoints: RawTelemetryPoint[]
  ): number {
    if (index < 2 || index >= allPoints.length - 1) return 0;
    
    const prev = allPoints[index - 1];
    const next = allPoints[index + 1];
    const deltaTime = next.time - prev.time;
    
    if (deltaTime <= 0) return 0;
    
    // Calculate acceleration from speed change
    const acceleration = (next.speed - prev.speed) / deltaTime;
    
    // Estimate throttle (very rough approximation)
    // Typical rocket acceleration: 10-40 m/s²
    const normalizedAcceleration = Math.max(0, Math.min(1, acceleration / 30));
    
    return normalizedAcceleration;
  }
  
  /**
   * Process stage events from FlightClub data
   */
  private static processStageEvent(rawEvent: any, stages: StageData[]): StageEvent | null {
    if (!rawEvent.key || !rawEvent.value) return null;
    
    const time = parseFloat(rawEvent.key);
    const eventCode = rawEvent.value;
    
    // Decode event type with enhanced MVac/engine-specific detection
    let event = 'Unknown Event';
    let description = '';
    let stageNumber = 1;
    let engineType: 'Merlin' | 'MVac' | 'Unknown' = 'Unknown';
    
    if (eventCode.includes('SEPARATION')) {
      event = 'Stage Separation';
      description = 'First stage separation from second stage';
      stageNumber = 1;
    } else if (eventCode.includes('MECO')) {
      event = 'MECO';
      description = 'Main Engine Cutoff (Merlin engines)';
      stageNumber = 1;
      engineType = 'Merlin';
    } else if (eventCode.includes('SECO')) {
      // Enhanced SECO detection with engine specificity
      if (eventCode.includes('SECO-1') || time < 600) { // First SECO within 10 minutes
        event = 'SECO-1';
        description = 'Second Engine Cutoff (MVac engine) - End of visibility window';
        engineType = 'MVac';
      } else {
        event = 'SECO-2';  
        description = 'Second Engine Cutoff - Restart (MVac engine)';
        engineType = 'MVac';
      }
      stageNumber = 2;
    } else if (eventCode.includes('ENGINE_START') || eventCode.includes('IGNITION')) {
      if (time > 120) { // After typical stage separation time
        event = 'Second Stage Ignition';
        description = 'MVac engine ignition - Start of 2nd stage burn';
        stageNumber = 2;
        engineType = 'MVac';
      }
    } else if (eventCode.includes('FAIRING')) {
      event = 'Fairing Separation';
      description = 'Payload fairing separation';
      stageNumber = 2;
    }
    
    // Find corresponding telemetry index
    const telemetryIndex = this.findNearestTelemetryIndex(time, stages);
    
    return {
      time,
      event,
      stageNumber,
      description,
      telemetryIndex,
      engineType
    };
  }
  
  /**
   * Calculate overall mission metrics
   */
  private static calculateMissionMetrics(telemetry: ProcessedTelemetryPoint[]) {
    if (telemetry.length === 0) {
      return {
        totalDuration: 0,
        maxAltitude: 0,
        maxSpeed: 0,
        maxDownrange: 0
      };
    }
    
    const totalDuration = telemetry[telemetry.length - 1].time - telemetry[0].time;
    const maxAltitude = Math.max(...telemetry.map(p => p.altitude));
    const maxSpeed = Math.max(...telemetry.map(p => p.speed));
    const maxDownrange = Math.max(...telemetry.map(p => p.downrangeDistance));
    
    return {
      totalDuration,
      maxAltitude,
      maxSpeed,
      maxDownrange
    };
  }
  
  /**
   * Calculate visibility windows from Bermuda
   */
  private static calculateVisibilityWindows(telemetry: ProcessedTelemetryPoint[]): VisibilityWindow[] {
    const windows: VisibilityWindow[] = [];
    let currentWindow: Partial<VisibilityWindow> | null = null;
    
    for (const point of telemetry) {
      if (point.isVisibleFromBermuda) {
        if (!currentWindow) {
          // Start new visibility window
          currentWindow = {
            startTime: point.time,
            maxElevation: point.elevationAngle,
            maxElevationTime: point.time,
            stage: point.stageNumber
          };
        } else {
          // Update current window
          if (point.elevationAngle > currentWindow.maxElevation!) {
            currentWindow.maxElevation = point.elevationAngle;
            currentWindow.maxElevationTime = point.time;
          }
        }
      } else if (currentWindow) {
        // End current visibility window
        currentWindow.endTime = telemetry[telemetry.indexOf(point) - 1]?.time || point.time;
        currentWindow.duration = currentWindow.endTime - currentWindow.startTime!;
        
        // Calculate average azimuth for this window
        const windowPoints = telemetry.filter(p => 
          p.time >= currentWindow!.startTime! && 
          p.time <= currentWindow!.endTime! &&
          p.isVisibleFromBermuda
        );
        currentWindow.averageAzimuth = windowPoints.reduce((sum, p) => sum + p.azimuthAngle, 0) / windowPoints.length;
        
        windows.push(currentWindow as VisibilityWindow);
        currentWindow = null;
      }
    }
    
    // Handle window that extends to end of flight
    if (currentWindow) {
      const lastPoint = telemetry[telemetry.length - 1];
      currentWindow.endTime = lastPoint.time;
      currentWindow.duration = currentWindow.endTime - currentWindow.startTime!;
      
      const windowPoints = telemetry.filter(p => 
        p.time >= currentWindow!.startTime! && 
        p.isVisibleFromBermuda
      );
      currentWindow.averageAzimuth = windowPoints.reduce((sum, p) => sum + p.azimuthAngle, 0) / windowPoints.length;
      
      windows.push(currentWindow as VisibilityWindow);
    }
    
    return windows;
  }
  
  /**
   * Find peak visibility time (highest elevation angle)
   */
  private static findPeakVisibilityTime(telemetry: ProcessedTelemetryPoint[]): number {
    let maxElevation = -90;
    let peakTime = 0;
    
    for (const point of telemetry) {
      if (point.isVisibleFromBermuda && point.elevationAngle > maxElevation) {
        maxElevation = point.elevationAngle;
        peakTime = point.time;
      }
    }
    
    return peakTime;
  }
  
  /**
   * Find closest approach to Bermuda
   */
  private static findClosestApproach(telemetry: ProcessedTelemetryPoint[]) {
    let minDistance = Infinity;
    let closestPoint = telemetry[0];
    
    for (const point of telemetry) {
      if (point.distanceFromBermuda < minDistance) {
        minDistance = point.distanceFromBermuda;
        closestPoint = point;
      }
    }
    
    return {
      time: closestPoint.time,
      distance: closestPoint.distanceFromBermuda,
      altitude: closestPoint.altitude,
      bearing: closestPoint.bearingFromBermuda
    };
  }
  
  /**
   * Utility functions
   */
  
  private static calculateGreatCircleDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const R = 6371; // Earth radius in km
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
    const y = Math.sin(dLng) * Math.cos(lat2 * Math.PI / 180);
    const x = Math.cos(lat1 * Math.PI / 180) * Math.sin(lat2 * Math.PI / 180) -
              Math.sin(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.cos(dLng);
    const bearing = Math.atan2(y, x) * 180 / Math.PI;
    return (bearing + 360) % 360;
  }
  
  private static calculateElevationAngle(horizontalDistance: number, targetAltitude: number, observerAltitude: number): number {
    const altitudeDifference = targetAltitude - observerAltitude;
    
    // Account for Earth curvature
    const earthCurvature = (horizontalDistance * horizontalDistance) / (2 * EARTH_RADIUS);
    const apparentAltitude = altitudeDifference - earthCurvature;
    
    const elevationRadians = Math.atan2(apparentAltitude, horizontalDistance);
    return elevationRadians * 180 / Math.PI;
  }
  
  private static findNearestTelemetryIndex(time: number, stages: StageData[]): number {
    let nearestIndex = 0;
    let minTimeDiff = Infinity;
    let globalIndex = 0;
    
    for (const stage of stages) {
      for (const point of stage.telemetry) {
        const timeDiff = Math.abs(point.time - time);
        if (timeDiff < minTimeDiff) {
          minTimeDiff = timeDiff;
          nearestIndex = globalIndex;
        }
        globalIndex++;
      }
    }
    
    return nearestIndex;
  }
}