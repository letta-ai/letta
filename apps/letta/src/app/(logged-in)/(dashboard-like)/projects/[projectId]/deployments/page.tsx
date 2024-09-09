'use client';
import React, { useMemo, useState } from 'react';
import {
  Button,
  DashboardPageSection,
  DashboardSearchBar,
  DashboardStatusComponent,
} from '@letta-web/component-library';
import { webApi, webApiQueryKeys } from '$letta/client';
import { useCurrentProjectId } from '../hooks';
import { useDebouncedValue } from '@mantine/hooks';
import { SourceAgentCard } from '../shared/SourceAgentCard';

const PAGE_SIZE = 20;

function ProjectStagingPage() {
  const currentProjectId = useCurrentProjectId();
  const [search, setSearch] = useState<string>('');

  const [debouncedSearch] = useDebouncedValue(search, 500);

  const { data, isLoading, fetchNextPage, hasNextPage } =
    webApi.projects.getProjectSourceAgents.useInfiniteQuery({
      queryKey: webApiQueryKeys.projects.getProjectSourceAgentsWithSearch(
        currentProjectId,
        { search: debouncedSearch }
      ),
      queryData: ({ pageParam }) => ({
        params: { projectId: currentProjectId },
        query: {
          offset: pageParam.offset,
          limit: pageParam.limit,
        },
      }),
      initialPageParam: { offset: 0, limit: PAGE_SIZE },
      getNextPageParam: (lastPage, allPages) => {
        return lastPage.body.length >= PAGE_SIZE
          ? { limit: PAGE_SIZE, offset: allPages.length * PAGE_SIZE }
          : undefined;
      },
    });

  const sourceAgents = useMemo(() => {
    return (data?.pages || []).flatMap((v) => v.body);
  }, [data]);

  if (sourceAgents.length === 0) {
    return (
      <DashboardStatusComponent
        emptyMessage="There are no agents to stage. Return to the project home and stage a Agent"
        emptyAction={<Button href="/" label="Return to project home" />}
        isLoading={isLoading}
      />
    );
  }

  return (
    <DashboardPageSection
      title="Staged Agents"
      actions={
        <DashboardSearchBar
          onSearch={setSearch}
          searchValue={search}
          searchPlaceholder="Search staged agents"
        />
      }
    >
      {sourceAgents.map((agent) => (
        <SourceAgentCard
          key={agent.id}
          name={agent.name}
          status={agent.status}
          id={agent.id}
          deployedAt={agent.createdAt}
        />
      ))}
      {hasNextPage && (
        <Button
          label="Load more agents"
          onClick={() => {
            void fetchNextPage();
          }}
        />
      )}
    </DashboardPageSection>
  );
}

export default ProjectStagingPage;
