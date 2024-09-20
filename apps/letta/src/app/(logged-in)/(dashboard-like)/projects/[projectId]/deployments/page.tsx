'use client';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Card,
  InputFilter,
  isMultiValue,
  RawSelect,
} from '@letta-web/component-library';
import type { OptionType } from '@letta-web/component-library';
import { Frame } from '@letta-web/component-library';
import {
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
} from '@letta-web/component-library';
import { FilterIcon, SearchIcon } from 'lucide-react';
import { webApi, webApiQueryKeys } from '$letta/client';
import { useCurrentProjectId } from '../hooks';
import { usePathname, useSearchParams } from 'next/navigation';
import type { ColumnDef } from '@tanstack/react-table';
import type { DeployedAgentType } from '$letta/web-api/contracts/projects';
import { useDebouncedValue } from '@mantine/hooks';
import { useAgentsServiceGetAgent } from '@letta-web/letta-agents-api';
import { useRouter } from 'next/navigation';
import { Messages } from '$letta/client/components';

interface AgentMessagesListProps {
  agentId: string;
}

function AgentMessagesList(props: AgentMessagesListProps) {
  const { agentId } = props;

  return (
    <VStack rounded border collapseHeight>
      <HStack borderBottom paddingX="small" paddingY="small">
        <Typography>Latest messages</Typography>
      </HStack>
      <VStack fullHeight overflow="hidden">
        <Messages isSendingMessage={false} agentId={agentId} />
      </VStack>
    </VStack>
  );
}

interface DeployedAgentViewProps {
  agent: DeployedAgentType;
  onClose: () => void;
}

function DeployedAgentView(props: DeployedAgentViewProps) {
  const { agent, onClose } = props;
  const { key } = agent;

  const { data } = useAgentsServiceGetAgent({
    agentId: agent.agentId,
  });

  return (
    <div className="contents">
      <Frame
        onClick={onClose}
        color="background-black"
        fullHeight
        fullWidth
        className="absolute z-[1] fade-in-5 opacity-10"
        rounded
      />
      <VStack
        className="absolute z-10 animate-in slide-in-from-right-10 w-[50%] right-0"
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
            {key}
          </Typography>
          <HStack>
            <Button
              onClick={onClose}
              color="tertiary-transparent"
              label="Close"
              hideLabel
              preIcon={<Cross2Icon />}
            />
          </HStack>
        </HStack>
        <VStack padding paddingY="small" overflowY="hidden" fullHeight>
          {!data ? (
            <VStack align="center" justify="center" fullHeight fullWidth>
              <LettaLoader size="large" />
            </VStack>
          ) : (
            <VStack fullHeight overflow="hidden" gap>
              <Card>
                <VStack>
                  <RawInput
                    inline
                    label="Agent ID"
                    defaultValue={agent.id}
                    readOnly
                    allowCopy
                    fullWidth
                  />
                  {/*<HStack fullWidth justify="end">*/}
                  {/*  <Button label="Connection instructions" preIcon={<BotIcon />} color="tertiary" />*/}
                  {/*</HStack>*/}
                </VStack>
              </Card>
              <AgentMessagesList agentId={agent.agentId} />
            </VStack>
          )}
        </VStack>
      </VStack>
    </div>
  );
}

interface DeployedAgentListProps {
  search: string;
  filterBy?: OptionType;
}

function DeployedAgentList(props: DeployedAgentListProps) {
  const currentProjectId = useCurrentProjectId();
  const [limit, setLimit] = useState(20);

  const [selectedAgent, setSelectedAgent] = useState<DeployedAgentType>();
  const { search, filterBy } = props;
  const [offset, setOffset] = useState(0);

  useEffect(() => {
    setOffset(0);
  }, [search]);

  const { data } = webApi.projects.getDeployedAgents.useQuery({
    queryKey: webApiQueryKeys.projects.getDeployedAgentsWithSearch(
      currentProjectId,
      {
        search: search,
        sourceAgentKey: filterBy?.value,
        limit,
        offset,
      }
    ),
    queryData: {
      query: {
        search: search,
        sourceAgentKey: filterBy?.value,
        offset,
        limit,
      },
      params: { projectId: currentProjectId },
    },
  });

  const DeployedAgentColumns: Array<ColumnDef<DeployedAgentType>> = useMemo(
    () => [
      {
        header: 'Id',
        accessorKey: 'id',
      },
      {
        header: 'External Identifier',
        accessorKey: 'key',
      },
      {
        header: 'Last Active',
        accessorKey: 'lastActiveAt',
      },
    ],
    []
  );

  const deployedAgents = useMemo(() => {
    return data?.body?.deployedAgents || [];
  }, [data]);

  return (
    <HStack className="relative" fullWidth>
      <DataTable
        onRowClick={(row) => {
          setSelectedAgent(row);
        }}
        fullHeight
        autofitHeight
        minHeight={400}
        limit={limit}
        onLimitChange={setLimit}
        hasNextPage={data?.body?.hasNextPage}
        showPagination
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

  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const initialFilter = useMemo(() => {
    const value = params.get('stagingAgentKey');
    const label = params.get('stagingAgentKey');

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
    queryData: { params: { projectId: currentProjectId }, query: {} },
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

      return [
        ...response.body.sourceAgents.map((agent) => ({
          label: agent.key,
          value: agent.key,
        })),
        { label: '(Any Agent)', value: '' },
      ];
    },
    [currentProjectId]
  );

  useEffect(() => {
    const nextURLSearchParams = new URLSearchParams();

    if (filterBy) {
      nextURLSearchParams.set('stagingAgentKey', filterBy.value);
    }

    router.replace(`${pathname}?${nextURLSearchParams.toString()}`);
  }, [filterBy, router, pathname]);

  const defaultOptions = useMemo(() => {
    if (!data?.body) {
      return null;
    }

    let hasInitialFilter = false;

    const arr = data.body.sourceAgents.map((agent) => {
      if (initialFilter && agent.key === initialFilter.value) {
        hasInitialFilter = true;
      }

      return { label: agent.key, value: agent.key };
    });

    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    if (initialFilter && !hasInitialFilter) {
      arr.unshift(initialFilter);
    }

    arr.unshift({ label: '(Any Agent)', value: '' });

    return arr;
  }, [data?.body, initialFilter]);

  if (!defaultOptions) {
    return (
      <RawSelect
        options={[]}
        isLoading
        inline
        fullWidth
        preLabelIcon={<FilterIcon className="w-4" />}
        label="from the staged agent:"
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
      label="from the staged agent:"
      placeholder="Staged Agent Name"
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
              label="Search deployed agents by name"
              placeholder="Search by name"
              fullWidth
            />
            <InputFilter>
              <FilterBySourceAgentComponent
                filterBy={filterBy}
                onFilterChange={setFilterBy}
              />
            </InputFilter>
          </VStack>
          <DeployedAgentList search={debouncedSearch} filterBy={filterBy} />
        </VStack>
      </DashboardPageSection>
    </DashboardPageLayout>
  );
}

export default DeployedAgentsPage;
