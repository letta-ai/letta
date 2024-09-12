'use client';
import React, { useMemo, useState } from 'react';
import {
  Button,
  DashboardPageLayout,
  DashboardPageSection,
  DashboardSearchBar,
  DashboardStatusComponent,
} from '@letta-web/component-library';
import { webApi, webApiQueryKeys } from '$letta/client';
import { useCurrentProjectId } from '../hooks';
import { useDebouncedValue } from '@mantine/hooks';
import { SourceAgentCard } from '../_shared/SourceAgentCard';

const PAGE_SIZE = 20;

interface ProjectStagingListProps {
  search: string;
}

function ProjectStagingList(props: ProjectStagingListProps) {
  const currentProjectId = useCurrentProjectId();

  const { search } = props;

  const { data, isLoading, fetchNextPage, hasNextPage } =
    webApi.projects.getProjectSourceAgents.useInfiniteQuery({
      queryKey: webApiQueryKeys.projects.getProjectSourceAgentsWithSearch(
        currentProjectId,
        { search }
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
        emptyAction={
          <Button
            href={`/projects/${currentProjectId}`}
            label="Return to project home"
          />
        }
        isLoading={isLoading}
      />
    );
  }

  return (
    <>
      {sourceAgents.map((agent) => (
        <SourceAgentCard key={agent.id} agent={agent} />
      ))}
      {hasNextPage && (
        <Button
          label="Load more agents"
          onClick={() => {
            void fetchNextPage();
          }}
        />
      )}
    </>
  );
}

function ProjectStagingPage() {
  const [search, setSearch] = useState<string>('');

  const [debouncedSearch] = useDebouncedValue(search, 500);

  return (
    <DashboardPageLayout
      title="Staged Agents"
      actions={
        <DashboardSearchBar
          onSearch={setSearch}
          searchValue={search}
          searchPlaceholder="Search staged agents"
        />
      }
    >
      <DashboardPageSection>
        <ProjectStagingList search={debouncedSearch} />
      </DashboardPageSection>
    </DashboardPageLayout>
  );
}

export default ProjectStagingPage;
