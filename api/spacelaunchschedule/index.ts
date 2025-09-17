import type { VercelRequest, VercelResponse } from '@vercel/node';

interface ApiResponse {
  trajectoryImageUrl?: string;
  flightClubId?: string;
  trajectoryDirection?: 'Northeast' | 'East' | 'Southeast' | 'North' | 'South';
  trajectoryAvailable: boolean;
  confidence: 'confirmed' | 'projected' | 'estimated';
  cached: boolean;
  lastChecked: string;
  warning?: string;
}

interface CacheEntry {
  data: ApiResponse;
  expires: number;
}

const cache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours default TTL

function sanitizeInput(value: unknown): string {
  if (typeof value === 'string') {
    return value.trim().slice(0, 256);
  }
  return '';
}

function normalizeSlug(value: string): string {
  return value
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^\w-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

function extractDirectionFromImageName(imageUrl: string): ApiResponse['trajectoryDirection'] | undefined {
  const filename = imageUrl.toLowerCase();

  if (filename.includes('northeast') || filename.includes('north_east') || filename.includes('_ne_') || filename.includes('_ne.') || filename.includes('rtls')) {
    return 'Northeast';
  }
  if (filename.includes('southeast') || filename.includes('south_east') || filename.includes('_se_') || filename.includes('_se.') || filename.includes('_sse_')) {
    return 'Southeast';
  }
  if (filename.includes('north') && !filename.includes('east')) {
    return 'Northeast';
  }
  if (filename.includes('south') && !filename.includes('east')) {
    return 'Southeast';
  }
  if (filename.includes('east') && !filename.includes('north') && !filename.includes('south')) {
    return 'East';
  }
  if (/\biss\b/.test(filename) || filename.includes('crew') || filename.includes('dragon')) {
    return 'Northeast';
  }
  if (filename.includes('gto') || filename.includes('geo') || filename.includes('geosynchronous')) {
    return 'Southeast';
  }

  return undefined;
}

function extractFlightClubId(html: string): string | undefined {
  const flightClubPattern = /flightclub\.io\/result\/(?:3d|2d|telemetry)\?llId=([a-f0-9-]+)/gi;
  const match = flightClubPattern.exec(html);
  if (match && match[1]) {
    return match[1];
  }

  const llIdPattern = /llId["\s:=]+([a-f0-9-]{36})/gi;
  const llIdMatch = llIdPattern.exec(html);
  if (llIdMatch && llIdMatch[1]) {
    return llIdMatch[1];
  }

  return undefined;
}

function generateCandidateUrls(missionName: string, rocketName: string, launchId: string): string[] {
  const missionSlug = missionName ? normalizeSlug(missionName) : '';
  const rocketSlug = rocketName ? normalizeSlug(rocketName) : '';
  const urls = new Set<string>();

  if (missionSlug) {
    urls.add(`https://www.spacelaunchschedule.com/launch/${missionSlug}/`);
    if (rocketSlug) {
      urls.add(`https://www.spacelaunchschedule.com/launch/${rocketSlug}-${missionSlug}/`);
    }
  }

  if (launchId) {
    urls.add(`https://www.spacelaunchschedule.com/launch/${launchId}/`);
  }

  const otvMatch = missionName.match(/OTV-?(\d+)/i);
  if (otvMatch) {
    urls.add(`https://www.spacelaunchschedule.com/launch/otv-${otvMatch[1]}/`);
  }

  const ussfMatch = missionName.match(/USSF-?(\d+)/i);
  if (ussfMatch) {
    urls.add(`https://www.spacelaunchschedule.com/launch/ussf-${ussfMatch[1]}/`);
  }

  return Array.from(urls);
}

async function verifyImage(url: string): Promise<boolean> {
  try {
    const response = await fetch(url, {
      method: 'HEAD',
      signal: AbortSignal.timeout(7000)
    });
    return response.ok;
  } catch {
    return false;
  }
}

async function scrapeSpaceLaunchSchedule(missionName: string, rocketName: string, launchId: string): Promise<ApiResponse> {
  const candidateUrls = generateCandidateUrls(missionName, rocketName, launchId);

  for (const url of candidateUrls) {
    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; BermudaRocketTracker/1.0)',
          Accept: 'text/html,application/xhtml+xml'
        },
        signal: AbortSignal.timeout(15000)
      });

      if (!response.ok) {
        continue;
      }

      const html = await response.text();
      const flightClubId = extractFlightClubId(html);

      const imagePatterns = [
        /<img[^>]+src="([^"]*trajectory[^"]*\.(?:jpg|jpeg|png|gif|webp))"[^>]*>/gi,
        /<img[^>]+src="([^"]*trajecoty[^"]*\.(?:jpg|jpeg|png|gif|webp))"[^>]*>/gi,
        /<img[^>]+src="([^"]*flight[_-]?path[^"]*\.(?:jpg|jpeg|png|gif|webp))"[^>]*>/gi,
        /<img[^>]+src="([^"]*orbit[_-]?track[^"]*\.(?:jpg|jpeg|png|gif|webp))"[^>]*>/gi
      ];

      let trajectoryImageUrl: string | undefined;
      let trajectoryDirection: ApiResponse['trajectoryDirection'];

      for (const pattern of imagePatterns) {
        let match: RegExpExecArray | null;
        while ((match = pattern.exec(html)) !== null) {
          if (match[1]) {
            const candidate = match[1].startsWith('http')
              ? match[1]
              : `https://www.spacelaunchschedule.com${match[1]}`;

            if (await verifyImage(candidate)) {
              trajectoryImageUrl = candidate;
              trajectoryDirection = extractDirectionFromImageName(candidate);
              break;
            }
          }
        }
        if (trajectoryImageUrl) {
          break;
        }
      }

      const trajectoryUnavailable = html.includes('trajectory information from FlightClub.io is currently unavailable') ||
        html.includes('trajectory details as soon as they are released');

      let confidence: ApiResponse['confidence'] = 'estimated';
      if (flightClubId) {
        confidence = 'confirmed';
      } else if (trajectoryImageUrl) {
        confidence = 'projected';
      }

      return {
        trajectoryImageUrl,
        flightClubId,
        trajectoryDirection,
        trajectoryAvailable: !trajectoryUnavailable && (!!flightClubId || !!trajectoryImageUrl),
        confidence,
        cached: false,
        lastChecked: new Date().toISOString()
      };
    } catch (error) {
      console.error('[SpaceLaunchScheduleProxy] Fetch failed for URL', url, error);
    }
  }

  return {
    trajectoryAvailable: false,
    confidence: 'estimated',
    cached: false,
    lastChecked: new Date().toISOString(),
    warning: 'Trajectory data unavailable from Space Launch Schedule'
  };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const missionName = sanitizeInput(req.query.missionName);
  const rocketName = sanitizeInput(req.query.rocketName);
  const launchId = sanitizeInput(req.query.launchId);

  if (!missionName && !launchId) {
    return res.status(400).json({ error: 'missionName or launchId is required' });
  }

  const cacheKey = `${launchId}|${missionName}|${rocketName}`.toLowerCase();
  const cached = cache.get(cacheKey);

  if (cached && cached.expires > Date.now()) {
    return res.status(200).json({ ...cached.data, cached: true });
  }

  try {
    const data = await scrapeSpaceLaunchSchedule(missionName, rocketName, launchId);
    cache.set(cacheKey, {
      data,
      expires: Date.now() + CACHE_TTL_MS
    });

    return res.status(200).json(data);
  } catch (error) {
    console.error('[SpaceLaunchScheduleProxy] Unexpected error', error);

    if (cached) {
      return res.status(200).json({ ...cached.data, cached: true, warning: 'Serving cached data due to upstream error' });
    }

    return res.status(200).json({
      trajectoryAvailable: false,
      confidence: 'estimated',
      cached: false,
      lastChecked: new Date().toISOString(),
      warning: 'Unable to retrieve Space Launch Schedule data'
    } as ApiResponse);
  }
}
