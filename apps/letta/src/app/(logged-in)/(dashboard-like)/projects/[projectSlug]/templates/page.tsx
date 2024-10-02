'use client';
import React, { useMemo, useState } from 'react';
import type { OptionType } from '@letta-web/component-library';
import {
  Button,
  DashboardPageLayout,
  DashboardPageSection,
  LoadingEmptyStatusComponent,
  VStack,
  RawInput,
} from '@letta-web/component-library';
import { webApi, webApiQueryKeys } from '$letta/client';
import { useCurrentProject } from '../hooks';
import { useDebouncedValue } from '@mantine/hooks';
import { SearchIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { AgentTemplateCard } from '$letta/client/components';

const PAGE_SIZE = 20;

interface ProjectStagingListProps {
  search: string;
  filterBy?: OptionType;
}

function AgentTemplateList(props: ProjectStagingListProps) {
  const { id: currentProjectId, slug: projectSlug } = useCurrentProject();

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
        emptyMessage="There are no agents to stage. Return to the project home and stage a Agent"
        emptyAction={
          <Button
            href={`/projects/${projectSlug}`}
            label="Return to project home"
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
          color="tertiary"
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
    <DashboardPageLayout title={t('title')}>
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
