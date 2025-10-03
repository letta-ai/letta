import { Typography } from '@letta-cloud/ui-component-library';
import type { RunResponseMessage } from '../../../../../../hooks';
import { useCallback } from 'react';
import { isAfter } from 'date-fns';

interface DateRenderProps {
  message: RunResponseMessage
}

export function DateRender(props: DateRenderProps) {
  const { message } = props;

  const formatDateAndTime = useCallback((date: Date) => {
    // if within the day, show time only
    // always show HH:MM:SS+ms
    // use Intl.DateTimeFormat

    if (isAfter(date, new Date(Date.now() - 24 * 60 * 60 * 1000))) {
      return new Intl.DateTimeFormat('default', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true,
      }).format(date);
    }

    return new Intl.DateTimeFormat('default', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true,
    }).format(date);
  }, []);

  if (!('date' in message)) {
    return null;
  }

  if (!message.date) {
    return null;
  }

  return (
    <Typography color="muted" variant="body3">{formatDateAndTime(new Date(message.date))}</Typography>
  )
}
