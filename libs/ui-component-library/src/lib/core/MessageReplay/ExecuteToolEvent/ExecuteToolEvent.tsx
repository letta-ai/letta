'use client';
import type { ExecuteToolTelemetrySpan } from '@letta-cloud/types';
import { useTranslations } from '@letta-cloud/translations';
import { useMemo } from 'react';
import { get } from 'lodash-es';
import { FunctionCall } from '../../../reusable/FunctionCall/FunctionCall';
import { VStack } from '../../../framing/VStack/VStack';
import { EventItem } from '../../EventItem/EventItem';
import { LettaInvaderOutlineIcon } from '../../../icons';

interface SendMessageEventProps {
  trace: ExecuteToolTelemetrySpan;
}

export function ExecuteToolEvent(props: SendMessageEventProps) {
  const { trace } = props;

  const t = useTranslations('components/MessageReplay/ExecuteToolEvent');

  const status = useMemo(() => {
    return get(trace['Events.Attributes'], '1.status') === 'error'
      ? 'failed'
      : 'success';
  }, [trace]);

  const funcReturn = useMemo(() => {
    return JSON.stringify(
      get(trace['Events.Attributes'], '1.func_return', ''),
      null,
      2,
    );
  }, [trace]);

  const stdErr = useMemo(() => {
    return JSON.stringify(
      get(trace['Events.Attributes'], '1.stderr', ''),
      null,
      2,
    );
  }, [trace]);

  const stdOut = useMemo(() => {
    return JSON.stringify(
      get(trace['Events.Attributes'], '1.stdout', ''),
      null,
      2,
    );
  }, [trace]);

  const toolName = useMemo(() => {
    return trace.SpanAttributes['parameter.tool_name'] || 'Unknown';
  }, [trace]);

  const inputs = useMemo(() => {
    const res = get(trace['Events.Attributes'], '0', '');

    if (typeof res === 'string') {
      return res;
    }

    return JSON.stringify(res, null, 2);
  }, [trace]);

  return (
    <EventItem
      icon={<LettaInvaderOutlineIcon size="small" />}
      name={t('title')}
    >
      <VStack fullWidth>
        <FunctionCall
          name={toolName}
          id={trace.SpanId}
          response={{
            date: new Date(trace.Timestamp).toLocaleString(),
            tool_return: funcReturn,
            tool_call_id: trace.SpanId,
            status: status,
            id: trace.SpanId,
            stderr: [stdErr],
            stdout: [stdOut],
            message_type: 'tool_return_message',
          }}
          inputs={inputs}
        />
      </VStack>
    </EventItem>
  );
}
