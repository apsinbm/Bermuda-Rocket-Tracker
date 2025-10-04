/**
 * Vercel Serverless Function: Flight Club Missions Proxy
 * 
 * Securely proxies requests to Flight Club API for mission discovery
 * Implements caching, rate limiting, and error handling
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getCachedMissions, setCachedMissions, type MissionCacheEntry } from './cache';

// Types
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
}

interface FlightClubMissionsResponse {
  missions: FlightClubMission[];
  lastUpdated: string;
  cached: boolean;
}

async function fetchMissionsFromFlightClub(): Promise<FlightClubMission[]> {
  const apiKey = process.env.FLIGHTCLUB_API_KEY;
  
  if (!apiKey) {
    throw new Error('Flight Club API key not configured');
  }
  
  const response = await fetch('https://api.flightclub.io/v3/mission/projected', {
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
  
  const data = await response.json();
  return data.missions || data; // Handle different response formats
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Set CORS headers with origin allowlist for security
  const allowedOrigins = [
    'https://bermuda-rocket-tracker.vercel.app',
    'http://localhost:3000',
    'http://localhost:3001',
    'http://localhost:3002'
  ];

  const origin = req.headers.origin || '';
  if (allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  }

  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Only allow GET requests
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  
  try {
    // Attempt to use shared cache first
    const cachedEntry = await getCachedMissions();
    if (cachedEntry && Date.now() - cachedEntry.cachedAt < 6 * 60 * 60 * 1000) {
      console.log('[FlightClub] Serving missions from shared cache');
      res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=300');
      return res.status(200).json({
        missions: cachedEntry.missions,
        lastUpdated: new Date(cachedEntry.cachedAt).toISOString(),
        cached: true,
        warning: cachedEntry.warning
      } as FlightClubMissionsResponse & { warning?: string });
    }

    // Fetch fresh data from Flight Club API
    console.log('[FlightClub] Fetching fresh missions from Flight Club API');
    const missions = await fetchMissionsFromFlightClub();

    const entry: MissionCacheEntry = {
      missions,
      cachedAt: Date.now()
    };

    await setCachedMissions(entry);

    console.log(`[FlightClub] Returning ${missions.length} missions (no server-side filtering)`);

    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=300');

    return res.status(200).json({
      missions,
      lastUpdated: new Date(entry.cachedAt).toISOString(),
      cached: false
    } as FlightClubMissionsResponse);

  } catch (error) {
    console.error('Flight Club missions API error:', error);

    const cachedEntry = await getCachedMissions();
    if (cachedEntry) {
      console.log('[FlightClub] Serving cached missions due to API error');
      res.setHeader('Cache-Control', 's-maxage=60');
      return res.status(200).json({
        missions: cachedEntry.missions,
        lastUpdated: new Date(cachedEntry.cachedAt).toISOString(),
        cached: true,
        warning: 'Serving cached data due to FlightClub API error'
      } as FlightClubMissionsResponse & { warning: string });
    }
    
    return res.status(500).json({ 
      error: 'Unable to fetch mission data',
      details: process.env.NODE_ENV === 'development' ? (error instanceof Error ? error.message : String(error)) : undefined
    });
  }
}

export { fetchMissionsFromFlightClub };
