import { useTranslations } from '@letta-cloud/translations';
import { useCurrentUser } from '$web/client/hooks';
import { useMemo, useRef } from 'react';

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
  const messageNumberRef = useRef<number | null>(null);

  return  useMemo(() => {
    if (!user) {
      return null;
    }

    const [firstName] = user.name.split(' ');
    const timeOfDay = new Date().getHours();
    const period = getTimeOfDayPeriod(timeOfDay);

    // Pick a random message number only if we haven't already
    if (messageNumberRef.current === null) {
      messageNumberRef.current = Math.floor(Math.random() * 10) + 1; // 10 variations
    }
    const messageNumber = messageNumberRef.current;

    // Get the message based on period and message number
    switch (period) {
      case 'lateNight':
        switch (messageNumber) {
          case 1: return t('lateNight.1', { firstName });
          case 2: return t('lateNight.2', { firstName });
          case 3: return t('lateNight.3', { firstName });
          case 4: return t('lateNight.4', { firstName });
          case 5: return t('lateNight.5', { firstName });
          case 6: return t('lateNight.6', { firstName });
          case 7: return t('lateNight.7', { firstName });
          case 8: return t('lateNight.8', { firstName });
          case 9: return t('lateNight.9', { firstName });
          case 10: return t('lateNight.10', { firstName });
          default: return t('lateNight.1', { firstName });
        }
      case 'earlyMorning':
        switch (messageNumber) {
          case 1: return t('earlyMorning.1', { firstName });
          case 2: return t('earlyMorning.2', { firstName });
          case 3: return t('earlyMorning.3', { firstName });
          case 4: return t('earlyMorning.4', { firstName });
          case 5: return t('earlyMorning.5', { firstName });
          case 6: return t('earlyMorning.6', { firstName });
          case 7: return t('earlyMorning.7', { firstName });
          case 8: return t('earlyMorning.8', { firstName });
          case 9: return t('earlyMorning.9', { firstName });
          case 10: return t('earlyMorning.10', { firstName });
          default: return t('goodMorning', { firstName }); // fallback
        }
      case 'morning':
        switch (messageNumber) {
          case 1: return t('morning.1', { firstName });
          case 2: return t('morning.2', { firstName });
          case 3: return t('morning.3', { firstName });
          case 4: return t('morning.4', { firstName });
          case 5: return t('morning.5', { firstName });
          case 6: return t('morning.6', { firstName });
          case 7: return t('morning.7', { firstName });
          case 8: return t('morning.8', { firstName });
          case 9: return t('morning.9', { firstName });
          case 10: return t('morning.10', { firstName });
          default: return t('goodMorning', { firstName }); // fallback
        }
      case 'afternoon':
        switch (messageNumber) {
          case 1: return t('afternoon.1', { firstName });
          case 2: return t('afternoon.2', { firstName });
          case 3: return t('afternoon.3', { firstName });
          case 4: return t('afternoon.4', { firstName });
          case 5: return t('afternoon.5', { firstName });
          case 6: return t('afternoon.6', { firstName });
          case 7: return t('afternoon.7', { firstName });
          case 8: return t('afternoon.8', { firstName });
          case 9: return t('afternoon.9', { firstName });
          case 10: return t('afternoon.10', { firstName });
          default: return t('goodAfternoon', { firstName }); // fallback
        }
      case 'evening':
        switch (messageNumber) {
          case 1: return t('evening.1', { firstName });
          case 2: return t('evening.2', { firstName });
          case 3: return t('evening.3', { firstName });
          case 4: return t('evening.4', { firstName });
          case 5: return t('evening.5', { firstName });
          case 6: return t('evening.6', { firstName });
          case 7: return t('evening.7', { firstName });
          case 8: return t('evening.8', { firstName });
          case 9: return t('evening.9', { firstName });
          case 10: return t('evening.10', { firstName });
          default: return t('goodEvening', { firstName }); // fallback
        }
      default:
        return t('goodMorning', { firstName });
    }
  }, [t, user]);
}
