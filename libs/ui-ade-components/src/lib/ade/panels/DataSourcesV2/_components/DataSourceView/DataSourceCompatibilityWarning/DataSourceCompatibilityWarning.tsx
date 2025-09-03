import { useCurrentAgent } from '../../../../../../hooks';
import type { Source } from '@letta-cloud/sdk-core';
import {
  Badge,
  HStack,
  Typography,
  Tooltip,
} from '@letta-cloud/ui-component-library';
import { useTranslations } from '@letta-cloud/translations';
import { WarningIcon } from '@letta-cloud/ui-component-library';
import {
  useIsSourceCompatibleWithAgent
} from '../../../hooks/useIsSourceCompatibleWithAgent/useIsSourceCompatibleWithAgent';

interface DataSourceCompatibilityWarningProps {
  source: Source;
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

  const detailedError = t.rich('description', {
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
  });

  return (
    <HStack gap="small" className="items-center">
      <WarningIcon size="xsmall" color="destructive" />
      <Tooltip content={detailedError}>
        <Typography variant="body3" color="destructive" className="cursor-help">
          {t('title')}
        </Typography>
      </Tooltip>
    </HStack>
  );
}
