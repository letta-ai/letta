'use client';
import React, { useCallback, useMemo, useState } from 'react';
import type { OptionType } from '@letta-web/component-library';
import {
  Badge,
  Button,
  DashboardPageLayout,
  DashboardPageSection,
  Dialog,
  HStack,
  LoadingEmptyStatusComponent,
  LoadedTypography,
  Typography,
  VStack,
  RawInput,
  InputFilter,
  RawSelect,
  RawAsyncSelect,
  isMultiValue,
} from '@letta-web/component-library';
import { webApi, webApiQueryKeys } from '$letta/client';
import { useCurrentProjectId } from '../hooks';
import { useDebouncedValue } from '@mantine/hooks';
import type { SourceAgentType } from '$letta/web-api/contracts/projects';
import { DeployAgentUsageInstructions } from '$letta/client/code-reference/DeployAgentUsageInstructions';
import { FilterIcon, SearchIcon } from 'lucide-react';

const PAGE_SIZE = 20;

interface StagedAgentCardProps {
  agent: SourceAgentType;
}

function StagedAgentCard(props: StagedAgentCardProps) {
  const { agent } = props;
  const currentProjectId = useCurrentProjectId();
  const { data } = webApi.projects.getDeployedAgentsCountBySourceAgent.useQuery(
    {
      queryKey: webApiQueryKeys.projects.getDeployedAgentsCountBySourceAgent(
        currentProjectId,
        agent.id
      ),
      queryData: {
        params: { projectId: currentProjectId },
        query: { sourceAgentId: agent.id },
      },
    }
  );

  return (
    <VStack rounded gap={false} border>
      <HStack borderBottom padding="small" align="center">
        <HStack justify="start" align="center">
          <HStack border color="background-greyer" rounded paddingX="xxsmall">
            <Typography align="left">
              {agent.testingAgentName || '<deleted-agent>'}
            </Typography>
          </HStack>
          /
          <Typography align="left" bold>
            {agent.key}
          </Typography>
          <Badge content={`v${agent.version}`} />
        </HStack>
      </HStack>
      <HStack
        wrap
        color="background-grey"
        justify="spaceBetween"
        align="center"
        padding="small"
      >
        <HStack gap="small">
          <LoadedTypography
            variant="body2"
            bold
            fillerText="100"
            isLoading={!data}
            text={data?.body.count.toString() || '0'}
          />
          <Typography noWrap variant="body2">
            deployed agent{data?.body && data.body.count === 1 ? '' : 's'}
          </Typography>
        </HStack>
        <HStack>
          <Dialog
            size="large"
            hideConfirm
            cancelText="Close"
            trigger={
              <Button
                color="tertiary"
                size="small"
                label="Deployment Instructions"
              />
            }
            title="Deploy Agent Instructions"
          >
            <DeployAgentUsageInstructions
              sourceAgentKey={agent.key}
              projectId={currentProjectId}
            />
          </Dialog>
          <Button
            color="tertiary"
            size="small"
            label="View Agents"
            href={`/projects/${currentProjectId}/agents?stagingAgentKey=${agent.key}`}
          />
        </HStack>
      </HStack>
    </VStack>
  );
}

interface ProjectStagingListProps {
  search: string;
  filterBy?: OptionType;
}

function ProjectStagingList(props: ProjectStagingListProps) {
  const currentProjectId = useCurrentProjectId();

  const { search, filterBy } = props;

  const { data, isLoading, fetchNextPage, hasNextPage } =
    webApi.projects.getProjectSourceAgents.useInfiniteQuery({
      queryKey: webApiQueryKeys.projects.getProjectSourceAgentsWithSearch(
        currentProjectId,
        {
          search,
          includeTestingAgentInfo: true,
          testingAgentId: filterBy?.value,
        }
      ),
      queryData: ({ pageParam }) => ({
        params: { projectId: currentProjectId },
        query: {
          testingAgentId: filterBy?.value,
          includeTestingAgentInfo: true,
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

  const sourceAgents = useMemo(() => {
    return (data?.pages || []).flatMap((v) => v.body.sourceAgents);
  }, [data]);

  if (sourceAgents.length === 0) {
    return (
      <LoadingEmptyStatusComponent
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
        <StagedAgentCard agent={agent} key={agent.key} />
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

interface FilterByTestingAgentComponentProps {
  filterBy?: OptionType;
  onFilterChange: (filter: OptionType) => void;
}

function FilterByTestingAgentComponent(
  props: FilterByTestingAgentComponentProps
) {
  const currentProjectId = useCurrentProjectId();
  const { filterBy, onFilterChange } = props;

  const { data } = webApi.projects.getProjectTestingAgents.useQuery({
    queryKey:
      webApiQueryKeys.projects.getProjectTestingAgents(currentProjectId),
    queryData: {
      params: { projectId: currentProjectId },
    },
  });

  const handleLoadOptions = useCallback(
    async (query: string) => {
      const response = await webApi.projects.getProjectTestingAgents.query({
        query: { search: query },
        params: { projectId: currentProjectId },
      });

      if (response.status !== 200) {
        return [];
      }

      return [
        ...response.body.map((agent) => ({
          label: agent.name,
          value: agent.id,
        })),
        { label: '(Any Agent)', value: '' },
      ];
    },
    [currentProjectId]
  );

  const defaultOptions = useMemo(() => {
    if (!data) {
      return [];
    }

    return [
      ...data.body.map((agent) => ({
        label: agent.name,
        value: agent.id,
      })),
      { label: '(Any Agent)', value: '' },
    ];
  }, [data]);

  if (!defaultOptions) {
    return (
      <RawSelect
        options={[]}
        isLoading
        inline
        fullWidth
        preLabelIcon={<FilterIcon className="w-4" />}
        label="from the agent template:"
        placeholder="Filter"
      />
    );
  }

  return (
    <RawAsyncSelect
      value={filterBy}
      cacheOptions
      isSearchable
      onSelect={(value) => {
        if (isMultiValue(value)) {
          onFilterChange(value[0]);
          return;
        } else {
          if (value) {
            onFilterChange(value);
          }
        }
      }}
      fullWidth
      inline
      loadOptions={handleLoadOptions}
      preLabelIcon={<FilterIcon className="w-4" />}
      label="from the agent template:"
      placeholder="Agent Template"
      defaultOptions={defaultOptions}
    />
  );
}

function ProjectStagingPage() {
  const [search, setSearch] = useState<string>('');
  const [filterBy, setFilterBy] = useState<OptionType>();

  const [debouncedSearch] = useDebouncedValue(search, 500);

  return (
    <DashboardPageLayout title="Deployed Agent Templates">
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
              label="Search agents by name"
              placeholder="Agent name"
              fullWidth
            />
            <InputFilter>
              <FilterByTestingAgentComponent
                filterBy={filterBy}
                onFilterChange={setFilterBy}
              />
            </InputFilter>
          </VStack>
          <ProjectStagingList filterBy={filterBy} search={debouncedSearch} />
        </VStack>
      </DashboardPageSection>
    </DashboardPageLayout>
  );
}

export default ProjectStagingPage;
