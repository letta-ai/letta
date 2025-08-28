import { useTranslations } from '@letta-cloud/translations';
import React, { useCallback, useMemo, useState } from 'react';
import {
  type AgentState,
  type Source,
  useAgentsServiceAttachSourceToAgent,
  UseAgentsServiceRetrieveAgentKeyFn,
  useSourcesServiceListSources,
} from '@letta-cloud/sdk-core';
import {
  Button,
  DatabaseIcon,
  Dialog,
  RawInput,
  SearchIcon,
  HStack,
  VStack,
  Tooltip,
  WarningIcon,
  Typography,
  LoadingEmptyStatusComponent,
  Frame,
} from '@letta-cloud/ui-component-library';
import { useQueryClient } from '@tanstack/react-query';
import { useCurrentAgent } from '../../../../hooks';
import {
  useIsSourceCompatibleWithAgent
} from '../../hooks/useIsSourceCompatibleWithAgent/useIsSourceCompatibleWithAgent';

interface DataSourceItemProps {
  source: Source;
  isAttached: boolean;
  onAttachComplete: () => void;
}

function DataSourceItem(props: DataSourceItemProps) {
  const { source, isAttached, onAttachComplete } = props;
  const { id } = useCurrentAgent();
  const queryClient = useQueryClient();
  const t = useTranslations('ADE/EditDataSourcesPanel.AttachDataSourceModal');

  const { mutate, isPending } = useAgentsServiceAttachSourceToAgent({
    onSuccess: (response) => {
      queryClient.setQueriesData<AgentState | undefined>(
        {
          queryKey: UseAgentsServiceRetrieveAgentKeyFn({
            agentId: id,
          }),
        },
        () => {
          return response;
        },
      );

      onAttachComplete();
    },
  });

  const handleAttachSource = useCallback(() => {
    mutate({
      agentId: id,
      sourceId: source.id || '',
    });
  }, [id, mutate, source.id]);

  const isCompatible = useIsSourceCompatibleWithAgent(source);

  return (
    <HStack
      paddingX="small"
      borderBottom
      paddingY="xsmall"
      justify="spaceBetween"
      align="center"
      fullWidth
    >
      <HStack gap align="center">
        <DatabaseIcon size="xsmall" />
        <VStack gap={false}>
          <Typography variant="body2">{source.name}</Typography>
          {source.embedding_config.handle && (
            <Typography variant="body4">
              {source.embedding_config.handle}
            </Typography>
          )}
        </VStack>
      </HStack>

      {!isCompatible ? (
        <Tooltip
          asChild
          content={t.rich('notCompatible.tooltip', {
            folder: () => source.embedding_config?.embedding_model || '',
          })}
        >
          <Button
            color="primary"
            size="xsmall"
            disabled
            preIcon={<WarningIcon />}
            label={t('notCompatible.title')}
          />
        </Tooltip>
      ) : (
        <Button
          color="secondary"
          type="button"
          disabled={isAttached}
          data-testid="attach-data-source-button"
          size="xsmall"
          busy={isPending}
          onClick={handleAttachSource}
          label={isAttached ? t('attached') : t('attach')}
        />
      )}
    </HStack>
  );
}

interface AttachDataSourceModalProps {
  trigger: React.ReactNode;
  onClose?: () => void;
}

export function AttachDataSourceModal(props: AttachDataSourceModalProps) {
  const { trigger, onClose } = props;
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const t = useTranslations('ADE/EditDataSourcesPanel.AttachDataSourceModal');

  const { sources: existingSources } = useCurrentAgent();
  const {
    data: allSources,
    isLoading,
    isError,
  } = useSourcesServiceListSources();

  const existingSourcesIdSet = useMemo(() => {
    if (!existingSources) {
      return new Set<string>();
    }

    return new Set(existingSources.map((source) => source.id));
  }, [existingSources]);

  const handleOpenChange = useCallback(
    (nextState: boolean) => {
      setOpen(nextState);
      if (!nextState) {
        setSearch('');
        onClose?.();
      }
    },
    [onClose],
  );

  const handleAttachComplete = useCallback(() => {
    handleOpenChange(false);
  }, [handleOpenChange]);

  const filteredSources = useMemo(() => {
    if (!allSources) {
      return [];
    }

    return allSources.filter((source) =>
      source.name.toLowerCase().includes(search.toLowerCase()),
    );
  }, [allSources, search]);

  const isEmpty = filteredSources.length === 0 && !isLoading && !isError;

  return (
    <Dialog
      onOpenChange={handleOpenChange}
      title={t('title')}
      isOpen={open}
      trigger={trigger}
      headerVariant="emphasis"
      testId="attach-data-source-modal"
      size="medium"
      hideFooter
      disableForm
    >
      <VStack gap="small">
        <Typography variant="body2">{t('support')}</Typography>
        <RawInput
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
          }}
          postIcon={<SearchIcon />}
          fullWidth
          hideLabel
          label={t('searchInput.label')}
          placeholder={t('searchInput.placeholder')}
        />

        <Frame
          paddingBottom
          fullWidth
          fullHeight
          overflowY="auto"
          className="min-h-[400px]"
        >
          {isLoading || isError || isEmpty ? (
            <VStack fullWidth fullHeight align="center" justify="center">
              <LoadingEmptyStatusComponent
                isLoading={isLoading}
                isError={isError}
                loadingMessage={t('loading')}
                errorMessage={t('error')}
                emptyMessage={
                  search ? t('emptySearchMessage') : t('emptyMessage')
                }
              />
            </VStack>
          ) : (
            <VStack gap={false} fullWidth>
              {filteredSources.map((source) => (
                <DataSourceItem
                  key={source.id}
                  source={source}
                  isAttached={existingSourcesIdSet.has(source.id || '')}
                  onAttachComplete={handleAttachComplete}
                />
              ))}
            </VStack>
          )}
        </Frame>
      </VStack>
    </Dialog>
  );
}
