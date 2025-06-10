import {
  getToolErrorRatePerDay,
  getToolErrorRateByName,
  getLLMLatencyPerDay,
  getToolLatencyPerDay,
  getToolLatencyByName,
  getToolUsageByFrequency,
  getTimeToFirstTokenPerDay,
  getTotalMessagesPerDay,
  getToolErrorsMetrics,
  getToolErrorMessages,
  getTimeToFirstTokenMetrics,
  getAverageResponseTime,
  getActiveAgentsPerDay,
  getTimeToFirstTokenMessages,
  getObservabilityOverview,
  getApiErrorCount,
} from './handlers';

export const observabilityRouter = {
  // New metrics endpoints
  getToolErrorRatePerDay,
  getToolErrorRateByName,
  getLLMLatencyPerDay,
  getToolLatencyPerDay,
  getToolLatencyByName,
  getToolUsageByFrequency,
  getTimeToFirstTokenPerDay,
  getTotalMessagesPerDay,
  // Existing endpoints
  getTimeToFirstTokenMetrics,
  getTimeToFirstTokenMessages,
  getAverageResponseTime,
  getActiveAgentsPerDay,
  getToolErrorsMetrics,
  getToolErrorMessages,
  getObservabilityOverview,
  getApiErrorCount,
};
