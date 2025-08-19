'use client';
import type {
  AgentStepTrace,
  ExecuteToolInput,
  ExecuteToolOutput,
  ExecuteToolTelemetrySpan,
  OtelTrace,
  RootTraceType,
} from '@letta-cloud/types';
import { useMemo } from 'react';
import { VStack } from '../../framing/VStack/VStack';
import { useTranslations } from '@letta-cloud/translations';
import { SendMessageEvent } from './SendMessageEvent/SendMessageEvent';
import { EventItem } from '../EventItem/EventItem';
import { ExecuteToolEvent } from './ExecuteToolEvent/ExecuteToolEvent';
import { LettaInvaderSleeptimeIcon } from '../../icons';
import { StartEvent } from './StartEvent/StartEvent';
import type { MessageEventType } from './type';
import {
  getLettaProcessingDurationFromTrace,
  getLLMDurationFromTrace,
  getStepDurationFromTrace,
  getToolDurationFromTrace,
  getTTFTFromTrace,
} from '@letta-cloud/utils-shared';
import { EventDurationsBadge } from './EventDurationsBadge/EventDurationsBadge';
import { useTotalTraceDuration } from '@letta-cloud/utils-client';

interface MessageReplayProps {
  traces: OtelTrace[];
}

interface StepEventProps {
  event: MessageEventType;
}

function StepEvent(props: StepEventProps) {
  const { event } = props;

  if (event.name === 'send_message') {
    return <SendMessageEvent event={event} />;
  }

  return <ExecuteToolEvent event={event} />;
}

function isToolInput(input: unknown): input is ExecuteToolInput {
  return typeof input === 'object';
}

function isToolOutput(output: unknown): output is ExecuteToolOutput {
  return typeof output === 'object';
}

export function MessageReplay(props: MessageReplayProps) {
  const { traces } = props;

  const t = useTranslations('components/MessageReplay');

  const events = useMemo(() => {
    if (!traces?.length) {
      return [];
    }
    const toolExecutions = traces.filter(
      (trace) => trace.SpanName === 'LettaAgent._execute_tool',
    ) as unknown as ExecuteToolTelemetrySpan[];

    const toolExecutionsByNameMap = new Map<string, ExecuteToolTelemetrySpan>();

    toolExecutions.forEach((execution) => {
      if (!('parameter.step_id' in execution.SpanAttributes)) {
        return;
      }

      const stepId =
        typeof execution.SpanAttributes?.['parameter.step_id'] === 'string'
          ? execution.SpanAttributes?.['parameter.step_id']
          : '';
      if (!toolExecutionsByNameMap.has(stepId)) {
        toolExecutionsByNameMap.set(stepId, execution);
      }
    });

    return traces
      .filter((trace) => trace.SpanName === 'agent_step')
      .map((_trace) => {
        const trace = _trace as unknown as AgentStepTrace;

        const stepId = trace.SpanAttributes['step_id'];

        const toolExecutionDetails = toolExecutionsByNameMap.get(stepId);

        if (!toolExecutionDetails) {
          return null;
        }

        return {
          timestamp: trace.Timestamp,
          stepId: trace.SpanAttributes['step_id'],
          name: toolExecutionDetails['SpanAttributes']['parameter.tool_name'],
          input: isToolInput(toolExecutionDetails['Events.Attributes'][0])
            ? toolExecutionDetails['Events.Attributes'][0]
            : null,
          output: isToolOutput(toolExecutionDetails['Events.Attributes'][1])
            ? toolExecutionDetails['Events.Attributes'][1]
            : null,
          llmDuration: getLLMDurationFromTrace(trace) || 0,
          toolDuration: getToolDurationFromTrace(trace) || 0,
          stepDuration: getStepDurationFromTrace(trace) || 0,
          lettaDuration: getLettaProcessingDurationFromTrace(trace) || 0,
        };
      });
  }, [traces]);

  const rootSpan = useMemo(() => {
    if (!traces?.length) {
      return null;
    }
    return traces.find(
      (trace) => !trace.ParentSpanId,
    ) as unknown as RootTraceType;
  }, [traces]);

  const totalDuration = useTotalTraceDuration(traces);

  const ttftDuration = useMemo(() => {
    return getTTFTFromTrace(traces);
  }, [traces]);

  if (!rootSpan) {
    return null;
  }

  return (
    <VStack fullWidth gap={false}>
      <StartEvent ttftDuration={ttftDuration} trace={rootSpan} />
      {events.map((event, index) => {
        if (!event) {
          return null;
        }

        return <StepEvent key={index} event={event} />;
      })}
      <EventItem
        rightContent={<EventDurationsBadge totalDuration={totalDuration} />}
        icon={<LettaInvaderSleeptimeIcon size="small" />}
        name={t('events.end.title')}
      ></EventItem>
    </VStack>
  );
}

export * from './DetailedMessageView/DetailedMessageView';
export * from './EventDurationsBadge/EventDurationsBadge';
