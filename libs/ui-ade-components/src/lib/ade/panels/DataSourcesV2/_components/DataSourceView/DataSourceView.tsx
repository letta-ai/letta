import {
  Button,
  CaretDownIcon,
  FolderIcon,
  HStack,
  PlusIcon,
  SearchIcon,
  VStack,
} from '@letta-cloud/ui-component-library';
import { useDataSourceContext } from '../../hooks/useDataSourceContext/useDataSourceContext';
import { useCurrentAgent } from '../../../../../hooks';
import { useMemo, useState } from 'react';
import type { Source } from '@letta-cloud/sdk-core';
import { useTranslations } from '@letta-cloud/translations';
import { FilesView } from './FilesView/FilesView';
import { InstructionsView } from './InstructionsView/InstructionsView';
import { DatasourceDropdownMenu } from '../DatasourceDropdownMenu';
import { DataSourceSelector } from '../DataSourceSelector';
import { UploadFileModal } from '../UploadFileModal';
import { DataSourceCompatibilityWarning } from './DataSourceCompatibilityWarning/DataSourceCompatibilityWarning';
import { SearchOverlay } from '../../../../../shared/SearchOverlay';

interface DataSourceViewHeaderProps {
  source: Source;
  search: string;
  onSearchChange: (search: string) => void;
  showSearch: boolean;
  onToggleSearch: () => void;
}

function DataSourceViewHeader(props: DataSourceViewHeaderProps) {
  const t = useTranslations('ADE/DataSourceViewHeader');
  const { source, search, onSearchChange, showSearch, onToggleSearch } = props;

  return (
    <HStack
      fullWidth
      justify="spaceBetween"
      align="center"
      paddingX="small"
      paddingY="xsmall"
      position="relative"
      overflow="hidden"
    >
      <SearchOverlay
        isVisible={showSearch}
        value={search}
        onChange={onSearchChange}
        onClose={() => {
          onToggleSearch();
        }}
        placeholder={t('searchFiles')}
        label={t('searchFiles')}
        closeLabel={t('closeSearch')}
      />
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
              disabled={showSearch}
            />
          }
        />
        <DatasourceDropdownMenu source={source} disabled={showSearch} />
      </HStack>
      <HStack>
        <Button
          size="xsmall"
          preIcon={<SearchIcon />}
          label={t('searchFiles')}
          color="tertiary"
          hideLabel
          onClick={onToggleSearch}
          active={showSearch}
          disabled={showSearch}
        />
        <UploadFileModal
          source={source}
          trigger={
            <Button
              size="xsmall"
              preIcon={<PlusIcon />}
              label={t('addFile')}
              color="secondary"
              hideLabel
              disabled={showSearch}
            />
          }
        />
      </HStack>
    </HStack>
  );
}

export function DataSourceView() {
  const { selectedDatasourceId } = useDataSourceContext();

  const [search, setSearch] = useState<string>('');
  const [showSearch, setShowSearch] = useState<boolean>(false);
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
    <VStack
      overflowY="hidden"
      className="max-h-[600px]"
      gap={false}
      fullWidth
      fullHeight
    >
      <DataSourceViewHeader
        source={selectedDataSource}
        search={search}
        onSearchChange={setSearch}
        showSearch={showSearch}
        onToggleSearch={() => {
          setShowSearch(!showSearch);
          if (showSearch) {
            setSearch('');
          }
        }}
      />
      <VStack
        collapseHeight
        flex
        fullWidth
        paddingX="small"
        paddingBottom="small"
      >
        <DataSourceCompatibilityWarning source={selectedDataSource} />
        <InstructionsView source={selectedDataSource} />
        <FilesView sourceId={selectedDataSource.id || ''} search={search} />
      </VStack>
    </VStack>
  );
}
