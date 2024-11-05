import { useTranslations } from 'next-intl';
import { z } from 'zod';
import type { PanelTemplate } from '@letta-web/component-library';
import { Dialog } from '@letta-web/component-library';
import { Button } from '@letta-web/component-library';
import { DataTable } from '@letta-web/component-library';
import {
  PanelBar,
  PanelMainContent,
  VStack,
} from '@letta-web/component-library';
import { useEffect, useMemo, useState } from 'react';
import type { AgentState } from '@letta-web/letta-agents-api';
import { webOriginSDKApi, webOriginSDKQueryKeys } from '$letta/client';
import type { ColumnDef } from '@tanstack/react-table';
import { useCurrentAgentMetaData } from '../hooks/useCurrentAgentMetaData/useCurrentAgentMetaData';
import { useCurrentProject } from '../../../../../../(dashboard-like)/projects/[projectSlug]/hooks';
import { DeployAgentUsageInstructions } from '$letta/client/code-reference/DeployAgentUsageInstructions';

function DeployAgentDialog() {
  const { id: projectId } = useCurrentProject();
  const t = useTranslations('ADE/DeployedAgentsPanel');

  return (
    <Dialog
      title={t('deployAgent.title')}
      size="xlarge"
      trigger={
        <Button
          color="tertiary"
          size="small"
          label={t('deployAgent.trigger')}
          target="_blank"
        />
      }
      hideConfirm
    >
      <DeployAgentUsageInstructions versionKey="latest" projectId={projectId} />
    </Dialog>
  );
}

function DeployedAgentsPanel() {
  const t = useTranslations('ADE/DeployedAgentsPanel');
  const { agentName } = useCurrentAgentMetaData();
  const [search, setSearch] = useState('');

  const { id: projectId } = useCurrentProject();
  const [limit, setLimit] = useState(20);

  const [offset, setOffset] = useState(0);

  useEffect(() => {
    setOffset(0);
  }, [search]);

  const { data } = webOriginSDKApi.agents.listAgents.useQuery({
    queryKey: webOriginSDKQueryKeys.agents.listAgentsWithSearch({
      name: search,
      limit,
      by_version: agentName,
      include_version: true,
      offset,
    }),
    queryData: {
      query: {
        search: search,
        offset,
        by_version: agentName,
        limit,
        include_version: true,
      },
    },
    refetchInterval: 1000 * 3,
  });

  const DeployedAgentColumns: Array<ColumnDef<AgentState>> = useMemo(
    () => [
      {
        header: t('table.columns.name'),
        accessorKey: 'name',
      },
      {
        header: t('table.columns.version'),
        accessorKey: 'version',
      },
      {
        accessorKey: 'id',
        header: '',
        cell: (row) => {
          return (
            <Button
              color="tertiary"
              size="small"
              label={t('table.openInAde')}
              href={`/projects/${projectId}/agents/${row.cell.id}`}
              target="_blank"
            />
          );
        },
      },
    ],
    [projectId, t]
  );

  const agents = useMemo(() => {
    return data?.body || [];
  }, [data]);

  return (
    <VStack fullHeight>
      <PanelBar
        searchValue={search}
        onSearch={setSearch}
        actions={<DeployAgentDialog />}
      ></PanelBar>
      <PanelMainContent>
        <DataTable
          fullHeight
          autofitHeight
          limit={limit}
          onLimitChange={setLimit}
          hasNextPage={data?.body.length === limit}
          showPagination
          offset={offset}
          onSetOffset={setOffset}
          loadingText={search ? t('table.searching') : t('table.loading')}
          noResultsText={
            search ? t('table.noResults') : t('table.emptyMessage')
          }
          columns={DeployedAgentColumns}
          data={agents}
          isLoading={!data}
        />
      </PanelMainContent>
    </VStack>
  );
}

export const deployedAgentsPanel = {
  useGetTitle: () => {
    const t = useTranslations('ADE/DeployedAgentsPanel');

    return t('title');
  },
  data: z.undefined(),
  content: DeployedAgentsPanel,
  templateId: 'deployed-agents',
} satisfies PanelTemplate<'deployed-agents'>;
