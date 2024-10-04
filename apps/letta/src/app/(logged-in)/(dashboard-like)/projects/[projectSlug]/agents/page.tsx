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
import { SearchIcon } from 'lucide-react';
import { webApi, webApiQueryKeys } from '$letta/client';
import { useCurrentProject } from '../hooks';
import { usePathname, useSearchParams } from 'next/navigation';
import type { ColumnDef } from '@tanstack/react-table';
import type { AgentType } from '$letta/web-api/contracts';
import { useDebouncedValue } from '@mantine/hooks';
import { useAgentsServiceGetAgent } from '@letta-web/letta-agents-api';
import { useRouter } from 'next/navigation';
import { Messages } from '$letta/client/components';
import { useTranslations } from 'next-intl';

interface AgentMessagesListProps {
  agentId: string;
}

function AgentMessagesList(props: AgentMessagesListProps) {
  const { agentId } = props;
  const t = useTranslations('projects/(projectSlug)/agents/page');

  return (
    <VStack rounded border collapseHeight>
      <HStack borderBottom paddingX="small" paddingY="small">
        <Typography>{t('latestMessages')}</Typography>
      </HStack>
      <VStack fullHeight overflow="hidden">
        <Messages mode="simple" isSendingMessage={false} agentId={agentId} />
      </VStack>
    </VStack>
  );
}

interface DeployedAgentViewProps {
  agent: AgentType;
  onClose: () => void;
}

function DeployedAgentView(props: DeployedAgentViewProps) {
  const { agent, onClose } = props;
  const { key } = agent;
  const { slug: currentProjectSlug } = useCurrentProject();
  const t = useTranslations('projects/(projectSlug)/agents/page');

  const { data } = useAgentsServiceGetAgent({
    agentId: agent.id,
  });

  return (
    <div className="contents">
      <Frame
        onClick={onClose}
        color="background-black"
        fullHeight
        fullWidth
        /* eslint-disable-next-line react/forbid-component-props */
        className="absolute z-[1] fade-in-5 opacity-10"
        rounded
      />
      <VStack
        /* eslint-disable-next-line react/forbid-component-props */
        className="absolute z-10 sm:animate-in slide-in-from-right-10 sm:w-[70%] right-0"
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
          <Typography align="left" bold variant="heading4">
            {key}
          </Typography>
          <HStack>
            <Button
              href={`/projects/${currentProjectSlug}/agents/${agent.id}`}
              label={t('openInADE')}
              color="tertiary"
            />
            <Button
              onClick={onClose}
              color="tertiary-transparent"
              label={t('close')}
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
                    label={t('agentId')}
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
              <AgentMessagesList agentId={agent.id} />
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
  const { id: currentProjectId, slug: projectSlug } = useCurrentProject();
  const [limit, setLimit] = useState(20);

  const [selectedAgent, setSelectedAgent] = useState<AgentType>();
  const { search, filterBy } = props;
  const [offset, setOffset] = useState(0);
  const t = useTranslations('projects/(projectSlug)/agents/page');

  useEffect(() => {
    setOffset(0);
  }, [search]);

  const { data } = webApi.projects.getDeployedAgents.useQuery({
    queryKey: webApiQueryKeys.projects.getDeployedAgentsWithSearch(
      currentProjectId,
      {
        search: search,
        deployedAgentTemplateVersion: filterBy?.value,
        limit,
        offset,
      }
    ),
    queryData: {
      query: {
        search: search,
        deployedAgentTemplateVersion: filterBy?.value,
        offset,
        limit,
      },
      params: { projectId: currentProjectId },
    },
  });

  const DeployedAgentColumns: Array<ColumnDef<AgentType>> = useMemo(
    () => [
      {
        header: t('table.columns.id'),
        accessorKey: 'id',
      },
      {
        header: t('table.columns.name'),
        accessorKey: 'key',
      },
      {
        header: t('table.columns.lastActive'),
        accessorKey: 'lastActiveAt',
      },
    ],
    [t]
  );

  const agents = useMemo(() => {
    return data?.body?.agents || [];
  }, [data]);

  return (
    <HStack position="relative" fullWidth>
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
          search || filterBy ? t('table.searching') : t('table.loading')
        }
        noResultsText={
          search || filterBy ? t('table.noResults') : t('table.emptyMessage')
        }
        noResultsAction={
          search || filterBy ? undefined : (
            <Button
              href={`/projects/${projectSlug}/staging`}
              label={t('table.deployAction')}
            />
          )
        }
        columns={DeployedAgentColumns}
        data={agents}
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

interface FilterByDeployedAgentTemplateComponentProps {
  filterBy?: OptionType;
  onFilterChange: (filter: OptionType) => void;
}

function FilterByDeployedAgentTemplateComponent(
  props: FilterByDeployedAgentTemplateComponentProps
) {
  const t = useTranslations('projects/(projectSlug)/agents/page');

  const { id: currentProjectId } = useCurrentProject();
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

  const { data } = webApi.projects.getProjectDeployedAgentTemplates.useQuery({
    queryKey:
      webApiQueryKeys.projects.getProjectDeployedAgentTemplates(
        currentProjectId
      ),
    queryData: { params: { projectId: currentProjectId }, query: {} },
  });

  const handleLoadOptions = useCallback(
    async (query: string) => {
      const response =
        await webApi.projects.getProjectDeployedAgentTemplates.query({
          query: { search: query },
          params: { projectId: currentProjectId },
        });

      if (response.status !== 200) {
        return [];
      }

      return [
        ...response.body.deployedAgentTemplates.map((agent) => ({
          label: agent.id,
          value: agent.id,
        })),
        { label: t('anyAgent'), value: '' },
      ];
    },
    [currentProjectId, t]
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

    const arr = data.body.deployedAgentTemplates.map((agent) => {
      if (initialFilter && agent.id === initialFilter.value) {
        hasInitialFilter = true;
      }

      return { label: agent.id, value: agent.id };
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
        label={t('searchDropdown.label')}
        placeholder={t('searchDropdown.placeholder')}
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
      label={t('searchDropdown.label')}
      placeholder={t('searchDropdown.placeholder')}
      defaultOptions={defaultOptions}
    />
  );
}

function DeployedAgentsPage() {
  const [filterBy, setFilterBy] = useState<OptionType>();
  const [search, setSearch] = useState('');
  const t = useTranslations('projects/(projectSlug)/agents/page');

  const [debouncedSearch] = useDebouncedValue(search, 500);

  return (
    <DashboardPageLayout title="Agents">
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
              label={t('search.label')}
              placeholder={t('search.placeholder')}
              fullWidth
            />
            <InputFilter>
              <FilterByDeployedAgentTemplateComponent
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
