'use client';
import { useTranslations } from '@letta-cloud/translations';
import {
  Button,
  CopyButton,
  DataTable,
  HStack,
  LettaInvaderIcon,
  MiddleTruncate,
} from '@letta-cloud/ui-component-library';
import type { GetToolErrorMessagesItemType } from '@letta-cloud/sdk-web';
import { webApi, webApiQueryKeys } from '@letta-cloud/sdk-web';
import { useMemo, useState } from 'react';
import { useObservabilityContext } from '../_components/hooks/useObservabilityContext/useObservabilityContext';
import { useCurrentProject } from '$web/client/hooks/useCurrentProject/useCurrentProject';
import type { ColumnDef } from '@tanstack/react-table';
import { useFormatters } from '@letta-cloud/utils-client';
import { ObservabilityExplorerPageWrapper } from '../_components/ObservabilityExplorerPageWrapper/ObservabilityExplorerPageWrapper';
import { ToolErrorsChart } from '../_components/charts/ToolErrorsChart/ToolErrorsChart';
import { ViewMessageTrace } from '../_components/ViewMessageTrace/ViewMessageTrace';

function LatestMessagesTable() {
  const t = useTranslations('pages/projects/observability/tool-errors');
  const [limit, setLimit] = useState(0);
  const [offset, setOffset] = useState(0);

  const { startDate, endDate } = useObservabilityContext();
  const { id: projectId, slug } = useCurrentProject();

  const { data } = webApi.observability.getToolErrorMessages.useQuery({
    queryKey: webApiQueryKeys.observability.getToolErrorMessages({
      projectId,
      startDate,
      endDate,
      limit,
      offset,
    }),
    queryData: {
      query: {
        projectId,
        startDate,
        offset,
        limit,
        endDate,
      },
    },
    enabled: !!limit,
  });

  const { formatDateAndTime } = useFormatters();

  const columns: Array<ColumnDef<GetToolErrorMessagesItemType>> = useMemo(
    () => [
      {
        accessorKey: 'createdAt',
        meta: {
          style: {
            width: '150px',
          },
        },
        header: t('table.columns.createdAt'),
        cell: ({ row }) => formatDateAndTime(row.original.createdAt),
      },
      {
        accessorKey: 'toolName',
        header: t('table.columns.toolName'),
      },
      {
        accessorKey: 'agentId',
        header: t('table.columns.agent'),
        cell: ({ row }) => (
          <HStack border inline paddingX="small" align="center" gap="text">
            <MiddleTruncate visibleStart={4} visibleEnd={10}>
              {row.original.agentId}
            </MiddleTruncate>
            <CopyButton
              size="xsmall"
              hideLabel
              copyButtonText={t('table.actions.copyAgentId')}
              textToCopy={row.original.agentId}
            />
            <Button
              label={t('table.actions.viewAgent')}
              color="tertiary"
              hideLabel
              preIcon={<LettaInvaderIcon />}
              square
              size="xsmall"
              href={`/projects/${slug}/agents/${row.original.agentId}`}
            />
          </HStack>
        ),
      },
      {
        id: 'actions',
        header: t('table.columns.actions'),
        meta: {
          style: {
            columnAlign: 'right',
          },
        },
        cell: ({ row }) => {
          return (
            <ViewMessageTrace
              trigger={
                <Button
                  label={t('table.actions.exploreMessage')}
                  color="secondary"
                  size="small"
                />
              }
              traceId={row.original.traceId}
            />
          );
        },
      },
    ],
    [formatDateAndTime, slug, t],
  );

  return (
    <DataTable
      data={data?.body.items || []}
      columns={columns}
      isLoading={!data}
      showPagination
      hasNextPage={data?.body.hasNextPage}
      autofitHeight
      offset={offset}
      onLimitChange={setLimit}
      limit={limit}
      onSetOffset={setOffset}
    />
  );
}

export default function TimeToFirstTokenPage() {
  const t = useTranslations('pages/projects/observability/tool-errors');

  return (
    <ObservabilityExplorerPageWrapper
      table={<LatestMessagesTable />}
      chart={<ToolErrorsChart />}
      info={t('description')}
      pageTitle={t('title')}
      tableTitle={t('table.title')}
    />
  );
}
