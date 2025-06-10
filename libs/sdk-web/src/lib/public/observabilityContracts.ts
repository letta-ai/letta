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
  traceId: z.string(),
  agentId: z.string(),
  functionName: z.string(),
  errorMessage: z.string(),
  userMessage: z.string(),
  agentMessage: z.string(),
  timestamp: z.string(),
});

export type GetToolErrorMessagesItemType = z.infer<
  typeof GetToolErrorMessagesItem
>;

const GetToolErrorMessagesResponseSchema = z.object({
  items: z.array(GetToolErrorMessagesItem),
  totalCount: z.number(),
});

const getToolErrorMessagesContract = c.query({
  path: '/observability/metrics/tool-errors/messages',
  method: 'GET',
  query: applyRefine(
    z.object({
      projectId: z.string(),
      startDate: z.string(),
      endDate: z.string(),
      functionName: z.string().optional(),
    }),
  ),
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
  p50ResponseTimeNs: z.number(), // 50th percentile response time in milliseconds
  p99ResponseTimeNs: z.number(), // 99th percentile response time in milliseconds
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

const ObservabilityOverviewSchema = z.object({
  totalMessageCount: z.number(),
  totalTokenCount: z.number(),
  tokenPerMessageMedian: z.number(),
  apiErrorRate: z.number(),
  toolErrorRate: z.number(),
  p50TimeToFirstTokenNs: z.number(),
  p99TimeToFirstTokenNs: z.number(),
  p50ResponseTimeNs: z.number(),
  p99ResponseTimeNs: z.number(),
});

const getObservabilityOverviewContract = c.query({
  path: '/observability/overview',
  method: 'GET',
  query: DefaultMetricsQuery,
  responses: {
    200: ObservabilityOverviewSchema,
  },
});

const APIErrorCountItem = z.object({
  date: z.string(), // ISO date string
  errorCount: z.number(), // Number of API errors for the date
});

const APIErrorCountResponseSchema = z.object({
  items: z.array(APIErrorCountItem),
});

const getApiErrorCountContract = c.query({
  path: '/observability/metrics/api-errors',
  method: 'GET',
  query: DefaultMetricsQuery,
  responses: {
    200: APIErrorCountResponseSchema,
  },
});

// Tool Error Rate Per Day
const ToolErrorRateItem = z.object({
  date: z.string(),
  errorCount: z.number(),
  totalCount: z.number(),
  errorRate: z.number(),
});

const ToolErrorRateResponseSchema = z.object({
  items: z.array(ToolErrorRateItem),
});

const getToolErrorRatePerDayContract = c.query({
  path: '/observability/metrics/tool-error-rate-per-day',
  method: 'GET',
  query: DefaultMetricsQuery,
  responses: {
    200: ToolErrorRateResponseSchema,
  },
});

// Tool Error Rate By Name
const ToolErrorRateByNameItem = z.object({
  date: z.string(),
  toolName: z.string(),
  errorCount: z.number(),
  totalCount: z.number(),
  errorRate: z.number(),
});

const ToolErrorRateByNameResponseSchema = z.object({
  items: z.array(ToolErrorRateByNameItem),
});

const getToolErrorRateByNameContract = c.query({
  path: '/observability/metrics/tool-error-rate-by-name',
  method: 'GET',
  query: DefaultMetricsQuery,
  responses: {
    200: ToolErrorRateByNameResponseSchema,
  },
});

// LLM Latency Per Day
const LLMLatencyItem = z.object({
  date: z.string(),
  count: z.number(),
  avgLatencyMs: z.number(),
  p50LatencyMs: z.number(),
  p99LatencyMs: z.number(),
});

const LLMLatencyResponseSchema = z.object({
  items: z.array(LLMLatencyItem),
});

const getLLMLatencyPerDayContract = c.query({
  path: '/observability/metrics/llm-latency-per-day',
  method: 'GET',
  query: DefaultMetricsQuery,
  responses: {
    200: LLMLatencyResponseSchema,
  },
});

// Tool Latency Per Day
const ToolLatencyItem = z.object({
  date: z.string(),
  count: z.number(),
  avgLatencyMs: z.number(),
  p50LatencyMs: z.number(),
  p99LatencyMs: z.number(),
});

const ToolLatencyResponseSchema = z.object({
  items: z.array(ToolLatencyItem),
});

const getToolLatencyPerDayContract = c.query({
  path: '/observability/metrics/tool-latency-per-day',
  method: 'GET',
  query: DefaultMetricsQuery,
  responses: {
    200: ToolLatencyResponseSchema,
  },
});

// Tool Latency By Name
const ToolLatencyByNameItem = z.object({
  date: z.string(),
  toolName: z.string(),
  count: z.number(),
  avgLatencyMs: z.number(),
  p50LatencyMs: z.number(),
  p99LatencyMs: z.number(),
});

const ToolLatencyByNameResponseSchema = z.object({
  items: z.array(ToolLatencyByNameItem),
});

const getToolLatencyByNameContract = c.query({
  path: '/observability/metrics/tool-latency-by-name',
  method: 'GET',
  query: DefaultMetricsQuery,
  responses: {
    200: ToolLatencyByNameResponseSchema,
  },
});

// Tool Usage By Frequency
const ToolUsageByFrequencyItem = z.object({
  date: z.string(),
  toolName: z.string(),
  usageCount: z.number(),
});

const ToolUsageByFrequencyResponseSchema = z.object({
  items: z.array(ToolUsageByFrequencyItem),
});

const getToolUsageByFrequencyContract = c.query({
  path: '/observability/metrics/tool-usage-by-frequency',
  method: 'GET',
  query: DefaultMetricsQuery,
  responses: {
    200: ToolUsageByFrequencyResponseSchema,
  },
});

// Time to First Token Per Day
const TimeToFirstTokenPerDayItem = z.object({
  date: z.string(),
  count: z.number(),
  avgTtftMs: z.number(),
  p50TtftMs: z.number(),
  p99TtftMs: z.number(),
});

const TimeToFirstTokenPerDayResponseSchema = z.object({
  items: z.array(TimeToFirstTokenPerDayItem),
});

const getTimeToFirstTokenPerDayContract = c.query({
  path: '/observability/metrics/time-to-first-token-per-day',
  method: 'GET',
  query: DefaultMetricsQuery,
  responses: {
    200: TimeToFirstTokenPerDayResponseSchema,
  },
});

export const observabilityContracts = c.router({
  // New metrics endpoints
  getToolErrorRatePerDay: getToolErrorRatePerDayContract,
  getToolErrorRateByName: getToolErrorRateByNameContract,
  getLLMLatencyPerDay: getLLMLatencyPerDayContract,
  getToolLatencyPerDay: getToolLatencyPerDayContract,
  getToolLatencyByName: getToolLatencyByNameContract,
  getToolUsageByFrequency: getToolUsageByFrequencyContract,
  getTimeToFirstTokenPerDay: getTimeToFirstTokenPerDayContract,
  // Existing endpoints
  getTimeToFirstTokenMetrics: timeToFirstTokenMetricsContract,
  getAverageResponseTime: getAverageResponseTimeContract,
  getTotalMessagesPerDay: getTotalMessagesPerDayContract,
  getActiveAgentsPerDay: getActiveAgentsContract,
  getTimeToFirstTokenMessages: getTimeToFirstTokenMessagesContract,
  getToolErrorsMetrics: getToolErrorsMetricsContract,
  getToolErrorMessages: getToolErrorMessagesContract,
  getObservabilityOverview: getObservabilityOverviewContract,
  getApiErrorCount: getApiErrorCountContract,
});

export const observabilityQueryKeys = {
  // New metrics query keys
  getToolErrorRatePerDay: (query: z.infer<typeof DefaultMetricsQuery>) => [
    'observability',
    'getToolErrorRatePerDay',
    query,
  ],
  getToolErrorRateByName: (query: z.infer<typeof DefaultMetricsQuery>) => [
    'observability',
    'getToolErrorRateByName',
    query,
  ],
  getLLMLatencyPerDay: (query: z.infer<typeof DefaultMetricsQuery>) => [
    'observability',
    'getLLMLatencyPerDay',
    query,
  ],
  getToolLatencyPerDay: (query: z.infer<typeof DefaultMetricsQuery>) => [
    'observability',
    'getToolLatencyPerDay',
    query,
  ],
  getToolLatencyByName: (query: z.infer<typeof DefaultMetricsQuery>) => [
    'observability',
    'getToolLatencyByName',
    query,
  ],
  getToolUsageByFrequency: (query: z.infer<typeof DefaultMetricsQuery>) => [
    'observability',
    'getToolUsageByFrequency',
    query,
  ],
  getTimeToFirstTokenPerDay: (query: z.infer<typeof DefaultMetricsQuery>) => [
    'observability',
    'getTimeToFirstTokenPerDay',
    query,
  ],
  // Existing query keys
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
  getApiErrorCount: (query: z.infer<typeof DefaultMetricsQuery>) => [
    'observability',
    'getApiErrorCount',
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
  getObservabilityOverview: (query: z.infer<typeof DefaultMetricsQuery>) => [
    'observability',
    'getObservabilityOverview',
    query,
  ],
};
