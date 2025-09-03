import { useTranslations } from '@letta-cloud/translations';
import { useCurrentAgent } from '../../../../../hooks';
import { useMemo } from 'react';

export function useDataSourcesTitle() {
  const t = useTranslations('ADE/EditDataSourcesPanel');
  const { sources } = useCurrentAgent();

  const count = useMemo(() => {
    if (!sources) {
      return '-';
    }

    return sources.length || 0;
  }, [sources]);

  return t('title', { count });
}
