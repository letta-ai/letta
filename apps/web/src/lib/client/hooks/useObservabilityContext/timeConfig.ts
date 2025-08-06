export type TimeRange = '1d' | '1h' | '4h' | '7d' | '12h' | '30d' | 'custom';

export interface TimeGranularity {
  range: TimeRange;
  intervalMinutes: number;
  clickhouseDateFormat: string;
  displayFormat: string;
  durationMs: number;
}

export const TIME_CONFIGS: Record<TimeRange, TimeGranularity> = {
  '1h': {
    range: '1h',
    intervalMinutes: 5,
    clickhouseDateFormat: 'toStartOfFiveMinutes(Timestamp)',
    displayFormat: 'HH:mm',
    durationMs: 60 * 60 * 1000, // 1 hour
  },
  '4h': {
    range: '4h',
    intervalMinutes: 20,
    clickhouseDateFormat: 'toStartOfInterval(Timestamp, INTERVAL 20 MINUTE)',
    displayFormat: 'HH:mm',
    durationMs: 4 * 60 * 60 * 1000, // 4 hours
  },
  '12h': {
    range: '12h',
    intervalMinutes: 60,
    clickhouseDateFormat: 'toStartOfHour(Timestamp)',
    displayFormat: 'HH:mm',
    durationMs: 12 * 60 * 60 * 1000, // 12 hours
  },
  '1d': {
    range: '1d',
    intervalMinutes: 60,
    clickhouseDateFormat: 'toStartOfHour(Timestamp)',
    displayFormat: 'HH:mm',
    durationMs: 24 * 60 * 60 * 1000, // 1 day
  },
  '7d': {
    range: '7d',
    intervalMinutes: 1440, // daily
    clickhouseDateFormat: 'toDate(Timestamp)',
    displayFormat: 'MMM d',
    durationMs: 7 * 24 * 60 * 60 * 1000, // 7 days
  },
  '30d': {
    range: '30d',
    intervalMinutes: 1440, // daily
    clickhouseDateFormat: 'toDate(Timestamp)',
    displayFormat: 'MMM d',
    durationMs: 30 * 24 * 60 * 60 * 1000, // 30 days
  },
  custom: {
    range: 'custom',
    intervalMinutes: 1440, // default to daily for custom
    clickhouseDateFormat: 'toDate(Timestamp)',
    displayFormat: 'MMM d',
    durationMs: 0, // will be computed based on actual range
  },
};

export function getTimeConfig(timeRange: TimeRange): TimeGranularity {
  return TIME_CONFIGS[timeRange];
}

export function computeStartEndDates(timeRange: TimeRange): {
  startDate: Date;
  endDate: Date;
} {
  const now = new Date();
  const config = getTimeConfig(timeRange);

  if (timeRange === 'custom') {
    // For custom, return current defaults - will be overridden
    return {
      startDate: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000),
      endDate: now,
    };
  }

  // Extend end time to capture incomplete intervals
  // Add one full interval to ensure current incomplete bucket is included
  const intervalMs = config.intervalMinutes * 60 * 1000;

  // For very short intervals (5min, 20min), extend by 2 intervals to be safe
  // For longer intervals (1h+), extend by 1 interval
  const extensionMultiplier = config.intervalMinutes <= 20 ? 2 : 1;
  const extendedEndTime = new Date(
    now.getTime() + intervalMs * extensionMultiplier,
  );

  return {
    startDate: new Date(now.getTime() - config.durationMs),
    endDate: extendedEndTime,
  };
}
