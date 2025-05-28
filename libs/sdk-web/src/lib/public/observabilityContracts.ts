import { initContract } from '@ts-rest/core';
import { z } from 'zod';

const c = initContract();

export const TimeToFirstTokenMetricsItem = z.object({
  date: z.string(), // ISO date string
  averageTimeToFirstTokenMs: z.number(), // Average time to first token in milliseconds
  sampleCount: z.number(), // Number of samples for the date
});

const TimeToFirstTokenMetricsResponseSchema = z.object({
  items: z.array(TimeToFirstTokenMetricsItem),
});

export const DefaultMetricsQuery = z
  .object({
    projectId: z.string(),
    startTimeUnix: z.number(),
    endTimeUnix: z.number(),
  })
  .refine(
    (data) => {
      return data.startTimeUnix < data.endTimeUnix;
    },
    {
      message: 'startTimeUnix must be less than endTimeUnix',
    },
  )
  .refine(
    (data) => {
      // Check if the time range is within 30 days
      const timeRange = data.endTimeUnix - data.startTimeUnix;
      return timeRange <= 30 * 24 * 60 * 60; // 30 days in s
    },
    {
      message: 'Time range must be within 30 days',
    },
  );

const timeToFirstTokenMetricsContract = c.query({
  path: '/observability/metrics/time-to-first-token',
  method: 'GET',
  query: DefaultMetricsQuery,
  responses: {
    200: TimeToFirstTokenMetricsResponseSchema,
  },
});

const AverageResponseTimeItem = z.object({
  date: z.string(), // ISO date string
  averageResponseTimeMs: z.number(), // Average response time in milliseconds
  sampleCount: z.number(), // Number of samples for the date
});

const AverageResponseTimeResponseSchema = z.object({
  items: z.array(AverageResponseTimeItem),
});

const getAverageResponseTimeContract = c.query({
  path: '/observability/metrics/average-response-time',
  method: 'GET',
  query: DefaultMetricsQuery,
  responses: {
    200: AverageResponseTimeResponseSchema,
  },
});

const totalMessagesPerDayItem = z.object({
  date: z.string(), // ISO date string
  totalMessages: z.number(), // Total messages for the date
});

const totalMessagesPerDayResponseSchema = z.object({
  items: z.array(totalMessagesPerDayItem),
});

const getTotalMessagesPerDayContract = c.query({
  path: '/observability/metrics/total-messages-per-day',
  method: 'GET',
  query: DefaultMetricsQuery,
  responses: {
    200: totalMessagesPerDayResponseSchema,
  },
});

export const observabilityContracts = c.router({
  getTimeToFirstTokenMetrics: timeToFirstTokenMetricsContract,
  getAverageResponseTime: getAverageResponseTimeContract,
  getTotalMessagesPerDay: getTotalMessagesPerDayContract,
});

export const observabilityQueryKeys = {
  getTimeToFirstTokenMetrics: (query: z.infer<typeof DefaultMetricsQuery>) => [
    'observability',
    'getTimeToFirstTokenMetrics',
    query,
  ],
  getAverageResponseTime: (query: z.infer<typeof DefaultMetricsQuery>) => [
    'observability',
    'getAverageResponseTime',
    query,
  ],
  getTotalMessagesPerDay: (query: z.infer<typeof DefaultMetricsQuery>) => [
    'observability',
    'getTotalMessagesPerDay',
    query,
  ],
};
