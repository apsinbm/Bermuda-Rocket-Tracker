import type { VercelRequest, VercelResponse } from '@vercel/node';
import {
  getLaunchMetadata,
  listCachedLaunchMetadata,
  removeLaunchMetadata,
  setLaunchMetadata,
  setCachedMissions,
  setCachedSimulation,
  type LaunchCacheMetadata,
  type MissionCacheEntry
} from '../flightclub/cache';
import { fetchMissionsFromFlightClub, type FlightClubMission } from '../flightclub/missions';
import {
  fetchSimulationFromFlightClub,
  processSimulationData,
  type ProcessedSimulationData
} from '../flightclub/simulation/[missionId]';

interface LaunchLibraryLaunch {
  id: string;
  name: string;
  net: string;
  window_start?: string;
  window_end?: string;
  mission?: {
    name?: string;
  };
  rocket?: {
    configuration?: {
      name?: string;
    };
  };
  launch_service_provider?: {
    name?: string;
  };
}

const LAUNCH_LIBRARY_ENDPOINT = 'https://ll.thespacedevs.com/2.2.0/launch/upcoming/?limit=40&location__ids=27,12,21';

const STAGE_RULES: Array<{ label: string; thresholdMinutes: number; intervalMinutes?: number }> = [
  { label: '14d', thresholdMinutes: 14 * 24 * 60 },
  { label: '7d', thresholdMinutes: 7 * 24 * 60 },
  { label: '48h', thresholdMinutes: 48 * 60 },
  { label: '24h', thresholdMinutes: 24 * 60 },
  { label: '12h', thresholdMinutes: 12 * 60 },
  { label: 'hourly', thresholdMinutes: 6 * 60, intervalMinutes: 60 },
  { label: 'minutely', thresholdMinutes: 30, intervalMinutes: 1 }
];

interface RefreshDecision {
  shouldRefresh: boolean;
  stage?: string;
}

interface RefreshSummary {
  refreshed: number;
  skipped: number;
  upcoming: number;
  errors: Array<{ launchId: string; message: string }>;
}

function authorize(request: VercelRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    // Fail closed: if CRON_SECRET is not configured, reject all requests
    console.error('CRON_SECRET environment variable is not configured');
    return false;
  }
  const provided = request.headers['authorization'];
  return provided === `Bearer ${secret}`;
}

async function fetchUpcomingLaunches(): Promise<LaunchLibraryLaunch[]> {
  const response = await fetch(LAUNCH_LIBRARY_ENDPOINT, {
    headers: {
      'User-Agent': 'Bermuda-Rocket-Tracker/CacheJob'
    },
    signal: AbortSignal.timeout(15000)
  });

  if (!response.ok) {
    throw new Error(`Launch Library API error: ${response.status} ${response.statusText}`);
  }

  const payload = await response.json();
  return Array.isArray(payload?.results) ? payload.results : [];
}

function normalizeName(value?: string): string {
  return value?.toLowerCase().replace(/\s+/g, ' ').trim() ?? '';
}

function isSpaceXMatch(launchName: string, missionDescription: string): boolean {
  const launch = normalizeName(launchName);
  const mission = normalizeName(missionDescription);

  if (!launch || !mission) {
    return false;
  }

  if (launch.includes('starlink') && mission.includes('starlink')) {
    return true;
  }

  const crewMatch = launch.match(/crew[-\s]*(\d+)/i);
  if (crewMatch) {
    const crewNumber = crewMatch[1];
    return mission.includes(`crew ${crewNumber}`) || mission.includes(`crew-${crewNumber}`);
  }

  if ((launch.includes('falcon') || launch.includes('dragon')) && mission.includes('falcon')) {
    return true;
  }

  return false;
}

function matchMissionForLaunch(launch: LaunchLibraryLaunch, missions: FlightClubMission[]): FlightClubMission | null {
  const launchId = launch.id;
  const launchName = launch.name || '';

  if (!missions.length) {
    return null;
  }

  const byId = missions.find(m => m.launchLibraryId === launchId);
  if (byId) {
    return byId;
  }

  const launchNameLower = normalizeName(launchName);
  if (launchNameLower) {
    const exact = missions.find(m => normalizeName(m.description) === launchNameLower);
    if (exact) {
      return exact;
    }

    const partial = missions.find(m => {
      const missionName = normalizeName(m.description);
      return missionName.includes(launchNameLower) || launchNameLower.includes(missionName);
    });
    if (partial) {
      return partial;
    }
  }

  const spaceX = missions.find(m => isSpaceXMatch(launchName, m.description));
  if (spaceX) {
    return spaceX;
  }

  if (launchNameLower) {
    const launchWords = launchNameLower.split(/[\s\-_]+/).filter(word => word.length > 2);
    const wordMatch = missions.find(m => {
      const missionWords = normalizeName(m.description).split(/[\s\-_]+/).filter(word => word.length > 2);
      return launchWords.some(lw => missionWords.some(mw => lw.includes(mw) || mw.includes(lw)));
    });
    if (wordMatch) {
      return wordMatch;
    }
  }

  return null;
}

function getSimulationId(mission: FlightClubMission): string | null {
  const guidPattern = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
  if (mission.flightClubSimId && guidPattern.test(mission.flightClubSimId)) {
    return mission.flightClubSimId;
  }
  if (guidPattern.test(mission.id)) {
    return mission.id;
  }
  return mission.flightClubSimId || mission.id || null;
}

function determineLaunchTime(launch: LaunchLibraryLaunch): number | null {
  const candidates = [launch.net, launch.window_start, launch.window_end].filter(Boolean);
  for (const value of candidates) {
    const timestamp = Date.parse(value as string);
    if (!Number.isNaN(timestamp)) {
      return timestamp;
    }
  }
  return null;
}

function evaluateRefresh(launchTime: number, meta: LaunchCacheMetadata | null): RefreshDecision {
  const now = Date.now();
  const diffMinutes = (launchTime - now) / 60000;

  if (diffMinutes <= 0) {
    return { shouldRefresh: false, stage: 'postlaunch' };
  }

  for (const rule of STAGE_RULES) {
    if (diffMinutes <= rule.thresholdMinutes) {
      if (rule.intervalMinutes) {
        if (!meta || meta.stage !== rule.label) {
          return { shouldRefresh: true, stage: rule.label };
        }
        if (!meta.lastRefreshedAt || (now - meta.lastRefreshedAt) / 60000 >= rule.intervalMinutes) {
          return { shouldRefresh: true, stage: rule.label };
        }
        return { shouldRefresh: false, stage: rule.label };
      }

      if (!meta || meta.stage !== rule.label) {
        return { shouldRefresh: true, stage: rule.label };
      }
      return { shouldRefresh: false, stage: rule.label };
    }
  }

  return { shouldRefresh: false, stage: meta?.stage };
}

function buildMissionCacheEntry(missions: FlightClubMission[]): MissionCacheEntry {
  return {
    missions,
    cachedAt: Date.now()
  };
}

export default async function handler(request: VercelRequest, response: VercelResponse) {
  if (!authorize(request)) {
    return response.status(401).json({ error: 'Unauthorized' });
  }

  if (request.method !== 'GET' && request.method !== 'POST') {
    return response.status(405).json({ error: 'Method not allowed' });
  }

  const summary: RefreshSummary = {
    refreshed: 0,
    skipped: 0,
    upcoming: 0,
    errors: []
  };

  try {
    const launches = await fetchUpcomingLaunches();
    summary.upcoming = launches.length;

    const missions = await fetchMissionsFromFlightClub();
    await setCachedMissions(buildMissionCacheEntry(missions));

    const activeLaunchIds = new Set<string>();

    for (const launch of launches) {
      const launchTime = determineLaunchTime(launch);
      if (!launchTime) {
        summary.skipped += 1;
        continue;
      }

      const mission = matchMissionForLaunch(launch, missions);
      if (!mission) {
        summary.skipped += 1;
        continue;
      }

      const simulationId = getSimulationId(mission);
      if (!simulationId) {
        summary.skipped += 1;
        continue;
      }

      activeLaunchIds.add(launch.id);

      const existingMeta = await getLaunchMetadata(launch.id);
      const launchIso = new Date(launchTime).toISOString();

      let meta: LaunchCacheMetadata | null = existingMeta ?? null;
      if (!meta) {
        meta = {
          launchId: launch.id,
          missionId: mission.id,
          simulationId,
          launchName: launch.name,
          launchTime: launchIso
        };
      } else if (meta.launchTime !== launchIso) {
        meta = {
          ...meta,
          launchTime: launchIso,
          stage: undefined,
          lastRefreshedAt: undefined,
          simulationId
        };
      }

      const decision = evaluateRefresh(launchTime, meta);
      if (!decision.shouldRefresh) {
        summary.skipped += 1;
        await setLaunchMetadata({
          ...meta,
          simulationId,
          stage: decision.stage,
          lastResult: meta.lastResult ?? 'success'
        });
        continue;
      }

      try {
        const rawSimulation = await fetchSimulationFromFlightClub(simulationId);
        const processed: ProcessedSimulationData = processSimulationData(rawSimulation);

        await setCachedSimulation(simulationId, {
          data: processed,
          cachedAt: Date.now()
        });

        await setLaunchMetadata({
          launchId: launch.id,
          missionId: mission.id,
          simulationId,
          launchName: launch.name,
          launchTime: launchIso,
          stage: decision.stage,
          lastRefreshedAt: Date.now(),
          lastResult: 'success'
        });

        summary.refreshed += 1;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        summary.errors.push({ launchId: launch.id, message });
        summary.skipped += 1;

        await setLaunchMetadata({
          launchId: launch.id,
          missionId: mission.id,
          simulationId,
          launchName: launch.name,
          launchTime: launchIso,
          stage: decision.stage,
          lastRefreshedAt: meta?.lastRefreshedAt,
          lastResult: 'failed'
        });
      }
    }

    const cachedMeta = await listCachedLaunchMetadata();
    await Promise.all(
      cachedMeta
        .filter(meta => !activeLaunchIds.has(meta.launchId))
        .map(meta => removeLaunchMetadata(meta.launchId))
    );

    return response.status(200).json({
      ok: true,
      summary,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return response.status(500).json({
      error: message,
      summary,
      timestamp: new Date().toISOString()
    });
  }
}
