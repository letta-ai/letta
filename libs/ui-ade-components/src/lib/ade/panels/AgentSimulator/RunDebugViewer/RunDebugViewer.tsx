'use client';
import { useTranslations } from '@letta-cloud/translations';
import {
  RunsService,
  type Run,
  type ListRunsResponse,
  useAgentsServiceCancelAgentRun,
} from '@letta-cloud/sdk-core';
import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Badge,
  Button, CancelIcon, ChevronDownIcon,
  HStack,
  LettaLoader,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Typography,
  VStack
} from '@letta-cloud/ui-component-library';
import { useInfiniteQuery } from '@tanstack/react-query';
import type { InfiniteData } from '@tanstack/query-core';
import { useCurrentAgent } from '../../../../hooks';
import { useFormatters } from '@letta-cloud/utils-client';
import { useAtom } from 'jotai/index';
import { showRunDebuggerAtom } from '@letta-cloud/ui-ade-components';

const UseInfiniteRunsQueryFn = (params: any[]) => ['runs', ...params];

interface CancelRunButtonProps {
  runId: string;
  agentId: string;
  isRunning: boolean;
}

function CancelRunButton(props: CancelRunButtonProps) {
  const { runId, agentId, isRunning } = props;
  const t = useTranslations('RunDebugViewer');

  const { mutate: cancelRun, isPending } = useAgentsServiceCancelAgentRun();

  const handleCancel = () => {
    cancelRun({
      agentId,
      requestBody: {
        run_ids: [runId],
      },
    });
  };

  if (!isRunning) {
    return null;
  }

  return (
    <Button
      size="3xsmall"
      color="tertiary"
      hideLabel
      preIcon={<CancelIcon color="lighter" />}
      onClick={handleCancel}
      busy={isPending}
      label={isPending ? t('cancelRun.cancelling') : t('cancelRun.cancel')}
    />
  );
}

interface StatusCellProps {
  status?: string;
}

function StatusCell(props: StatusCellProps) {
  const { status } = props;

  const getStatusVariant = (status?: string) => {
    switch (status) {
      case 'completed':
        return 'success';
      case 'failed':
      case 'error':
        return 'destructive';
      case 'running':
      case 'in_progress':
        return 'info';
      case 'cancelled':
        return 'warning';
      default:
        return 'default';
    }
  };

  return (
    <Badge size="small" content={status || 'unknown'} variant={getStatusVariant(status)} />
  );
}

interface DurationCellProps {
  durationNs?: number | null;
}

function DurationCell(props: DurationCellProps) {
  const { durationNs } = props;
  const { formatSmallDuration } = useFormatters();

  if (!durationNs) return <Typography variant="body4">-</Typography>;

  return (
    <Typography variant="body4">{formatSmallDuration(durationNs)}</Typography>
  );
}

interface DateCellProps {
  date?: string | null;
}

function DateCell(props: DateCellProps) {
  const { date } = props;

  if (!date) return <Typography variant="body4">-</Typography>;

  const formattedDate = new Date(date).toLocaleString();
  return <Typography variant="body4">{formattedDate}</Typography>;
}

const limit = 3;

interface RunDebugViewerTableProps {
  data: Run[];
  agentId: string;
}

function RunDebugViewerTable(props: RunDebugViewerTableProps) {
  const { data, agentId } = props;

  const t = useTranslations('RunDebugViewer');

  if (data.length === 0) {
    return (
      <VStack align="center" padding fullWidth>
        <Typography variant="body4" color="muted">
          {t('table.noResults')}
        </Typography>
      </VStack>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>
            <Typography variant="body4">{t('columns.status')}</Typography>
          </TableHead>
          <TableHead>
            <Typography variant="body4">{t('columns.stopReason')}</Typography>
          </TableHead>
          <TableHead>
            <Typography variant="body4">{t('columns.duration')}</Typography>
          </TableHead>
          <TableHead>
            <Typography variant="body4">{t('columns.completedAt')}</Typography>
          </TableHead>
          <TableHead>
            <Typography variant="body4">{t('columns.createdAt')}</Typography>
          </TableHead>
          <TableHead>
            <Typography variant="body4">{t('columns.jobType')}</Typography>
          </TableHead>
          <TableHead>
            <Typography variant="body4">{t('columns.runId')}</Typography>
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {data.map((run, index) => (
          <TableRow key={run.id || index}>
            <TableCell size="compact">
              <HStack align="center">

                <StatusCell status={run.status} />
                <CancelRunButton
                  runId={run.id || ''}
                  agentId={agentId}
                  isRunning={run.status === 'running'}
                />
              </HStack>
            </TableCell>
            <TableCell size="compact">
              <Typography variant="body4">{run.stop_reason || '-'}</Typography>
            </TableCell>
            <TableCell size="compact">
              <DurationCell durationNs={run.total_duration_ns} />
            </TableCell>
            <TableCell size="compact">
              <DateCell date={run.completed_at} />
            </TableCell>
            <TableCell size="compact">
              <DateCell date={run.created_at} />
            </TableCell>
            <TableCell size="compact">
              <Typography variant="body4">{run.id}</Typography>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function RunDebugViewerWrapper() {
  const { id: agentId } = useCurrentAgent();
  const t = useTranslations('RunDebugViewer');

  const [page, setPage] = useState<number>(0);

  const { data, isFetchingNextPage, isError, fetchNextPage } = useInfiniteQuery<
    ListRunsResponse,
    unknown,
    InfiniteData<ListRunsResponse>,
    unknown[],
    { before?: string | null }
  >({
    queryKey: UseInfiniteRunsQueryFn([
      {
        agentIds: agentId ? [agentId] : [],
        limit: limit + 1,
      },
    ]),
    queryFn: ({ pageParam }) => {
      return RunsService.listRuns({
        agentIds: agentId ? [agentId] : [],
        limit: limit + 1,
        before: pageParam?.before,
      });
    },
    refetchInterval: 1000,
    initialPageParam: { before: null },
    getNextPageParam: (lastPage) => {
      if (lastPage.length > limit) {
        return {
          before: lastPage[lastPage.length - 2].id,
        };
      }
      return undefined;
    },
    enabled: !!agentId && !!limit,
  });

  useEffect(() => {
    if (!data?.pages) {
      return;
    }

    if (page === data.pages.length) {
      void fetchNextPage();
    }
  }, [page, data, fetchNextPage]);

  const hasNextPage = useMemo(() => {
    if (!data?.pages?.[page]) {
      return false;
    }

    return data.pages[page].length > limit;
  }, [data, page]);

  const filteredData = useMemo(() => {
    if (!data) {
      return [];
    }

    return data.pages?.[page]?.slice(0, limit) || [];
  }, [data, page]);

  const isLoadingPage = useMemo(() => {
    if (!data) {
      return true;
    }

    if (isFetchingNextPage && !data.pages[page]) {
      return true;
    }

    return false;
  }, [data, isFetchingNextPage, page]);

  const [_, setShowRunDebugger] = useAtom(showRunDebuggerAtom);

  if (!agentId) {
    return null;
  }

  if (isError) {
    return <Alert title={t('table.error')} variant="destructive" />;
  }

  if (isLoadingPage) {
    return (
      <VStack color="background" align="center" fullWidth padding>
        <LettaLoader variant="grower" size="large" />
      </VStack>
    );
  }

  return (
    <VStack gap={false} fullWidth>
      {isLoadingPage ? (
        <VStack color="background" align="center" fullWidth padding>
          <LettaLoader variant="grower" size="large" />
        </VStack>
      ) : (
        <RunDebugViewerTable data={filteredData} agentId={agentId || ''} />
      )}
      <HStack paddingX="xxsmall" paddingBottom="xxsmall" align="center" justify="spaceBetween" fullWidth>
        <HStack align="center" padding="small" fullWidth justify="spaceBetween">


        </HStack>
        <HStack>
          <Button
            size="xsmall"
            color="secondary"
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={page === 0 || isLoadingPage}
            label={t('table.previous')}
          />
          <Button
            size="xsmall"
            color="secondary"
            onClick={() => {
              if (hasNextPage) {
                setPage((p) => p + 1);
              }
            }}
            disabled={!hasNextPage || isLoadingPage}
            label={t('table.next')}
          />
          <Button
            size="xsmall"
            color="secondary"
            postIcon={<ChevronDownIcon />}
            onClick={() => setShowRunDebugger(false)}
            label={t('close')}
          />
        </HStack>
      </HStack>
    </VStack>
  );
}

export function RunDebugViewer() {
  return (
    <VStack paddingX="small">
      <VStack  border gap={false}>

        <RunDebugViewerWrapper />
      </VStack>
    </VStack>
  );
}
