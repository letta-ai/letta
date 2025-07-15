import { useTranslations } from '@letta-cloud/translations';
import { useMemo, useState } from 'react';
import { get } from 'lodash-es';
import { Typography } from '../../Typography/Typography';
import { EventItem } from '../../EventItem/EventItem';
import { LettaAlienChatIcon } from '../../../icons';
import { StatusBadge } from '../../../reusable/StatusBadge/StatusBadge';
import type { MessageEventType } from '../type';
import { EventDurationsBadge } from '../EventDurationsBadge/EventDurationsBadge';
import { DetailedMessageView, VStack } from '../../../../';

interface SendMessageEventProps {
  event: MessageEventType;
}

const MAX_MESSAGE_LENGTH = 150;
export function SendMessageEvent(props: SendMessageEventProps) {
  const { event } = props;

  const t = useTranslations('components/MessageReplay');

  const [showMore, setShowMore] = useState(false);

  const status = useMemo(() => {
    return event.output?.status === 'success' ? 'success' : 'error';
  }, [event.output?.status]);
  const message = useMemo(() => {
    const message = get(event.input, 'message', '');

    if (typeof message === 'string') {
      return message;
    }

    return JSON.stringify(message);
  }, [event]);

  const isLongMessage = useMemo(() => {
    return message.length > MAX_MESSAGE_LENGTH;
  }, [message]);

  return (
    <EventItem
      rightContent={<EventDurationsBadge {...event} />}
      icon={<LettaAlienChatIcon size="small" />}
      name={t('events.sendMessage.title')}
    >
      <VStack fullWidth>
        {status === 'error' ? (
          <div className="absolute top-2 right-2">
            <StatusBadge status={status} />
          </div>
        ) : (
          <div className="bg-background-grey w-full p-2">
            <Typography variant="body3" className="text-text-lighter">
              {showMore
                ? message
                : `${message.slice(0, MAX_MESSAGE_LENGTH)}${isLongMessage ? '...' : ''}`}
              {isLongMessage && (
                <>
                  {' '}
                  <button
                    className="text-primary font-semibold"
                    onClick={() => {
                      setShowMore((prev) => !prev);
                    }}
                  >
                    {showMore ? t('showLess') : t('showMore')}
                  </button>
                </>
              )}
            </Typography>
          </div>
        )}
        <VStack border>
          <DetailedMessageView stepId={event.stepId} />
        </VStack>
      </VStack>
    </EventItem>
  );
}
