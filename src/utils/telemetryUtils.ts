import { EnhancedTelemetryFrame } from '../services/flightClubApiService';

/**
 * Find the telemetry frame whose timestamp is closest to the requested playback time.
 * Uses binary search so that large datasets remain responsive.
 */
export function getTelemetryFrameIndex(telemetry: EnhancedTelemetryFrame[], targetTime: number): number {
  if (!telemetry.length) {
    return -1;
  }

  if (telemetry.length === 1) {
    return 0;
  }

  if (targetTime <= telemetry[0].time) {
    return 0;
  }

  const lastIndex = telemetry.length - 1;
  if (targetTime >= telemetry[lastIndex].time) {
    return lastIndex;
  }

  let left = 0;
  let right = lastIndex;

  while (left <= right) {
    const mid = Math.floor((left + right) / 2);
    const midTime = telemetry[mid].time;

    if (midTime === targetTime) {
      return mid;
    }

    if (midTime < targetTime) {
      left = mid + 1;
    } else {
      right = mid - 1;
    }
  }

  const nextIndex = Math.min(left, lastIndex);
  const previousIndex = Math.max(0, nextIndex - 1);

  const previousDiff = Math.abs(telemetry[previousIndex].time - targetTime);
  const nextDiff = Math.abs(telemetry[nextIndex].time - targetTime);

  return nextDiff < previousDiff ? nextIndex : previousIndex;
}

export function getTelemetryFrame(telemetry: EnhancedTelemetryFrame[], targetTime: number): EnhancedTelemetryFrame | null {
  const index = getTelemetryFrameIndex(telemetry, targetTime);
  if (index === -1) {
    return null;
  }
  return telemetry[index];
}

/**
 * Find the first telemetry frame whose timestamp is at or after the requested time.
 */
export function getTelemetryFrameIndexAtOrAfterTime(
  telemetry: EnhancedTelemetryFrame[],
  targetTime: number
): number {
  if (!telemetry.length) {
    return -1;
  }

  if (targetTime <= telemetry[0].time) {
    return 0;
  }

  const lastIndex = telemetry.length - 1;
  if (targetTime >= telemetry[lastIndex].time) {
    return lastIndex;
  }

  let left = 0;
  let right = lastIndex;

  while (left < right) {
    const mid = Math.floor((left + right) / 2);
    if (telemetry[mid].time < targetTime) {
      left = mid + 1;
    } else {
      right = mid;
    }
  }

  return left;
}
