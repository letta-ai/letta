import { useTranslations } from '@letta-cloud/translations';
import { useCurrentUser } from '$web/client/hooks';
import { useEffect, useState, useRef } from 'react';

type TimeOfDayPeriod = 'lateNight' | 'earlyMorning' | 'morning' | 'afternoon' | 'evening';

function getTimeOfDayPeriod(hour: number): TimeOfDayPeriod {
  if (hour >= 0 && hour < 5) return 'lateNight';
  if (hour >= 5 && hour < 9) return 'earlyMorning';
  if (hour >= 9 && hour < 12) return 'morning';
  if (hour >= 12 && hour < 18) return 'afternoon';
  return 'evening'; // 18-23
}

export function useWelcomeText() {
  const t = useTranslations('client/hooks/useWelcomeText');
  const user = useCurrentUser();
  const [welcomeText, setWelcomeText] = useState<string | null>(null);
  const messageNumberRef = useRef<number | null>(null);

  useEffect(() => {
    if (!user) {
      setWelcomeText(null);
      return;
    }

    const [firstName] = user.name.split(' ');
    const timeOfDay = new Date().getHours();
    const period = getTimeOfDayPeriod(timeOfDay);

    // Get the count of available messages for this period
    // Start with 1 as fallback for backward compatibility
    let messageCount = 1;
    try {
      const countKey = `${period}.count`;
      const count = t(countKey as Parameters<typeof t>[0]);
      // Check if we got a valid count (not the key itself back)
      if (count && !count.includes('.count')) {
        messageCount = parseInt(count, 10) || 1;
      }
    } catch {
      // If count doesn't exist, fallback to 1
      messageCount = 1;
    }

    // Pick a random message number only if we haven't already
    if (messageNumberRef.current === null) {
      messageNumberRef.current = Math.floor(Math.random() * messageCount) + 1;
    }
    const messageNumber = messageNumberRef.current;

    // Get the message
    try {
      const messageKey = `${period}.${messageNumber}`;
      setWelcomeText(t(messageKey as Parameters<typeof t>[0], { firstName }));
    } catch {
      // Fallback to legacy keys if new structure doesn't exist
      if (period === 'morning' || period === 'earlyMorning') {
        setWelcomeText(t('goodMorning' as Parameters<typeof t>[0], { firstName }));
      } else if (period === 'afternoon') {
        setWelcomeText(t('goodAfternoon' as Parameters<typeof t>[0], { firstName }));
      } else {
        setWelcomeText(t('goodEvening' as Parameters<typeof t>[0], { firstName }));
      }
    }
  }, [t, user]);

  return welcomeText;
}
