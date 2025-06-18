import type { ExecuteToolTelemetrySpan } from '@letta-cloud/types';
import { useTranslations } from '@letta-cloud/translations';
import { useMemo, useState } from 'react';
import { get } from 'lodash-es';
import { Typography } from '../../Typography/Typography';
import { EventItem } from '../../EventItem/EventItem';
import { LettaAlienChatIcon } from '../../../icons';
import { StatusBadge } from '../../../reusable/StatusBadge/StatusBadge';

interface SendMessageEventProps {
  trace: ExecuteToolTelemetrySpan;
}

const MAX_MESSAGE_LENGTH = 150;
export function SendMessageEvent(props: SendMessageEventProps) {
  const { trace } = props;

  const t = useTranslations('components/MessageReplay');

  const [showMore, setShowMore] = useState(true);

  const status = useMemo(() => {
    return get(trace['Events.Attributes'], '1.status') === 'error'
      ? 'error'
      : 'success';
  }, [trace]);
  const message = useMemo(() => {
    const message = get(trace['Events.Attributes'], '0.message', '');

    if (typeof message === 'string') {
      return message;
    }

    return JSON.stringify(message);
  }, [trace]);

  const isLongMessage = useMemo(() => {
    return message.length > MAX_MESSAGE_LENGTH;
  }, [message]);

  return (
    <EventItem
      icon={<LettaAlienChatIcon size="small" />}
      name={t('events.sendMessage.title')}
    >
      {status === 'error' ? (
        <div className="absolute top-2 right-2">
          <StatusBadge status={status} />
        </div>
      ) : (
        <div className="bg-background-grey w-full p-2 line-clamp-2">
          <Typography variant="body3" className="text-text-lighter">
            {showMore ? message.slice(0, MAX_MESSAGE_LENGTH) : message}
            {isLongMessage && (
              <>
                {' '}
                <button
                  className="text-primary"
                  onClick={() => {
                    setShowMore((prev) => !prev);
                  }}
                >
                  {showMore ? t('showMore') : t('showLess')}
                </button>
              </>
            )}
          </Typography>
        </div>
      )}
    </EventItem>
  );
}
