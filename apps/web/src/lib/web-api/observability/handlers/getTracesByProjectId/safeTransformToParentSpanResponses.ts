// Transformation functions
import type { RawAgentTraceRecord } from './types';
import { parseAgentTraceRecord } from './types';
import type {
  ParentSpanResponseType,
  StepDetailType,
} from '@letta-cloud/sdk-web';
import { ParentSpanResponse, StepDetail } from '@letta-cloud/sdk-web';

export function transformToParentSpanResponses(
  rawRecords: RawAgentTraceRecord[],
): ParentSpanResponseType[] {
  return rawRecords.map(transformToParentSpanResponse);
}

export function transformToParentSpanResponse(
  rawRecord: RawAgentTraceRecord,
): ParentSpanResponseType {
  // Parse the raw record first to get structured data
  const parsedRecord = parseAgentTraceRecord(rawRecord);

  // Extract agent ID from parent attributes
  const agentId = parsedRecord.parent_attributes['http.agent_id'];

  // Transform agent steps to step details
  const steps: StepDetailType[] = parsedRecord.agent_steps.map((step) => {
    const [_traceId, _timestamp, metadata, timingData] = step;
    const [_timestamps, eventTypes, metrics] = timingData;

    // Extract timing information
    let llmDurationMs = 0;
    let toolDurationMs = 0;
    let stepDurationMs = 0;
    let toolName = 'unknown';
    let toolStatus: 'error' | 'success' = 'success';

    // Parse metrics to extract timing and tool information
    metrics.forEach((metric: any, index: number) => {
      if ('duration_ms' in metric && eventTypes[index] === 'llm_request_ms') {
        llmDurationMs = parseInt(metric.duration_ms || '0') || 0;
      }
      if ('duration_ms' in metric && eventTypes[index] === 'step_ms') {
        stepDurationMs = parseInt(metric.duration_ms || '0') || 0;
      }
      if ('tool_name' in metric && metric.tool_name) {
        toolName = metric.tool_name;
      }
      if ('duration_ms' in metric && 'tool_name' in metric) {
        toolDurationMs = parseInt(metric.duration_ms || '0') || 0;
      }
      if ('success' in metric && metric.success) {
        toolStatus = metric.success === 'true' ? 'success' : 'error';
      }
    });

    return StepDetail.parse({
      stepId: metadata.step_id,
      toolName,
      toolDurationMs,
      llmDurationMs,
      stepDurationMs,
      toolStatus,
    });
  });

  // Determine request and execution status
  const requestStatus: 'error' | 'success' =
    parsedRecord.parent_status_code === 'STATUS_CODE_OK' ? 'success' : 'error';
  const executionStatus: 'error' | 'success' = steps.some(
    (step) => step.toolStatus === 'error',
  )
    ? 'error'
    : 'success';

  return ParentSpanResponse.parse({
    traceId: parsedRecord.TraceId,
    spanId: parsedRecord.TraceId, // Using trace ID as span ID since no separate span ID in source
    createdAt: parsedRecord.earliest_agent_step.toISOString(),
    requestStatus,
    executionStatus,
    statusMessage: parsedRecord.parent_status_message || '',
    durationNs: steps.reduce(
      (total, step) => total + step.stepDurationMs * 1_000_000,
      0,
    ),
    steps,
    agentId,
    inputPayload: parsedRecord.parent_attributes['http.request.body.messages'],
  });
}

// Safe transformation with error handling
export function safeTransformToParentSpanResponses(
  rawRecords: RawAgentTraceRecord[],
) {
  const results = rawRecords.map((record, index) => {
    try {
      return {
        success: true as const,
        data: transformToParentSpanResponse(record),
        index,
      };
    } catch (error) {
      return {
        success: false as const,
        error: error instanceof Error ? error.message : 'Unknown error',
        record,
        index,
      };
    }
  });

  const successful = results
    .filter(
      (
        result,
      ): result is {
        success: true;
        data: ParentSpanResponseType;
        index: number;
      } => result.success,
    )
    .map((result) => result.data);

  const errors = results.filter(
    (
      result,
    ): result is {
      success: false;
      error: string;
      record: RawAgentTraceRecord;
      index: number;
    } => !result.success,
  );

  return { successful, errors };
}
