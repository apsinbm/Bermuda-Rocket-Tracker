/**
 * Vercel Serverless Function: Flight Club Missions Proxy
 * 
 * Securely proxies requests to Flight Club API for mission discovery
 * Implements caching, rate limiting, and error handling
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';

// Types
interface FlightClubMission {
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

// Cache storage (in-memory for serverless)
let cache: {
  data: FlightClubMission[] | null;
  timestamp: number;
  ttl: number;
} = {
  data: null,
  timestamp: 0,
  ttl: 15 * 60 * 1000, // 15 minutes
};

// SECURITY: Rate limiting moved to middleware with distributed storage

function isCacheValid(): boolean {
  return cache.data !== null && (Date.now() - cache.timestamp) < cache.ttl;
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
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  // Only allow GET requests
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  
  try {
    // SECURITY: Rate limiting handled by middleware
    
    // Check cache first
    if (isCacheValid()) {
      console.log('Serving missions from cache');
      return res.status(200).json({
        missions: cache.data,
        lastUpdated: new Date(cache.timestamp).toISOString(),
        cached: true
      } as FlightClubMissionsResponse);
    }
    
    // Fetch fresh data from Flight Club API
    console.log('Fetching fresh missions from Flight Club API');
    const missions = await fetchMissionsFromFlightClub();
    
    // Update cache with ALL missions (no pre-filtering)
    cache.data = missions;
    cache.timestamp = Date.now();
    
    // IMPORTANT: Return ALL missions to allow proper matching
    // Filtering moved to client-side for UI display purposes only
    console.log(`[FlightClub] Returning ${missions.length} missions (no server-side filtering)`);
    
    // Set cache headers for client-side caching
    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=300'); // 5 minutes
    
    return res.status(200).json({
      missions: missions, // Return ALL missions
      lastUpdated: new Date().toISOString(),
      cached: false
    } as FlightClubMissionsResponse);
    
  } catch (error) {
    console.error('Flight Club missions API error:', error);
    
    // Return cached data if available, even if stale
    if (cache.data) {
      console.log('Serving stale cache due to API error');
      return res.status(200).json({
        missions: cache.data,
        lastUpdated: new Date(cache.timestamp).toISOString(),
        cached: true,
        warning: 'Serving cached data due to API unavailability'
      } as FlightClubMissionsResponse & { warning: string });
    }
    
    return res.status(500).json({ 
      error: 'Unable to fetch mission data',
      details: process.env.NODE_ENV === 'development' ? (error instanceof Error ? error.message : String(error)) : undefined
    });
  }
}