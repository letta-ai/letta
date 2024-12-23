import { useTranslations } from 'next-intl';
import { useCurrentUser } from '$web/client/hooks';
import { useMemo } from 'react';

export function useWelcomeText() {
  const timeOfDay = new Date().getHours();
  const t = useTranslations('client/hooks/useWelcomeText');
  const user = useCurrentUser();

  return useMemo(() => {
    if (!user) {
      return null;
    }

    const [firstName] = user.name.split(' ');

    if (timeOfDay < 12) {
      return t('goodMorning', { firstName });
    }

    if (timeOfDay < 18) {
      return t('goodAfternoon', { firstName });
    }

    return t('goodEvening', { firstName });
  }, [timeOfDay, t, user]);
}
