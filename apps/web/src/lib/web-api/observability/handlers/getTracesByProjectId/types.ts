import { z } from 'zod';

// Enums
export const StatusCodeSchema = z.enum(['STATUS_CODE_OK', 'STATUS_CODE_ERROR']);
export const EventTypeSchema = z.enum([
  'llm_request_ms',
  'tool_execution_started',
  'tool_execution_completed',
  'provider_req_start_ns',
  'step_ms',
]);

// Base schemas for nested structures
export const ParentAttributesSchema = z
  .object({
    'http.method': z.string(),
    'http.url': z.string(),
    'http.agent_id': z.string(),
    'http.request.body.messages': z.string(),
    'http.status_code': z.string(),
  })
  .catchall(z.string()); // Allow additional HTTP attributes

export const StepTimingSchema = z.object({
  duration_ms: z.string(),
});

export const ToolExecutionSchema = z.object({
  tool_name: z.string().optional(),
  tool_id: z.string().optional(),
  tool_type: z.string().optional(),
  duration_ms: z.string().optional(),
  success: z.string().optional(),
});

export const StepMetricsSchema = z.object({
  step_id: z.string(),
});

export const AgentStepSchema = z.tuple([
  z.string(), // Step trace ID
  z.string(), // Step timestamp (ISO format)
  StepMetricsSchema, // Step metadata
  z.array(z.any()),
]);

// Raw CSV record schema
export const AgentTraceRecordSchema = z.object({
  TraceId: z.string(),
  parent_status_message: z.string().nullable(),
  parent_status_code: StatusCodeSchema,
  parent_duration: z.string(),
  parent_attributes: ParentAttributesSchema,
  agent_steps: z.array(AgentStepSchema),
  agent_step_count: z.string(),
  earliest_agent_step: z.string().transform((str, ctx) => {
    const date = new Date(str);
    if (isNaN(date.getTime())) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Invalid date format',
      });
      return z.NEVER;
    }
    return date;
  }),
  latest_agent_step: z.string().transform((str, ctx) => {
    const date = new Date(str);
    if (isNaN(date.getTime())) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Invalid date format',
      });
      return z.NEVER;
    }
    return date;
  }),
});

// Raw CSV record without transformations (for when you want to keep strings)
export const RawAgentTraceRecordSchema = z.object({
  TraceId: z.string(),
  parent_status_message: z.string().nullable(),
  parent_status_code: StatusCodeSchema,
  parent_duration: z.string(),
  parent_attributes: z.string(),
  agent_steps: z.string(),
  agent_step_count: z.string(),
  earliest_agent_step: z.string(),
  latest_agent_step: z.string(),
});

// Type exports
export type AgentTraceRecord = z.infer<typeof AgentTraceRecordSchema>;
export type RawAgentTraceRecord = z.infer<typeof RawAgentTraceRecordSchema>;
export type ParentAttributes = z.infer<typeof ParentAttributesSchema>;
export type AgentStep = z.infer<typeof AgentStepSchema>;
export type StepTiming = z.infer<typeof StepTimingSchema>;
export type ToolExecution = z.infer<typeof ToolExecutionSchema>;
export type StepMetrics = z.infer<typeof StepMetricsSchema>;

// Utility functions
export function parseAgentTraceRecord(
  rawRecord: RawAgentTraceRecord,
): AgentTraceRecord {
  return AgentTraceRecordSchema.parse(rawRecord);
}

export function parseAgentTraceRecords(
  rawRecords: RawAgentTraceRecord[],
): AgentTraceRecord[] {
  return rawRecords.map((record) => AgentTraceRecordSchema.parse(record));
}

export function safeParseAgentTraceRecord(rawRecord: unknown) {
  return AgentTraceRecordSchema.safeParse(rawRecord);
}

export function safeParseAgentTraceRecords(rawRecords: unknown[]) {
  const results = rawRecords.map((record) =>
    AgentTraceRecordSchema.safeParse(record),
  );

  const successful = results
    .filter(
      (result): result is z.SafeParseSuccess<AgentTraceRecord> =>
        result.success,
    )
    .map((result) => result.data);

  const errors = results
    .filter((result): result is z.SafeParseError<unknown> => !result.success)
    .map((result) => result.error);

  return { successful, errors };
}

export function isValidAgentTraceRecord(obj: unknown): obj is AgentTraceRecord {
  return AgentTraceRecordSchema.safeParse(obj).success;
}
