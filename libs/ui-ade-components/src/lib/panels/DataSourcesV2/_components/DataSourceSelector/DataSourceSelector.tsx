import React, { Fragment, useCallback, useMemo, useState } from 'react';
import {
  Popover,
  VStack,
  Button,
  HR,
  PlusIcon,
  LinkIcon,
  Tooltip,
  WarningIcon,
} from '@letta-cloud/ui-component-library';
import { useCurrentAgent } from '../../../../hooks';
import { useDataSourceContext } from '../../hooks/useDataSourceContext/useDataSourceContext';
import { CreateDataSourceModal } from '../CreateDataSourceModal/CreateDataSourceModal';
import { AttachDataSourceModal } from '../AttachDataSourceModal/AttachDataSourceModal';
import { useTranslations } from '@letta-cloud/translations';
import type { Source } from '@letta-cloud/sdk-core';
import { useIsSourceCompatibleWithAgent } from '../../hooks/useIsSourceCompatibleWithAgent/useIsSourceCompatibleWithAgent';

export interface DataSourceSelectorProps {
  trigger: React.ReactNode;
}

interface DataSourceButtonProps {
  source: Source;
  isActive: boolean;
  onSelect: (sourceId: string) => void;
  showDivider: boolean;
}

export function DataSourceButton(props: DataSourceButtonProps) {
  const { source, isActive, onSelect, showDivider } = props;

  const isCompatible = useIsSourceCompatibleWithAgent(source);
  const t = useTranslations('ADE/EditDataSourcesPanel.DataSourceSelector');

  return (
    <Fragment>
      <Button
        fullWidth
        align="left"
        color="tertiary"
        size="small"
        active={isActive}
        label={source.name}
        postIcon={
          !isCompatible && (
            <Tooltip
              content={t.rich('incompatibleWarningTooltipWithModels', {
                folder: () => source.embedding_config?.embedding_model || '',
              })}
            >
              <WarningIcon size="xsmall" color="destructive" />
            </Tooltip>
          )
        }
        onClick={() => {
          onSelect(source.id || '');
        }}
      />
      {showDivider && <HR />}
    </Fragment>
  );
}

export function DataSourceSelector(props: DataSourceSelectorProps) {
  const { trigger } = props;
  const { sources } = useCurrentAgent();
  const { selectedDatasourceId, setSelectedDatasource } =
    useDataSourceContext();
  const [isOpen, setIsOpen] = useState(false);
  const t = useTranslations('ADE/EditDataSourcesPanel.DataSourceSelector');

  const handleSelectDataSource = useCallback(
    (sourceId: string) => {
      setSelectedDatasource(sourceId);
      setIsOpen(false);
    },
    [setSelectedDatasource],
  );

  const sortedSourceList = useMemo(() => {
    if (!sources) {
      return [];
    }

    return [...sources].sort((a, b) => {
      if (a.name && b.name) {
        return a.name.localeCompare(b.name);
      }
      return 0;
    });
  }, [sources]);

  return (
    <Popover
      trigger={trigger}
      triggerAsChild
      open={isOpen}
      onOpenChange={setIsOpen}
      align="start"
      className="bg-background-grey2"
      side="bottom"
    >
      <VStack
        padding="xxsmall"
        className="min-w-[200px] max-h-[300px] overflow-y-auto"
      >
        <VStack gap={false}>
          {sortedSourceList.map((source, index) => (
            <DataSourceButton
              key={source.id}
              source={source}
              isActive={selectedDatasourceId === source.id}
              onSelect={handleSelectDataSource}
              showDivider={!!(sources && index < sources.length - 1)}
            />
          ))}
        </VStack>

        <VStack gap={false} border>
          <CreateDataSourceModal
            trigger={
              <Button
                fullWidth
                align="left"
                color="tertiary"
                size="small"
                preIcon={<PlusIcon />}
                label={t('createNewDataSource')}
              />
            }
          />

          <HR />

          <AttachDataSourceModal
            trigger={
              <Button
                fullWidth
                align="left"
                color="tertiary"
                size="small"
                preIcon={<LinkIcon />}
                label={t('attachExistingDataSource')}
              />
            }
          />
        </VStack>
      </VStack>
    </Popover>
  );
}
