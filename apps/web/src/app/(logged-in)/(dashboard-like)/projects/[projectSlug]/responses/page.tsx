'use client';
import React, { useMemo, useState } from 'react';
import {
  Badge,
  Button,
  DashboardPageLayout,
  DashboardPageSection,
  DataTable,
  Tooltip,
} from '@letta-cloud/ui-component-library';
import { useTranslations } from '@letta-cloud/translations';
import { useCurrentProject } from '$web/client/hooks/useCurrentProject/useCurrentProject';
import type { ParentSpanResponseType } from '@letta-cloud/sdk-web';
import { webApi, webApiQueryKeys } from '@letta-cloud/sdk-web';
import type { ColumnDef } from '@tanstack/react-table';
import { useFormatters } from '@letta-cloud/utils-client';
import { ViewMessageTrace } from '../observability/_components/ViewMessageTrace/ViewMessageTrace';

export default function ResponsesPage() {
  const { id: projectId } = useCurrentProject();
  const [limit, setLimit] = useState(0);
  const [offset, setOffset] = useState(0);

  const { data, isError } = webApi.observability.getTracesByProjectId.useQuery({
    queryKey: webApiQueryKeys.observability.getTracesByProjectId({
      projectId,
      offset,
      limit,
    }),
    queryData: {
      query: {
        projectId,
        offset,
        limit,
      },
    },
    enabled: !!limit,
  });

  const { formatDateAndTime, formatSmallDuration } = useFormatters();

  const t = useTranslations('projects/(projectSlug)/responses/page');

  const columns: Array<ColumnDef<ParentSpanResponseType>> = useMemo(
    () => [
      {
        id: 'timestamp',
        accessorKey: 'createdAt',
        header: t('columns.timestamp'),
        cell: ({ row }) => {
          return formatDateAndTime(row.original?.createdAt || '');
        },
      },
      {
        id: 'status',
        accessorKey: 'executionStatus',
        header: t('columns.status'),
        cell: ({ row }) => {
          if (row.original.requestStatus === 'error') {
            return (
              <Tooltip content={t('statuses.requestFailed.tooltip')}>
                <Badge
                  content={t('statuses.requestFailed.label')}
                  variant="destructive"
                />
              </Tooltip>
            );
          }

          if (row.original.executionStatus === 'error') {
            return (
              <Tooltip content={t('statuses.executionFailed.tooltip')}>
                <Badge
                  content={t('statuses.executionFailed.label')}
                  variant="destructive"
                />
              </Tooltip>
            );
          }

          return (
            <Badge content={t('statuses.success.label')} variant="success" />
          );
        },
      },
      {
        id: 'agent',
        accessorKey: 'agentId',
        header: t('columns.agent'),
      },

      {
        id: 'duration',
        accessorKey: 'duration',
        header: t('columns.duration'),
        cell: ({ row }) => {
          return formatSmallDuration(row.original?.durationNs || 0);
        },
      },
      {
        id: 'actions',
        header: t('columns.actions'),
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
                  label={t('actions.exploreMessage')}
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
    [formatDateAndTime, formatSmallDuration, t],
  );

  return (
    <DashboardPageLayout title={t('title')} encapsulatedFullHeight>
      <DashboardPageSection fullHeight>
        <DataTable
          isLoading={!data}
          limit={limit}
          offset={offset}
          hasNextPage={data?.body.hasNextPage}
          onSetOffset={setOffset}
          showPagination
          autofitHeight
          errorMessage={isError ? t('errorMessage') : undefined}
          loadingText={t('loadingMessage')}
          onLimitChange={setLimit}
          columns={columns}
          data={data?.body.items || []}
        />
      </DashboardPageSection>
    </DashboardPageLayout>
  );
}
