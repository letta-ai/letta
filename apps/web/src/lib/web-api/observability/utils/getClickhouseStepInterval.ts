import type { TimeGranularity } from '$web/client/hooks/useObservabilityContext/timeConfig';

/**
 * Converts a TimeGranularity to a ClickHouse STEP INTERVAL string for use with WITH FILL
 * @param granularity The time granularity configuration
 * @returns ClickHouse STEP INTERVAL string (e.g., "5 MINUTE", "1 HOUR", "1 DAY")
 */
export function getClickhouseStepInterval(
  granularity: TimeGranularity,
): string {
  const minutes = granularity.intervalMinutes;

  if (minutes < 60) {
    return `${minutes} MINUTE`;
  } else if (minutes === 60) {
    return '1 HOUR';
  } else if (minutes === 1440) {
    return '1 DAY';
  } else {
    // For custom intervals, convert to hours if possible
    const hours = minutes / 60;
    if (hours === Math.floor(hours)) {
      return `${hours} HOUR`;
    } else {
      // Fallback to minutes for non-standard intervals
      return `${minutes} MINUTE`;
    }
  }
}
