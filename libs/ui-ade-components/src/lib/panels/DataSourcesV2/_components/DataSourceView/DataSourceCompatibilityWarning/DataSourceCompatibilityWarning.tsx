import { useCurrentAgent } from '../../../../../hooks';
import type { Source } from '@letta-cloud/sdk-core';
import { useMemo } from 'react';
import { Alert, Badge } from '@letta-cloud/ui-component-library';
import { useTranslations } from '@letta-cloud/translations';

interface DataSourceCompatibilityWarningProps {
  source: Source;
}

export function useIsSourceCompatibleWithAgent(source: Source) {
  const { embedding_config } = useCurrentAgent();

  return useMemo(() => {
    if (!embedding_config || !source.embedding_config) {
      return true;
    }

    return (
      embedding_config.embedding_model ===
      source.embedding_config.embedding_model
    );
  }, [embedding_config, source.embedding_config]);
}

export function DataSourceCompatibilityWarning(
  props: DataSourceCompatibilityWarningProps,
) {
  const { source } = props;
  const { embedding_config } = useCurrentAgent();

  const t = useTranslations(
    'ADE/EditDataSourcesPanel/DataSourceCompatibilityWarning',
  );

  const isCompatible = useIsSourceCompatibleWithAgent(source);

  if (isCompatible) {
    return null;
  }

  return (
    <Alert variant="destructive" title={t('title')}>
      {t.rich('description', {
        agent: () => (
          <Badge
            border
            size="small"
            variant="destructive"
            content={embedding_config?.embedding_model || ''}
          />
        ),
        embedding: () => (
          <Badge
            border
            size="small"
            variant="destructive"
            content={source.embedding_config?.embedding_model || ''}
          />
        ),
      })}
    </Alert>
  );
}
