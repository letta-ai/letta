import type { ToolType } from '@letta-cloud/sdk-core';

export interface RootTraceType {
  Timestamp: string;
  TraceId: string;
  SpanId: string;
  ParentSpanId: '';
  TraceState: string;
  SpanName: string;
  SpanKind: string;
  ServiceName: string;
  ResourceAttributes: ResourceAttributes;
  ScopeName: string;
  ScopeVersion: string;
  SpanAttributes: SpanAttributes;
  Duration: string;
  StatusCode: string;
  StatusMessage: string;
  'Events.Timestamp': string[];
  'Events.Name': string[];
  'Events.Attributes': Attribute[];
  'Links.TraceId': any[];
  'Links.SpanId': any[];
  'Links.TraceState': any[];
  'Links.Attributes': any[];
}

export interface ResourceAttributes {
  'telemetry.sdk.language': string;
  'telemetry.sdk.name': string;
  'telemetry.sdk.version': string;
  'service.name': string;
  'device.id': string;
  'letta.version': string;
}

export interface SpanAttributes {
  'agent.id': string;
  'project.id': string;
  'http.method': string;
  'http.url': string;
  'http.request.body.config': string;
  'http.request.body.stream_tokens': string;
  'http.request.body.use_assistant_message': string;
  'http.request.body.messages': string;
  'http.agent_id': string;
  'user.id': string;
  'http.status_code': string;
  'organization.id': string;
  'http.request.body.stream_steps': string;
}

export type Attribute = object;

export interface AgentStepTrace {
  Timestamp: string;
  TraceId: string;
  SpanId: string;
  ParentSpanId: string;
  TraceState: string;
  SpanName: string;
  SpanKind: string;
  ServiceName: string;
  ResourceAttributes: ResourceAttributes;
  ScopeName: string;
  ScopeVersion: string;
  SpanAttributes: AgentStepTraceSpanAttributes;
  Duration: string;
  StatusCode: string;
  StatusMessage: string;
  'Events.Timestamp': string[];
  'Events.Name': [
    'request_start_to_provider_request_start_ns',
    'llm_request_ms',
    'tool_execution_started',
    'tool_execution_completed',
    'step_ms',
  ];
  'Events.Attributes': Array<
    | {
        duration_ms: string;
      }
    | {
        provider_req_start_ms: string;
      }
    | {
        request_start_to_provider_request_start_ns: string;
      }
    | {
        tool_type: ToolType;
        tool_id: string;
        tool_name: string;
        duration_ms: string;
        success: string;
      }
  >;
  'Links.TraceId': any[];
  'Links.SpanId': any[];
  'Links.TraceState': any[];
  'Links.Attributes': any[];
}

export interface ToolExecutionCompletedEvent {
  tool_type: ToolType;
  tool_id: string;
  tool_name: string;
  duration_ms: string;
  success: string;
}

export interface LLMRequestMSEvent {
  duration_ms: string;
}

export interface ProviderReqStartMSEvent {
  provider_req_start_ms: string;
}

export interface StepMSEvent {
  duration_ms: string;
}

export interface MappedEventAttributes {
  provider_req_start_ns: ProviderReqStartMSEvent;
  llm_request_ms: LLMRequestMSEvent;
  tool_execution_started: object;
  tool_execution_completed: ToolExecutionCompletedEvent;
  step_ms: StepMSEvent;
  time_to_first_token_ms: {
    ttft_ms: string;
  };
}

export interface ResourceAttributes {
  'telemetry.sdk.name': string;
  'telemetry.sdk.version': string;
  'service.name': string;
  'device.id': string;
  'letta.version': string;
  'telemetry.sdk.language': string;
}

export interface AgentStepTraceSpanAttributes {
  step_id: string;
}

export interface ExecuteToolOutput {
  agent_state: string;
  func_return: string;
  sandbox_config_fingerprint: string;
  status: string;
  stderr: string[];
  stdout: string[];
}

export type ExecuteToolInput = Record<string, any>;

type ExecuteToolEventAttribute = ExecuteToolInput | ExecuteToolOutput;

interface ExecuteToolResourceAttributes {
  'device.id': string;
  'letta.version': string;
  'service.name': string;
  'telemetry.sdk.language': string;
  'telemetry.sdk.name': string;
  'telemetry.sdk.version': string;
}

interface ExecuteToolSpanAttributes {
  'parameter.agent_state': string;
  'parameter.agent_step_span': string;
  'parameter.tool_args': string;
  'parameter.tool_name': string;
}

export interface ExecuteToolTelemetrySpan {
  Duration: string;
  'Events.Attributes': ExecuteToolEventAttribute[];
  'Events.Name': string[];
  'Events.Timestamp': string[];
  'Links.Attributes': any[];
  'Links.SpanId': any[];
  'Links.TraceId': any[];
  'Links.TraceState': any[];
  ParentSpanId: string;
  ResourceAttributes: ExecuteToolResourceAttributes;
  ScopeName: string;
  ScopeVersion: string;
  ServiceName: string;
  SpanAttributes: ExecuteToolSpanAttributes;
  SpanId: string;
  SpanKind: string;
  SpanName: 'LettaAgent._execute_tool';
  StatusCode: string;
  StatusMessage: string;
  Timestamp: string;
  TraceId: string;
  TraceState: string;
}
