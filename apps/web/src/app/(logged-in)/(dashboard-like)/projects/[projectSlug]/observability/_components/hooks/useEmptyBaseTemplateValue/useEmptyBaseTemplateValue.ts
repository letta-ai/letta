import { useTranslations } from '@letta-cloud/translations';
import { useMemo } from 'react';

export function useEmptyBaseTemplateValue() {
  const t = useTranslations(
    'pages/projects/observability/useEmptyBaseTemplateValue',
  );

  return useMemo(() => {
    return {
      value: '',
      label: t('none'),
    };
  }, [t]);
}
