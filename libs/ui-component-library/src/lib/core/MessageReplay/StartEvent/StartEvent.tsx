import type { RootTraceType } from '@letta-cloud/types';
import { useTranslations } from '@letta-cloud/translations';
import { Typography } from '../../Typography/Typography';
import { EventItem } from '../../EventItem/EventItem';
import { LettaInvaderIcon } from '../../../icons';
import { useMemo } from 'react';
import { Code } from '../../Code/Code';
import { EventDurationsBadge } from '../EventDurationsBadge/EventDurationsBadge';

interface StartEventProps {
  trace: RootTraceType;
  ttftDuration?: number;
}

export function StartEvent(props: StartEventProps) {
  const { trace, ttftDuration } = props;

  const t = useTranslations('components/StartEvent');

  const messages = useMemo(() => {
    try {
      return JSON.stringify(
        JSON.parse(
          trace.SpanAttributes['http.request.body.messages'].replace(/'/g, '"'),
        ),
        null,
        2,
      );
    } catch (_e) {
      return trace.SpanAttributes['http.request.body.messages'];
    }
  }, [trace]);

  return (
    <EventItem
      rightContent={<EventDurationsBadge ttftDuration={ttftDuration} />}
      icon={<LettaInvaderIcon size="small" />}
      name={t('title')}
    >
      <div className="bg-background-grey flex flex-col gap-2 w-full p-2 line-clamp-2">
        <Typography variant="body2" bold>
          {trace.SpanName}
        </Typography>
        <Code
          language="javascript"
          code={messages}
          fontSize="small"
          showLineNumbers={false}
        />
      </div>
    </EventItem>
  );
}
