export interface Launch {
  id: string;
  name: string;
  rocket: {
    name: string;
    configuration?: {
      launch_service_provider?: {
        name: string;
      };
    };
  };
  launch_service_provider?: {
    name: string;
  };
  pad: {
    name: string;
    latitude?: string;    // API returns coordinates as strings directly on pad
    longitude?: string;   // API returns coordinates as strings directly on pad
    location: {
      name: string;
      latitude?: number;  // Keep for backward compatibility
      longitude?: number; // Keep for backward compatibility
    };
  };
  net: string; // Network Event Time
  mission: {
    name: string;
    orbit?: {
      name: string;
    };
    description?: string;
  };
  livestream_url?: string;
  status: {
    name: string;
    abbrev?: string;
  };
  window_start?: string;
  window_end?: string;
  image?: string;
  webcast_live?: boolean;
}

export interface VisibilityData {
  likelihood: 'high' | 'medium' | 'low' | 'none';
  reason: string;
  bearing?: number; // compass direction from Bermuda
  estimatedTimeVisible?: string;
  trajectoryImageUrl?: string;
  trajectoryDirection?: 'Northeast' | 'East-Northeast' | 'East' | 'East-Southeast' | 'Southeast' | 'North' | 'South' | 'Unknown';
  score?: number; // visibility score (0-1)
  factors?: string[]; // array of factors affecting visibility
  dataSource?: 'flightclub' | 'calculated' | 'estimated'; // Source of trajectory data
}

// FlightClub API Types
export interface FlightClubMission {
  id: string;
  description: string;
  startDateTime: string;
  company: {
    id: string;
    description: string;
  };
  display: boolean;
  flightClubSimId: string;
  launchLibraryId?: string;
  vehicle: {
    description: string;
  };
  sequences?: unknown[];
  landingZones?: unknown[];
}

export interface FlightClubTelemetryFrame {
  time: number; // seconds from liftoff
  latitude: number;
  longitude: number;
  altitude: number; // meters
  speed: number; // m/s
}

export interface FlightClubTrajectoryData {
  missionId: string;
  simulationId: string;
  launchLibraryId?: string;
  description: string;
  company: string;
  vehicle: string;
  stages: Array<{
    stageNumber: number;
    telemetry: FlightClubTelemetryFrame[];
  }>;
}

// Launch Matching Types
export type MatchConfidence = 'exact' | 'high' | 'medium' | 'low' | 'none';

export interface LaunchMatch {
  flightClubMission: FlightClubMission;
  confidence: MatchConfidence;
  score: number; // 0-100 confidence score
  matchReasons: string[];
  validationWarnings?: string[];
}

export interface LaunchWithFlightClub extends Launch {
  flightClubMatch?: LaunchMatch;
  hasFlightClubData: boolean;
}

export interface LaunchWithVisibility extends Launch {
  visibility: VisibilityData;
  bermudaTime: string;
  flightClubMatch?: LaunchMatch; // Add FlightClub data to visibility launches
  hasFlightClubData?: boolean;
}

export interface LaunchPad {
  name: string;
  location: {
    latitude: number;
    longitude: number;
  };
  typicalAzimuth: number[]; // Range of typical launch azimuths
  description: string;
}

// Government Solar Data Types
export interface USNOSolarData {
  date: string;
  sunrise: string;
  sunset: string;
  civil_twilight_begin: string;
  civil_twilight_end: string;
  nautical_twilight_begin: string;
  nautical_twilight_end: string;
  astronomical_twilight_begin: string;
  astronomical_twilight_end: string;
  solar_noon: string;
  source: 'usno' | 'backup' | 'calculated';
}

export interface SunriseSunsetApiData {
  results: {
    sunrise: string;
    sunset: string;
    solar_noon: string;
    day_length: string;
    civil_twilight_begin: string;
    civil_twilight_end: string;
    nautical_twilight_begin: string;
    nautical_twilight_end: string;
    astronomical_twilight_begin: string;
    astronomical_twilight_end: string;
  };
  status: string;
}

export interface SolarPosition {
  azimuth: number; // degrees (0 = North, 90 = East)
  elevation: number; // degrees above horizon
  distance: number; // AU from Earth
  zenith: number; // degrees from zenith
  hour_angle: number; // degrees
  declination: number; // degrees
  right_ascension: number; // hours
  julian_day: number;
  equation_of_time: number; // minutes
  calculated_at: Date;
}

// Enhanced Visibility Types
export interface VisibilityWindow {
  startTime: number; // seconds from liftoff
  endTime: number; // seconds from liftoff
  startBearing: number; // degrees from Bermuda
  endBearing: number; // degrees from Bermuda
  closestApproach: number; // km from Bermuda
  totalVisibleTime: number; // seconds
  peakVisibilityTime: number; // seconds from liftoff
  quality: 'excellent' | 'good' | 'fair' | 'poor';
}

export interface EnhancedVisibilityData extends VisibilityData {
  solarConditions: {
    sunElevation: number; // degrees at launch time
    sunAzimuth: number; // degrees at launch time
    twilightPhase: 'day' | 'civil' | 'nautical' | 'astronomical' | 'night';
    illuminationConditions: 'optimal' | 'good' | 'fair' | 'poor';
    rocketSunlit: boolean; // Is rocket in sunlight during visibility window
    groundDarkness: boolean; // Is ground dark enough for good viewing
  };
  visibilityWindow?: VisibilityWindow;
  governmentDataUsed: boolean; // True if USNO/government data was used
  lastCalculated: Date;
  validationStatus: {
    isValid: boolean;
    warnings: string[];
    dataQuality: 'excellent' | 'good' | 'fair' | 'poor';
  };
}

export interface LaunchWithEnhancedVisibility extends Launch {
  enhancedVisibility: EnhancedVisibilityData;
  bermudaTime: string;
  flightClubMatch?: LaunchMatch;
  hasFlightClubData?: boolean;
}

// Real-Time Delay Management Types
export interface DelayEvent {
  timestamp: Date;
  oldTime: string; // Previous NET time
  newTime: string; // New NET time
  delayMinutes: number; // Delay in minutes (positive = delayed, negative = moved earlier)
  source: 'api' | 'manual' | 'estimated';
  reason?: string; // Weather, technical, range conflict, etc.
  confidence: 'confirmed' | 'estimated' | 'rumored';
}

export type ScheduleStatus = 'on-time' | 'delayed' | 'scrubbed' | 'go' | 'hold' | 'unknown';

export type DelayImpact = 
  | 'VISIBILITY_IMPROVED'    // Delay moved launch into better visibility window
  | 'VISIBILITY_DEGRADED'    // Delay moved launch into worse visibility window  
  | 'WINDOW_GAINED'         // Delay moved launch from invisible to visible
  | 'WINDOW_LOST'           // Delay moved launch from visible to invisible
  | 'MINOR_CHANGE'          // Small delay with minimal visibility impact
  | 'NO_IMPACT'             // Delay but visibility unchanged
  | 'UNKNOWN_IMPACT';       // Cannot determine impact

export interface DelayImpactAnalysis {
  impact: DelayImpact;
  severity: 'critical' | 'significant' | 'minor' | 'none';
  oldVisibility: EnhancedVisibilityData;
  newVisibility: EnhancedVisibilityData;
  summary: string;
  userMessage: string;
  shouldNotify: boolean;
  visibilityChange: {
    likelihoodChanged: boolean;
    conditionsChanged: boolean;
    timingChanged: boolean;
    qualityChanged: boolean;
  };
}

export interface LaunchWithDelayTracking extends Launch {
  // Schedule tracking
  originalNet: string;           // Original launch time when first detected
  currentNet: string;           // Current launch time (same as net, but explicit)
  lastUpdated: Date;            // When schedule last changed
  delayHistory: DelayEvent[];   // All schedule changes
  scheduleStatus: ScheduleStatus;
  
  // Visibility tracking (required for compatibility with LaunchCard)
  visibility: VisibilityData;    // Current visibility calculation
  bermudaTime: string;          // Formatted time for Bermuda timezone
  flightClubMatch?: LaunchMatch; // FlightClub trajectory match data
  visibilityHistory?: {
    original: EnhancedVisibilityData;
    current: EnhancedVisibilityData;
  };
  delayImpact?: DelayImpactAnalysis;
  
  // Monitoring metadata
  pollingFrequency: number;     // Current polling interval in ms
  lastPolled: Date;             // When last checked for updates
  priorityLevel: 'critical' | 'high' | 'medium' | 'low'; // Based on proximity to launch
}

export interface LaunchMonitoringConfig {
  enableRealTimePolling: boolean;
  enableDelayNotifications: boolean;
  enableVisibilityAlerts: boolean;
  pollingIntervals: {
    critical: number;  // < 30 minutes to launch
    high: number;      // < 2 hours to launch  
    medium: number;    // < 6 hours to launch
    low: number;       // < 24 hours to launch
    default: number;   // > 24 hours to launch
  };
  notificationThresholds: {
    minDelayMinutes: number;        // Minimum delay to trigger notification
    significantDelayMinutes: number; // Threshold for "significant" delay
    visibilityChangeRequired: boolean; // Only notify if visibility changes
  };
}

// Notification Types
export type DelayNotificationType = 
  | 'DELAY_DETECTED'
  | 'VISIBILITY_IMPROVED' 
  | 'VISIBILITY_DEGRADED'
  | 'WINDOW_LOST'
  | 'WINDOW_GAINED'
  | 'MINOR_DELAY'
  | 'LAUNCH_SCRUBBED'
  | 'SCHEDULE_CONFIRMED';

// Schedule Change Detection Types
export interface LaunchSnapshot {
  id: string;
  name: string;
  net: string;
  window_start?: string;
  window_end?: string;
  status: {
    id: number;
    name: string;
  };
  lastChecked: Date;
  checkCount: number;
}

export interface LaunchChanges {
  netChanged: boolean;
  windowChanged: boolean;
  statusChanged: boolean;
  delayMinutes: number;
  windowShiftMinutes?: number;
}

export interface ScheduleChangeResult {
  hasChanged: boolean;
  changeType: 'delay' | 'advance' | 'scrub' | 'window_shift' | 'status_change' | 'no_change';
  severity: 'minor' | 'significant' | 'major' | 'critical';
  oldLaunch: LaunchSnapshot;
  newLaunch: Launch;
  delayEvent?: DelayEvent;
  changes: LaunchChanges;
  confidence: 'high' | 'medium' | 'low';
  recommendations: string[];
}

export interface DelayNotification {
  type: DelayNotificationType;
  launch: LaunchWithDelayTracking;
  message: string;
  priority: 'high' | 'medium' | 'low';
  timestamp: Date;
  shouldPush: boolean; // Send push notification
  shouldShow: boolean; // Show in UI
}

// Real-time monitoring state
export interface LaunchMonitoringState {
  activeMonitoring: Map<string, LaunchWithDelayTracking>; // launchId -> enhanced launch
  pollingIntervals: Map<string, NodeJS.Timeout>; // launchId -> interval timer
  config: LaunchMonitoringConfig;
  lastGlobalUpdate: Date;
  notifications: DelayNotification[];
  stats: {
    totalDelaysDetected: number;
    visibilityImprovements: number;
    visibilityDegradations: number;
    missedWindows: number;
    gainedWindows: number;
  };
}

// Physics-based visibility calculation interfaces
export interface VisibilityFactors {
  geometricVisibility: boolean;  // Can it be seen above horizon?
  maxAltitude: number;           // km - highest altitude during visible phase
  closestApproach: number;       // km from Bermuda at closest point
  visibilityWindow: {
    start: number;  // T+ minutes when visibility begins
    end: number;    // T+ minutes when visibility ends
    duration: number; // minutes of total visibility
  };
  timeOfDay: 'day' | 'twilight' | 'night';
  exhaustPlumeIlluminated: boolean; // Sun illuminating plume in dark sky
  trajectoryDirection: string;   // Actual direction rocket is traveling (e.g., "Northeast")
  initialViewingDirection: string;  // Where to first look from Bermuda (e.g., "Southwest")
  trackingPath: string;         // How rocket moves across sky (e.g., "SW → W → NW → N")
  maxViewingAngle: number;       // degrees above horizon at best visibility
  visibilityReason?: string;     // Enhanced explanation of 2nd stage visibility window
}

export interface TrajectoryPoint {
  time: number;      // T+ seconds from launch
  latitude: number;  // degrees
  longitude: number; // degrees
  altitude: number;  // km above sea level (or meters when specified)
  distance: number;  // km from Bermuda
  bearing: number;   // degrees from Bermuda
  aboveHorizon: boolean; // visible above horizon from Bermuda
  elevationAngle: number; // degrees above horizon
  visible: boolean;  // within line-of-sight (alias for aboveHorizon)
  stage: 'first' | 'second-burn' | 'second-coast' | 'separation'; // rocket stage/phase
  engineStatus: 'burning' | 'shutdown' | 'separation'; // engine status
  velocity?: number; // m/s - rocket velocity (optional for compatibility)
}

export interface GeometricVisibilityResult {
  isVisible: boolean;
  likelihood: 'high' | 'medium' | 'low' | 'none';
  reason: string;
  factors: VisibilityFactors;
  trajectoryPoints?: TrajectoryPoint[];
}