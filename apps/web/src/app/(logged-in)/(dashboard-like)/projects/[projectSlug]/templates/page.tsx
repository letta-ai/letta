'use client';
import React, { useMemo, useState } from 'react';
import type { OptionType } from '@letta-web/component-library';
import { PlusIcon } from '@letta-web/component-library';
import {
  Button,
  DashboardPageLayout,
  DashboardPageSection,
  LoadingEmptyStatusComponent,
  VStack,
  RawInput,
} from '@letta-web/component-library';
import { webApi, webApiQueryKeys } from '$web/client';
import { useCurrentProject } from '../hooks';
import { useDebouncedValue } from '@mantine/hooks';
import { SearchIcon } from '@letta-web/component-library';
import { useTranslations } from '@letta-cloud/translations';
import { AgentTemplateCard } from '$web/client/components';
import { CreateNewTemplateDialog } from '../_components/CreateNewTemplateDialog/CreateNewTemplateDialog';

const PAGE_SIZE = 20;

interface ProjectStagingListProps {
  search: string;
  filterBy?: OptionType;
}

function AgentTemplateList(props: ProjectStagingListProps) {
  const { id: currentProjectId } = useCurrentProject();
  const t = useTranslations('projects/(projectSlug)/templates/page');
  const { search } = props;

  const { data, isLoading, fetchNextPage, hasNextPage } =
    webApi.agentTemplates.listAgentTemplates.useInfiniteQuery({
      queryKey: webApiQueryKeys.agentTemplates.listAgentTemplatesWithSearch({
        search,
        projectId: currentProjectId,
      }),
      queryData: ({ pageParam }) => ({
        query: {
          search,
          projectId: currentProjectId,
          offset: pageParam.offset,
          limit: pageParam.limit,
        },
      }),
      initialPageParam: { offset: 0, limit: PAGE_SIZE },
      getNextPageParam: (lastPage, allPages) => {
        return lastPage.body.hasNextPage
          ? { limit: PAGE_SIZE, offset: allPages.length * PAGE_SIZE }
          : undefined;
      },
    });

  const deployedAgentTemplates = useMemo(() => {
    return (data?.pages || []).flatMap((v) => v.body.agentTemplates);
  }, [data]);

  if (deployedAgentTemplates.length === 0) {
    return (
      <LoadingEmptyStatusComponent
        emptyMessage={!search ? t('noTemplates') : t('noTemplatesFound')}
        emptyAction={
          <CreateNewTemplateDialog
            trigger={
              <Button preIcon={<PlusIcon />} label={t('createTemplate')} />
            }
          />
        }
        isLoading={isLoading}
      />
    );
  }

  return (
    <>
      {deployedAgentTemplates.map((agent) => (
        <AgentTemplateCard agent={agent} key={agent.id} />
      ))}
      {hasNextPage && (
        <Button
          fullWidth
          color="secondary"
          label="Load more agents"
          onClick={() => {
            void fetchNextPage();
          }}
        />
      )}
    </>
  );
}

function TemplatesPage() {
  const [search, setSearch] = useState<string>('');
  const t = useTranslations('projects/(projectSlug)/templates/page');

  const [debouncedSearch] = useDebouncedValue(search, 500);

  return (
    <DashboardPageLayout
      title={t('title')}
      actions={
        <CreateNewTemplateDialog
          trigger={
            <Button
              color="secondary"
              preIcon={<PlusIcon />}
              label={t('createTemplate')}
            />
          }
        />
      }
    >
      <DashboardPageSection>
        <VStack fullHeight fullWidth>
          <VStack gap={false} fullWidth>
            <RawInput
              onChange={(e) => {
                setSearch(e.target.value);
              }}
              value={search}
              preIcon={<SearchIcon />}
              hideLabel
              label={t('searchInput.label')}
              placeholder={t('searchInput.placeholder')}
              fullWidth
            />
          </VStack>
          <AgentTemplateList search={debouncedSearch} />
        </VStack>
      </DashboardPageSection>
    </DashboardPageLayout>
  );
}

export default TemplatesPage;
