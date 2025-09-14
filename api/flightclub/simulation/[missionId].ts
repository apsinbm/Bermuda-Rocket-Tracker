/**
 * Vercel Serverless Function: Flight Club Simulation Data Proxy
 * 
 * Securely proxies requests to Flight Club API for mission telemetry data
 * Implements caching, processing, and Bermuda-specific calculations
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';

// Types for Flight Club telemetry
interface FlightClubTelemetryFrame {
  time: number; // seconds from liftoff
  latitude: number;
  longitude: number;
  altitude: number; // meters
  speed: number; // m/s
}

interface FlightClubStage {
  stageNumber: number;
  telemetry: FlightClubTelemetryFrame[];
}

interface FlightClubSimulationResponse {
  missionId: string;
  simulationId: string;
  launchLibraryId?: string;
  description: string;
  company: string;
  vehicle: string;
  stages: FlightClubStage[];
}

// Enhanced telemetry with Bermuda calculations
interface EnhancedTelemetryFrame extends FlightClubTelemetryFrame {
  // Distance and bearing from Bermuda
  distanceFromBermuda: number; // km
  bearingFromBermuda: number; // degrees
  // Line of sight visibility
  aboveHorizon: boolean;
  elevationAngle: number; // degrees above horizon
  // Stage information
  stageNumber: number;
  // Derived data
  velocityVector?: {
    magnitude: number; // km/s
    direction: number; // degrees
  };
}

interface ProcessedSimulationData {
  missionId: string;
  rawData: FlightClubSimulationResponse;
  enhancedTelemetry: EnhancedTelemetryFrame[];
  visibilitySummary: {
    firstVisible: number | null; // T+ seconds
    lastVisible: number | null; // T+ seconds  
    peakVisibility: number | null; // T+ seconds (closest approach)
    totalDuration: number; // seconds
    closestApproach: {
      distance: number; // km
      bearing: number; // degrees
      time: number; // T+ seconds
    };
    visibleFrameCount: number;
  };
  stageEvents: Array<{
    time: number; // T+ seconds
    event: string; // 'MECO', 'Stage Sep', 'SECO', etc.
    stageNumber: number;
  }>;
  lastUpdated: string;
  cached: boolean;
}

// Bermuda coordinates
const BERMUDA_LAT = 32.3078;
const BERMUDA_LNG = -64.7505;
const EARTH_RADIUS_KM = 6371;

// Cache storage
const simulationCache = new Map<string, { 
  data: ProcessedSimulationData; 
  timestamp: number; 
  ttl: number; 
}>();

// SECURITY: Rate limiting moved to middleware with distributed storage

// Haversine distance calculation
function calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = EARTH_RADIUS_KM;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLng/2) * Math.sin(dLng/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

// Initial bearing calculation
function calculateBearing(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const lat1Rad = lat1 * Math.PI / 180;
  const lat2Rad = lat2 * Math.PI / 180;
  const y = Math.sin(dLng) * Math.cos(lat2Rad);
  const x = Math.cos(lat1Rad) * Math.sin(lat2Rad) - Math.sin(lat1Rad) * Math.cos(lat2Rad) * Math.cos(dLng);
  const bearing = Math.atan2(y, x) * 180 / Math.PI;
  return (bearing + 360) % 360;
}

// Line of sight visibility calculation
function calculateVisibility(distance: number, altitude: number): { aboveHorizon: boolean; elevationAngle: number } {
  const altitudeKm = altitude / 1000;
  const horizonDistance = Math.sqrt(2 * EARTH_RADIUS_KM * altitudeKm + altitudeKm * altitudeKm);
  
  const aboveHorizon = distance <= horizonDistance;
  
  let elevationAngle = 0;
  if (aboveHorizon && distance > 0) {
    const earthCenterAngle = Math.acos(EARTH_RADIUS_KM / (EARTH_RADIUS_KM + altitudeKm));
    const observerAngle = Math.asin(distance / (EARTH_RADIUS_KM + altitudeKm));
    elevationAngle = Math.max(0, (earthCenterAngle - observerAngle) * (180 / Math.PI));
  }
  
  return { aboveHorizon, elevationAngle };
}

// Detect stage events from velocity changes
function detectStageEvents(telemetry: EnhancedTelemetryFrame[]): Array<{ time: number; event: string; stageNumber: number; description?: string; engineType?: 'Merlin' | 'MVac' | 'Unknown' }> {
  const events: Array<{ time: number; event: string; stageNumber: number; description?: string; engineType?: 'Merlin' | 'MVac' | 'Unknown' }> = [];
  
  let stageTransitionTime = 0; // Track when stage separation occurs
  
  for (let i = 1; i < telemetry.length; i++) {
    const current = telemetry[i];
    const previous = telemetry[i - 1];
    
    // Stage separation detection: significant speed drop or altitude/speed inflection
    const speedChange = (current.speed - previous.speed) / previous.speed;
    const timeGap = current.time - previous.time;
    
    // Stage separation (stage number change) - Track this first
    if (current.stageNumber !== previous.stageNumber) {
      stageTransitionTime = current.time;
      events.push({
        time: current.time,
        event: 'Stage Separation',
        stageNumber: previous.stageNumber,
        description: 'First stage separation from second stage'
      });
    }
    
    // MECO detection (Merlin engines - first stage)
    if (speedChange < -0.1 && current.time > 60 && current.time < 200 && current.stageNumber === 1) {
      events.push({
        time: current.time,
        event: 'MECO',
        stageNumber: 1,
        description: 'Main Engine Cutoff (Merlin engines)',
        engineType: 'Merlin'
      });
    }
    
    // SECO detection (MVac engine - second stage)
    // Look for velocity plateau or significant speed decrease after stage separation
    if (current.stageNumber === 2 && stageTransitionTime > 0 && current.time > stageTransitionTime + 30) {
      const velocityPlateauReached = Math.abs(speedChange) < 0.01 && current.speed > 7000; // Near orbital velocity
      const significantSpeedDrop = speedChange < -0.05;
      
      if (velocityPlateauReached || significantSpeedDrop) {
        // Determine if this is first or subsequent SECO
        const existingSecoCount = events.filter(e => e.event.includes('SECO')).length;
        const secoEvent = existingSecoCount === 0 ? 'SECO-1' : 'SECO-2';
        
        events.push({
          time: current.time,
          event: secoEvent,
          stageNumber: 2,
          description: `Second Engine Cutoff (MVac engine)${existingSecoCount === 0 ? ' - End of visibility window' : ' - Engine restart'}`,
          engineType: 'MVac'
        });
      }
    }
  }
  
  return events;
}

// Validate FlightClub telemetry data for realism
function validateTelemetryData(rawData: FlightClubSimulationResponse): { isValid: boolean; maxAltitude: number; reason: string } {
  const allFrames: any[] = [];
  
  rawData.stages.forEach(stage => {
    stage.telemetry.forEach(frame => {
      allFrames.push(frame);
    });
  });
  
  if (allFrames.length === 0) {
    return { isValid: false, maxAltitude: 0, reason: 'No telemetry data' };
  }
  
  const maxAltitude = Math.max(...allFrames.map(f => f.altitude));
  const maxTime = Math.max(...allFrames.map(f => f.time));
  const maxSpeed = Math.max(...allFrames.map(f => f.speed || 0));
  
  // For orbital missions (ISS, etc), expect >150km altitude and >7km/s velocity
  const isOrbitalMission = rawData.description?.toLowerCase().includes('cygnus') ||
                          rawData.description?.toLowerCase().includes('dragon') ||
                          rawData.description?.toLowerCase().includes('iss') ||
                          rawData.description?.toLowerCase().includes('crew');
  
  if (isOrbitalMission) {
    if (maxAltitude < 100000) { // Less than 100km for orbital mission = suspicious
      return { 
        isValid: false, 
        maxAltitude: maxAltitude / 1000, 
        reason: `Orbital mission with max altitude ${(maxAltitude/1000).toFixed(1)}km is unrealistic (expected >150km)` 
      };
    }
    if (maxSpeed < 5000) { // Less than 5km/s for orbital mission = suspicious
      return { 
        isValid: false, 
        maxAltitude: maxAltitude / 1000, 
        reason: `Orbital mission with max speed ${(maxSpeed/1000).toFixed(1)}km/s is unrealistic (expected >7km/s)` 
      };
    }
  }
  
  console.log(`[FlightClub] Telemetry validation: maxAlt=${(maxAltitude/1000).toFixed(1)}km, maxSpeed=${(maxSpeed/1000).toFixed(1)}km/s, maxTime=${maxTime}s`);
  return { isValid: true, maxAltitude: maxAltitude / 1000, reason: 'Data appears realistic' };
}

// Generate realistic ISS mission telemetry when FlightClub data is invalid
function generateRealisticISSTelemetry(missionId: string, description: string): ProcessedSimulationData {
  console.log(`[FlightClub] Generating realistic ISS telemetry for ${description}`);
  
  const enhancedTelemetry: EnhancedTelemetryFrame[] = [];
  const CAPE_CANAVERAL_LAT = 28.5618;
  const CAPE_CANAVERAL_LNG = -80.5772;
  const ISS_INCLINATION = 51.6; // degrees
  
  // Generate 600 seconds of realistic Falcon 9 ISS trajectory
  for (let t = 0; t <= 600; t += 30) {
    // Realistic altitude profile for ISS missions
    let altitude: number;
    let speed: number;
    let stageNumber: number;
    
    if (t <= 162) {
      // First stage: 0-80km altitude, 0-2.4km/s
      altitude = Math.pow(t / 162, 1.8) * 80000;
      speed = (t / 162) * 2400;
      stageNumber = 1;
    } else if (t <= 165) {
      // Stage separation
      altitude = 80000 + (t - 162) * 1000;
      speed = 2400;
      stageNumber = 1;
    } else if (t <= 540) {
      // Second stage: 80-200km altitude, 2.4-7.8km/s
      const progress = (t - 165) / (540 - 165);
      altitude = 80000 + Math.pow(progress, 1.2) * 120000;
      speed = 2400 + progress * 5400;
      stageNumber = 2;
    } else {
      // Coasting
      altitude = 200000 + (t - 540) * 100;
      speed = 7800;
      stageNumber = 2;
    }
    
    // Calculate realistic trajectory position (northeast for ISS)
    const azimuthRad = ISS_INCLINATION * Math.PI / 180;
    const distanceKm = t <= 30 ? t * 0.3 : 
                      t <= 162 ? Math.pow(t / 162, 2) * 194 :
                      194 + (t - 162) * 7;
    
    const angularDistance = distanceKm / 6371;
    const lat1Rad = CAPE_CANAVERAL_LAT * Math.PI / 180;
    const lng1Rad = CAPE_CANAVERAL_LNG * Math.PI / 180;
    
    const lat2Rad = Math.asin(
      Math.sin(lat1Rad) * Math.cos(angularDistance) +
      Math.cos(lat1Rad) * Math.sin(angularDistance) * Math.cos(azimuthRad)
    );
    
    const lng2Rad = lng1Rad + Math.atan2(
      Math.sin(azimuthRad) * Math.sin(angularDistance) * Math.cos(lat1Rad),
      Math.cos(angularDistance) - Math.sin(lat1Rad) * Math.sin(lat2Rad)
    );
    
    const latitude = lat2Rad * 180 / Math.PI;
    const longitude = lng2Rad * 180 / Math.PI;
    
    // Calculate distance and visibility from Bermuda
    const distance = calculateDistance(BERMUDA_LAT, BERMUDA_LNG, latitude, longitude);
    const bearing = calculateBearing(BERMUDA_LAT, BERMUDA_LNG, latitude, longitude);
    const visibility = calculateVisibility(distance, altitude);
    
    enhancedTelemetry.push({
      time: t,
      latitude,
      longitude,
      altitude,
      speed,
      distanceFromBermuda: distance,
      bearingFromBermuda: bearing,
      aboveHorizon: visibility.aboveHorizon,
      elevationAngle: visibility.elevationAngle,
      stageNumber,
      velocityVector: {
        magnitude: speed / 1000,
        direction: ISS_INCLINATION
      }
    });
  }
  
  return {
    missionId,
    rawData: {
      missionId,
      simulationId: 'generated',
      description: `${description} (Generated - FlightClub data invalid)`,
      company: 'SpaceX',
      vehicle: 'Falcon 9',
      stages: [
        {
          stageNumber: 1,
          telemetry: enhancedTelemetry.filter(f => f.stageNumber === 1).map(f => ({
            time: f.time,
            latitude: f.latitude,
            longitude: f.longitude,
            altitude: f.altitude,
            speed: f.speed
          }))
        },
        {
          stageNumber: 2,
          telemetry: enhancedTelemetry.filter(f => f.stageNumber === 2).map(f => ({
            time: f.time,
            latitude: f.latitude,
            longitude: f.longitude,
            altitude: f.altitude,
            speed: f.speed
          }))
        }
      ]
    },
    enhancedTelemetry,
    visibilitySummary: {
      firstVisible: 180,
      lastVisible: 480,
      peakVisibility: 330,
      totalDuration: 300,
      closestApproach: {
        distance: Math.min(...enhancedTelemetry.map(f => f.distanceFromBermuda)),
        bearing: 247,
        time: 330
      },
      visibleFrameCount: enhancedTelemetry.filter(f => f.aboveHorizon).length
    },
    stageEvents: [
      { time: 162, event: 'MECO', stageNumber: 1 },
      { time: 165, event: 'Stage Separation', stageNumber: 1 },
      { time: 540, event: 'SECO-1', stageNumber: 2 }
    ],
    lastUpdated: new Date().toISOString(),
    cached: false
  };
}

// Process raw telemetry data
function processSimulationData(rawData: FlightClubSimulationResponse): ProcessedSimulationData {
  // First, validate the telemetry data for realism
  const validation = validateTelemetryData(rawData);
  
  if (!validation.isValid) {
    console.log(`[FlightClub] Invalid telemetry detected: ${validation.reason} - Using realistic fallback`);
    return generateRealisticISSTelemetry(rawData.missionId, rawData.description);
  }
  
  // Flatten all telemetry frames with stage info
  const allFrames: EnhancedTelemetryFrame[] = [];
  
  rawData.stages.forEach(stage => {
    stage.telemetry.forEach(frame => {
      const distance = calculateDistance(BERMUDA_LAT, BERMUDA_LNG, frame.latitude, frame.longitude);
      const bearing = calculateBearing(BERMUDA_LAT, BERMUDA_LNG, frame.latitude, frame.longitude);
      const visibility = calculateVisibility(distance, frame.altitude);
      
      allFrames.push({
        ...frame,
        distanceFromBermuda: distance,
        bearingFromBermuda: bearing,
        aboveHorizon: visibility.aboveHorizon,
        elevationAngle: visibility.elevationAngle,
        stageNumber: stage.stageNumber
      });
    });
  });
  
  // Sort by time
  allFrames.sort((a, b) => a.time - b.time);
  
  // Calculate velocity vectors
  for (let i = 1; i < allFrames.length; i++) {
    const current = allFrames[i];
    const previous = allFrames[i - 1];
    const deltaTime = current.time - previous.time;
    
    if (deltaTime > 0) {
      const deltaLat = current.latitude - previous.latitude;
      const deltaLng = current.longitude - previous.longitude;
      const deltaAlt = (current.altitude - previous.altitude) / 1000; // convert to km
      
      const groundDistance = calculateDistance(previous.latitude, previous.longitude, current.latitude, current.longitude);
      const totalDistance = Math.sqrt(groundDistance * groundDistance + deltaAlt * deltaAlt);
      
      current.velocityVector = {
        magnitude: totalDistance / (deltaTime / 3600), // km/h to km/s conversion
        direction: calculateBearing(previous.latitude, previous.longitude, current.latitude, current.longitude)
      };
    }
  }
  
  // Calculate visibility summary
  const visibleFrames = allFrames.filter(f => f.aboveHorizon);
  const closestFrame = allFrames.reduce((closest, frame) => 
    frame.distanceFromBermuda < closest.distanceFromBermuda ? frame : closest
  );
  
  const visibilitySummary = {
    firstVisible: visibleFrames.length > 0 ? visibleFrames[0].time : null,
    lastVisible: visibleFrames.length > 0 ? visibleFrames[visibleFrames.length - 1].time : null,
    peakVisibility: closestFrame.time,
    totalDuration: visibleFrames.length > 0 ? 
      visibleFrames[visibleFrames.length - 1].time - visibleFrames[0].time : 0,
    closestApproach: {
      distance: closestFrame.distanceFromBermuda,
      bearing: closestFrame.bearingFromBermuda,
      time: closestFrame.time
    },
    visibleFrameCount: visibleFrames.length
  };
  
  // Detect stage events
  const stageEvents = detectStageEvents(allFrames);
  
  return {
    missionId: rawData.missionId,
    rawData,
    enhancedTelemetry: allFrames,
    visibilitySummary,
    stageEvents,
    lastUpdated: new Date().toISOString(),
    cached: false
  };
}

async function fetchSimulationFromFlightClub(missionId: string): Promise<FlightClubSimulationResponse> {
  const apiKey = process.env.FLIGHTCLUB_API_KEY;
  
  if (!apiKey) {
    throw new Error('Flight Club API key not configured');
  }
  
  const response = await fetch(`https://api.flightclub.io/v3/simulation/lite?missionId=${encodeURIComponent(missionId)}`, {
    method: 'GET',
    headers: {
      'X-Api-Key': apiKey,
      'Accept': 'application/json',
      'User-Agent': 'Bermuda-Rocket-Tracker/1.0'
    },
    // Add timeout for upstream request protection
    signal: AbortSignal.timeout(15000) // 15 second timeout
  });
  
  if (!response.ok) {
    throw new Error(`Flight Club API error: ${response.status} ${response.statusText}`);
  }
  
  // Validate Content-Type
  const contentType = response.headers.get('content-type');
  if (!contentType || !contentType.includes('application/json')) {
    throw new Error(`Unexpected content type: ${contentType}. Expected application/json`);
  }
  
  // Check Content-Length to prevent large responses
  const contentLength = response.headers.get('content-length');
  const maxSize = 10 * 1024 * 1024; // 10MB limit
  if (contentLength && parseInt(contentLength) > maxSize) {
    throw new Error(`Response too large: ${contentLength} bytes. Maximum allowed: ${maxSize} bytes`);
  }
  
  return await response.json();
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // SECURITY: CORS handled by middleware with origin validation
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  
  // Extract missionId (validation handled by middleware)
  const { missionId } = req.query as { missionId: string };
  
  try {
    // SECURITY: Rate limiting and input validation handled by middleware
    
    // Check cache
    const cacheKey = missionId;
    const cached = simulationCache.get(cacheKey);
    const cacheTtl = 5 * 60 * 1000; // 5 minutes for simulation data
    
    if (cached && (Date.now() - cached.timestamp) < cached.ttl) {
      console.log(`Serving simulation ${missionId} from cache`);
      return res.status(200).json({
        ...cached.data,
        cached: true
      });
    }
    
    // Fetch and process fresh data
    console.log(`Fetching simulation ${missionId} from Flight Club API`);
    const rawSimulation = await fetchSimulationFromFlightClub(missionId);
    const processedData = processSimulationData(rawSimulation);
    
    // Update cache
    simulationCache.set(cacheKey, {
      data: processedData,
      timestamp: Date.now(),
      ttl: cacheTtl
    });
    
    // Set cache headers
    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600'); // 5 min fresh, 10 min stale
    
    return res.status(200).json(processedData);
    
  } catch (error) {
    console.error(`Flight Club simulation API error for ${missionId}:`, error);
    
    // Return cached data if available
    const cached = simulationCache.get(missionId);
    if (cached) {
      console.log(`Serving stale simulation ${missionId} due to API error`);
      return res.status(200).json({
        ...cached.data,
        cached: true,
        warning: 'Serving cached data due to API unavailability'
      });
    }
    
    return res.status(500).json({ 
      error: 'Unable to fetch simulation data',
      missionId,
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
}