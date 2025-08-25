'use client';
import { useTranslations } from '@letta-cloud/translations';
import { useMemo } from 'react';
import { get } from 'lodash-es';
import { FunctionCall } from '../../../reusable/FunctionCall/FunctionCall';
import { VStack } from '../../../framing/VStack/VStack';
import { EventItem } from '../../EventItem/EventItem';
import { LettaInvaderOutlineIcon } from '../../../icons';
import type { MessageEventType } from '../type';
import { EventDurationsBadge } from '../EventDurationsBadge/EventDurationsBadge';
import { DetailedMessageView } from '../../../../';

interface SendMessageEventProps {
  event: MessageEventType;
}

export function ExecuteToolEvent(props: SendMessageEventProps) {
  const { event } = props;

  const t = useTranslations('components/MessageReplay/ExecuteToolEvent');

  const status = useMemo(() => {
    return event.output?.status === 'error' ? 'failed' : 'success';
  }, [event]);

  const funcReturn = useMemo(() => {
    return JSON.stringify(get(event.output, 'func_return', ''), null, 2);
  }, [event]);

  const stdErr = useMemo(() => {
    return JSON.stringify(get(event.output, 'stderr', ''), null, 2);
  }, [event]);

  const stdOut = useMemo(() => {
    return JSON.stringify(get(event.output, 'stdout', ''), null, 2);
  }, [event]);

  const toolName = useMemo(() => {
    return event.name || 'Unknown';
  }, [event]);

  const inputs = useMemo(() => {
    const res = event.input;

    if (typeof res === 'string') {
      return res;
    }

    return JSON.stringify(res, null, 2);
  }, [event]);

  return (
    <EventItem
      icon={<LettaInvaderOutlineIcon size="small" />}
      name={t('title')}
      rightContent={<EventDurationsBadge {...event} />}
    >
      <VStack fullWidth>
        <FunctionCall
          name={toolName}
          variant="inspector"
          id={event.stepId}
          response={{
            date: new Date(event.timestamp).toLocaleString(),
            tool_return: funcReturn,
            tool_call_id: event.stepId,
            status: status === 'success' ? 'success' : 'error',
            id: event.stepId,
            stderr: [stdErr],
            stdout: [stdOut],
            message_type: 'tool_return_message',
          }}
          inputs={inputs}
          status={status}
        />
        <VStack border>
          <DetailedMessageView stepId={event.stepId} />
        </VStack>
      </VStack>
    </EventItem>
  );
}
