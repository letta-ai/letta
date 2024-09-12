'use client';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import type { OptionType } from '@letta-web/component-library';
import {
  ActionCard,
  Button,
  Cross2Icon,
  LettaLoader,
  Typography,
  VStack,
} from '@letta-web/component-library';
import {
  DashboardPageLayout,
  DashboardPageSection,
  DataTable,
  HStack,
  RawAsyncSelect,
  RawInput,
  Skeleton,
} from '@letta-web/component-library';
import { SearchIcon } from 'lucide-react';
import { webApi, webApiQueryKeys } from '$letta/client';
import { useCurrentProjectId } from '../hooks';
import { useSearchParams } from 'next/navigation';
import type { ColumnDef } from '@tanstack/react-table';
import type { DeployedAgentType } from '$letta/web-api/contracts/projects';
import { useDebouncedValue } from '@mantine/hooks';
import { useAgentsServiceGetAgent } from '@letta-web/letta-agents-api';

interface DeployedAgentViewProps {
  agent: DeployedAgentType;
  onClose: () => void;
}

function DeployedAgentView(props: DeployedAgentViewProps) {
  const { agent, onClose } = props;
  const { name } = agent;

  const { data } = useAgentsServiceGetAgent({
    agentId: agent.agentId,
  });

  return (
    <VStack
      className="absolute animate-in slide-in-from-left-0 w-[90%] right-0"
      color="background"
      rounded
      border
      fullHeight
      fullWidth
    >
      <HStack
        padding
        paddingY="small"
        borderBottom
        align="center"
        fullWidth
        justify="spaceBetween"
      >
        <Typography bold variant="heading2">
          {name}
        </Typography>
        <HStack>
          <Button color="tertiary" label="Open in ADE" />
          <Button
            onClick={onClose}
            color="tertiary-transparent"
            label="Close"
            hideLabel
            preIcon={<Cross2Icon />}
          />
        </HStack>
      </HStack>
      <VStack padding paddingY="small" overflowY="auto" collapseHeight>
        {!data ? (
          <VStack align="center" justify="center" fullHeight fullWidth>
            <LettaLoader size="large" />
          </VStack>
        ) : (
          <VStack gap>
            <ActionCard title="View Variables" />
            <ActionCard title="View Memories" />
            <ActionCard title="Explore Messages" />
          </VStack>
        )}
      </VStack>
    </VStack>
  );
}

interface DeployedAgentListProps {
  search: string;
  filterBy?: OptionType;
}

const AGENT_LIMIT = 20;

function DeployedAgentList(props: DeployedAgentListProps) {
  const currentProjectId = useCurrentProjectId();

  const [selectedAgent, setSelectedAgent] = useState<DeployedAgentType>();
  const { search, filterBy } = props;
  const [offset, setOffset] = useState(0);
  const { data } = webApi.projects.getDeployedAgents.useQuery({
    queryKey: webApiQueryKeys.projects.getDeployedAgentsWithSearch(
      currentProjectId,
      {
        search: search,
        sourceAgentId: filterBy?.value,
      }
    ),
    queryData: {
      query: {
        search,
        sourceAgentId: filterBy?.value,
        offset,
        limit: AGENT_LIMIT,
      },
      params: { projectId: currentProjectId },
    },
  });

  const DeployedAgentColumns: Array<ColumnDef<DeployedAgentType>> = useMemo(
    () => [
      {
        header: 'Name',
        accessorKey: 'name',
      },
      {
        header: '',
        accessorKey: 'id',
        meta: {
          style: {
            columnAlign: 'right',
          },
        },
        cell: ({ cell }) => (
          <Button
            onClick={() => {
              setSelectedAgent(cell.row.original);
            }}
            color="tertiary"
            active={selectedAgent?.id === cell.row.original.id}
            label="Details"
          />
        ),
      },
    ],
    [selectedAgent]
  );

  const deployedAgents = useMemo(() => {
    return data?.body || [];
  }, [data]);

  return (
    <HStack className="relative" fullHeight fullWidth>
      <DataTable
        fullHeight
        className="min-h-[400px]"
        limit={AGENT_LIMIT}
        offset={offset}
        onSetOffset={setOffset}
        loadingText={
          search || filterBy ? 'Searching...' : 'Loading deployed agents...'
        }
        noResultsText={
          search || filterBy ? 'No results found' : 'No agents deployed'
        }
        noResultsAction={
          search || filterBy ? undefined : (
            <Button
              href={`/projects/${currentProjectId}/staging`}
              label="Deploy an agent"
            />
          )
        }
        columns={DeployedAgentColumns}
        data={deployedAgents}
        isLoading={!data}
      />
      {selectedAgent && (
        <DeployedAgentView
          onClose={() => {
            setSelectedAgent(undefined);
          }}
          agent={selectedAgent}
        />
      )}
    </HStack>
  );
}

interface FilterBySourceAgentComponentProps {
  filterBy?: OptionType;
  onFilterChange: (filter: OptionType) => void;
}

function FilterBySourceAgentComponent(
  props: FilterBySourceAgentComponentProps
) {
  const currentProjectId = useCurrentProjectId();
  const { filterBy, onFilterChange } = props;

  const params = useSearchParams();

  const initialFilter = useMemo(() => {
    const value = params.get('stagingAgentId');
    const label = params.get('stagingAgentName');

    if (value && label) {
      return { value, label };
    }
  }, [params]);

  useEffect(() => {
    if (initialFilter) {
      onFilterChange(initialFilter);
    }
  }, [initialFilter, onFilterChange]);

  const { data } = webApi.projects.getProjectSourceAgents.useQuery({
    queryKey: webApiQueryKeys.projects.getProjectSourceAgents(currentProjectId),
    queryData: { params: { projectId: currentProjectId } },
  });

  const handleLoadOptions = useCallback(
    async (query: string) => {
      const response = await webApi.projects.getProjectSourceAgents.query({
        query: { search: query },
        params: { projectId: currentProjectId },
      });

      if (response.status !== 200) {
        return [];
      }

      return response.body.map((agent) => ({
        label: agent.name,
        value: agent.id,
      }));
    },
    [currentProjectId]
  );

  const defaultOptions = useMemo(() => {
    if (!data?.body) {
      return null;
    }

    let hasInitialFilter = false;

    const arr = data.body.map((agent) => {
      if (initialFilter && agent.id === initialFilter.value) {
        hasInitialFilter = true;
      }

      return { label: agent.name, value: agent.id };
    });

    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    if (initialFilter && !hasInitialFilter) {
      arr.unshift(initialFilter);
    }

    return arr;
  }, [data?.body, initialFilter]);

  if (!defaultOptions) {
    return <Skeleton className="h-biHeight w-[150px]" />;
  }

  return (
    <RawAsyncSelect
      value={filterBy}
      cacheOptions
      isSearchable
      loadOptions={handleLoadOptions}
      label="Filter by Source Agent"
      placeholder="Filter"
      defaultOptions={defaultOptions}
    />
  );
}

function DeployedAgentsPage() {
  const [filterBy, setFilterBy] = useState<OptionType>();
  const [search, setSearch] = useState('');

  const [debouncedSearch] = useDebouncedValue(search, 500);

  return (
    <DashboardPageLayout title="Deployed Agents">
      <DashboardPageSection fullHeight>
        <VStack fullHeight fullWidth>
          <HStack fullWidth>
            <RawInput
              onChange={(e) => {
                setSearch(e.target.value);
              }}
              value={search}
              preIcon={<SearchIcon />}
              label="Search deployed agents by name"
              placeholder="Agent name"
              fullWidth
            />
            <FilterBySourceAgentComponent
              filterBy={filterBy}
              onFilterChange={setFilterBy}
            />
          </HStack>
          <DeployedAgentList search={debouncedSearch} filterBy={filterBy} />
        </VStack>
      </DashboardPageSection>
    </DashboardPageLayout>
  );
}

export default DeployedAgentsPage;
