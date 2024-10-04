'use client';
import React, { useCallback, useMemo, useState } from 'react';
import type { PanelTemplate } from '@letta-web/component-library';
import {
  ActionCard,
  Button,
  CheckIcon,
  createPageRouter,
  HStack,
  LoadingEmptyStatusComponent,
  PanelBar,
  PanelMainContent,
  VStack,
} from '@letta-web/component-library';
import {
  useAgentsServiceGetAgentSources,
  UseAgentsServiceGetAgentSourcesKeyFn,
  useSourcesServiceAttachAgentToSource,
  useSourcesServiceListSources,
} from '@letta-web/letta-agents-api';
import { useCurrentAgent } from '../hooks';
import { z } from 'zod';
import { useQueryClient } from '@tanstack/react-query';

const { PanelRouter, usePanelPageContext } = createPageRouter(
  {
    attachDataSourcePage: {
      title: 'Attach Data Source',
      state: z.undefined(),
    },
    viewAttachedDataSourcePage: {
      title: 'Data Sources',
      state: z.undefined(),
    },
  },
  {
    initialPage: 'viewAttachedDataSourcePage',
  }
);

function ViewAttachedDataSourcePage() {
  const { id } = useCurrentAgent();
  const [search, setSearch] = useState('');
  const { data: agentSources, isError } = useAgentsServiceGetAgentSources({
    agentId: id,
  });

  const filteredAgentSources = useMemo(() => {
    return agentSources?.filter((source) =>
      source.name.toLowerCase().includes(search.toLowerCase())
    );
  }, [agentSources, search]);

  const { setCurrentPage } = usePanelPageContext();

  return (
    <>
      <PanelBar
        onSearch={(value) => {
          setSearch(value);
        }}
        searchValue={search}
        actions={
          <>
            <Button
              target="_blank"
              href="/data-sources"
              size="small"
              color="tertiary"
              label="Manage"
            />
            <Button
              onClick={() => {
                setCurrentPage('attachDataSourcePage');
              }}
              size="small"
              color="secondary"
              label="Attach Data Sources"
            />
          </>
        }
      />
      <PanelMainContent>
        <VStack fullWidth gap="small">
          {!filteredAgentSources ||
            (filteredAgentSources.length === 0 && (
              <LoadingEmptyStatusComponent
                isLoading={!agentSources}
                isError={isError}
                errorMessage="An error occurred, please contact support."
                emptyMessage="No data sources attached"
                emptyAction={
                  <Button
                    onClick={() => {
                      setCurrentPage('attachDataSourcePage');
                    }}
                    label="Attach Data Sources"
                    color="tertiary"
                  />
                }
                loadingMessage="Loading data sources..."
              />
            ))}
          {filteredAgentSources?.map((source) => (
            <ActionCard
              title={source.name}
              key={source.id}
              mainAction={
                <Button
                  label="View"
                  target="_blank"
                  href={`/data-sources/${source.id}`}
                  color="tertiary"
                />
              }
            />
          ))}
        </VStack>
      </PanelMainContent>
    </>
  );
}

interface DataSourceToAttachCardProps {
  sourceId: string;
  sourceName: string;
  isAttached: boolean;
}

function DataSourceToAttachCard(props: DataSourceToAttachCardProps) {
  const { isAttached, sourceId, sourceName } = props;
  const { id } = useCurrentAgent();
  const { mutate, isPending } = useSourcesServiceAttachAgentToSource({
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: UseAgentsServiceGetAgentSourcesKeyFn({
          agentId: id,
        }),
      });
    },
  });
  const queryClient = useQueryClient();

  const attachDataSource = useCallback(() => {
    if (isAttached) {
      return;
    }

    mutate({
      sourceId,
      agentId: id,
    });
  }, [isAttached, mutate, id, sourceId]);

  return (
    <ActionCard
      title={sourceName}
      mainAction={
        <HStack>
          <Button
            label="View"
            target="_blank"
            href={`/data-sources/${sourceId}`}
            color="tertiary"
          />
          <Button
            active={isAttached}
            busy={isPending}
            onClick={attachDataSource}
            color="tertiary"
            preIcon={isAttached && <CheckIcon />}
            label={isAttached ? 'Attached' : 'Attach'}
          />
        </HStack>
      }
    />
  );
}

function AttachDataSourcePage() {
  const [search, setSearch] = useState('');
  const { data: allSources, isError } = useSourcesServiceListSources();
  const { id } = useCurrentAgent();

  const { data: agentSources, isError: isAgentsServiceError } =
    useAgentsServiceGetAgentSources({
      agentId: id,
    });

  const agentSourcesIdsSet = useMemo(() => {
    return new Set(agentSources?.map((source) => source.id));
  }, [agentSources]);

  const filteredSources = useMemo(() => {
    return allSources
      ?.filter((source) =>
        source.name.toLowerCase().includes(search.toLowerCase())
      )
      .map((source) => ({
        ...source,
        isAttached: agentSourcesIdsSet.has(source.id),
      }));
  }, [agentSourcesIdsSet, allSources, search]);

  const { setCurrentPage } = usePanelPageContext();

  return (
    <>
      <PanelBar
        onReturn={() => {
          setCurrentPage('viewAttachedDataSourcePage');
        }}
        searchValue={search}
        onSearch={(value) => {
          setSearch(value);
        }}
      />
      <PanelMainContent>
        <VStack fullWidth gap="small">
          {!filteredSources ||
            (filteredSources.length === 0 && (
              <LoadingEmptyStatusComponent
                isLoading={!filteredSources}
                isError={isError || isAgentsServiceError}
                errorMessage="An error occurred, please contact support."
                emptyMessage={
                  search ? 'No data sources found' : 'No data sources available'
                }
                emptyAction={
                  !search && (
                    <Button
                      target="_blank"
                      href="/data-sources"
                      label="Manage Data Sources"
                      color="tertiary"
                    />
                  )
                }
                loadingMessage="Loading data sources..."
              />
            ))}
          {filteredSources?.map((source) => (
            <DataSourceToAttachCard
              isAttached={source.isAttached}
              key={source.id}
              sourceId={source.id || ''}
              sourceName={source.name}
            />
          ))}
        </VStack>
      </PanelMainContent>
    </>
  );
}

export function DataSourcesPanel() {
  return (
    <PanelRouter
      rootPageKey="viewAttachedDataSourcePage"
      pages={{
        attachDataSourcePage: <AttachDataSourcePage />,
        viewAttachedDataSourcePage: <ViewAttachedDataSourcePage />,
      }}
    />
  );
}

export const dataSourcesPanelTemplate = {
  templateId: 'data-sources',
  content: DataSourcesPanel,
  title: 'Data Sources',
  data: z.undefined(),
} satisfies PanelTemplate<'data-sources'>;
