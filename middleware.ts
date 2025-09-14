/**
 * Vercel Edge Middleware for Security and Rate Limiting
 * 
 * Provides:
 * - Distributed rate limiting using Upstash Redis
 * - Origin validation and CORS security
 * - Request logging and monitoring
 * - Input validation for API endpoints
 */

import { NextRequest, NextResponse } from 'next/server';
import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

// Initialize Redis for rate limiting (only if environment variables are available)
const redis = process.env.UPSTASH_REDIS_REST_URL ? new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
}) : null;

// Rate limiter configuration
const ratelimit = redis ? new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(50, '1 m'), // 50 requests per minute
  analytics: true,
}) : null;

// Strict rate limiter for heavy endpoints
const heavyRatelimit = redis ? new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(20, '1 m'), // 20 requests per minute for telemetry
  analytics: true,
}) : null;

// Allowed origins for CORS
const ALLOWED_ORIGINS = [
  'https://bermuda-rocket-tracker.vercel.app',
  'https://bermuda-rocket-tracker-git-main-patos-projects.vercel.app',
  'https://bermuda-rocket-tracker-patos-projects.vercel.app',
  // Add staging domains as needed
];

// Development origins (only allow in development)
const DEV_ORIGINS = [
  'http://localhost:3000',
  'http://localhost:3001',
  'http://127.0.0.1:3000',
  'http://127.0.0.1:3001',
];

/**
 * Validate request origin
 */
function validateOrigin(request: NextRequest): boolean {
  const origin = request.headers.get('origin');
  
  if (!origin) {
    // Allow requests without origin (direct API calls, mobile apps)
    return true;
  }
  
  // In development, allow dev origins
  if (process.env.NODE_ENV === 'development') {
    return [...ALLOWED_ORIGINS, ...DEV_ORIGINS].includes(origin);
  }
  
  // In production, only allow production origins
  return ALLOWED_ORIGINS.includes(origin);
}

/**
 * Validate missionId parameter for Flight Club endpoints
 */
function validateMissionId(missionId: string): boolean {
  // Only allow alphanumeric, hyphens, and underscores, max 100 chars
  return /^[A-Za-z0-9_-]{1,100}$/.test(missionId);
}

/**
 * Get client IP address for rate limiting
 */
function getClientIP(request: NextRequest): string {
  // Try to get real IP from various headers
  const forwardedFor = request.headers.get('x-forwarded-for');
  const realIP = request.headers.get('x-real-ip');
  const cfConnectingIP = request.headers.get('cf-connecting-ip');
  
  if (forwardedFor) {
    // x-forwarded-for can be a comma-separated list, take the first one
    return forwardedFor.split(',')[0].trim();
  }
  
  if (realIP) {
    return realIP;
  }
  
  if (cfConnectingIP) {
    return cfConnectingIP;
  }
  
  // Fallback to Vercel's IP (less reliable for rate limiting)
  return request.ip || 'unknown';
}

/**
 * Handle CORS for API routes
 */
function handleCORS(request: NextRequest): NextResponse | null {
  const origin = request.headers.get('origin');
  
  // Handle preflight requests
  if (request.method === 'OPTIONS') {
    if (origin && validateOrigin(request)) {
      return new NextResponse(null, {
        status: 200,
        headers: {
          'Access-Control-Allow-Origin': origin,
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization',
          'Access-Control-Max-Age': '86400', // 24 hours
        },
      });
    }
    
    return new NextResponse(null, { status: 403 });
  }
  
  return null;
}

/**
 * Apply rate limiting
 */
async function applyRateLimit(request: NextRequest, isHeavyEndpoint = false): Promise<NextResponse | null> {
  if (!ratelimit || !heavyRatelimit) {
    // If Redis is not configured, skip rate limiting (development mode)
    return null;
  }
  
  const ip = getClientIP(request);
  const limiter = isHeavyEndpoint ? heavyRatelimit : ratelimit;
  
  try {
    const { success, limit, reset, remaining } = await limiter.limit(ip);
    
    if (!success) {
      return new NextResponse(
        JSON.stringify({
          error: 'Rate limit exceeded',
          limit,
          reset: new Date(reset),
          retryAfter: Math.round((reset - Date.now()) / 1000),
        }),
        {
          status: 429,
          headers: {
            'Content-Type': 'application/json',
            'X-RateLimit-Limit': limit.toString(),
            'X-RateLimit-Remaining': remaining.toString(),
            'X-RateLimit-Reset': reset.toString(),
            'Retry-After': Math.round((reset - Date.now()) / 1000).toString(),
          },
        }
      );
    }
    
    // Add rate limit headers to successful responses
    return null; // Continue to the actual handler
  } catch (error) {
    console.error('Rate limiting error:', error);
    // If rate limiting fails, allow the request but log the error
    return null;
  }
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  
  // Only apply middleware to API routes
  if (!pathname.startsWith('/api/')) {
    return NextResponse.next();
  }
  
  // Handle CORS preflight requests
  const corsResponse = handleCORS(request);
  if (corsResponse) {
    return corsResponse;
  }
  
  // Validate origin for API requests
  if (!validateOrigin(request)) {
    return new NextResponse(
      JSON.stringify({ error: 'Origin not allowed' }),
      { status: 403, headers: { 'Content-Type': 'application/json' } }
    );
  }
  
  // Validate missionId parameter for Flight Club simulation endpoint
  if (pathname.startsWith('/api/flightclub/simulation/')) {
    const missionId = pathname.split('/').pop();
    if (missionId && !validateMissionId(missionId)) {
      return new NextResponse(
        JSON.stringify({ error: 'Invalid mission ID format' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }
  }
  
  // Apply rate limiting
  const isHeavyEndpoint = pathname.startsWith('/api/flightclub/simulation/');
  const rateLimitResponse = await applyRateLimit(request, isHeavyEndpoint);
  if (rateLimitResponse) {
    return rateLimitResponse;
  }
  
  // Log API requests for monitoring
  const ip = getClientIP(request);
  const userAgent = request.headers.get('user-agent') || 'unknown';
  console.log(`[API] ${request.method} ${pathname} - IP: ${ip} - UA: ${userAgent.substring(0, 100)}`);
  
  // Continue to the API handler
  const response = NextResponse.next();
  
  // Add security headers to API responses
  const origin = request.headers.get('origin');
  if (origin && validateOrigin(request)) {
    response.headers.set('Access-Control-Allow-Origin', origin);
  }
  
  response.headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  return response;
}

export const config = {
  matcher: [
    /*
     * Match all API routes
     */
    '/api/:path*',
  ],
};