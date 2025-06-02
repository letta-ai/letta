'use client';
import { useTranslations } from '@letta-cloud/translations';
import { TimeToFirstTokenChart } from '../_components/charts/TimeToFirstTokenChart/TimeToFirstTokenChart';
import {
  Button,
  Code,
  CopyButton,
  DataTable,
  Dialog,
  ExpandContentIcon,
  HStack,
  MiddleTruncate,
} from '@letta-cloud/ui-component-library';
import type { TimeToFirstTokenMessageItemType } from '@letta-cloud/sdk-web';
import { webApi, webApiQueryKeys } from '@letta-cloud/sdk-web';
import { useMemo, useState } from 'react';
import { useObservabilityContext } from '../_components/hooks/useObservabilityContext/useObservabilityContext';
import { useCurrentProject } from '$web/client/hooks/useCurrentProject/useCurrentProject';
import type { ColumnDef } from '@tanstack/react-table';
import { useFormatters } from '@letta-cloud/utils-client';
import { ObservabilityExplorerPageWrapper } from '../_components/ObservabilityExplorerPageWrapper/ObservabilityExplorerPageWrapper';

function LatestMessagesTable() {
  const t = useTranslations('pages/projects/observability/timeToFirstToken');
  const [limit, setLimit] = useState(0);
  const [offset, setOffset] = useState(0);

  const { startDate, endDate } = useObservabilityContext();
  const { id: projectId, slug } = useCurrentProject();

  const { data } = webApi.observability.getTimeToFirstTokenMessages.useQuery({
    queryKey: webApiQueryKeys.observability.getTimeToFirstTokenMessages({
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

  const { formatSmallDuration, formatDateAndTime } = useFormatters();

  const columns: Array<ColumnDef<TimeToFirstTokenMessageItemType>> = useMemo(
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
        accessorKey: 'timeToFirstTokenNs',
        header: t('table.columns.timeToFirstToken'),
        meta: {
          style: {
            width: '150px',
          },
        },
        cell: ({ row }) => {
          const timeToFirstToken = row.original.timeToFirstTokenNs;
          return timeToFirstToken
            ? formatSmallDuration(timeToFirstToken)
            : t('table.notAvailable');
        },
      },
      {
        accessorKey: 'messages',
        header: t('table.columns.message'),
        cell: ({ row }) => (
          <Dialog
            title={t('table.columns.message')}
            hideConfirm
            trigger={
              <HStack
                as="button"
                /* eslint-disable-next-line react/forbid-component-props */
                className="inline-flex"
                paddingX="xxsmall"
                gap="small"
                justify="spaceBetween"
                color="background-grey"
                border
              >
                <MiddleTruncate visibleStart={25} visibleEnd={25}>
                  {JSON.stringify(row.original.messages)}
                </MiddleTruncate>
                <ExpandContentIcon />
              </HStack>
            }
          >
            <Code
              showLineNumbers={false}
              fontSize="small"
              language="javascript"
              code={JSON.stringify(row.original.messages, null, 2)}
            />
          </Dialog>
        ),
      },
      {
        accessorKey: 'agentId',
        header: t('table.columns.agent'),
        cell: ({ row }) => (
          <HStack align="center" gap="small">
            <MiddleTruncate visibleStart={4} visibleEnd={6}>
              {row.original.agentId}
            </MiddleTruncate>
            <CopyButton
              size="small"
              hideLabel
              textToCopy={row.original.agentId}
            />
          </HStack>
        ),
      },
      {
        id: 'actions',
        header: t('table.columns.actions'),
        cell: ({ row }) => {
          return (
            <Button
              label={t('table.actions.viewAgent')}
              color="secondary"
              size="small"
              href={`/projects/${slug}/agents/${row.original.agentId}`}
            />
          );
        },
      },
    ],
    [formatDateAndTime, formatSmallDuration, slug, t],
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
  const t = useTranslations('pages/projects/observability/timeToFirstToken');

  return (
    <ObservabilityExplorerPageWrapper
      table={<LatestMessagesTable />}
      chart={<TimeToFirstTokenChart />}
      info={t('description')}
      pageTitle={t('title')}
      tableTitle={t('table.title')}
    />
  );
}
