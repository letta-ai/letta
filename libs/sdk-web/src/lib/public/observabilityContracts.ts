import { initContract } from '@ts-rest/core';
import { z } from 'zod';
import { zodTypes } from '@letta-cloud/sdk-core';

const c = initContract();

export const TimeToFirstTokenMetricsItem = z.object({
  date: z.string(), // ISO date string
  averageTimeToFirstTokenMs: z.number(), // Average time to first token in milliseconds
  sampleCount: z.number(), // Number of samples for the date
});

const TimeToFirstTokenMetricsResponseSchema = z.object({
  items: z.array(TimeToFirstTokenMetricsItem),
});

function applyRefine(schema: z.ZodObject<any>) {
  return schema
    .refine(
      (data) => {
        return (
          new Date(data.startDate).getTime() < new Date(data.endDate).getTime()
        );
      },
      {
        message: 'startTimeUnix must be less than endTimeUnix',
      },
    )
    .refine(
      (data) => {
        // Check if the time range is within 365 days
        const startTime = new Date(data.startDate).getTime();
        const endTime = new Date(data.endDate).getTime();

        const timeDifference = endTime - startTime;

        return timeDifference <= 365 * 24 * 60 * 60 * 1000; // 365 days in milliseconds
      },
      {
        message: 'Time range must be within 365 days',
      },
    );
}

export const DefaultMetricsQuery = applyRefine(
  z.object({
    projectId: z.string(),
    startDate: z.string(),
    endDate: z.string(),
  }),
);

const DefaultPagedMetricsQuery = applyRefine(
  z.object({
    projectId: z.string(),
    startDate: z.string(),
    endDate: z.string(),
    offset: z.number(),
    limit: z.number().max(25),
  }),
);

const GetToolErrorItem = z.object({
  date: z.string(), // ISO date string
  errorCount: z.number(), // Number of errors for the tool on that date
});

const GetToolErrorsResponseSchema = z.object({
  items: z.array(GetToolErrorItem),
});

const getToolErrorsMetricsContract = c.query({
  path: '/observability/metrics/tool-errors',
  method: 'GET',
  query: DefaultMetricsQuery,
  responses: {
    200: GetToolErrorsResponseSchema,
  },
});

const GetToolErrorMessagesItem = z.object({
  createdAt: z.string(), // ISO date string
  traceId: z.string(),
  agentId: z.string(),
  toolName: z.string(),
});

export type GetToolErrorMessagesItemType = z.infer<
  typeof GetToolErrorMessagesItem
>;

const GetToolErrorMessagesResponseSchema = z.object({
  items: z.array(GetToolErrorMessagesItem),
  hasNextPage: z.boolean(),
});

const getToolErrorMessagesContract = c.query({
  path: '/observability/metrics/tool-errors/messages',
  method: 'GET',
  query: DefaultPagedMetricsQuery,
  responses: {
    200: GetToolErrorMessagesResponseSchema,
  },
});

const timeToFirstTokenMetricsContract = c.query({
  path: '/observability/metrics/time-to-first-token',
  method: 'GET',
  query: DefaultMetricsQuery,
  responses: {
    200: TimeToFirstTokenMetricsResponseSchema,
  },
});

const TimeToFirstTokenMessageItem = z.object({
  createdAt: z.string(),
  traceId: z.string(),
  messages: zodTypes.MessageCreate.array(),
  timeToFirstTokenNs: z.number().nullable(),
  agentId: z.string(),
});

export type TimeToFirstTokenMessageItemType = z.infer<
  typeof TimeToFirstTokenMessageItem
>;

const TimeToFirstTokenMessagesResponseSchema = z.object({
  items: z.array(TimeToFirstTokenMessageItem),
  hasNextPage: z.boolean(),
});

const getTimeToFirstTokenMessagesContract = c.query({
  path: '/observability/metrics/time-to-first-token/messages',
  method: 'GET',
  query: DefaultPagedMetricsQuery,
  responses: {
    200: TimeToFirstTokenMessagesResponseSchema,
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

const activeAgentItem = z.object({
  date: z.string(), // ISO date string
  activeAgents: z.number(), // Number of active agents for the date
});

const activeAgentsResponseSchema = z.object({
  returningActiveAgents: z.array(activeAgentItem),
  newActiveAgents: z.array(activeAgentItem),
});

const getActiveAgentsContract = c.query({
  path: '/observability/metrics/active-agents',
  method: 'GET',
  query: DefaultMetricsQuery,
  responses: {
    200: activeAgentsResponseSchema,
  },
});

export const observabilityContracts = c.router({
  getTimeToFirstTokenMetrics: timeToFirstTokenMetricsContract,
  getAverageResponseTime: getAverageResponseTimeContract,
  getTotalMessagesPerDay: getTotalMessagesPerDayContract,
  getActiveAgentsPerDay: getActiveAgentsContract,
  getTimeToFirstTokenMessages: getTimeToFirstTokenMessagesContract,
  getToolErrorsMetrics: getToolErrorsMetricsContract,
  getToolErrorMessages: getToolErrorMessagesContract,
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
  getActiveAgentsPerDay: (query: z.infer<typeof DefaultMetricsQuery>) => [
    'observability',
    'getActiveAgentsPerDay',
    query,
  ],
  getTimeToFirstTokenMessages: (
    query: z.infer<typeof DefaultPagedMetricsQuery>,
  ) => ['observability', 'getTimeToFirstTokenMessages', query],
  getToolErrorsMetrics: (query: z.infer<typeof DefaultMetricsQuery>) => [
    'observability',
    'getToolErrorsMetrics',
    query,
  ],
  getToolErrorMessages: (query: z.infer<typeof DefaultPagedMetricsQuery>) => [
    'observability',
    'getToolErrorMessages',
    query,
  ],
};
