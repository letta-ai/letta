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
import { isEqual } from 'lodash-es';

interface DataSourceItemProps {
  source: Source;
  isAttached: boolean;
  onAttachComplete: () => void;
}

function DataSourceItem(props: DataSourceItemProps) {
  const { source, isAttached, onAttachComplete } = props;
  const { id, embedding_config } = useCurrentAgent();
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
        (oldData) => {
          if (!oldData) {
            return oldData;
          }

          return {
            ...oldData,
            sources: [
              response,
              ...oldData.sources.filter(
                (currentSource) => currentSource.id !== response.id,
              ),
            ],
          };
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

  const isCompatible = isEqual(embedding_config, source.embedding_config);

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
        <Typography variant="body2">{source.name}</Typography>
      </HStack>

      {!isCompatible ? (
        <Tooltip asChild content={t('notCompatible.details')}>
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
          overflowY="auto"
          className="min-h-[400px]"
        >
          {isLoading || isError || isEmpty ? (
            <LoadingEmptyStatusComponent
              isLoading={isLoading}
              isError={isError}
              loadingMessage={t('loading')}
              errorMessage={t('error')}
              emptyMessage={
                search ? t('emptySearchMessage') : t('emptyMessage')
              }
              noMinHeight
            />
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
