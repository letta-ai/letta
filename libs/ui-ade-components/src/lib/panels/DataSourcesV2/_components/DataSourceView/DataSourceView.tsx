import {
  Button,
  CaretDownIcon,
  FolderIcon,
  HStack,
  PlusIcon,
  VStack,
} from '@letta-cloud/ui-component-library';
import { useDataSourceContext } from '../../hooks/useDataSourceContext/useDataSourceContext';
import { useCurrentAgent } from '../../../../hooks';
import { useMemo } from 'react';
import type { Source } from '@letta-cloud/sdk-core';
import { useTranslations } from '@letta-cloud/translations';
import { FilesView } from './FilesView/FilesView';
import { InstructionsView } from './InstructionsView/InstructionsView';
import { DatasourceDropdownMenu } from '../DatasourceDropdownMenu';
import { DataSourceSelector } from '../DataSourceSelector';
import { UploadFileModal } from '../UploadFileModal';
import { DataSourceCompatibilityWarning } from './DataSourceCompatibilityWarning/DataSourceCompatibilityWarning';

interface DataSourceViewHeaderProps {
  source: Source;
}

function DataSourceViewHeader(props: DataSourceViewHeaderProps) {
  const t = useTranslations('ADE/DataSourceViewHeader');
  const { source } = props;

  return (
    <HStack fullWidth justify="spaceBetween" align="center" padding="small">
      <HStack gap="small" align="center">
        <DataSourceSelector
          trigger={
            <Button
              data-testid="current-folder-name"
              label={source.name}
              size="small"
              color="secondary"
              _use_rarely_className="!font-semibold [&]:!border-none"
              preIcon={<FolderIcon />}
              postIcon={<CaretDownIcon />}
            />
          }
        />
        <DatasourceDropdownMenu source={source} />
      </HStack>
      <HStack>
        <UploadFileModal
          source={source}
          trigger={
            <Button
              size="xsmall"
              preIcon={<PlusIcon />}
              label={t('addFile')}
              color="secondary"
              hideLabel
            />
          }
        />
      </HStack>
    </HStack>
  );
}

export function DataSourceView() {
  const { selectedDatasourceId } = useDataSourceContext();

  const { sources } = useCurrentAgent();

  const selectedDataSource = useMemo(() => {
    if (!sources || sources.length === 0) {
      return undefined;
    }

    return (
      sources?.find((source) => source.id === selectedDatasourceId) ||
      sources[0]
    );
  }, [sources, selectedDatasourceId]);

  if (!sources || !selectedDataSource) {
    return null;
  }

  return (
    <VStack overflowY="hidden" gap={false} fullWidth fullHeight>
      <DataSourceViewHeader source={selectedDataSource} />
      <VStack
        fullHeight
        overflowY="hidden"
        fullWidth
        paddingX="small"
        paddingBottom="small"
      >
        <DataSourceCompatibilityWarning source={selectedDataSource} />
        <InstructionsView source={selectedDataSource} />
        <FilesView sourceId={selectedDataSource.id || ''} />
      </VStack>
    </VStack>
  );
}
