import { useState } from 'react';

const THIRTY_DAYS = 30 * 24 * 60 * 60; // 30 days in milliseconds
const ONE_DAY = 24 * 60 * 60; // 1 day in seconds

export function useObservabilitySeriesDates() {
  const [endTimeUnix] = useState(Date.now() / 1000 + ONE_DAY);
  const [startTimeUnix] = useState(endTimeUnix - THIRTY_DAYS); // Default to 30 days before the end time

  return {
    startTimeUnix,
    endTimeUnix,
    startDate: new Date((startTimeUnix - ONE_DAY) * 1000),
    endDate: new Date(endTimeUnix * 1000),
  };
}
