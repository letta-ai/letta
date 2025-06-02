'use client';
import type {
  ExecuteToolTelemetrySpan,
  OtelTrace,
  RootTraceType,
} from '@letta-cloud/types';
import { useMemo } from 'react';
import { VStack } from '../../framing/VStack/VStack';
import { useTranslations } from '@letta-cloud/translations';
import './MessageReplay.scss';
import { SendMessageEvent } from './SendMessageEvent/SendMessageEvent';
import { MessageEvent } from './MessageEvent/MessageEvent';
import { ExecuteToolEvent } from './ExecuteToolEvent/ExecuteToolEvent';
import { LettaInvaderSleeptimeIcon } from '../../icons';
import { StartEvent } from './StartEvent/StartEvent';

interface MessageReplayProps {
  traces: OtelTrace[];
}

interface StepEventProps {
  trace: ExecuteToolTelemetrySpan;
}

function StepEvent(props: StepEventProps) {
  const { trace } = props;

  const t = useTranslations('components/MessageReplay');
  const toolName = trace.SpanAttributes['parameter.tool_name'];

  if (toolName === 'send_message') {
    return <SendMessageEvent trace={trace} />;
  }

  return <ExecuteToolEvent trace={trace} />;
}

export function MessageReplay(props: MessageReplayProps) {
  const { traces } = props;

  const t = useTranslations('components/MessageReplay');

  const steps: ExecuteToolTelemetrySpan[] = useMemo(() => {
    if (!traces?.length) {
      return [];
    }
    return traces.filter(
      (trace) => trace.SpanName === 'LettaAgent._execute_tool',
    ) as unknown as ExecuteToolTelemetrySpan[];
  }, [traces]);

  const rootSpan = useMemo(() => {
    if (!traces?.length) {
      return null;
    }
    return traces.find(
      (trace) => !trace.ParentSpanId,
    ) as unknown as RootTraceType;
  }, [traces]);

  if (!rootSpan) {
    return null;
  }

  return (
    <VStack fullWidth gap={false}>
      <StartEvent trace={rootSpan} />
      {steps.map((step, index) => {
        return <StepEvent key={index} trace={step} />;
      })}
      <MessageEvent
        icon={<LettaInvaderSleeptimeIcon size="small" />}
        name={t('events.end.title')}
      ></MessageEvent>
    </VStack>
  );
}
